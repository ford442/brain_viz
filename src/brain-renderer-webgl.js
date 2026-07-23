import { BrainGeometry } from './brain-geometry.js';
import { Mat4 } from './math-utils.js';
import { meshVertexSource, meshFragmentSource, pointVertexSource, pointFragmentSource } from './webgl-shaders.js';
import { clamp01, mix, smoothstep, createDefaultParams, createProgram } from './webgl-gl-utils.js';

const BRAIN_RANGE = 1.6;

export class BrainRendererWebGL {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.backendType = 'webgl';
        this.usingWebGL = true;
        this.usingWebGPU = false;
        this.device = null;
        this.context = null;
        this.rendererFallbackReason = null;

        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        this.targetZoom = 3.5;
        this.fov = Math.PI / 4;
        this.targetFov = Math.PI / 4;
        this.camera = { zoom: this.zoom };
        this.time = 0;
        this.isRunning = false;
        this.tensorPlaybackMode = false;
        this.geometryRows = 80;
        this.geometryCols = 50;
        this.geometryDirty = false;
        this.geometryRebuildIntervalMs = 80;
        this.lastGeometryRebuildTime = 0;
        this.lastGeometryGenerationMs = 0;
        this.wasmMode = false;
        this.params = createDefaultParams();
        this.voxelDim = 32;
        this.voxelCount = this.voxelDim * this.voxelDim * this.voxelDim;
        this._lastHumanTensor = new Float32Array(this.voxelCount);
        this._lastAITensor = new Float32Array(this.voxelCount);
        this._nextHumanTensor = new Float32Array(this.voxelCount);
        this._altitudeInternal = {
            activationTime: 0,
            lastAltitude: 0.0
        };
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0,
            electricalActive: 0.0,
            mercuryActive: 0.0
        };
        this.debugOptions = {
            wireframe: false,
            tensorField: true,
            isolate: 'all'
        };

        this.geometry = null;
        this.baseVertices = null;
        this.baseNormals = null;
        this.baseIndices = null;
        this.baseFiberVertices = null;
        this.baseFiberPaths = null;
        this.baseFiberMeta = null;
        this.baseSomaInstances = null;
        this.fiberAffinityData = null;
        this.tensorPointPositions = null;
        this.tensorPointColorSize = null;
        this.meshPositions = null;
        this.meshColors = null;
        this.fiberColors = null;
        this.somaColorSize = null;

        this.meshProgram = null;
        this.pointProgram = null;
        this.meshVao = null;
        this.wireVao = null;
        this.fiberVao = null;
        this.tensorVao = null;
        this.somaVao = null;
        this.meshBuffers = {};
        this.frameHandle = null;

        this.setupInputHandlers();
    }

    setupInputHandlers() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        this.canvas.addEventListener('mousedown', (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; });
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                this.targetRotation.y += (e.clientX - lastX) * 0.01;
                this.targetRotation.x += (e.clientY - lastY) * 0.01;
                this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x));
                lastX = e.clientX;
                lastY = e.clientY;
            }
        });
        this.canvas.addEventListener('mouseup', () => { isDragging = false; });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.targetZoom = Math.max(2, Math.min(10, this.targetZoom + e.deltaY * 0.01));
        });
    }

    setCameraParams({ rotation, zoom, fov }) {
        if (rotation) {
            if (rotation.x !== undefined) this.targetRotation.x = rotation.x;
            if (rotation.y !== undefined) this.targetRotation.y = rotation.y;
        }
        if (zoom !== undefined) {
            this.targetZoom = Math.max(2, Math.min(10, zoom));
        }
        if (fov !== undefined) {
            this.targetFov = Math.max(0.1, Math.min(Math.PI - 0.1, fov));
        }
    }

    async initialize() {
        const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true, xrCompatible: true });
        if (!gl) {
            throw new Error('WebGL2 is unavailable in this browser.');
        }
        this.gl = gl;
        this.context = gl;

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        this.meshProgram = createProgram(gl, meshVertexSource, meshFragmentSource);
        this.pointProgram = createProgram(gl, pointVertexSource, pointFragmentSource);

        this.buildAndUploadGeometry();
        this.buildTensorDebugGrid();
        this.resize();
    }

    buildGeometry() {
        const geometry = new BrainGeometry({
            baseRadius: 1.5,
            foldScale: this.params.foldScale,
            foldStrength: this.params.foldStrength,
            fissureDepth: this.params.fissureDepth,
            lobeFoldBias: this.params.lobeFoldBias,
            corticalThickness: this.params.corticalThickness,
            growth: this.params.growth,
            fiberSymmetry: this.params.fiberSymmetry,
            bundleCoherence: this.params.bundleCoherence
        });
        geometry.generate(this.geometryRows, this.geometryCols);
        return geometry;
    }

    buildAndUploadGeometry() {
        const gl = this.gl;
        const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
        this.geometry = this.buildGeometry();
        this.baseVertices = this.geometry.getVertexData();
        const paddedNormals = this.geometry.getNormalData();
        this.baseNormals = new Float32Array(paddedNormals.length / 4 * 3);
        for (let i = 0, j = 0; i < paddedNormals.length; i += 4, j += 3) {
            this.baseNormals[j + 0] = paddedNormals[i + 0];
            this.baseNormals[j + 1] = paddedNormals[i + 1];
            this.baseNormals[j + 2] = paddedNormals[i + 2];
        }
        this.baseIndices = this.geometry.getIndexData();
        this.baseFiberVertices = this.geometry.getFiberData();
        this.baseFiberPaths = this.geometry.getFiberPathData();
        this.baseFiberMeta = this.geometry.getFiberDataWithMetadata();
        this.baseSomaInstances = this.geometry.getSomaInstanceData();
        this.fiberAffinityData = this.geometry.getFiberAffinityData();

        this.meshPositions = new Float32Array(this.baseVertices);
        this.meshColors = new Float32Array(this.baseVertices.length);
        this.fiberColors = new Float32Array(this.baseFiberVertices.length);
        this.somaColorSize = new Float32Array((this.baseSomaInstances.length / 9) * 4);

        const wireIndices = new Uint32Array(this.baseIndices.length * 2);
        for (let i = 0, w = 0; i < this.baseIndices.length; i += 3) {
            const a = this.baseIndices[i + 0];
            const b = this.baseIndices[i + 1];
            const c = this.baseIndices[i + 2];
            wireIndices[w++] = a; wireIndices[w++] = b;
            wireIndices[w++] = b; wireIndices[w++] = c;
            wireIndices[w++] = c; wireIndices[w++] = a;
        }

        this.meshBuffers.position = gl.createBuffer();
        this.meshBuffers.color = gl.createBuffer();
        this.meshBuffers.index = gl.createBuffer();
        this.meshBuffers.wireIndex = gl.createBuffer();
        this.meshBuffers.fiberPosition = gl.createBuffer();
        this.meshBuffers.fiberColor = gl.createBuffer();
        this.meshBuffers.somaPosition = gl.createBuffer();
        this.meshBuffers.somaColorSize = gl.createBuffer();

        this.meshVao = gl.createVertexArray();
        gl.bindVertexArray(this.meshVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, this.meshPositions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, this.meshColors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.baseIndices, gl.STATIC_DRAW);

        this.wireVao = gl.createVertexArray();
        gl.bindVertexArray(this.wireVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffers.wireIndex);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);
        this.wireIndexCount = wireIndices.length;

        this.fiberVao = gl.createVertexArray();
        gl.bindVertexArray(this.fiberVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberPosition);
        gl.bufferData(gl.ARRAY_BUFFER, this.baseFiberVertices, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberColor);
        gl.bufferData(gl.ARRAY_BUFFER, this.fiberColors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

        const somaCount = this.baseSomaInstances.length / 9;
        const somaPositions = new Float32Array(somaCount * 3);
        for (let i = 0; i < somaCount; i++) {
            somaPositions[i * 3 + 0] = this.baseSomaInstances[i * 9 + 0];
            somaPositions[i * 3 + 1] = this.baseSomaInstances[i * 9 + 1];
            somaPositions[i * 3 + 2] = this.baseSomaInstances[i * 9 + 2];
        }
        this.somaVao = gl.createVertexArray();
        gl.bindVertexArray(this.somaVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaPosition);
        gl.bufferData(gl.ARRAY_BUFFER, somaPositions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaColorSize);
        gl.bufferData(gl.ARRAY_BUFFER, this.somaColorSize, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);

        this.geometryDirty = false;
        this.lastGeometryRebuildTime = typeof performance !== 'undefined' ? performance.now() : 0;
        this.lastGeometryGenerationMs = startedAt ? this.lastGeometryRebuildTime - startedAt : 0;
    }

    buildTensorDebugGrid() {
        const pointCount = this.voxelCount;
        this.tensorPointPositions = new Float32Array(pointCount * 3);
        this.tensorPointColorSize = new Float32Array(pointCount * 4);
        const dim = this.voxelDim;
        let ptr = 0;
        for (let z = 0; z < dim; z++) {
            for (let y = 0; y < dim; y++) {
                for (let x = 0; x < dim; x++) {
                    this.tensorPointPositions[ptr * 3 + 0] = ((x / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                    this.tensorPointPositions[ptr * 3 + 1] = ((y / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                    this.tensorPointPositions[ptr * 3 + 2] = ((z / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                    ptr++;
                }
            }
        }

        const gl = this.gl;
        this.meshBuffers.tensorPosition = gl.createBuffer();
        this.meshBuffers.tensorColorSize = gl.createBuffer();
        this.tensorVao = gl.createVertexArray();
        gl.bindVertexArray(this.tensorVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorPosition);
        gl.bufferData(gl.ARRAY_BUFFER, this.tensorPointPositions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorColorSize);
        gl.bufferData(gl.ARRAY_BUFFER, this.tensorPointColorSize, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);
    }

    resize() {
        const gl = this.gl;
        const load = Math.max(0, Math.min(1, this.params.cognitiveLoad));
        const scale = Math.max(0.1, 1.0 - load);
        const targetWidth = Math.max(1, Math.floor(this.canvas.clientWidth * scale));
        const targetHeight = Math.max(1, Math.floor(this.canvas.clientHeight * scale));
        if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
        }
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    setParams(newParams) {
        const geometryKeys = ['foldScale', 'foldStrength', 'fissureDepth', 'lobeFoldBias', 'corticalThickness', 'growth', 'fiberSymmetry', 'bundleCoherence'];
        const geometryChanged = geometryKeys.some((key) => newParams[key] !== undefined && newParams[key] !== this.params[key]);
        this.params = { ...this.params, ...newParams };
        if (geometryChanged) {
            this.geometryDirty = true;
        }
    }

    setSynaptiXParams(newParams) {
        this.setParams(newParams);
    }

    setDebugOptions(newOptions) {
        this.debugOptions = { ...this.debugOptions, ...newOptions };
    }

    getDebugOptions() {
        return { ...this.debugOptions };
    }

    updateAltitudeState() {
        const alt = this.params.altitude || 0.0;
        const altFraction = Math.min(1.0, alt / 8000);
        this.params.oxygenLevel = Math.max(0.35, 1.0 - (altFraction * 0.65));
        let stressCurve = 0.0;
        if (altFraction > 0.5) {
            stressCurve = 1.0 / (1.0 + Math.exp(-10 * (altFraction - 0.5)));
        }
        if (alt > this._altitudeInternal.lastAltitude) {
            this._altitudeInternal.activationTime += 1;
        } else if (alt < this._altitudeInternal.lastAltitude) {
            this._altitudeInternal.activationTime = Math.max(0, this._altitudeInternal.activationTime - 2);
        }
        this.params.hypoxiaStress = clamp01(stressCurve * (0.65 + this._altitudeInternal.activationTime / 600.0));
        this.params.metabolicRate = 1.0 + (this.params.hypoxiaStress * 1.0);
        if (this.params.hypoxiaStress > 0.5) {
            const sustainedPenalty = Math.max(0.3, 1.0 - (this._altitudeInternal.activationTime / 1800.0));
            this.params.mitochondrialFunction = Math.max(0.35, sustainedPenalty);
        } else {
            this.params.mitochondrialFunction = 1.0 - this.params.hypoxiaStress * 0.4;
        }
        this._altitudeInternal.lastAltitude = alt;
    }

    injectStimulus(targetX, targetY, targetZ, intensity) {
        const BOUNDARY_LIMIT = 1.45;
        if ([targetX, targetY, targetZ, intensity].some((val) => isNaN(val))) {
            return;
        }
        this.stimulus.pos = [
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetX)),
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetY)),
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetZ))
        ];
        this.stimulus.active = Math.max(0.0, intensity);
    }

    injectElectrical(intensity) {
        if (isNaN(intensity)) return;
        this.stimulus.electricalActive = Math.max(0.0, intensity);
    }

    injectMercury(intensity) {
        if (isNaN(intensity)) return;
        this.stimulus.mercuryActive = Math.max(0.0, intensity);
    }

    calmState() {
        this.params.frequency = 2.0;
        this.params.amplitude = 0.5;
        this.params.smoothing = 0.9;
        this.params.colorShift = 0.0;
        this.params.sparkle = 0.0;
        this.params.pointCloudDensity = 1.0;
        this.params.fiberCoupling = 0.5;
        this.params.shake = 0.0;
        this.params.stress = 0.0;
        this.params.cortisol = 0.0;
        this.params.heavyMetal = 0.0;
        this.params.cognitiveLoad = 0.0;
        this.params.fluidActive = 0.0;
        this.params.immuneActivity = 0.0;
        this.params.fogDensity = 0.0;
        this.params.aberration = 0.0;
        this.params.grain = 0.0;
        this.params.focus = 0.5;
        this.params.aperture = 0.0;
        this.params.ambientLight = 0.2;
        this.params.dirIntensity = 0.8;
        this.params.lightDirX = 1.0;
        this.params.lightDirY = 1.0;
        this.params.lightDirZ = 1.0;
    }

    resetActivity() {
        this._lastHumanTensor.fill(0);
        this._lastAITensor.fill(0);
    }

    async enableWasmMode() {
        console.warn('[BrainRendererWebGL] WASM compute mode is unavailable in the WebGL fallback.');
        return false;
    }

    disableWasmMode() {
        this.wasmMode = false;
    }

    runWasmBenchmark() {
        return null;
    }

    sampleField(worldPos, useAI = false) {
        const tensor = useAI ? this._lastAITensor : this._lastHumanTensor;
        const normalizedX = clamp01((worldPos[0] / BRAIN_RANGE) * 0.5 + 0.5);
        const normalizedY = clamp01((worldPos[1] / BRAIN_RANGE) * 0.5 + 0.5);
        const normalizedZ = clamp01((worldPos[2] / BRAIN_RANGE) * 0.5 + 0.5);
        const x = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedX * this.voxelDim)));
        const y = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedY * this.voxelDim)));
        const z = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedZ * this.voxelDim)));
        return tensor[z * this.voxelDim * this.voxelDim + y * this.voxelDim + x];
    }

    computeResonance(humanVal, aiVal) {
        return 1.0 - smoothstep(0.0, this.params.resonanceThreshold || 0.2, Math.abs(humanVal - aiVal));
    }

    getFieldColor(humanVal, aiVal, position, style) {
        const resonance = this.computeResonance(humanVal, aiVal);
        const shift = this.params.colorShift || 0.0;
        if (style >= 4.0) {
            const humanColor = [
                mix(0.05, 0.35, humanVal),
                mix(0.65, 0.95, humanVal),
                mix(0.95, 0.4, humanVal)
            ];
            const aiColor = [
                mix(0.65, 1.0, aiVal),
                mix(0.1, 0.25, aiVal),
                mix(0.75, 1.0, aiVal)
            ];
            return [
                mix(humanColor[0], aiColor[0], this.params.aiInfluence * 0.7) + resonance * 0.15,
                mix(humanColor[1], aiColor[1], this.params.aiInfluence * 0.7) + resonance * 0.08,
                mix(humanColor[2], aiColor[2], this.params.aiInfluence * 0.7) + resonance * 0.2
            ];
        }
        if (style >= 3.0) {
            return [
                clamp01(humanVal * 1.6 + shift * 0.3),
                clamp01(humanVal * 0.9 + 0.1),
                clamp01(1.0 - humanVal * 0.75)
            ];
        }
        if (style >= 2.0) {
            return [
                clamp01(0.1 + humanVal * 0.9 + shift * 0.3),
                clamp01(0.55 + humanVal * 0.45),
                clamp01(0.35 + humanVal * 0.6)
            ];
        }
        if (style >= 1.0) {
            return [
                clamp01(0.08 + humanVal * 0.7 + Math.abs(position[1]) * 0.1),
                clamp01(0.85 + humanVal * 0.15),
                clamp01(0.92 + shift * 0.08)
            ];
        }
        return [
            clamp01(0.12 + humanVal * 0.15 + shift * 0.4),
            clamp01(0.38 + humanVal * 0.6),
            clamp01(0.52 + humanVal * 0.45)
        ];
    }

    updateTensorSimulation() {
        const dim = this.voxelDim;
        const current = this._lastHumanTensor;
        const next = this._nextHumanTensor;
        const amplitude = this.params.amplitude || 0;
        const smoothing = this.params.smoothing || 0;
        const coupling = this.params.fiberCoupling || 0;
        const style = this.params.style || 0;
        const time = this.time;
        const wave = Math.sin(time * (this.params.frequency || 1.0)) * 0.5 + 0.5;
        const stimulusRadius = 0.22 + coupling * 0.16;

        for (let z = 0; z < dim; z++) {
            for (let y = 0; y < dim; y++) {
                for (let x = 0; x < dim; x++) {
                    const idx = z * dim * dim + y * dim + x;
                    const xm = Math.max(0, x - 1);
                    const xp = Math.min(dim - 1, x + 1);
                    const ym = Math.max(0, y - 1);
                    const yp = Math.min(dim - 1, y + 1);
                    const zm = Math.max(0, z - 1);
                    const zp = Math.min(dim - 1, z + 1);
                    const avg = (
                        current[z * dim * dim + y * dim + xm] +
                        current[z * dim * dim + y * dim + xp] +
                        current[z * dim * dim + ym * dim + x] +
                        current[z * dim * dim + yp * dim + x] +
                        current[zm * dim * dim + y * dim + x] +
                        current[zp * dim * dim + y * dim + x]
                    ) / 6;

                    const worldX = ((x / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                    const worldY = ((y / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                    const worldZ = ((z / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                    let tractBias = 0.0;
                    let coverage = 0.0;
                    const affinityBase = idx * 12;
                    for (let slot = 0; slot < 3; slot++) {
                        const weight = this.fiberAffinityData[affinityBase + slot * 4 + 3];
                        if (weight <= 0.01) continue;
                        const dx = this.fiberAffinityData[affinityBase + slot * 4 + 0];
                        const dy = this.fiberAffinityData[affinityBase + slot * 4 + 1];
                        const dz = this.fiberAffinityData[affinityBase + slot * 4 + 2];
                        const step = BRAIN_RANGE / dim;
                        const ahead = this.sampleField([worldX + dx * step, worldY + dy * step, worldZ + dz * step]);
                        const behind = this.sampleField([worldX - dx * step, worldY - dy * step, worldZ - dz * step]);
                        tractBias += Math.max(ahead, behind) * weight;
                        coverage += weight;
                    }
                    if (coverage > 0) {
                        tractBias /= coverage;
                    }

                    const radial = Math.sqrt(worldX * worldX + worldY * worldY + worldZ * worldZ) / BRAIN_RANGE;
                    const corticalBias = 1.0 - smoothstep(0.1, 0.95, radial);
                    let nextVal = mix(current[idx], avg, 0.14 + smoothing * 0.22);
                    nextVal = mix(nextVal, tractBias, coupling * (0.15 + coverage * 0.45));
                    nextVal += (wave - 0.5) * amplitude * (0.02 + corticalBias * 0.04);
                    nextVal -= current[idx] * (0.015 + this.params.hypoxiaStress * 0.025 + this.params.heavyMetal * 0.012);

                    if (this.stimulus.active > 0.0) {
                        const dx = worldX - this.stimulus.pos[0];
                        const dy = worldY - this.stimulus.pos[1];
                        const dz = worldZ - this.stimulus.pos[2];
                        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        nextVal += Math.exp(-(dist * dist) / (stimulusRadius * stimulusRadius)) * this.stimulus.active * 0.34;
                    }

                    if (this.stimulus.electricalActive > 0.0) {
                        nextVal += (Math.sin(time * 25.0 + worldX * 8.0 + worldY * 6.0) * 0.5 + 0.5) * this.stimulus.electricalActive * 0.06;
                    }
                    if (this.stimulus.mercuryActive > 0.0) {
                        nextVal *= Math.max(0.0, 1.0 - this.stimulus.mercuryActive * 0.03);
                    }
                    if (style >= 4.0) {
                        const aiVal = this._lastAITensor[idx];
                        nextVal += aiVal * this.params.aiInfluence * coupling * 0.04;
                    }

                    next[idx] = clamp01(nextVal);
                }
            }
        }

        current.set(next);
        this.stimulus.active = 0.0;
        this.stimulus.electricalActive = 0.0;
        this.stimulus.mercuryActive = 0.0;
    }

    updateDynamicBuffers() {
        const gl = this.gl;
        const style = this.params.style || 0;

        for (let i = 0; i < this.baseVertices.length; i += 3) {
            const pos = [this.baseVertices[i + 0], this.baseVertices[i + 1], this.baseVertices[i + 2]];
            const normal = [this.baseNormals[i + 0], this.baseNormals[i + 1], this.baseNormals[i + 2]];
            const humanVal = this.sampleField(pos, false);
            const aiVal = this.sampleField(pos, true);
            const resonance = this.computeResonance(humanVal, aiVal);
            const displacement = humanVal * (0.018 + this.params.amplitude * 0.05) + resonance * (style >= 4.0 ? 0.015 : 0.0);
            this.meshPositions[i + 0] = pos[0] + normal[0] * displacement;
            this.meshPositions[i + 1] = pos[1] + normal[1] * displacement;
            this.meshPositions[i + 2] = pos[2] + normal[2] * displacement;
            const color = this.getFieldColor(humanVal, aiVal, pos, style);
            this.meshColors[i + 0] = color[0];
            this.meshColors[i + 1] = color[1];
            this.meshColors[i + 2] = color[2];
        }

        for (let i = 0; i < this.baseFiberVertices.length; i += 3) {
            const pathIndex = (i / 3) * 6;
            const midpoint = [
                (this.baseFiberPaths[pathIndex + 0] + this.baseFiberPaths[pathIndex + 3]) * 0.5,
                (this.baseFiberPaths[pathIndex + 1] + this.baseFiberPaths[pathIndex + 4]) * 0.5,
                (this.baseFiberPaths[pathIndex + 2] + this.baseFiberPaths[pathIndex + 5]) * 0.5
            ];
            const humanVal = this.sampleField(midpoint, false);
            const aiVal = this.sampleField(midpoint, true);
            const resonance = this.computeResonance(humanVal, aiVal);
            const metaIndex = (i / 3) * 4;
            const myelin = clamp01(this.baseFiberMeta[metaIndex + 2] || 0.2);
            const baseColor = style >= 4.0
                ? [0.75 + resonance * 0.2, 0.35 + humanVal * 0.3, 0.95]
                : [0.1 + humanVal * 0.9, 0.65 + myelin * 0.2, 0.95 - myelin * 0.35];
            this.fiberColors[i + 0] = clamp01(baseColor[0]);
            this.fiberColors[i + 1] = clamp01(baseColor[1]);
            this.fiberColors[i + 2] = clamp01(baseColor[2]);
        }

        const somaCount = this.baseSomaInstances.length / 9;
        for (let i = 0; i < somaCount; i++) {
            const pos = [
                this.baseSomaInstances[i * 9 + 0],
                this.baseSomaInstances[i * 9 + 1],
                this.baseSomaInstances[i * 9 + 2]
            ];
            const humanVal = this.sampleField(pos, false);
            const aiVal = this.sampleField(pos, true);
            const resonance = this.computeResonance(humanVal, aiVal);
            const color = this.getFieldColor(humanVal, aiVal, pos, style);
            this.somaColorSize[i * 4 + 0] = color[0];
            this.somaColorSize[i * 4 + 1] = color[1];
            this.somaColorSize[i * 4 + 2] = color[2];
            this.somaColorSize[i * 4 + 3] = 3.0 + humanVal * 8.0 + resonance * 2.5;
        }

        for (let i = 0; i < this.voxelCount; i++) {
            const humanVal = this._lastHumanTensor[i];
            const aiVal = this._lastAITensor[i];
            const color = this.getFieldColor(humanVal, aiVal, [0, 0, 0], style >= 4.0 ? 4.0 : 3.0);
            const alpha = style >= 3.0 || this.debugOptions.tensorField
                ? clamp01((Math.max(humanVal, aiVal) - 0.08) * 1.6)
                : 0.0;
            this.tensorPointColorSize[i * 4 + 0] = color[0];
            this.tensorPointColorSize[i * 4 + 1] = color[1];
            this.tensorPointColorSize[i * 4 + 2] = color[2];
            this.tensorPointColorSize[i * 4 + 3] = alpha > 0.01 ? 1.5 + Math.max(humanVal, aiVal) * 7.0 : 0.0;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.meshPositions);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.meshColors);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberColor);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.fiberColors);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaColorSize);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.somaColorSize);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorColorSize);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.tensorPointColorSize);
    }

    updateCameraState() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.fov += (this.targetFov - this.fov) * 0.1;
        this.camera.zoom = this.zoom;
    }

    updateMatrices() {
        this.updateCameraState();
        const aspect = Math.max(1, this.canvas.width) / Math.max(1, this.canvas.height);
        const projection = Mat4.perspective(this.fov, aspect, 0.1, 100.0);
        const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);
        let shakeX = 0.0;
        let shakeY = 0.0;
        if (this.params.shake > 0.001) {
            shakeX = (Math.random() - 0.5) * this.params.shake;
            shakeY = (Math.random() - 0.5) * this.params.shake;
        }
        const model = Mat4.multiply(Mat4.rotateX(this.rotation.x + shakeX), Mat4.rotateY(this.rotation.y + shakeY));
        const pv = Mat4.multiply(view, projection);
        return Mat4.multiply(model, pv);
    }

    drawMesh(mvp, wireframe = false) {
        const gl = this.gl;
        gl.useProgram(this.meshProgram);
        const uMvp = gl.getUniformLocation(this.meshProgram, 'uMvp');
        const uPointSize = gl.getUniformLocation(this.meshProgram, 'uPointSize');
        gl.uniformMatrix4fv(uMvp, false, mvp);
        gl.uniform1f(uPointSize, 1.0);
        gl.bindVertexArray(wireframe ? this.wireVao : this.meshVao);
        gl.drawElements(wireframe ? gl.LINES : gl.TRIANGLES, wireframe ? this.wireIndexCount : this.baseIndices.length, gl.UNSIGNED_INT, 0);
    }

    drawFibers(mvp) {
        const gl = this.gl;
        gl.useProgram(this.meshProgram);
        const uMvp = gl.getUniformLocation(this.meshProgram, 'uMvp');
        const uPointSize = gl.getUniformLocation(this.meshProgram, 'uPointSize');
        gl.uniformMatrix4fv(uMvp, false, mvp);
        gl.uniform1f(uPointSize, 1.0);
        gl.bindVertexArray(this.fiberVao);
        gl.lineWidth(1);
        gl.drawArrays(gl.LINES, 0, this.baseFiberVertices.length / 3);
    }

    drawPoints(mvp, vao, count) {
        const gl = this.gl;
        gl.useProgram(this.pointProgram);
        const uMvp = gl.getUniformLocation(this.pointProgram, 'uMvp');
        gl.uniformMatrix4fv(uMvp, false, mvp);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.POINTS, 0, count);
    }

    drawScene(mvp) {
        const isolate = this.debugOptions.isolate || 'all';
        const style = this.params.style || 0;
        const shouldDrawMesh = isolate === 'all' || isolate === 'mesh';
        const shouldDrawFibers = isolate === 'all' || isolate === 'fibers';
        const shouldDrawTensor = isolate === 'all' || isolate === 'tensor';

        if (shouldDrawTensor && (style >= 3.0 || this.debugOptions.tensorField)) {
            this.drawPoints(mvp, this.tensorVao, this.voxelCount);
        }
        if (shouldDrawFibers && (style >= 2.0 || style >= 4.0 || isolate === 'fibers')) {
            this.drawFibers(mvp);
            this.drawPoints(mvp, this.somaVao, this.baseSomaInstances.length / 9);
        }
        if (shouldDrawMesh && (style < 3.0 || style >= 4.0 || isolate === 'mesh')) {
            const wireframe = this.debugOptions.wireframe || style === 1.0;
            this.drawMesh(mvp, wireframe);
        }
    }

    beginXRFrame(timestamp) {
        if (this.geometryDirty && (!this.lastGeometryRebuildTime || timestamp - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
            this.buildAndUploadGeometry();
        }
        this.updateAltitudeState();
        this.time += 0.016;
        if (!this.tensorPlaybackMode) this.updateTensorSimulation();
        this.updateDynamicBuffers();
        this.updateCameraState();
    }

    drawXRView(mvp, viewport) {
        const gl = this.gl;
        gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        this.drawScene(mvp);
    }

    render() {
        if (!this.isRunning) return;
        if (this.geometryDirty && (!this.lastGeometryRebuildTime || performance.now() - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
            this.buildAndUploadGeometry();
        }

        this.resize();
        this.updateAltitudeState();
        this.time += 0.016;
        if (!this.tensorPlaybackMode) {
            this.updateTensorSimulation();
        }
        this.updateDynamicBuffers();
        const mvp = this.updateMatrices();

        const gl = this.gl;
        gl.clearColor(0.01, 0.02, 0.04, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.drawScene(mvp);

        this.frameHandle = requestAnimationFrame(() => this.render());
    }

    setVoxelData(float32Array) {
        if (!float32Array || float32Array.length !== this.voxelCount) {
            return;
        }
        this._lastHumanTensor.set(float32Array);
    }

    setAITensorData(float32Array) {
        if (!float32Array || float32Array.length !== this.voxelCount) {
            return;
        }
        this._lastAITensor.set(float32Array);
    }

    start() {
        this.isRunning = true;
        this.render();
    }

    stop() {
        this.isRunning = false;
        if (this.frameHandle) {
            cancelAnimationFrame(this.frameHandle);
            this.frameHandle = null;
        }
    }
}

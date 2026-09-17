// @ts-check
import { meshVertexSource, meshFragmentSource, pointVertexSource, pointFragmentSource } from './webgl-shaders.js';
import { createDefaultParams, createProgram } from './webgl-gl-utils.js';
import { applyPathwayMethods, createPathwayState } from './pathway-renderer.js';
import { createImmunePool } from './immune-particles.js';
import { applyGeometryMethods } from './brain-renderer-webgl/geometry.js';
import { applyImmuneMethods } from './brain-renderer-webgl/immune.js';
import { applyStateMethods } from './brain-renderer-webgl/state.js';
import { applyTensorSimMethods } from './brain-renderer-webgl/tensor-sim.js';
import { applyDynamicBufferMethods } from './brain-renderer-webgl/dynamic-buffers.js';
import { applyDrawMethods } from './brain-renderer-webgl/draw.js';
import { applyLifecycleMethods } from './brain-renderer-webgl/lifecycle.js';

/**
 * WebGL2 fallback/debug renderer. Implements the shared `BrainRendererFacade`
 * documented in `src/renderer-contract.js` — see `BrainRenderer`'s class
 * comment in `brain-renderer.js` for why this isn't declared with
 * `@implements`, and `docs/webgl-fallback.md` for the capability matrix
 * against the WebGPU backend.
 */
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
        this.pathwayState = createPathwayState();
        this.pathwaySelections = [];
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
        this.synaptixCouplingState = null;
        this._nextHumanTensor = new Float32Array(this.voxelCount);
        this._altitudeInternal = {
            activationTime: 0,
            lastAltitude: 0.0
        };
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0,
            electricalActive: 0.0,
            mercuryActive: 0.0,
            // [Paint Energy]
            radius: 0.0,
            erase: false,
            decayHalfLife: 0.0,
            lastDecayTime: 0
        };
        // [Paint Energy] Guards the orbit-drag mouse handlers below so a
        // paint stroke on the canvas doesn't also rotate the camera.
        this.paintModeActive = false;
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
        this.basePathwayMeta = null;
        this.baseSomaInstances = null;
        this.fiberAffinityData = null;
        // [Tensor Physics] Unit-normalised copy of fiberAffinityData, rebuilt by
        // prepareFiberAffinities() whenever geometry changes, plus the step
        // counter that seeds the field's voxel hash.
        this._normalizedFiberAffinity = null;
        this._tensorFrame = 0;
        this.tensorPointPositions = null;
        this.tensorPointColorSize = null;
        this.meshPositions = null;
        this.meshColors = null;
        this.partnerMeshPositions = null;
        this.partnerMeshColors = null;
        this.fiberColors = null;
        this.pathwayEmissions = null;
        this.somaColorSize = null;

        this.meshProgram = null;
        this.pointProgram = null;
        this.meshVao = null;
        this.partnerMeshVao = null;
        this.wireVao = null;
        this.fiberVao = null;
        this.tensorVao = null;
        this.somaVao = null;
        // [Phase 6] Simplified CPU immune particles. The fallback uses a
        // smaller pool than WebGPU (point sprites, integrated on the CPU).
        this.immunePool = createImmunePool(512);
        this.immuneVao = null;
        this.immuneDrawCount = 0;
        this.immunePositions = new Float32Array(this.immunePool.capacity * 3);
        this.immuneColorSize = new Float32Array(this.immunePool.capacity * 4);
        this.meshBuffers = {};
        this.frameHandle = null;
        this.bridgeVao = null;
        this.bridgeVertexCount = 0;
        this.bridgePositions = new Float32Array(5 * 16 * 2 * 3);
        this.bridgeColors = new Float32Array(5 * 16 * 2 * 3);
        this.synaptixPerformance = { singleWorkUnits: 0, dualWorkUnits: 0, workRatio: 1, frameTimes: [] };

        this.setupInputHandlers();
    }

    setupInputHandlers() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.paintModeActive) return;
            isDragging = true; lastX = e.clientX; lastY = e.clientY;
        });
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.paintModeActive) return;
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

    /** @type {import('./renderer-contract.js').BrainRendererFacade['setCameraParams']} */
    setCameraParams({ rotation, zoom, fov } = {}) {
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

        // buildAndUploadGeometry/buildTensorDebugGrid/buildImmuneResources/resize
        // are attached to BrainRendererWebGL.prototype by the applyXMethods()
        // mixins below (applyGeometryMethods, applyTensorSimMethods,
        // applyImmuneMethods, applyDrawMethods) — not visible to TS across that
        // module boundary, same as setupInputHandlers()/generate() elsewhere.
        // @ts-expect-error
        this.buildAndUploadGeometry();
        // @ts-expect-error
        this.buildTensorDebugGrid();
        // @ts-expect-error
        this.buildImmuneResources();
        // @ts-expect-error
        this.resize();
    }
}

applyGeometryMethods(BrainRendererWebGL);
applyImmuneMethods(BrainRendererWebGL);
applyStateMethods(BrainRendererWebGL);
applyTensorSimMethods(BrainRendererWebGL);
applyDynamicBufferMethods(BrainRendererWebGL);
applyDrawMethods(BrainRendererWebGL);
applyLifecycleMethods(BrainRendererWebGL);
applyPathwayMethods(BrainRendererWebGL);

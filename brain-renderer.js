// brain-renderer.js
// Verified Neuro-Weaver V2.6 Implementation
import { BrainGeometry } from './brain-geometry.js';
import { vertexShader, fragmentShader, computeShader, somaVertexShader, somaFragmentShader, postVertexShader, postFragmentShader } from './shaders.js';
import { Mat4 } from './math-utils.js';

const RENDER_UNIFORM_FLOAT_COUNT = 60;
const UNIFORM_BUFFER_ALIGNMENT = 256;
const RENDER_UNIFORM_BUFFER_SIZE = Math.ceil(
    (RENDER_UNIFORM_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT) / UNIFORM_BUFFER_ALIGNMENT
) * UNIFORM_BUFFER_ALIGNMENT;
const COMPUTE_UNIFORM_BUFFER_SIZE = 80;

export class BrainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;

        // Pipelines
        this.pipeline = null;      // Solid Mesh
        this.fiberPipeline = null; // Lines
        this.somaPipeline = null;  // Instanced Spheres (Somas)
        this.postPipeline = null;  // [Phase 7] Cinematic Post-Process
        
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        this.targetZoom = 3.5; // [Neuro-Weaver] Smooth Zoom Target
        this.time = 0;
        this.isRunning = false;
        this.tensorPlaybackMode = false; // [BCI] When true, compute shader skipped; TensorPlayer drives the voxel buffer

        this.params = {
            frequency: 2.0,
            amplitude: 0.5,
            spikeThreshold: 0.8,
            smoothing: 0.9,
            style: 0.0, // 0=Organic, 1=Cyber, 2=Connectome, 3=Heatmap
            sliceZ: 2.0,  // Slice plane Z value (Starts outside bounds)
            flowSpeed: 4.0, // V2.3: Signal Speed
            colorShift: 0.0, // [Phase 5] Serotonin Color Shift
            sparkle: 0.0, // [Phase 5] Synaptic Sparkles
            growth: 1.0, // [Phase 6] Dendritic Growth (0.0 - 1.0)
            shake: 0.0, // [Phase 2] Camera Shake Intensity (Trauma/Panic)
            aberration: 0.0, // [Phase 7] Chromatic Aberration Intensity
            grain: 0.0, // [Phase 7] Film Grain Intensity
            focus: 0.5, // [Phase 7] Focus Distance (0.0 - 1.0)
            aperture: 0.0, // [Phase 7] Blur Strength (DoF)
            lightDirX: 1.0, // [Phase 2] Directional Light X
            lightDirY: 1.0, // [Phase 2] Directional Light Y
            lightDirZ: 1.0, // [Phase 2] Directional Light Z
            ambientLight: 0.2, // [Phase 2] Ambient Light Intensity
            dirIntensity: 0.8, // [Phase 2] Directional Light Intensity
            stress: 0.0, // [Phase 2] Cognitive Stress Distortion
            cortisol: 0.0, // [Phase 5] Cortisol Structural Decay
            fluidActive: 0.0, // [Phase 6] Procedural Volumetric Fluid Dynamics
            // Altitude/Hypoxia Simulation Parameters
            altitude: 0.0, // Altitude in meters (0-8000)
            oxygenLevel: 1.0, // Oxygen saturation (1.0-0.3)
            hypoxiaStress: 0.0, // Cellular stress response (0.0-1.0)
            metabolicRate: 1.0, // ATP consumption multiplier (0.5-2.0)
            mitochondrialFunction: 1.0 // ATP synthesis efficiency (0.0-1.0)
        };

        // Voxel Grid Settings
        // 32x32x32 flattened buffer
        this.voxelDim = 32;
        this.voxelCount = this.voxelDim * this.voxelDim * this.voxelDim;

        // Stimulus State (V2.2 Initialized)
        // Stores position and intensity for compute shader injection
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0,
            electricalActive: 0.0,
            mercuryActive: 0.0
        };

        // Altitude/Hypoxia Internal State
        // Tracks activation time for cumulative hypoxia effects
        this._altitudeInternal = {
            activationTime: 0,
            lastAltitude: 0.0
        };

        this.renderTarget = null;
        this.sampler = null;
        this.postBindGroup = null;

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
                lastX = e.clientX; lastY = e.clientY;
            }
        });
        this.canvas.addEventListener('mouseup', () => { isDragging = false; });
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.targetZoom = Math.max(2, Math.min(10, this.targetZoom + e.deltaY * 0.01));
        });
    }

    // [Neuro-Weaver] Camera Control API
    setCameraParams({ rotation, zoom }) {
        if (rotation) {
            if (rotation.x !== undefined) this.targetRotation.x = rotation.x;
            if (rotation.y !== undefined) this.targetRotation.y = rotation.y;
        }
        if (zoom !== undefined) {
            this.targetZoom = Math.max(2, Math.min(10, zoom));
        }
    }

    async initialize() {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No GPU');
        
        const requiredFeatures = [];
        const featuresToCheck = [
            'float32-filterable', 'float32-blendable', 'clip-distances',
            'depth32float-stencil8', 'texture-component-swizzle'
        ];
        
        for (const feature of featuresToCheck) {
            if (adapter.features.has(feature)) {
                requiredFeatures.push(feature);
            }
        }
        
        this.device = await adapter.requestDevice({ requiredFeatures });
        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({ device: this.device, format: format, alphaMode: 'opaque' });
        
        // Geometry
        const geometry = new BrainGeometry();
        geometry.generate(80, 50); 
        
        // 1. Solid Mesh Buffers
        this.vertexBuffer = this.createBuffer(geometry.getVertexData(), GPUBufferUsage.VERTEX);
        this.normalBuffer = this.createBuffer(geometry.getNormalData(), GPUBufferUsage.VERTEX);
        this.indexBuffer = this.createBuffer(geometry.getIndexData(), GPUBufferUsage.INDEX);
        this.indexCount = geometry.getIndexCount();
        
        // 2. Fiber Line Buffers
        this.fiberBuffer = this.createBuffer(geometry.getFiberData(), GPUBufferUsage.VERTEX);
        this.fiberVertexCount = geometry.getFiberVertexCount();
        
        // 3. Setup Resource Groups
        this.initSomaResources(geometry);
        this.initVolumetricResources();
        
        // Bind Groups Layouts
        const renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
            ]
        });
        
        // Create Bind Group for Rendering
        // Binding 0: Uniforms (MVP, Time, Style, etc.)
        // Binding 1: Volumetric Data (Read-Only Storage)
        this.bindGroup = this.device.createBindGroup({
            layout: renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.tensorBuffer } }
            ]
        });
        
        // --- PIPELINE 1: SOLID MESH ---
        this.pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: vertexShader }),
                entryPoint: 'main',
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }, // Pos
                    { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }  // Normal
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' }
        });

        // --- PIPELINE 2: FIBERS ---
        this.fiberPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: vertexShader }),
                entryPoint: 'main', 
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }] 
            },
            primitive: { topology: 'line-list' }, 
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' }
        });

        this.initSomaPipeline(renderBindGroupLayout, format);
        this.initComputePipeline();

        // [Phase 7] Post-Processing Init
        this.initPostProcessing(format);

        // Ensure canvas dimensions are valid before creating depth texture
        const width = Math.max(1, this.canvas.width);
        const height = Math.max(1, this.canvas.height);
        this.depthTexture = this.device.createTexture({ size: [width, height], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
        this.createRenderTarget(width, height);

        console.log("Renderer V2.6 Verified with Post-Processing");
    }

    // [Neuro-Weaver] Refactored: Initialize Volumetric Data (Tensor)
    initVolumetricResources() {
        // VOXEL DATA
        // [Neuro-Weaver] 3D Texture Evolution: Flattened storage buffer for volumetric data
        this.voxelBufferSize = this.voxelCount;

        // Create Storage Buffer for Tensor Data (Read/Write in Compute, Read-Only in Vertex)
        this.tensorBuffer = this.device.createBuffer({
            size: this.voxelBufferSize * 4, // 32x32x32 floats
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        // Render uniforms: 2 mat4s (32 floats) + scalar block (28 floats including padding) = 60 floats / 240 bytes.
        // The buffer is padded to 256 bytes to satisfy WebGPU uniform buffer alignment requirements.
        this.uniformBuffer = this.device.createBuffer({
            size: RENDER_UNIFORM_BUFFER_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Compute uniforms: TensorParams is 64 bytes after alignment.
        this.computeUniformBuffer = this.device.createBuffer({
            size: COMPUTE_UNIFORM_BUFFER_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    }

    // [Neuro-Weaver] Refactored: Initialize Soma Geometry
    initSomaResources(geometry) {
        // 3. Soma (Sphere) Instancing (V2.2)
        // [Neuro-Weaver] Use explicit grid intersections from geometry for instance positions
        const somaPositions = geometry.getSomaPositions();
        this.somaInstanceBuffer = this.createBuffer(somaPositions, GPUBufferUsage.VERTEX);
        this.somaInstanceCount = somaPositions.length / 3;

        // Create a simple low-poly sphere (Icosahedron) for the instance geometry
        const X = 0.525731112119133606;
        const Z = 0.850650808352039932;
        const N = 0.0;

        // V2.2 Icosahedron vertices
        const icoVerts = new Float32Array([
            -X,N,Z, X,N,Z, -X,N,-Z, X,N,-Z,
            N,Z,X, N,Z,-X, N,-Z,X, N,-Z,-X,
            Z,X,N, -Z,X,N, Z,-X,N, -Z,-X,N
        ]);

        const icoIndices = new Uint16Array([
            0,4,1, 0,9,4, 9,5,4, 4,5,8, 4,8,1,
            8,10,1, 8,3,10, 5,3,8, 5,2,3, 2,7,3,
            7,10,3, 7,6,10, 7,11,6, 11,0,6, 0,1,6,
            6,1,10, 9,0,11, 9,11,2, 9,2,5, 7,2,11
        ]);

        // V2.2 Geometry Buffers: Icosahedron mesh for somas
        this.somaVertexBuffer = this.createBuffer(icoVerts, GPUBufferUsage.VERTEX);
        this.somaIndexBuffer = this.createBuffer(icoIndices, GPUBufferUsage.INDEX);
        this.somaIndexCount = icoIndices.length;
    }

    initSomaPipeline(renderBindGroupLayout, format) {
        // --- PIPELINE 3: INSTANCED SPHERES (V2.6) ---
        // [Neuro-Weaver] Setup Instanced Soma Pipeline
        // Renders soma spheres at circuit intersections using instancing.
        // Verified: Uses explicit soma positions from BrainGeometry.
        // This pipeline enables the "Structured Data" visualization by showing discrete nodes.

        const somaModule = this.device.createShaderModule({ code: somaVertexShader });
        const somaFragModule = this.device.createShaderModule({ code: somaFragmentShader });

        this.somaPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: somaModule,
                entryPoint: 'main_soma',
                buffers: [
                    // 1. Mesh Geometry (Icosahedron)
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    // 2. Instance Data (Positions)
                    // Uses 'instance' step mode to position each soma based on circuit nodes
                    { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                ]
            },
            fragment: {
                module: somaFragModule,
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth32float' }
        });
    }

    initComputePipeline() {
        // Compute Pipeline
        const computeLayout = this.device.createBindGroupLayout({
             entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                       { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }]
        });
        this.computeBindGroup = this.device.createBindGroup({
            layout: computeLayout,
            entries: [{ binding: 0, resource: { buffer: this.tensorBuffer } }, { binding: 1, resource: { buffer: this.computeUniformBuffer } }]
        });
        this.computePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
            compute: { module: this.device.createShaderModule({ code: computeShader }), entryPoint: 'main' }
        });
    }

    // [Phase 7] Initialize Post-Processing
    initPostProcessing(format) {
        const postModule = this.device.createShaderModule({ code: postVertexShader });
        const postFragModule = this.device.createShaderModule({ code: postFragmentShader });

        this.postPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: postModule,
                entryPoint: 'main'
            },
            fragment: {
                module: postFragModule,
                entryPoint: 'main',
                targets: [{ format: format }] // Render to screen
            },
            primitive: {
                topology: 'triangle-list'
            }
        });

        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
    }

    createRenderTarget(width, height) {
        if (this.renderTarget) this.renderTarget.destroy();

        // Must match canvas format for compatibility if copying, but here we render to it then sample from it.
        // It's used as a color attachment and a texture binding.
        this.renderTarget = this.device.createTexture({
            size: [width, height],
            format: navigator.gpu.getPreferredCanvasFormat(),
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });

        // Recreate Bind Group
        this.postBindGroup = this.device.createBindGroup({
            layout: this.postPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.renderTarget.createView() },
                { binding: 2, resource: this.sampler },
                { binding: 3, resource: this.depthTexture.createView() }
            ]
        });
    }

    createBuffer(data, usage) {
        const buffer = this.device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    setParams(newParams) { this.params = { ...this.params, ...newParams }; }

    // Altitude/Hypoxia Physiological State Update
    // Derives hypoxia parameters from altitude input using barometric formulas
    updateAltitudeState() {
        const alt = this.params.altitude;

        // Barometric formula: O2 = 0.21 * (1 - altitude/44330)^5.255
        // Simplified linear approximation: 1.0 at 0m → 0.35 at 8000m
        // [Scientific Fix] Changed from 0.3 to 0.35 to match actual barometric calculation
        // At 8000m, atmospheric pressure is ~35% of sea level (35600/101325 Pa)
        const altFraction = Math.min(1.0, alt / 8000);
        this.params.oxygenLevel = Math.max(0.35, 1.0 - (altFraction * 0.65));

        // Hypoxia stress: sigmoid curve, peak response at 4000-5000m
        let stressCurve;
        if (altFraction > 0.5) {
            stressCurve = 1.0 / (1.0 + Math.exp(-10 * (altFraction - 0.5)));
        } else {
            stressCurve = altFraction * 0.2;
        }
        this.params.hypoxiaStress = stressCurve;

        // Metabolic rate: hypoxia increases ATP demand
        this.params.metabolicRate = 1.0 + (this.params.hypoxiaStress * 1.0);

        // Mitochondrial function: declines with sustained hypoxia
        if (this.params.hypoxiaStress > 0.5) {
            this._altitudeInternal.activationTime += this.isRunning ? 1.0 : 0.0;
            const sustainedPenalty = Math.max(0.3, 1.0 - (this._altitudeInternal.activationTime / 1800.0)); // 30 min = 1800 frames @ 60fps
            this.params.mitochondrialFunction = sustainedPenalty;
        } else {
            this._altitudeInternal.activationTime = 0;
            this.params.mitochondrialFunction = 1.0;
        }

        this._altitudeInternal.lastAltitude = alt;
    }

    // [Neuro-Weaver] Task: Stimulus Injection (Refactored V2.7)
    // Writes target coordinates to a temporary state, which is uploaded
    // to the Compute Shader uniforms in the next render cycle.
    // [V2.3] Stimulus Injection Logic: Triggers a volumetric pulse at the target coordinate
    // [Neuro-Weaver V2.8] Updated signature for clarity
    injectStimulus(targetX, targetY, targetZ, intensity) {
        // [Neuro-Weaver] Validation: Prevent injection of invalid values
        if ([targetX, targetY, targetZ, intensity].some(val => isNaN(val))) {
             console.warn("Neuro-Weaver: Invalid stimulus parameters ignored");
             return;
        }

        // Update state for Compute Shader uniforms
        // [Neuro-Weaver] V2.7: Clamp coordinates to brain range (Refactored)
        const BOUNDARY_LIMIT = 1.6;
        this.stimulus.pos = [
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetX)),
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetY)),
            Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetZ))
        ];
        // Ensure intensity is non-negative
        this.stimulus.active = Math.max(0.0, intensity);

        console.log(`[Neuro-Weaver] Stimulus Injected: Pos(${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)}) Intensity(${intensity.toFixed(2)})`);
    }

    injectElectrical(intensity, duration) {
        if (isNaN(intensity)) return;
        this.stimulus.electricalActive = Math.max(0.0, intensity);
        console.log(`[Neuro-Weaver] Electrical Stimulus Injected: Intensity(${intensity.toFixed(2)})`);
    }

    injectMercury(intensity, duration) {
        if (isNaN(intensity)) return;
        this.stimulus.mercuryActive = Math.max(0.0, intensity);
        console.log(`[Neuro-Weaver] Mercury Stimulus Injected: Intensity(${intensity.toFixed(2)})`);
    }

    calmState() {
        // Clear all activity by resetting parameters to a "Calm" state.
        // Setting amplitude low prevents new chaotic waves.
        // Setting smoothing high (0.98) causes existing activity to decay very slowly,
        // creating a "settling down" effect rather than an abrupt cutoff.
        this.params.amplitude = 0.1;
        this.params.frequency = 0.5;
        this.params.smoothing = 0.98;
        this.params.colorShift = 0.0;
        this.params.sparkle = 0.0;
        this.params.aberration = 0.0;
        this.params.grain = 0.0;
        this.params.aperture = 0.0;
        this.params.stress = 0.0;
        this.params.cortisol = 0.0;
    }

    resetActivity() {
        // Instantly clear the volumetric tensor data
        const emptyData = new Float32Array(this.voxelCount);
        this.device.queue.writeBuffer(this.tensorBuffer, 0, emptyData);
    }

    updateUniforms() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(Math.PI / 4, aspect, 0.1, 100.0);
        const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);

        // [Phase 2] Camera Shake Logic
        let shakeX = 0;
        let shakeY = 0;
        if (this.params.shake > 0.001) {
             shakeX = (Math.random() - 0.5) * this.params.shake;
             shakeY = (Math.random() - 0.5) * this.params.shake;
        }

        const model = Mat4.multiply(Mat4.rotateX(this.rotation.x + shakeX), Mat4.rotateY(this.rotation.y + shakeY));

        const pv = Mat4.multiply(view, projection);
        const mvp = Mat4.multiply(model, pv);
        
        // Uniform Buffer Layout (Verified)
        // [0-15]: MVP (64 bytes)
        // [16-31]: Model (64 bytes)
        // [32]: Time
        // [33]: Style
        // [34]: FlowSpeed
        // [35]: ColorShift
        // [36-39]: SlicePlane (Vec4, 16 bytes)
        // [40]: Sparkle (4 bytes)
        // [41]: Growth (4 bytes)
        // [42]: Aberration (4 bytes)
        // [43]: Grain (4 bytes)
        // [44]: Focus (4 bytes)
        // [45]: Aperture (4 bytes)
        // [48-50]: LightDir (12 bytes)
        // [51]: AmbientLight (4 bytes)
        // [52]: DirIntensity (4 bytes)
        // [53]: Stress (4 bytes)
        // [54]: Cortisol (4 bytes)

        const OFFSET_MVP = 0;
        const OFFSET_MODEL = 16;
        const OFFSET_TIME = 32;
        const OFFSET_STYLE = 33;
        const OFFSET_FLOW = 34;
        const OFFSET_COLOR = 35;
        const OFFSET_SLICE = 36;
        const OFFSET_SPARKLE = 40;
        const OFFSET_GROWTH = 41;
        const OFFSET_ABERRATION = 42;
        const OFFSET_GRAIN = 43;
        const OFFSET_FOCUS = 44;
        const OFFSET_APERTURE = 45;
        const OFFSET_LIGHT_DIR = 48;
        const OFFSET_AMBIENT = 51;
        const OFFSET_DIR_INTENSITY = 52;
        const OFFSET_STRESS = 53;
        const OFFSET_CORTISOL = 54;
        const OFFSET_ALTITUDE = 55;
        const OFFSET_OXYGEN = 56;
        const OFFSET_HYPOXIA_STRESS = 57;
        const OFFSET_METABOLIC_RATE = 58;
        const OFFSET_MITOCHONDRIAL = 59;

        const uData = new Float32Array(RENDER_UNIFORM_FLOAT_COUNT);
        uData.set(mvp, OFFSET_MVP);
        uData.set(model, OFFSET_MODEL);
        uData[OFFSET_TIME] = this.time;
        uData[OFFSET_STYLE] = this.params.style;
        uData[OFFSET_FLOW] = this.params.flowSpeed;
        uData[OFFSET_COLOR] = this.params.colorShift;

        // Slice Plane Logic
        uData[OFFSET_SLICE] = 0.0;      // Px
        uData[OFFSET_SLICE + 1] = 0.0;  // Py
        uData[OFFSET_SLICE + 2] = -1.0; // Pz (Normal pointing backward)
        uData[OFFSET_SLICE + 3] = this.params.sliceZ; // Distance

        uData[OFFSET_SPARKLE] = this.params.sparkle;
        uData[OFFSET_GROWTH] = this.params.growth;
        uData[OFFSET_ABERRATION] = this.params.aberration;
        uData[OFFSET_GRAIN] = this.params.grain;
        uData[OFFSET_FOCUS] = this.params.focus;
        uData[OFFSET_APERTURE] = this.params.aperture;
        uData[OFFSET_LIGHT_DIR] = this.params.lightDirX;
        uData[OFFSET_LIGHT_DIR + 1] = this.params.lightDirY;
        uData[OFFSET_LIGHT_DIR + 2] = this.params.lightDirZ;
        uData[OFFSET_AMBIENT] = this.params.ambientLight;
        uData[OFFSET_DIR_INTENSITY] = this.params.dirIntensity;
        uData[OFFSET_STRESS] = this.params.stress;
        uData[OFFSET_CORTISOL] = this.params.cortisol;
        uData[OFFSET_ALTITUDE] = this.params.altitude;
        uData[OFFSET_OXYGEN] = this.params.oxygenLevel;
        uData[OFFSET_HYPOXIA_STRESS] = this.params.hypoxiaStress;
        uData[OFFSET_METABOLIC_RATE] = this.params.metabolicRate;
        uData[OFFSET_MITOCHONDRIAL] = this.params.mitochondrialFunction;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        
        // Compute Uniforms layout (64 bytes total):
        // 32 bytes scalar block + 16 bytes stimulus block + 12 bytes hypoxia block + 4 bytes trailing padding.
        const cBuf = new ArrayBuffer(COMPUTE_UNIFORM_BUFFER_SIZE);
        const dv = new DataView(cBuf);
        dv.setFloat32(0, this.time, true);
        dv.setUint32(4, this.voxelDim, true);
        dv.setFloat32(8, this.params.frequency, true);
        dv.setFloat32(12, this.params.amplitude, true);
        dv.setFloat32(16, this.params.spikeThreshold, true);
        dv.setFloat32(20, this.params.smoothing, true);
        dv.setFloat32(24, this.params.style, true);
        dv.setFloat32(28, 0.0, true);

        // [Neuro-Weaver] Upload Stimulus Data
        // Layout must match TensorParams struct in WGSL (std140)
        // Offset 32: stimulusPos (vec3)
        // Offset 44: stimulusActive (f32)
        dv.setFloat32(32, this.stimulus.pos[0], true);
        dv.setFloat32(36, this.stimulus.pos[1], true);
        dv.setFloat32(40, this.stimulus.pos[2], true);

        dv.setFloat32(44, this.stimulus.active, true);

        // Altitude/Hypoxia parameters for compute shader
        // Offset 48: hypoxiaStress
        // Offset 52: metabolicRate
        // Offset 56: mitochondrialFunction
        dv.setFloat32(48, this.params.hypoxiaStress, true);
        dv.setFloat32(52, this.params.metabolicRate, true);
        dv.setFloat32(56, this.params.mitochondrialFunction, true);

        // Fluid Dynamics and Environmental Hazard variables
        dv.setFloat32(60, this.params.fluidActive, true);
        dv.setFloat32(64, this.stimulus.electricalActive, true);
        dv.setFloat32(68, this.stimulus.mercuryActive, true);

        // Upload to GPU
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);

        // Auto-reset pulse (single frame injection)
        if (this.stimulus.active > 0) {
             this.stimulus.active = 0.0;
        }
        if (this.stimulus.electricalActive > 0) {
             this.stimulus.electricalActive = 0.0;
        }
        if (this.stimulus.mercuryActive > 0) {
             this.stimulus.mercuryActive = 0.0;
        }
    }

    render() {
        // [V2.3] Main Render Loop
        if (!this.isRunning) return;
        
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (width === 0 || height === 0) return;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width; this.canvas.height = height;
            this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({ size: [width, height], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

            // Resize Render Target
            this.createRenderTarget(width, height);
        }

        this.time += 0.016;
        this.updateAltitudeState(); // Update altitude/hypoxia parameters before uniforms
        this.updateUniforms();
        
        const commandEncoder = this.device.createCommandEncoder();

        // Skip physics simulation when tensor playback is driving the voxel buffer directly
        if (!this.tensorPlaybackMode) {
            const computePass = commandEncoder.beginComputePass();
            computePass.setPipeline(this.computePipeline);
            computePass.setBindGroup(0, this.computeBindGroup);
            computePass.dispatchWorkgroups(Math.ceil(this.voxelBufferSize / 64));
            computePass.end();
        }
        
        // --- PASS 1: RENDER SCENE TO TEXTURE ---
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.renderTarget.createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, 
                loadOp: 'clear', storeOp: 'store'
            }],
            depthStencilAttachment: { view: this.depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        
        renderPass.setBindGroup(0, this.bindGroup);
        
        if (this.params.style >= 2.0 && this.params.style < 3.0) {
            // --- CONNECTOME MODE ---

            // 1. Draw Fibers
            renderPass.setPipeline(this.fiberPipeline);
            renderPass.setVertexBuffer(0, this.fiberBuffer);
            renderPass.setVertexBuffer(1, this.fiberBuffer); 
            renderPass.draw(this.fiberVertexCount); 

            // 2. Draw Instanced Neurons (Somas) [V2.6 Pipeline]
            renderPass.setPipeline(this.somaPipeline);
            renderPass.setVertexBuffer(0, this.somaVertexBuffer); // Mesh
            renderPass.setVertexBuffer(1, this.somaInstanceBuffer); // Positions
            renderPass.setIndexBuffer(this.somaIndexBuffer, 'uint16');
            // Draw call uses instance count
            renderPass.drawIndexed(this.somaIndexCount, this.somaInstanceCount);

        } else {
            renderPass.setPipeline(this.pipeline);
            renderPass.setVertexBuffer(0, this.vertexBuffer);
            renderPass.setVertexBuffer(1, this.normalBuffer);
            renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
            renderPass.drawIndexed(this.indexCount);
        }
        
        renderPass.end();

        // --- PASS 2: POST-PROCESSING TO SCREEN ---
        const postPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear', storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 }
            }]
        });

        postPass.setPipeline(this.postPipeline);
        postPass.setBindGroup(0, this.postBindGroup);
        postPass.draw(6); // Draw full-screen quad
        postPass.end();

        this.device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(() => this.render());
    }

    // [BCI] Direct tensor injection — bypasses compute shader physics.
    // Used by TensorPlayer to stream pre-recorded or real-time BCI data frames.
    setVoxelData(float32Array) {
        this.device.queue.writeBuffer(this.tensorBuffer, 0, float32Array);
    }

    start() { this.isRunning = true; this.render(); }
    stop() { this.isRunning = false; }
}

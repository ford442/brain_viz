// @ts-check
// brain-renderer.js
// Verified Neuro-Weaver V2.6 Implementation
import { WasmTensorEngine } from './wasm-engine.js';
import { applyPipelineMethods } from './brain-renderer/pipelines.js';
import { applyGeometryMethods } from './brain-renderer/geometry.js';
import { applyStimulusMethods } from './brain-renderer/stimulus.js';
import { applyUniformsMethods } from './brain-renderer/uniforms.js';
import { applyRenderLoopMethods } from './brain-renderer/render-loop.js';
import { applyCoreMethods } from './brain-renderer/core-methods.js';
import { applySynaptiXBridgeMethods } from './brain-renderer/synaptix-bridges.js';

export class BrainRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;

        // Pipelines
        this.pipeline = null;      // Solid Mesh
        this.fiberPipeline = null; // Lines
        this.somaPipeline = null;  // Instanced Spheres (Somas)
        this.sparkPipeline = null; // Emissive Sparks
        this.postPipeline = null;  // [Phase 7] Cinematic Post-Process
        
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        this.targetZoom = 3.5; // [Neuro-Weaver] Smooth Zoom Target
        this.fov = Math.PI / 4;
        this.targetFov = Math.PI / 4;
        this.time = 0;
        this.isRunning = false;
        this.tensorPlaybackMode = false; // [BCI] When true, compute shader skipped; TensorPlayer drives the voxel buffer
        this.geometryRows = 80;
        this.geometryCols = 50;
        this.geometryDirty = false;
        this.geometryRebuildIntervalMs = 80;
        this.lastGeometryRebuildTime = 0;
        this.lastGeometryGenerationMs = 0;

        // [Phase 1 WASM] Hybrid simulation mode.
        // When wasmMode is true the C++ BrainTensorEngine drives the tensor physics
        // instead of the WebGPU compute shader.  Falls back to WebGPU automatically
        // if the WASM build has not been run or the browser does not support it.
        this.wasmMode   = false;
        this.wasmEngine = new WasmTensorEngine(32); // lazy-initialised on first enable

        this.params = {
            cognitiveLoad: 0.0, // [Phase 9] Visual Cortex Fatigue (Dynamic LoD)
            cognitiveDissonance: 0.0, // [Phase 2.5] Cognitive Dissonance
            frequency: 2.0,
            amplitude: 0.5,
            spikeThreshold: 0.8,
            smoothing: 0.9,
            style: 0.0, // 0=Organic, 1=Cyber, 2=Connectome, 3=Heatmap
            sliceZ: 2.0,  // Slice plane Z value (Starts outside bounds)
            flowSpeed: 4.0, // V2.3: Signal Speed
            colorShift: 0.0, // [Phase 5] Serotonin Color Shift
            dopamineTrails: 0.0,

            // [Phase 21] Neuromodulator physics defaults
            decayRate: 0.96,
            diffusionRate: 0.1,
            pulseSaturation: 1.0,
            trailLength: 1.0,
            retentionBiasX: 0.5,
            retentionBiasY: 0.0,
            retentionBiasZ: 0.2,
            retentionBiasW: 0.2,

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
            lesionActive: 0.0,
            lesionCenterX: 0.0,
            lesionCenterY: 0.0,
            lesionCenterZ: 0.0,
            lesionRadius: 0.0,
            decimation: 0.0,
            myelin_degradation: 0.0, // [V3.1] Connectome myelin loss visualization
            fluidActive: 0.0,
            immuneActivity: 0.0, // [Phase 6] Procedural Volumetric Fluid Dynamics
            plasticityDecay: 0.0,
            visualFatigue: 0.0,
            sensoryDeprivation: 0.0,
            spatialMemory: 0.0,
            apoptosis: 0.0,
            edgeDetection: 0.0, // Visual Cortex Edge Detection
            pulseSaturation: 1.0,
            trailLength: 1.0,
            lesionCenterX: 0.0,
            lesionCenterY: 0.0,
            lesionCenterZ: 0.0,
            lesionActive: 0.0,
            lesionRadius: 0.0,
            decimation: 0.0,
            psychedelic: 0.0,
            // Altitude/Hypoxia Simulation Parameters
            altitude: 0.0, // Altitude in meters (0-8000)
            oxygenLevel: 1.0, // Oxygen saturation (1.0-0.3)
            hypoxiaStress: 0.0, // Cellular stress response (0.0-1.0)
            metabolicRate: 1.0, // ATP consumption multiplier (0.5-2.0)
            mitochondrialFunction: 1.0, // ATP synthesis efficiency (0.0-1.0)
            fogDensity: 0.0, // Volumetric Fog
            partnerInfluence: 0.5,
            aiInfluence: 0.5, // Deprecated alias, synchronized by setParams().
            resonanceThreshold: 0.2,
            couplingStrength: 1.0,
            couplingWindowSeconds: 2.0,
            dualAvatarEnabled: true,
            aiLayer: 0.0,
            pointCloudDensity: 1.0,
            fiberCoupling: 0.5,
            foldScale: 1.0,
            foldStrength: 0.16,
            fissureDepth: 0.52,
            lobeFoldBias: 1.0,
            corticalThickness: 0.11,
            networkTopology: 0.0,
            fiberSymmetry: 0.85,      // [V3.3] Bilateral connectome symmetry (0=free, 1=mirrored)
            bundleCoherence: 0.6,     // [V3.3] Tightness of fibers within a tract bundle
            connectomeVariant: 0.0,   // [V3.3] 0=Anatomical (DTI tracts), 1=Reasoning Pathways
        };

        // Voxel Grid Settings
        // 32x32x32 flattened buffer
        this.voxelDim = 32;
        this.voxelCount = this.voxelDim * this.voxelDim * this.voxelDim;
        this._lastHumanTensor = new Float32Array(this.voxelCount);
        this._lastAITensor = new Float32Array(this.voxelCount);
        this.synaptixCouplingState = null;

        // Stimulus State (V2.2 Initialized)
        // Stores position and intensity for compute shader injection
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0,
            electricalActive: 0.0,
            mercuryActive: 0.0,
            decayRate: 0.0,
            lastTime: 0
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

        // @ts-expect-error setupInputHandlers is attached to the prototype by
        // applyCoreMethods() below, after this class body — not visible to TS.
        this.setupInputHandlers();
    }
    

    // [Neuro-Weaver] Camera Control API
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
        const geometry = this.buildGeometry();
        
        // 1. Solid Mesh Buffers
        this.vertexBuffer = this.createBuffer(geometry.getVertexData(), GPUBufferUsage.VERTEX);
        this.normalBuffer = this.createBuffer(geometry.getNormalData(), GPUBufferUsage.VERTEX);
        this.indexBuffer = this.createBuffer(geometry.getIndexData(), GPUBufferUsage.INDEX);
        this.indexCount = geometry.getIndexCount();
        
        // 2. Fiber Line Buffers
        this.fiberBuffer = this.createBuffer(geometry.getFiberData(), GPUBufferUsage.VERTEX);
        this.fiberNormalBuffer = this.createBuffer(geometry.getFiberNormalData(), GPUBufferUsage.VERTEX);
        this.fiberMetaBuffer = this.createBuffer(geometry.getFiberDataWithMetadata(), GPUBufferUsage.VERTEX);
        this.fiberPathBuffer = this.createBuffer(geometry.getFiberPathData(), GPUBufferUsage.VERTEX);
        this.fiberVertexCount = geometry.getFiberVertexCount();
        
        // 3. Setup Resource Groups
        this.initSomaResources(geometry);
        this.initSparkResources(geometry);
        this.initVolumetricResources();
        this.uploadFiberDirections(geometry);
        
        // Bind Groups Layouts
        const renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                { binding: 3, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }
            ]
        });
        
        // Create Bind Group for Rendering
        // Binding 0: Uniforms (MVP, Time, Style, etc.)
        // Binding 1: Volumetric Data (Read-Only Storage)
        this.bindGroup = this.device.createBindGroup({
            layout: renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.tensorBuffer } },
                { binding: 2, resource: { buffer: this.aiTensorBuffer } },
                { binding: 3, resource: { buffer: this.fiberDirectionBuffer } }
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
                    { arrayStride: 16, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] }  // Normal (padded to match shared shader)
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }] 
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' }
        });

        // --- PIPELINE 2: FIBERS ---
        this.fiberPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: fiberVertexShader }),
                entryPoint: 'main', 
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    { arrayStride: 16, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x4' }] },
                    { arrayStride: 16, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }] },
                    {
                        arrayStride: 24,
                        attributes: [
                            { shaderLocation: 3, offset: 0, format: 'float32x3' },
                            { shaderLocation: 4, offset: 12, format: 'float32x3' }
                        ]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fiberFragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }] 
            },
            primitive: { topology: 'triangle-list' }, 
            depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth32float' }
        });

        this.initSomaPipeline(renderBindGroupLayout, format);
        this.initSparkPipeline(renderBindGroupLayout, format);
        this.initPointCloudPipeline(renderBindGroupLayout, format);
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

        this.aiTensorBuffer = this.device.createBuffer({
            size: this.voxelBufferSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        // Initialize with zeros
        this.device.queue.writeBuffer(this.aiTensorBuffer, 0, new Float32Array(this.voxelCount));

        // [V3.2] Fiber Affinity Buffer: 3 vec4s per voxel (xyz=dir, w=weight) from actual bundles
        this.fiberDirectionBuffer = this.device.createBuffer({
            size: this.voxelCount * 12 * 4, // 3 vec4<f32> per voxel
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

    // [V3.2] Upload actual bundle-derived fiber affinity map
    uploadFiberDirections(geometry) {
        const data = geometry.getFiberAffinityData();
        if (data && data.byteLength === this.voxelCount * 12 * 4) {
            this.device.queue.writeBuffer(this.fiberDirectionBuffer, 0, data);
        }
    }

    // [Neuro-Weaver] Refactored: Initialize Soma Geometry (V3.1)
    initSomaResources(geometry) {
        const somaInstances = geometry.getSomaInstanceData();
        this.somaInstanceBuffer = this.createBuffer(somaInstances, GPUBufferUsage.VERTEX);
        this.somaInstanceCount = somaInstances.length / 9;

        // Create a simple low-poly sphere (Icosahedron) for the instance geometry
        const X = 0.525731112119133606;
        const Z = 0.850650808352039932;
        const N = 0.0;

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

        this.somaVertexBuffer = this.createBuffer(icoVerts, GPUBufferUsage.VERTEX);
        this.somaIndexBuffer = this.createBuffer(icoIndices, GPUBufferUsage.INDEX);
        this.somaIndexCount = icoIndices.length;

        // [V3.1] Dense point-cloud instances
        const pointCloudData = geometry.getPointCloudData();
        this.pointCloudInstanceBuffer = this.createBuffer(pointCloudData, GPUBufferUsage.VERTEX);
        this.pointCloudInstanceCount = pointCloudData.length / 8;

        this.pointCloudQuadBuffer = this.createBuffer(new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ]), GPUBufferUsage.VERTEX);
    }

    initSparkResources(geometry) {
        const sparkSources = geometry.getSparkSourceData();
        this.sparkInstanceBuffer = this.createBuffer(sparkSources, GPUBufferUsage.VERTEX);
        this.sparkInstanceCount = sparkSources.length / 12;

        this.sparkQuadBuffer = this.createBuffer(new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ]), GPUBufferUsage.VERTEX);
    }

    initSomaPipeline(renderBindGroupLayout, format) {
        // --- PIPELINE 3: INSTANCED SPHERES (V3.1) ---
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
                    // 2. Instance Data: [pos(3), meta(4), shape(2)] padded to 32 bytes
                    { arrayStride: 36, stepMode: 'instance', attributes: [
                        { shaderLocation: 1, offset: 0, format: 'float32x3' },
                        { shaderLocation: 2, offset: 12, format: 'float32x4' },
                        { shaderLocation: 3, offset: 28, format: 'float32x2' }
                    ]}
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

    initSparkPipeline(renderBindGroupLayout, format) {
        const sparkModule = this.device.createShaderModule({ code: sparkVertexShader });
        const sparkFragModule = this.device.createShaderModule({ code: sparkFragmentShader });

        this.sparkPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: sparkModule,
                entryPoint: 'main',
                buffers: [
                    { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
                    {
                        arrayStride: 48,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x4' },
                            { shaderLocation: 2, offset: 16, format: 'float32x4' },
                            { shaderLocation: 3, offset: 32, format: 'float32x4' }
                        ]
                    }
                ]
            },
            fragment: {
                module: sparkFragModule,
                entryPoint: 'main',
                targets: [{
                    format: format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' }
        });
    }

    initPointCloudPipeline(renderBindGroupLayout, format) {
        const pcModule = this.device.createShaderModule({ code: pointCloudVertexShader });
        const pcFragModule = this.device.createShaderModule({ code: pointCloudFragmentShader });

        this.pointCloudPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: pcModule,
                entryPoint: 'main',
                buffers: [
                    { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
                    {
                        arrayStride: 32,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x3' },
                            { shaderLocation: 2, offset: 12, format: 'float32x4' }
                        ]
                    }
                ]
            },
            fragment: {
                module: pcFragModule,
                entryPoint: 'main',
                targets: [{
                    format: format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' }
                    }
                }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' }
        });
    }

    initComputePipeline() {
        // Compute Pipeline with Fiber Direction Buffer for Anisotropic Diffusion
        const computeLayout = this.device.createBindGroupLayout({
             entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                       { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                       { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                       { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }]
        });
        this.computeBindGroup = this.device.createBindGroup({
            layout: computeLayout,
            entries: [{ binding: 0, resource: { buffer: this.tensorBuffer } },
                      { binding: 1, resource: { buffer: this.computeUniformBuffer } },
                      { binding: 2, resource: { buffer: this.fiberDirectionBuffer } },
                      { binding: 3, resource: { buffer: this.aiTensorBuffer } }]
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

    buildGeometry() {
        const geometry = new BrainGeometry({
            foldScale: this.params.foldScale,
            foldStrength: this.params.foldStrength,
            fissureDepth: this.params.fissureDepth,
            lobeFoldBias: this.params.lobeFoldBias,
            corticalThickness: this.params.corticalThickness,
            growth: this.params.growth,
            networkTopology: this.params.networkTopology,
            fiberSymmetry: this.params.fiberSymmetry,
            bundleCoherence: this.params.bundleCoherence
        });
        geometry.generate(this.geometryRows, this.geometryCols);
        return geometry;
    }

    destroyGeometryBuffers() {
        [
            this.vertexBuffer,
            this.normalBuffer,
            this.indexBuffer,
            this.fiberBuffer,
            this.fiberNormalBuffer,
            this.fiberMetaBuffer,
            this.fiberPathBuffer,
            this.somaInstanceBuffer,
            this.somaVertexBuffer,
            this.somaIndexBuffer,
            this.sparkInstanceBuffer,
            this.sparkQuadBuffer,
            this.pointCloudInstanceBuffer,
            this.pointCloudQuadBuffer
        ].forEach((buffer) => buffer?.destroy?.());
    }

    rebuildGeometry() {
        if (!this.device) return;
        const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
        const geometry = this.buildGeometry();
        this.destroyGeometryBuffers();

        this.vertexBuffer = this.createBuffer(geometry.getVertexData(), GPUBufferUsage.VERTEX);
        this.normalBuffer = this.createBuffer(geometry.getNormalData(), GPUBufferUsage.VERTEX);
        this.indexBuffer = this.createBuffer(geometry.getIndexData(), GPUBufferUsage.INDEX);
        this.indexCount = geometry.getIndexCount();
        this.fiberBuffer = this.createBuffer(geometry.getFiberData(), GPUBufferUsage.VERTEX);
        this.fiberNormalBuffer = this.createBuffer(geometry.getFiberNormalData(), GPUBufferUsage.VERTEX);
        this.fiberMetaBuffer = this.createBuffer(geometry.getFiberDataWithMetadata(), GPUBufferUsage.VERTEX);
        this.fiberPathBuffer = this.createBuffer(geometry.getFiberPathData(), GPUBufferUsage.VERTEX);
        this.fiberVertexCount = geometry.getFiberVertexCount();
        this.initSomaResources(geometry);
        this.initSparkResources(geometry);
        this.uploadFiberDirections(geometry);

        this.geometryDirty = false;
        this.lastGeometryRebuildTime = typeof performance !== 'undefined' ? performance.now() : 0;
        this.lastGeometryGenerationMs = startedAt ? this.lastGeometryRebuildTime - startedAt : 0;
    }

    setParams(newParams) {
        const geometryKeys = ['foldScale', 'foldStrength', 'fissureDepth', 'lobeFoldBias', 'corticalThickness', 'growth', 'networkTopology', 'fiberSymmetry', 'bundleCoherence'];
        const geometryChanged = geometryKeys.some((key) => newParams[key] !== undefined && newParams[key] !== this.params[key]);
        this.params = { ...this.params, ...newParams };
        if (geometryChanged) {
            this.geometryDirty = true;
        }
    }

    setSynaptiXParams(newParams) {
        this.setParams(newParams);
    }

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

    triggerTMS(center, strength = 1.2, radius = 0.28, durationMs = 650) {
        this.tms = {
            center: center,
            strength: strength,
            radius: radius,
            duration: durationMs,
            startTime: performance.now()
        };
        this.params.tmsCenterX = center[0];
        this.params.tmsCenterY = center[1];
        this.params.tmsCenterZ = center[2];
        this.params.tmsActive = strength;
        this.params.tmsRadius = radius;
    }

    injectStimulus(targetX, targetY, targetZ, intensity, duration = 0.0) {
        // [Neuro-Weaver] Validation: Prevent injection of invalid values
        if ([targetX, targetY, targetZ, intensity, duration].some(val => isNaN(val))) {
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
        if (duration > 0) {
            this.stimulus.decayRate = intensity / duration;
            this.stimulus.lastTime = performance.now();
        } else {
            this.stimulus.decayRate = 0.0;
        }

        // [Phase 1 WASM] Forward stimulus to the C++ engine when in WASM mode
        if (this.wasmMode && this.wasmEngine.available) {
            this.wasmEngine.injectStimulus(
                this.stimulus.pos[0],
                this.stimulus.pos[1],
                this.stimulus.pos[2],
                this.stimulus.active,
                this.params.mitochondrialFunction ?? 1.0
            );
        }

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

        this.tms = null;
        this.params.cognitiveLoad = 0.0;
    }

    resetActivity() {
        // Instantly clear the volumetric tensor data
        const emptyData = new Float32Array(this.voxelCount);
        this._lastHumanTensor.fill(0);
        this.device.queue.writeBuffer(this.tensorBuffer, 0, emptyData);
        // Also reset WASM engine buffer so both paths stay in sync
        if (this.wasmEngine.available) this.wasmEngine.reset();
    }

    // [Phase 1 WASM] Enable the hybrid WASM simulation mode.
    // Loads and initialises the C++ engine on first call.
    // @returns {Promise<boolean>}  true if WASM is now active.
    async enableWasmMode() {
        const ok = await this.wasmEngine.init();
        if (ok) {
            this.wasmMode = true;
            console.log('[BrainRenderer] WASM simulation mode ENABLED');
        } else {
            console.warn('[BrainRenderer] WASM unavailable — staying on WebGPU compute');
        }
        return ok;
    }

    // [Phase 1 WASM] Disable the hybrid WASM mode and return to WebGPU compute shaders.
    disableWasmMode() {
        this.wasmMode = false;
        console.log('[BrainRenderer] WASM simulation mode DISABLED — using WebGPU compute');
    }

    // [Phase 1 WASM] Run and log a WASM benchmark (steps simulation steps).
    runWasmBenchmark(steps = 100) {
        if (!this.wasmEngine.available) {
            console.warn('[BrainRenderer] WASM not initialised — call enableWasmMode() first');
            return null;
        }
        return this.wasmEngine.benchmark(steps);
    }

    updateUniforms() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.fov += (this.targetFov - this.fov) * 0.1;
        
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(this.fov, aspect, 0.1, 100.0);
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
        const OFFSET_DOPAMINE = 36;
        const OFFSET_PAD1 = 37;
        const OFFSET_PAD2 = 38;
        const OFFSET_PAD3 = 39;
        const OFFSET_SLICE = 40;
        const OFFSET_SPARKLE = 44;
        const OFFSET_GROWTH = 45;
        const OFFSET_ABERRATION = 46;
        const OFFSET_GRAIN = 47;
        const OFFSET_FOCUS = 48;
        const OFFSET_APERTURE = 49;
        const OFFSET_LIGHT_DIR = 52;
        const OFFSET_AMBIENT = 55;
        const OFFSET_DIR_INTENSITY = 56;
        const OFFSET_STRESS = 57;
        const OFFSET_CORTISOL = 58;
        const OFFSET_ALTITUDE = 59;
        const OFFSET_OXYGEN = 60;
        const OFFSET_HYPOXIA_STRESS = 61;
        const OFFSET_METABOLIC_RATE = 62;
        const OFFSET_MITOCHONDRIAL = 63;
        const OFFSET_FOG_DENSITY = 64;
        const OFFSET_ZOOM = 65;
        const OFFSET_HEAVY_METAL = 66;
        const OFFSET_FLUID_ACTIVE = 67;
        const OFFSET_AI_INFLUENCE = 68;
        const OFFSET_RESONANCE_THRESHOLD = 69;
        const OFFSET_SYNAPTIX_ACTIVE = 70;
        const OFFSET_AI_LAYER = 71;
        const OFFSET_POINT_CLOUD_DENSITY = 72;
        const OFFSET_FIBER_COUPLING = 73;
        const OFFSET_CONNECTOME_VARIANT = 74; // [V3.3] formerly pad5
        const OFFSET_TMS_ACTIVE = 75;
        const OFFSET_TMS_CENTER = 76; // vec3 takes 3
        const OFFSET_TMS_PULSE = 79;
        const OFFSET_TMS_RADIUS = 80;
        const OFFSET_EDGEDETECTION = 81;
        const OFFSET_PULSESATURATION = 82;
        const OFFSET_TRAILLENGTH = 83;
        const OFFSET_LESIONCENTER = 84; // vec3 takes 3
        const OFFSET_LESIONACTIVE = 87;
        const OFFSET_LESIONRADIUS = 88;
        const OFFSET_DECIMATION = 89;
        const OFFSET_PSYCHEDELIC = 90;
        const OFFSET_IMMUNEACTIVITY = 91;
        const OFFSET_PLASTICITYDECAY = 92;
        const OFFSET_VISUALFATIGUE = 93;
        const OFFSET_SENSORYDEPRIVATION = 94;
        const OFFSET_SPATIALMEMORY = 95;
        const OFFSET_APOPTOSIS = 96;

        const RENDER_UNIFORM_FLOAT_COUNT = 100;
        const uData = new Float32Array(RENDER_UNIFORM_FLOAT_COUNT);
        uData.set(mvp, OFFSET_MVP);
        uData.set(model, OFFSET_MODEL);
        uData[OFFSET_TIME] = this.time;
        uData[OFFSET_STYLE] = this.params.style;
        uData[OFFSET_FLOW] = this.params.flowSpeed;
        uData[OFFSET_COLOR] = this.params.colorShift;
        uData[OFFSET_DOPAMINE] = this.params.dopamineTrails ?? 0.0;

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
        uData[OFFSET_CORTISOL] = Math.max(this.params.cortisol, this.params.myelin_degradation || 0.0);
        uData[OFFSET_ALTITUDE] = this.params.altitude;
        uData[OFFSET_OXYGEN] = this.params.oxygenLevel;
        uData[OFFSET_HYPOXIA_STRESS] = this.params.hypoxiaStress;
        uData[OFFSET_METABOLIC_RATE] = this.params.metabolicRate;
        uData[OFFSET_MITOCHONDRIAL] = this.params.mitochondrialFunction;
        uData[OFFSET_FOG_DENSITY] = this.params.fogDensity;
        uData[OFFSET_ZOOM] = this.zoom;
        uData[OFFSET_HEAVY_METAL] = this.params.heavyMetal;
        uData[OFFSET_FLUID_ACTIVE] = this.params.fluidActive;
        uData[OFFSET_AI_INFLUENCE] = this.params.aiInfluence;
        uData[OFFSET_RESONANCE_THRESHOLD] = this.params.resonanceThreshold;
        uData[OFFSET_SYNAPTIX_ACTIVE] = this.params.style >= 4.0 ? 1.0 : 0.0;
        uData[OFFSET_AI_LAYER] = this.params.aiLayer;
        uData[OFFSET_POINT_CLOUD_DENSITY] = this.params.pointCloudDensity ?? 1.0;
        uData[OFFSET_FIBER_COUPLING] = this.params.fiberCoupling ?? 0.5;
        uData[OFFSET_CONNECTOME_VARIANT] = this.params.connectomeVariant ?? 0.0;
        uData[OFFSET_TMS_ACTIVE] = this.params.tmsActive;
        uData[OFFSET_TMS_CENTER] = this.params.tmsCenterX;
        uData[OFFSET_TMS_CENTER + 1] = this.params.tmsCenterY;
        uData[OFFSET_TMS_CENTER + 2] = this.params.tmsCenterZ;
        uData[OFFSET_TMS_PULSE] = this.params.tmsPulse;
        uData[OFFSET_TMS_RADIUS] = this.params.tmsRadius;
        uData[OFFSET_EDGEDETECTION] = this.params.edgeDetection;
        uData[OFFSET_PULSESATURATION] = this.params.pulseSaturation;
        uData[OFFSET_TRAILLENGTH] = this.params.trailLength;
        uData[OFFSET_LESIONCENTER] = this.params.lesionCenterX;
        uData[OFFSET_LESIONCENTER + 1] = this.params.lesionCenterY;
        uData[OFFSET_LESIONCENTER + 2] = this.params.lesionCenterZ;
        uData[OFFSET_LESIONACTIVE] = this.params.lesionActive;
        uData[OFFSET_LESIONRADIUS] = this.params.lesionRadius;
        uData[OFFSET_DECIMATION] = this.params.decimation;
        uData[OFFSET_PSYCHEDELIC] = this.params.psychedelic;
        uData[OFFSET_IMMUNEACTIVITY] = this.params.immuneActivity;
        uData[OFFSET_PLASTICITYDECAY] = this.params.plasticityDecay;
        uData[OFFSET_VISUALFATIGUE] = this.params.visualFatigue;
        uData[OFFSET_SENSORYDEPRIVATION] = this.params.sensoryDeprivation;
        uData[OFFSET_SPATIALMEMORY] = this.params.spatialMemory;
        uData[OFFSET_APOPTOSIS] = this.params.apoptosis;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        
        // Compute Uniforms layout (112 bytes total):
        // 32 bytes scalar block + 16 bytes stimulus block + 12 bytes hypoxia block
        // + 20 bytes hazards + 16 bytes padding + 16 bytes SynaptiX params.
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
        dv.setFloat32(72, this.params.cognitiveLoad, true);
        dv.setFloat32(76, this.params.stress, true);

        // [SynaptiX] AI Tensor Mirror params (offset 88)
        dv.setFloat32(88, this.params.aiInfluence, true);
        dv.setFloat32(92, this.params.resonanceThreshold, true);
        dv.setFloat32(96, this.params.style >= 4.0 ? 1.0 : 0.0, true);

        // [V3.2] Fiber-volume coupling strength (offset 100)
        dv.setFloat32(100, this.params.fiberCoupling ?? 0.5, true);

        // Upload to GPU
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);

        // Auto-reset pulse (single frame injection)
        if (this.stimulus.active > 0) {
            if (this.stimulus.decayRate > 0) {
                const now = performance.now();
                const dt = (now - this.stimulus.lastTime) / 1000.0; // convert to seconds
                this.stimulus.active = Math.max(0.0, this.stimulus.active - this.stimulus.decayRate * dt);
                this.stimulus.lastTime = now;
                if (this.stimulus.active === 0.0) {
                    this.stimulus.decayRate = 0.0; // stop decaying once zero
                }
            } else {
                this.stimulus.active = 0.0;
            }
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

        if (this.tms) {
            const elapsed = performance.now() - this.tms.startTime;
            if (elapsed > this.tms.duration) {
                this.tms = null;
                this.params.tmsActive = 0.0;
                this.params.tmsPulse = 0.0;
            } else {
                const rawProgress = elapsed / this.tms.duration;
                // smooth 0 -> 1 -> 0 pulse using sine
                this.params.tmsPulse = Math.sin(rawProgress * Math.PI) * this.tms.strength;

                // Add volumetric bias (energy impact)
                // We'll do this by injecting stimulus each frame of the pulse
                const pulseIntensity = this.params.tmsPulse * 0.1;
                if (pulseIntensity > 0.01) {
                    this.injectStimulus(this.params.tmsCenterX, this.params.tmsCenterY, this.params.tmsCenterZ, pulseIntensity, 0.0);
                }
            }
        }
        if (this.geometryDirty && (!this.lastGeometryRebuildTime || performance.now() - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
            this.rebuildGeometry();
        }
        
        const load = Math.max(0, Math.min(1, this.params.cognitiveLoad));
        const scale = Math.max(0.1, 1.0 - load); // Stronger load = more aggressive downscaling

        const targetWidth = Math.max(1, Math.floor(this.canvas.clientWidth * scale));
        const targetHeight = Math.max(1, Math.floor(this.canvas.clientHeight * scale));

        if (Math.abs(this.canvas.width - targetWidth) > 20 || Math.abs(this.canvas.height - targetHeight) > 20) {
            this.canvas.width = targetWidth;
            this.canvas.height = targetHeight;
            this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({ size: [targetWidth, targetHeight], format: 'depth32float', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });

            // Resize Render Target
            this.createRenderTarget(targetWidth, targetHeight);
            console.log(`[BrainRenderer] LoD adjusted: ${targetWidth}x${targetHeight} (load=${load.toFixed(2)})`);
        }

        this.time += 0.016;
        this.updateAltitudeState(); // Update altitude/hypoxia parameters before uniforms
        this.updateUniforms();
        
        const commandEncoder = this.device.createCommandEncoder();

        // Skip physics simulation when tensor playback is driving the voxel buffer directly
        if (!this.tensorPlaybackMode) {
            if (this.wasmMode && this.wasmEngine.available) {
                // [Phase 1 WASM] Hybrid path: C++ engine runs simulation on CPU,
                // result is uploaded to the WebGPU storage buffer each frame.
                this.wasmEngine.update(this.time, {
                    ...this.params,
                    _electricalActive: this.stimulus.electricalActive,
                    _mercuryActive:    this.stimulus.mercuryActive
                });
                const tensorData = this.wasmEngine.getTensorData();
                if (tensorData) {
                    this._lastHumanTensor.set(tensorData);
                    this.device.queue.writeBuffer(this.tensorBuffer, 0, tensorData);
                }
            } else {
                // Default path: WebGPU compute shader handles tensor physics on GPU.
                const computePass = commandEncoder.beginComputePass();
                computePass.setPipeline(this.computePipeline);
                computePass.setBindGroup(0, this.computeBindGroup);
                computePass.dispatchWorkgroups(Math.ceil(this.voxelBufferSize / 64));
                computePass.end();
            }
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
        
        const isSynaptiX = this.params.style >= 4.0;
        const isConnectome = this.params.style >= 2.0 && this.params.style < 3.0;
        const pointDensity = Math.max(0.0, this.params.pointCloudDensity ?? 1.0);
        const pointCloudDrawCount = Math.floor(this.pointCloudInstanceCount * Math.min(1.0, pointDensity));
        const somaDrawCount = Math.floor(this.somaInstanceCount * Math.min(1.0, 0.35 + pointDensity * 0.65));

        if (isConnectome || isSynaptiX) {
            // --- CONNECTOME / SYNAPTIX MODE ---

            // 1. Draw Fibers
            renderPass.setPipeline(this.fiberPipeline);
            renderPass.setVertexBuffer(0, this.fiberBuffer);
            renderPass.setVertexBuffer(1, this.fiberNormalBuffer);
            renderPass.setVertexBuffer(2, this.fiberMetaBuffer);
            renderPass.setVertexBuffer(3, this.fiberPathBuffer);
            renderPass.draw(this.fiberVertexCount);

            // 2. Draw Dense Point Cloud (Boutons / Varicosities) [V3.1]
            if (pointCloudDrawCount > 0) {
                renderPass.setPipeline(this.pointCloudPipeline);
                renderPass.setVertexBuffer(0, this.pointCloudQuadBuffer);
                renderPass.setVertexBuffer(1, this.pointCloudInstanceBuffer);
                renderPass.draw(6, pointCloudDrawCount);
            }

            // 3. Draw Instanced Mesh Somas (Hubs / Medium) [V3.1 Pipeline]
            if (somaDrawCount > 0) {
                renderPass.setPipeline(this.somaPipeline);
                renderPass.setVertexBuffer(0, this.somaVertexBuffer); // Mesh
                renderPass.setVertexBuffer(1, this.somaInstanceBuffer); // Rich instance data
                renderPass.setIndexBuffer(this.somaIndexBuffer, 'uint16');
                renderPass.drawIndexed(this.somaIndexCount, somaDrawCount);
            }

            // 4. Draw Emissive Sparks / Vesicles
            if (this.sparkInstanceCount > 0) {
                renderPass.setPipeline(this.sparkPipeline);
                renderPass.setVertexBuffer(0, this.sparkQuadBuffer);
                renderPass.setVertexBuffer(1, this.sparkInstanceBuffer);
                renderPass.draw(6, this.sparkInstanceCount);
            }
        }

        if (!isConnectome || isSynaptiX) {
            // --- SOLID MESH MODE (Organic / Cyber / Heatmap / SynaptiX overlay) ---
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
        if (!float32Array || float32Array.length !== this.voxelCount) {
            console.warn(`[BrainRenderer] Ignored human tensor update with invalid size: ${float32Array?.length ?? 'null'}`);
            return;
        }
        this._lastHumanTensor.set(float32Array);
        this.device.queue.writeBuffer(this.tensorBuffer, 0, float32Array);
    }

    setAITensorData(float32Array) {
        if (!float32Array || float32Array.length !== this.voxelCount) {
            console.warn(`[BrainRenderer] Ignored AI tensor update with invalid size: ${float32Array?.length ?? 'null'}`);
            return;
        }
        this._lastAITensor.set(float32Array);
        this.device.queue.writeBuffer(this.aiTensorBuffer, 0, float32Array);
    }

    start() { this.isRunning = true; this.render(); }
    stop() { this.isRunning = false; }
}

applyPipelineMethods(BrainRenderer);
applyGeometryMethods(BrainRenderer);
applyStimulusMethods(BrainRenderer);
applyUniformsMethods(BrainRenderer);
applyRenderLoopMethods(BrainRenderer);
applyCoreMethods(BrainRenderer);
applySynaptiXBridgeMethods(BrainRenderer);

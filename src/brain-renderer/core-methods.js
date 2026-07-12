import { BrainGeometry } from '../brain-geometry.js';
import { vertexShader, fragmentShader, fiberVertexShader, fiberFragmentShader, computeShader, somaVertexShader, somaFragmentShader, sparkVertexShader, sparkFragmentShader, postVertexShader, postFragmentShader, pointCloudVertexShader, pointCloudFragmentShader } from '../shaders.js';

export function applyCoreMethods(Target) {
    Target.prototype.setupInputHandlers = function() {
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
    };

    Target.prototype.setCameraParams = function({ rotation, zoom, fov }) {
 rotation, zoom, fov 
    };

    Target.prototype.initialize = async function() {
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
    };

    Target.prototype.setParams = function(newParams) {
        const geometryKeys = ['foldScale', 'foldStrength', 'fissureDepth', 'lobeFoldBias', 'corticalThickness', 'growth', 'networkTopology', 'fiberSymmetry', 'bundleCoherence'];
        const geometryChanged = geometryKeys.some((key) => newParams[key] !== undefined && newParams[key] !== this.params[key]);
        this.params = { ...this.params, ...newParams };
        if (geometryChanged) {
    this.geometryDirty = true;
        }
    };

    Target.prototype.setSynaptiXParams = function(newParams) {
        this.setParams(newParams);
    };

    Target.prototype.setVoxelData = function(float32Array) {
        if (!float32Array || float32Array.length !== this.voxelCount) {
    console.warn(`[BrainRenderer] Ignored human tensor update with invalid size: ${float32Array?.length ?? 'null'}`);
    return;
        }
        this._lastHumanTensor.set(float32Array);
        this.device.queue.writeBuffer(this.tensorBuffer, 0, float32Array);
    };

    Target.prototype.setAITensorData = function(float32Array) {
        if (!float32Array || float32Array.length !== this.voxelCount) {
    console.warn(`[BrainRenderer] Ignored AI tensor update with invalid size: ${float32Array?.length ?? 'null'}`);
    return;
        }
        this._lastAITensor.set(float32Array);
        this.device.queue.writeBuffer(this.aiTensorBuffer, 0, float32Array);
    };

    Target.prototype.start = function() {
 this.isRunning = true; this.render(); 
    };

    Target.prototype.stop = function() {
 this.isRunning = false; 
    };

}

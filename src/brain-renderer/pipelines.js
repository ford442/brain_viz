import { vertexShader, fragmentShader, fiberVertexShader, fiberFragmentShader, computeShader, somaVertexShader, somaFragmentShader, sparkVertexShader, sparkFragmentShader, postVertexShader, postFragmentShader, pointCloudVertexShader, pointCloudFragmentShader } from '../shaders.js';
import { RENDER_UNIFORM_BUFFER_SIZE, COMPUTE_UNIFORM_BUFFER_SIZE } from './constants.js';

export function applyPipelineMethods(Target) {
    Target.prototype.initVolumetricResources = function() {
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
        this.avatarAUniformBuffer = this.device.createBuffer({
    size: RENDER_UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        this.partnerUniformBuffer = this.device.createBuffer({
    size: RENDER_UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Compute uniforms: TensorParams is 64 bytes after alignment.
        this.computeUniformBuffer = this.device.createBuffer({
    size: COMPUTE_UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
    };

    Target.prototype.uploadFiberDirections = function(geometry) {
        const data = geometry.getFiberAffinityData();
        if (data && data.byteLength === this.voxelCount * 12 * 4) {
    this.device.queue.writeBuffer(this.fiberDirectionBuffer, 0, data);
        }
    };

    Target.prototype.initSomaResources = function(geometry) {
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
    };

    Target.prototype.initSparkResources = function(geometry) {
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
    };

    Target.prototype.initSomaPipeline = function(renderBindGroupLayout, format) {
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
    };

    Target.prototype.initSparkPipeline = function(renderBindGroupLayout, format) {
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
    };

    Target.prototype.initPointCloudPipeline = function(renderBindGroupLayout, format) {
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
    };

    Target.prototype.initComputePipeline = function() {
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
    };

    Target.prototype.initPostProcessing = function(format) {
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
    };

    Target.prototype.createRenderTarget = function(width, height) {
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
    };

    Target.prototype.createBuffer = function(data, usage) {
        const buffer = this.device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    };

}

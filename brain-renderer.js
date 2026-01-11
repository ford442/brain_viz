// brain-renderer.js
// Verified Neuro-Weaver V2.1 Implementation
import { BrainGeometry } from './brain-geometry.js';
import { vertexShader, fragmentShader, computeShader, sphereVertexShader, sphereFragmentShader } from './shaders.js';
import { Mat4 } from './math-utils.js';

export class BrainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;

        // Pipelines
        this.pipeline = null;      // Solid Mesh
        this.fiberPipeline = null; // Lines
        this.spherePipeline = null;// Instanced Spheres (Somas)
        
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        this.time = 0;
        this.isRunning = false;
        
        this.params = {
            frequency: 2.0,
            amplitude: 0.5,
            spikeThreshold: 0.8,
            smoothing: 0.9,
            style: 0.0, // 0=Organic, 1=Cyber, 2=Connectome, 3=Heatmap
            clipZ: 2.0  // Slice plane Z value (Starts outside bounds)
        };

        // Voxel Grid Settings
        // 32x32x32 flattened buffer
        this.voxelDim = 32;
        this.voxelCount = this.voxelDim * this.voxelDim * this.voxelDim;

        // Stimulus State
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0
        };
        
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
            this.zoom = Math.max(2, Math.min(10, this.zoom + e.deltaY * 0.01));
        });
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
        
        // 3. Soma (Sphere) Instancing
        // Use explicit grid intersections from geometry
        const somaPositions = geometry.getSomaPositions();
        this.somaInstanceBuffer = this.createBuffer(somaPositions, GPUBufferUsage.VERTEX);
        this.somaInstanceCount = somaPositions.length / 3;

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

        this.sphereVertexBuffer = this.createBuffer(icoVerts, GPUBufferUsage.VERTEX);
        this.sphereIndexBuffer = this.createBuffer(icoIndices, GPUBufferUsage.INDEX);
        this.sphereIndexCount = icoIndices.length;


        // VOXEL DATA
        this.dataSize = this.voxelCount;
        this.tensorBuffer = this.device.createBuffer({
            size: this.dataSize * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        // Uniforms (Size increased for ClipPlane)
        // 48 floats (192 bytes)
        // Layout:
        // MVP (64), Model (64), Time(4), Style(4), Pad(8), ClipPlane(16)
        this.uniformBuffer = this.device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        
        this.computeUniformBuffer = this.device.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        
        // Bind Groups Layouts
        const renderBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } }
            ]
        });
        
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
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
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
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' } 
        });

        // --- PIPELINE 3: INSTANCED SPHERES ---
        this.spherePipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: sphereVertexShader }),
                entryPoint: 'main',
                buffers: [
                    // 1. Mesh Geometry (Cube/Sphere)
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    // 2. Instance Data (Positions)
                    { arrayStride: 12, stepMode: 'instance', attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: sphereFragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }]
            },
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
        });


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

        this.depthTexture = this.device.createTexture({ size: [this.canvas.width, this.canvas.height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });

        console.log("Renderer V2.1 Initialized");
    }

    createBuffer(data, usage) {
        const buffer = this.device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    setParams(newParams) { this.params = { ...this.params, ...newParams }; }

    injectStimulus(x, y, z, strength) {
        this.stimulus.pos = [x, y, z];
        this.stimulus.active = strength;
    }

    calmState() {
        // Clear all activity by resetting parameters to a "Calm" state.
        // Setting amplitude low prevents new chaotic waves.
        // Setting smoothing high (0.98) causes existing activity to decay very slowly,
        // creating a "settling down" effect rather than an abrupt cutoff.
        this.params.amplitude = 0.1;
        this.params.frequency = 0.5;
        this.params.smoothing = 0.98;
    }

    updateUniforms() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(Math.PI / 4, aspect, 0.1, 100.0);
        const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);
        const model = Mat4.multiply(Mat4.rotateX(this.rotation.x), Mat4.rotateY(this.rotation.y));

        const pv = Mat4.multiply(view, projection);
        const mvp = Mat4.multiply(model, pv);
        
        // Uniform Buffer Size 192 bytes
        const uData = new Float32Array(48); // 48 * 4 = 192 bytes
        uData.set(mvp, 0);       // 0-15
        uData.set(model, 16);    // 16-31
        uData[32] = this.time;
        uData[33] = this.params.style;

        // Clip Plane: Vec4 (Normal X, Y, Z, Distance)
        // We want to clip if dot(pos, N) + D < 0
        // Standard Z clip: Keep if P.z < clipZ -> -P.z + clipZ > 0
        // Normal (0,0,-1), D = clipZ
        uData[36] = 0.0; // Px
        uData[37] = 0.0; // Py
        uData[38] = -1.0; // Pz (Normal pointing backward)
        uData[39] = this.params.clipZ; // Distance

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        
        // Compute Uniforms (48 bytes)
        const cBuf = new ArrayBuffer(48);
        const dv = new DataView(cBuf);
        dv.setFloat32(0, this.time, true);
        dv.setUint32(4, this.voxelDim, true);
        dv.setFloat32(8, this.params.frequency, true);
        dv.setFloat32(12, this.params.amplitude, true);
        dv.setFloat32(16, this.params.spikeThreshold, true);
        dv.setFloat32(20, this.params.smoothing, true);
        dv.setFloat32(24, this.params.style, true);
        dv.setFloat32(28, 0.0, true);

        dv.setFloat32(32, this.stimulus.pos[0], true);
        dv.setFloat32(36, this.stimulus.pos[1], true);
        dv.setFloat32(40, this.stimulus.pos[2], true);
        dv.setFloat32(44, this.stimulus.active, true);

        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);

        this.stimulus.active = 0.0;
    }

    render() {
        if (!this.isRunning) return;
        
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (width === 0 || height === 0) return;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width; this.canvas.height = height;
            this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({ size: [width, height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        }

        this.time += 0.016;
        this.updateUniforms();
        
        const commandEncoder = this.device.createCommandEncoder();
        
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.dataSize / 64));
        computePass.end();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
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

            // 2. Draw Instanced Neurons (Somas)
            renderPass.setPipeline(this.spherePipeline);
            renderPass.setVertexBuffer(0, this.sphereVertexBuffer); // Mesh
            renderPass.setVertexBuffer(1, this.somaInstanceBuffer); // Positions
            renderPass.setIndexBuffer(this.sphereIndexBuffer, 'uint16');
            renderPass.drawIndexed(this.sphereIndexCount, this.somaInstanceCount);

        } else {
            renderPass.setPipeline(this.pipeline);
            renderPass.setVertexBuffer(0, this.vertexBuffer);
            renderPass.setVertexBuffer(1, this.normalBuffer);
            renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
            renderPass.drawIndexed(this.indexCount);
        }
        
        renderPass.end();
        this.device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(() => this.render());
    }

    start() { this.isRunning = true; this.render(); }
    stop() { this.isRunning = false; }
}

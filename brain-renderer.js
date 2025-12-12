// brain-renderer.js
import { BrainGeometry } from './brain-geometry.js';
import { vertexShader, fragmentShader, computeShader } from './shaders.js';
import { Mat4 } from './math-utils.js';

export class BrainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.pipeline = null;      // For Solid Mesh
        this.fiberPipeline = null; // For Lines
        
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
            style: 0.0 // 0=Organic, 1=Cyber, 2=Connectome
        };
        
        this.setupInputHandlers();
    }
    
    // ... setupInputHandlers() ... (Same as before)
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
        this.device = await adapter.requestDevice();
        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({ device: this.device, format: format, alphaMode: 'opaque' });
        
        // Geometry
        const geometry = new BrainGeometry();
        geometry.generate(80, 50); // High density for good fibers
        
        // 1. Solid Mesh Buffers
        this.vertexBuffer = this.createBuffer(geometry.getVertexData(), GPUBufferUsage.VERTEX);
        this.normalBuffer = this.createBuffer(geometry.getNormalData(), GPUBufferUsage.VERTEX);
        this.indexBuffer = this.createBuffer(geometry.getIndexData(), GPUBufferUsage.INDEX);
        this.indexCount = geometry.getIndexCount();
        
        // 2. Fiber Line Buffers
        this.fiberBuffer = this.createBuffer(geometry.getFiberData(), GPUBufferUsage.VERTEX);
        this.fiberVertexCount = geometry.getFiberVertexCount();
        
        // Tensor Data
        this.dataSize = geometry.getVertexCount();
        this.tensorBuffer = this.device.createBuffer({ size: this.dataSize * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        
        // Uniforms
        this.uniformBuffer = this.device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.computeUniformBuffer = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        
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
        
        // --- PIPELINE 1: SOLID MESH (Triangle List) ---
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

        // --- PIPELINE 2: FIBERS (Line List) ---
        this.fiberPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: vertexShader }),
                entryPoint: 'main', // Uses same shader, logic inside handles style
                buffers: [
                    // Only 1 buffer for fibers (Position), we calc normal in shader or assume spherical
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] } 
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' } } }] // Additive blend for glow
            },
            primitive: { topology: 'line-list' }, // Crucial for drawing lines
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth24plus' } // Disable depth write for transparent glow
        });

        // Compute Pipeline (Same as before)
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
    }

    createBuffer(data, usage) {
        const buffer = this.device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
        this.device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    setParams(newParams) { this.params = { ...this.params, ...newParams }; }

    updateUniforms() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(Math.PI / 4, aspect, 0.1, 100.0);
        const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);
        const model = Mat4.multiply(Mat4.rotateY(this.rotation.y), Mat4.rotateX(this.rotation.x));
        const mvp = Mat4.multiply(Mat4.multiply(projection, view), model);
        
        const uData = new Float32Array(40);
        uData.set(mvp, 0); uData.set(model, 16);
        uData[32] = this.time; uData[33] = this.params.style;
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        
        const cBuf = new ArrayBuffer(32);
        const dv = new DataView(cBuf);
        dv.setFloat32(0, this.time, true);
        dv.setUint32(4, this.dataSize, true);
        dv.setFloat32(8, this.params.frequency, true);
        dv.setFloat32(12, this.params.amplitude, true);
        dv.setFloat32(16, this.params.spikeThreshold, true);
        dv.setFloat32(20, this.params.smoothing, true);
        dv.setFloat32(24, this.params.style, true);
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);
    }
    
    render() {
        if (!this.isRunning) return;
        
        // Resize check... (omitted for brevity, same as before)
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width; this.canvas.height = height;
            this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({ size: [width, height], format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });
        }

        this.time += 0.016;
        this.updateUniforms();
        
        const commandEncoder = this.device.createCommandEncoder();
        
        // Compute Pass
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.dataSize / 64));
        computePass.end();
        
        // Render Pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }, // Back to black background
                loadOp: 'clear', storeOp: 'store'
            }],
            depthStencilAttachment: { view: this.depthTexture.createView(), depthClearValue: 1.0, depthLoadOp: 'clear', depthStoreOp: 'store' }
        });
        
        renderPass.setBindGroup(0, this.bindGroup);
        
        // SWITCH RENDER MODE
        if (this.params.style >= 2.0) {
            // --- CONNECTOME MODE (FIBERS) ---
            renderPass.setPipeline(this.fiberPipeline);
            renderPass.setVertexBuffer(0, this.fiberBuffer);
            // Draw lines (2 vertices per fiber)
            renderPass.draw(this.fiberVertexCount); 
        } else {
            // --- SOLID MODES (ORGANIC / CYBER) ---
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

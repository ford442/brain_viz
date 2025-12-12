// Main brain renderer using WebGPU
import { BrainGeometry } from './brain-geometry.js';
import { vertexShader, fragmentShader, computeShader } from './shaders.js';
import { Mat4 } from './math-utils.js';

export class BrainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.pipeline = null;
        this.computePipeline = null;
        
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        
        this.time = 0;
        this.isRunning = false;
        // Default shader params (can be updated via UI)
        this.params = {
            frequency: 2.0,
            amplitude: 0.5,
            spikeThreshold: 0.8,
            smoothing: 0.9
        };
        
        this.setupInputHandlers();
    }
    
    setupInputHandlers() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        
        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - lastX;
                const deltaY = e.clientY - lastY;
                
                this.targetRotation.y += deltaX * 0.01;
                this.targetRotation.x += deltaY * 0.01;
                
                // Clamp X rotation
                this.targetRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.targetRotation.x));
                
                lastX = e.clientX;
                lastY = e.clientY;
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });
        
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom += e.deltaY * 0.01;
            this.zoom = Math.max(2, Math.min(10, this.zoom));
        });
    }
    
    async initialize() {
        // Request adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No GPU adapter found');
        }
        
        this.device = await adapter.requestDevice();
        
        // Configure canvas
        this.context = this.canvas.getContext('webgpu');
        const format = navigator.gpu.getPreferredCanvasFormat();
        
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: 'opaque',
        });
        
        // Generate brain geometry
        const geometry = new BrainGeometry();
        geometry.generate(64, 32);
        
        // Create vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            size: geometry.getVertexData().byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, geometry.getVertexData());
        
        // Create normal buffer
        this.normalBuffer = this.device.createBuffer({
            size: geometry.getNormalData().byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.normalBuffer, 0, geometry.getNormalData());
        
        // Create index buffer
        this.indexBuffer = this.device.createBuffer({
            size: geometry.getIndexData().byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.indexBuffer, 0, geometry.getIndexData());
        this.indexCount = geometry.getIndexCount();
        
        // Create tensor data buffer
        const dataSize = geometry.getVertexCount();
        this.tensorBuffer = this.device.createBuffer({
            size: dataSize * 4, // f32
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        
        // Initialize tensor data
        const initialData = new Float32Array(dataSize);
        for (let i = 0; i < dataSize; i++) {
            initialData[i] = Math.sin(i * 0.1) * 0.5;
        }
        this.device.queue.writeBuffer(this.tensorBuffer, 0, initialData);
        
        // Create uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            size: 144, // mat4x4 (64) + mat4x4 (64) + f32 (4) + vec3 (12)
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Create compute uniform buffer
        this.computeUniformBuffer = this.device.createBuffer({
            size: 32, // time (4) + dataSize (4) + frequency (4) + amplitude (4) + spikeThreshold (4) + smoothing (4) + padding
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Create bind group layout for rendering
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'read-only-storage' }
                }
            ]
        });
        
        // Create bind group for rendering
        this.bindGroup = this.device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.tensorBuffer } }
            ]
        });
        
        // Create compute bind group layout
        const computeBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'storage' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: { type: 'uniform' }
                }
            ]
        });
        
        // Create compute bind group
        this.computeBindGroup = this.device.createBindGroup({
            layout: computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.tensorBuffer } },
                { binding: 1, resource: { buffer: this.computeUniformBuffer } }
            ]
        });
        
        // Create render pipeline
        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });
        
        this.pipeline = this.device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: this.device.createShaderModule({ code: vertexShader }),
                entryPoint: 'main',
                buffers: [
                    {
                        arrayStride: 12,
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    },
                    {
                        arrayStride: 12,
                        attributes: [{
                            shaderLocation: 1,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    }
                ]
            },
            fragment: {
                module: this.device.createShaderModule({ code: fragmentShader }),
                entryPoint: 'main',
                targets: [{ format: format }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: 'depth24plus'
            }
        });
        
        // Create compute pipeline
        const computePipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [computeBindGroupLayout]
        });
        
        this.computePipeline = this.device.createComputePipeline({
            layout: computePipelineLayout,
            compute: {
                module: this.device.createShaderModule({ code: computeShader }),
                entryPoint: 'main'
            }
        });
        
        // Create depth texture
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        
        this.dataSize = dataSize;
    }

    // Update params from UI/controls
    setParams(newParams) {
        this.params = { ...this.params, ...newParams };
    }
    
    updateUniforms() {
        // Smooth rotation
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        
        // Create matrices
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(Math.PI / 4, aspect, 0.1, 100.0);
        
        const eye = [0, 0, this.zoom];
        const center = [0, 0, 0];
        const up = [0, 1, 0];
        const view = Mat4.lookAt(eye, center, up);
        
        const rotX = Mat4.rotateX(this.rotation.x);
        const rotY = Mat4.rotateY(this.rotation.y);
        const model = Mat4.multiply(rotY, rotX);
        
        const viewProj = Mat4.multiply(projection, view);
        const mvp = Mat4.multiply(viewProj, model);
        
        // Update uniform buffer
        const uniformData = new Float32Array(36);
        uniformData.set(mvp, 0);
        uniformData.set(model, 16);
        uniformData[32] = this.time;
        
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        
        // Update compute uniforms
        // Build a mixed-type buffer (float32 + uint32) using DataView for correct types
        const computeBuffer = new ArrayBuffer(32);
        const dv = new DataView(computeBuffer);
        dv.setFloat32(0, this.time, true); // time at offset 0
        dv.setUint32(4, this.dataSize, true); // dataSize as u32 at offset 4
        dv.setFloat32(8, this.params.frequency, true);
        dv.setFloat32(12, this.params.amplitude, true);
        dv.setFloat32(16, this.params.spikeThreshold, true);
        dv.setFloat32(20, this.params.smoothing, true);
        dv.setFloat32(24, 0.0, true); // padding
        dv.setFloat32(28, 0.0, true); // padding
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, computeBuffer);
    }
    
    render() {
        if (!this.isRunning) return;
        
        // Update canvas size
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            
            // Recreate depth texture
            this.depthTexture.destroy();
            this.depthTexture = this.device.createTexture({
                size: [width, height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT
            });
        }
        
        // Update time and uniforms
        this.time += 0.016;
        this.updateUniforms();
        
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        
        // Compute pass - update tensor data
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        const workgroupCount = Math.ceil(this.dataSize / 64);
        computePass.dispatchWorkgroups(workgroupCount);
        computePass.end();
        
        // Render pass
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        
        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setVertexBuffer(0, this.vertexBuffer);
        renderPass.setVertexBuffer(1, this.normalBuffer);
        renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
        renderPass.drawIndexed(this.indexCount);
        renderPass.end();
        
        this.device.queue.submit([commandEncoder.finish()]);
        
        requestAnimationFrame(() => this.render());
    }
    
    start() {
        this.isRunning = true;
        this.render();
    }
    
    stop() {
        this.isRunning = false;
    }
}

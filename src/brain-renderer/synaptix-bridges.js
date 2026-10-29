// @ts-check
import { synaptixBridgeVertexShader, synaptixBridgeFragmentShader } from '../shaders/synaptix-bridge.js';
import { BRIDGE_MAX_VERTICES, forEachBridgeVertex } from '../multi-brain-layout.js';

const MAX_VERTICES = BRIDGE_MAX_VERTICES;

export function applySynaptiXBridgeMethods(Target) {
    Target.prototype.initSynaptiXBridges = function(format) {
        this.synaptixBridgeData = new Float32Array(MAX_VERTICES * 6);
        this.synaptixBridgeBuffer = this.device.createBuffer({
            size: this.synaptixBridgeData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        const layout = this.device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
        });
        this.synaptixBridgeBindGroup = this.device.createBindGroup({
            layout,
            entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
        });
        this.synaptixBridgePipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            vertex: {
                module: this.device.createShaderModule({ code: synaptixBridgeVertexShader }),
                entryPoint: 'main',
                buffers: [{
                    arrayStride: 24,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 12, format: 'float32x3' },
                    ],
                }],
            },
            fragment: {
                module: this.device.createShaderModule({ code: synaptixBridgeFragmentShader }),
                entryPoint: 'main',
                targets: [{
                    format,
                    blend: {
                        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
                        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
                    },
                }],
            },
            primitive: { topology: 'line-list' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' },
        });
        this.synaptixBridgeVertexCount = 0;
    };

    Target.prototype.updateSynaptiXBridges = function() {
        if (!this.synaptixBridgeData || !this.synaptixBridgeBuffer) return;
        const data = this.synaptixBridgeData;
        let offset = 0;
        const vertex = forEachBridgeVertex(this.synaptixCouplingState, performance.now(), (position, color) => {
            data.set(position, offset);
            data.set(color, offset + 3);
            offset += 6;
        });
        this.synaptixBridgeVertexCount = vertex;
        this.device.queue.writeBuffer(this.synaptixBridgeBuffer, 0, this.synaptixBridgeData, 0, vertex * 6);
    };
}


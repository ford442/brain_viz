import { synaptixBridgeVertexShader, synaptixBridgeFragmentShader } from '../shaders/synaptix-bridge.js';

const REGION_ANCHORS = {
    frontal: [0.55, 0.2, 0.72],
    occipital: [0.55, 0.0, -0.72],
    parietal: [0.52, 0.68, 0.0],
    temporal: [0.66, -0.22, 0.05],
    deep: [0.42, 0.0, 0.0],
};
const SEGMENTS = 16;
const MAX_VERTICES = Object.keys(REGION_ANCHORS).length * SEGMENTS * 2;

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
        const state = this.synaptixCouplingState || {};
        const regions = state.regions || {};
        const now = performance.now();
        const empathy = state.empathyPulse;
        const divergence = state.divergenceStorm;
        let vertex = 0;
        for (const [name, anchor] of Object.entries(REGION_ANCHORS)) {
            let coupling = Math.max(0, Math.min(1, regions[name] || 0));
            if (empathy?.region === name) {
                const phase = Math.max(0, Math.min(1, (now - empathy.startedAt) / (empathy.endsAt - empathy.startedAt)));
                coupling = Math.max(coupling, Math.sin(phase * Math.PI) * empathy.intensity);
            }
            const storm = divergence?.intensity || 0;
            const glow = Math.max(0.05, coupling * (1 - storm * 0.65));
            const start = [-1.05 + anchor[0] * 0.62, anchor[1] * 0.62, anchor[2] * 0.62];
            const end = [1.05 - anchor[0] * 0.62, anchor[1] * 0.62, anchor[2] * 0.62];
            let previous = start;
            for (let segment = 1; segment <= SEGMENTS; segment++) {
                const t = segment / SEGMENTS;
                const lift = Math.sin(t * Math.PI) * (0.18 + coupling * 0.28);
                const jitter = storm * 0.08 * Math.sin(segment * 4.7 + now * 0.012 + vertex);
                const point = [
                    start[0] + (end[0] - start[0]) * t,
                    start[1] + lift + jitter,
                    start[2] + (end[2] - start[2]) * t + jitter * 0.5,
                ];
                for (const position of [previous, point]) {
                    const offset = vertex * 6;
                    this.synaptixBridgeData.set(position, offset);
                    this.synaptixBridgeData[offset + 3] = glow + storm * 0.35;
                    this.synaptixBridgeData[offset + 4] = glow * 0.82 + storm * 0.05;
                    this.synaptixBridgeData[offset + 5] = glow * 0.35 + storm * 0.65;
                    vertex++;
                }
                previous = point;
            }
        }
        this.synaptixBridgeVertexCount = vertex;
        this.device.queue.writeBuffer(this.synaptixBridgeBuffer, 0, this.synaptixBridgeData, 0, vertex * 6);
    };
}


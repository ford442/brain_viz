// @ts-check
// src/brain-renderer/clipmap.js
// [Clipmap] WebGPU side of the clipmap field (Phase B) and the recursive-zoom
// cortical patch (Phase C) — docs/field-resolution.md §7.
//
// Policy lives in src/clipmap/clipmap-controller.js (pure JS, Node-tested);
// this mixin owns the GPU objects and turns the controller's per-frame
// decision into work:
//
//   textures  brickStateTextureA     rg32float 64³     fine state (r) + coarse at texel (g)
//             brickStateTextureB     rg32float 64³     the same, after the step, before correction
//             brickRenderTexture     rgba16float 64³   what render shaders sample
//             brickAffinityTexture   rgba32float 64×64×192  tract atlas, 1 slab/slot
//             brickMeansTexture      rg32float 8³      restriction cell means (§11.3)
//   passes    coarse compute → brick compute (step A→B, restrict B, correct B→A
//             + render copy) → scene → post
//             (the brick reads the coarse field the coarse pass just wrote, and
//             the scene reads the brick the brick pass just wrote — encoder
//             order is the synchronisation, as for the coarse field itself)
//   draws     cortical patch surface + laminar somas, or point impostors
//
// Everything here is WebGPU-only. The WebGL2 fallback steps the coarse field
// on the CPU and reports the brick as unsupported (docs/webgl-fallback.md).

import { ClipmapController, cameraDirectionInModel } from '../clipmap/clipmap-controller.js';
import {
    AFFINITY_SLOTS,
    BRICK_CHUNK_DIM,
    BRICK_DIM,
    FINE_LATTICE_DIM,
    brickResourceBytes,
    toroidalTexel,
} from '../clipmap/brick-layout.js';
import { EMPTY_CHUNK } from '../clipmap/affinity-chunks.js';
import { PATCH_SOMA_FLOATS, PATCH_VERTEX_FLOATS } from '../clipmap/cortical-patch.js';
import { BRICK_MEAN_CELL, BRICK_WORKGROUP, brickComputeShader, brickCorrectShader, brickRestrictShader } from '../shaders/brick-compute.js';
import {
    patchFragmentShader,
    patchImpostorFragmentShader,
    patchImpostorVertexShader,
    patchSomaFragmentShader,
    patchSomaVertexShader,
    patchVertexShader,
} from '../shaders/cortical-patch.js';
import { BRICK_UNIFORM_BYTE_SIZE, BRICK_UNIFORM_FLOAT_COUNT, BRICK_UNIFORM_OFFSETS as B } from '../shaders/uniform-layout.js';

const CHUNK_TEXELS = BRICK_CHUNK_DIM ** 3;
/** Bytes of one slot's plane in a planar chunk (vec4<f32> per voxel). */
const CHUNK_SLOT_BYTES = CHUNK_TEXELS * 16;
/** Shared zero block for clearing a chunk's atlas texels.
 * @type {Float32Array|null} */
let zeroChunk = null;

const ADDITIVE_PREMULTIPLIED = {
    color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
};

/**
 * Throws if this device cannot hold the brick. Like assertDeviceCanHold() in
 * resolution.js, a device that clamped deriveRequiredLimits() down is a
 * refusal, reported in the clipmap state — never a silently smaller brick.
 * @param {GPUDevice} device
 */
function assertDeviceCanHoldBrick(device) {
    const limits = device.limits;
    const tallest = BRICK_DIM * AFFINITY_SLOTS;
    if (limits.maxTextureDimension3D < tallest) {
        throw new Error(`[Clipmap] the affinity atlas needs 3D textures of ${tallest} texels; this device allows ${limits.maxTextureDimension3D}.`);
    }
    if (limits.maxStorageTexturesPerShaderStage < 2) {
        throw new Error('[Clipmap] the brick correct pass writes two storage textures; this device allows fewer.');
    }
}

export function applyClipmapMethods(Target) {
    /** Creates the controller. Called from the constructor (no device yet). */
    Target.prototype.createClipmapController = function() {
        this.clipmap = new ClipmapController({
            gpu: {
                uploadAffinityChunk: (chunk, data) => this.uploadAffinityChunk(chunk, data),
                clearAffinityChunk: (chunk) => this.uploadAffinityChunk(chunk, EMPTY_CHUNK),
                uploadPatch: (patch) => this.uploadCorticalPatch(patch),
            },
        });
        this.clipmapFrame = this.clipmap.lastFrame;
        this.patchGpu = null;
        this._lastRenderAt = 0;
        this._lastEncodeMs = 0;
    };

    /**
     * Allocates every brick/patch GPU object. Called from initialize() after
     * the render bind group layout exists and before the render bind groups
     * are created (they bind the brick render texture). On a device that
     * cannot hold the brick, allocates a 1³ placeholder render texture so the
     * shared bind group stays valid, and marks the clipmap unsupported.
     * @param {GPUTextureFormat} format
     */
    Target.prototype.initClipmap = function(format) {
        const device = this.device;
        this.brickSampler = device.createSampler({
            label: 'brick-sampler',
            magFilter: 'linear',
            minFilter: 'linear',
            // Toroidal addressing: texel s holds lattice voxel g ≡ s (mod 64),
            // so wrapping *is* the right neighbour everywhere but the brick's
            // outer face, which render shaders mask (brickEdgeMask).
            addressModeU: 'repeat',
            addressModeV: 'repeat',
            addressModeW: 'repeat',
        });

        try {
            assertDeviceCanHoldBrick(device);
        } catch (err) {
            this.brickRenderTexture = device.createTexture({
                label: 'brick-render-placeholder',
                size: [1, 1, 1],
                dimension: '3d',
                format: 'rgba16float',
                usage: GPUTextureUsage.TEXTURE_BINDING,
            });
            this.clipmap.setSupported(false, /** @type {Error} */ (err).message);
            console.warn(/** @type {Error} */ (err).message);
            return;
        }

        const stateTexture = (label) => device.createTexture({
            label,
            size: [BRICK_DIM, BRICK_DIM, BRICK_DIM],
            dimension: '3d',
            format: 'rg32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        this.brickStateTextureA = stateTexture('brick-state');
        this.brickStateTextureB = stateTexture('brick-stepped');
        this.brickRenderTexture = device.createTexture({
            label: 'brick-render',
            size: [BRICK_DIM, BRICK_DIM, BRICK_DIM],
            dimension: '3d',
            format: 'rgba16float',
            // COPY_SRC: readBrickSnapshot() (verification / debugging).
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
        });
        this.brickAffinityTexture = device.createTexture({
            label: 'brick-affinity-atlas',
            size: [BRICK_DIM, BRICK_DIM, BRICK_DIM * AFFINITY_SLOTS],
            dimension: '3d',
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        const cells = BRICK_DIM / BRICK_MEAN_CELL;
        this.brickMeansTexture = device.createTexture({
            label: 'brick-cell-means',
            size: [cells, cells, cells],
            dimension: '3d',
            format: 'rg32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        this.brickUniformBuffer = device.createBuffer({
            label: 'brick-params',
            size: BRICK_UNIFORM_BYTE_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const unfilterable3d = { sampleType: 'unfilterable-float', viewDimension: '3d' };
        const storage3d = (format) => ({ access: 'write-only', format, viewDimension: '3d' });
        const C = GPUShaderStage.COMPUTE;
        this.brickBindGroupLayout = device.createBindGroupLayout({
            label: 'brick-step',
            entries: [
                { binding: 0, visibility: C, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: C, buffer: { type: 'uniform' } },
                { binding: 2, visibility: C, buffer: { type: 'read-only-storage' } },
                { binding: 3, visibility: C, buffer: { type: 'uniform' } },
                { binding: 4, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
                { binding: 5, visibility: C, storageTexture: /** @type {any} */ (storage3d('rg32float')) },
                { binding: 6, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
            ],
        });
        this.brickRestrictBindGroupLayout = device.createBindGroupLayout({
            label: 'brick-restrict',
            entries: [
                { binding: 0, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
                { binding: 1, visibility: C, storageTexture: /** @type {any} */ (storage3d('rg32float')) },
            ],
        });
        this.brickCorrectBindGroupLayout = device.createBindGroupLayout({
            label: 'brick-correct',
            entries: [
                { binding: 0, visibility: C, buffer: { type: 'uniform' } },
                { binding: 1, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
                { binding: 2, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
                { binding: 3, visibility: C, texture: /** @type {any} */ (unfilterable3d) },
                { binding: 4, visibility: C, storageTexture: /** @type {any} */ (storage3d('rg32float')) },
                { binding: 5, visibility: C, storageTexture: /** @type {any} */ (storage3d('rgba16float')) },
            ],
        });
        const computePipeline = (label, layout, code) => device.createComputePipeline({
            label,
            layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
            compute: { module: device.createShaderModule({ label, code }), entryPoint: 'main' },
        });
        this.brickComputePipeline = computePipeline('brick-step', this.brickBindGroupLayout, brickComputeShader);
        this.brickRestrictPipeline = computePipeline('brick-restrict', this.brickRestrictBindGroupLayout, brickRestrictShader);
        this.brickCorrectPipeline = computePipeline('brick-correct', this.brickCorrectBindGroupLayout, brickCorrectShader);
        this.brickRestrictBindGroup = device.createBindGroup({
            label: 'brick-restrict',
            layout: this.brickRestrictBindGroupLayout,
            entries: [
                { binding: 0, resource: this.brickStateTextureB.createView() },
                { binding: 1, resource: this.brickMeansTexture.createView() },
            ],
        });
        this.brickCorrectBindGroup = device.createBindGroup({
            label: 'brick-correct',
            layout: this.brickCorrectBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.brickUniformBuffer } },
                { binding: 1, resource: this.brickStateTextureB.createView() },
                { binding: 2, resource: this.brickMeansTexture.createView() },
                { binding: 3, resource: this.brickAffinityTexture.createView() },
                { binding: 4, resource: this.brickStateTextureA.createView() },
                { binding: 5, resource: this.brickRenderTexture.createView() },
            ],
        });
        this.createBrickBindGroups();

        // --- Phase C pipelines (share the render bind group layout) ---
        const layout = device.createPipelineLayout({ bindGroupLayouts: [this.renderBindGroupLayout] });
        const patchVertexLayout = {
            arrayStride: PATCH_VERTEX_FLOATS * 4,
            attributes: [
                { shaderLocation: 0, offset: 0, format: 'float32x3' },
                { shaderLocation: 1, offset: 12, format: 'float32x3' },
                { shaderLocation: 2, offset: 24, format: 'float32x4' },
            ],
        };
        this.patchPipeline = device.createRenderPipeline({
            label: 'cortical-patch',
            layout,
            vertex: { module: device.createShaderModule({ label: 'patch-vs', code: patchVertexShader }), entryPoint: 'main', buffers: [/** @type {any} */ (patchVertexLayout)] },
            fragment: {
                module: device.createShaderModule({ label: 'patch-fs', code: patchFragmentShader }),
                entryPoint: 'main',
                targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } } }],
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' },
        });
        this.patchSomaPipeline = device.createRenderPipeline({
            label: 'cortical-patch-somas',
            layout,
            vertex: {
                module: device.createShaderModule({ label: 'patch-soma-vs', code: patchSomaVertexShader }),
                entryPoint: 'main',
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                    {
                        arrayStride: PATCH_SOMA_FLOATS * 4,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 1, offset: 0, format: 'float32x4' },
                            { shaderLocation: 2, offset: 16, format: 'float32x4' },
                            { shaderLocation: 3, offset: 32, format: 'float32x4' },
                        ],
                    },
                ],
            },
            fragment: {
                module: device.createShaderModule({ label: 'patch-soma-fs', code: patchSomaFragmentShader }),
                entryPoint: 'main',
                targets: [{ format, blend: /** @type {any} */ (ADDITIVE_PREMULTIPLIED) }],
            },
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' },
        });
        this.patchImpostorPipeline = device.createRenderPipeline({
            label: 'cortical-patch-impostor',
            layout,
            vertex: {
                module: device.createShaderModule({ label: 'patch-impostor-vs', code: patchImpostorVertexShader }),
                entryPoint: 'main',
                buffers: [
                    { arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] },
                    { ...patchVertexLayout, stepMode: 'instance', attributes: patchVertexLayout.attributes.map((a) => ({ ...a, shaderLocation: a.shaderLocation + 1 })) },
                ],
            },
            fragment: {
                module: device.createShaderModule({ label: 'patch-impostor-fs', code: patchImpostorFragmentShader }),
                entryPoint: 'main',
                targets: [{ format, blend: /** @type {any} */ (ADDITIVE_PREMULTIPLIED) }],
            },
            primitive: { topology: 'triangle-list', cullMode: 'none' },
            depthStencil: { depthWriteEnabled: false, depthCompare: 'less', format: 'depth32float' },
        });

        // Fresh textures: nothing the controller believed resident is any more.
        this.clipmap.resetGpuState();
        this.patchGpu = null;
        this.clipmap.setSupported(true);
    };

    /**
     * (Re)creates the brick step's bind group. It captures the coarse tensor
     * buffers, so setVoxelDim() must call this after rebuilding them — the
     * same failure mode as the render/compute bind groups (resolution.js).
     * (The restrict/correct bind groups hold only brick-owned textures.)
     */
    Target.prototype.createBrickBindGroups = function() {
        if (!this.brickBindGroupLayout || !this.tensorBuffer) return;
        this.brickBindGroup = this.device.createBindGroup({
            label: 'brick-step',
            layout: this.brickBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.tensorBuffer } },
                { binding: 1, resource: { buffer: this.computeUniformBuffer } },
                { binding: 2, resource: { buffer: this.aiTensorBuffer } },
                { binding: 3, resource: { buffer: this.brickUniformBuffer } },
                { binding: 4, resource: this.brickStateTextureA.createView() },
                { binding: 5, resource: this.brickStateTextureB.createView() },
                { binding: 6, resource: this.brickAffinityTexture.createView() },
            ],
        });
    };

    /**
     * Writes one chunk's three tract slots into the atlas at its toroidal
     * position (EMPTY_CHUNK writes zeros). A chunk is 16-aligned and 64 is a
     * multiple of 16, so it lands as one contiguous block per slot.
     * @param {number[]} chunk
     * @param {Float32Array|{empty: true}} data
     */
    Target.prototype.uploadAffinityChunk = function(chunk, data) {
        if (!this.device || !this.brickAffinityTexture) return;
        const planar = data instanceof Float32Array ? data : (zeroChunk ??= new Float32Array(CHUNK_TEXELS * 4 * AFFINITY_SLOTS));
        const [x, y, z] = chunk.map((g) => toroidalTexel(g));
        for (let slot = 0; slot < AFFINITY_SLOTS; slot++) {
            this.device.queue.writeTexture(
                { texture: this.brickAffinityTexture, origin: { x, y, z: z + slot * BRICK_DIM } },
                planar,
                { offset: slot * CHUNK_SLOT_BYTES, bytesPerRow: BRICK_CHUNK_DIM * 16, rowsPerImage: BRICK_CHUNK_DIM },
                { width: BRICK_CHUNK_DIM, height: BRICK_CHUNK_DIM, depthOrArrayLayers: BRICK_CHUNK_DIM },
            );
        }
    };

    /**
     * Uploads a finished cortical patch, reusing the GPU buffers when they are
     * large enough (every patch has the same size, so after the first upload
     * this is three writeBuffer calls).
     * @param {import('../clipmap/cortical-patch.js').CorticalPatch} patch
     */
    Target.prototype.uploadCorticalPatch = function(patch) {
        if (!this.device || !this.patchPipeline) return;
        const ensure = (key, data, usage) => {
            const existing = this[key];
            if (!existing || existing.size < data.byteLength) {
                existing?.destroy?.();
                this[key] = this.device.createBuffer({ label: key, size: Math.ceil(data.byteLength / 4) * 4, usage: usage | GPUBufferUsage.COPY_DST });
            }
            this.device.queue.writeBuffer(this[key], 0, data);
        };
        ensure('patchVertexBuffer', patch.vertices, GPUBufferUsage.VERTEX);
        ensure('patchIndexBuffer', patch.indices, GPUBufferUsage.INDEX);
        ensure('patchSomaBuffer', patch.somas, GPUBufferUsage.VERTEX);
        this.patchGpu = { vertexCount: patch.vertexCount, indexCount: patch.indexCount, somaCount: patch.somaCount };
    };

    /**
     * Runs the controller for this frame and uploads the brick uniforms.
     * Called by render() before updateUniforms(), which reads clipmapFrame.
     */
    Target.prototype.updateClipmapFrame = function() {
        if (!this.clipmap) return;
        const frame = this.clipmap.update({
            zoom: this.zoom,
            cameraDir: cameraDirectionInModel(this.rotation),
            style: this.params.style,
            cognitiveLoad: this.params.cognitiveLoad,
            playback: this.tensorPlaybackMode,
            voxelDim: this.voxelDim,
            stimulus: this.stimulus,
        });
        this.clipmapFrame = frame;
        if (!frame.active || !frame.dispatch || !this.brickUniformBuffer) return;
        const data = new Float32Array(BRICK_UNIFORM_FLOAT_COUNT);
        data.set(frame.latticeOrigin, B.latticeOrigin);
        data[B.brickDim] = BRICK_DIM;
        data.set(frame.prevOrigin, B.prevOrigin);
        data[B.prevValid] = frame.prevValid;
        data[B.latticeDim] = FINE_LATTICE_DIM;
        data[B.nudge] = frame.nudge;
        data[B.mode] = frame.mode;
        this.device.queue.writeBuffer(this.brickUniformBuffer, 0, data);
    };

    /**
     * Encodes the brick's compute pass, after the coarse compute pass (it
     * reads the coarse field that pass writes) and before the scene pass
     * (which samples the render copy it writes).
     * @param {GPUCommandEncoder} encoder
     */
    Target.prototype.encodeBrickPass = function(encoder) {
        const frame = this.clipmapFrame;
        if (!frame?.active || !frame.dispatch || !this.brickBindGroup) return;
        const pass = encoder.beginComputePass({
            label: 'brick',
            timestampWrites: this.gpuTimer ? this.gpuTimer.timestampWrites('brick') : undefined,
        });
        // Three dispatches, each its own synchronisation scope: every one
        // reads what the previous one wrote (state A → stepped B → cell means
        // → corrected A + render copy).
        const groups = Math.ceil(BRICK_DIM / BRICK_WORKGROUP);
        pass.setPipeline(this.brickComputePipeline);
        pass.setBindGroup(0, this.brickBindGroup);
        pass.dispatchWorkgroups(groups, groups, groups);
        pass.setPipeline(this.brickRestrictPipeline);
        pass.setBindGroup(0, this.brickRestrictBindGroup);
        const cells = BRICK_DIM / BRICK_MEAN_CELL;
        pass.dispatchWorkgroups(cells, cells, cells);
        pass.setPipeline(this.brickCorrectPipeline);
        pass.setBindGroup(0, this.brickCorrectBindGroup);
        pass.dispatchWorkgroups(groups, groups, groups);
        pass.end();
    };

    /**
     * Draws the cortical patch (mesh + somas, or impostors at the reduced
     * tier) into the scene pass. The render bind group must be set.
     * @param {GPURenderPassEncoder} pass
     */
    Target.prototype.drawCorticalPatch = function(pass) {
        const patch = this.clipmapFrame?.patch;
        if (!patch?.draw || !this.patchGpu || !this.patchVertexBuffer) return;
        if (patch.impostor) {
            pass.setPipeline(this.patchImpostorPipeline);
            pass.setVertexBuffer(0, this.pointCloudQuadBuffer);
            pass.setVertexBuffer(1, this.patchVertexBuffer);
            pass.draw(6, this.patchGpu.vertexCount);
            return;
        }
        pass.setPipeline(this.patchSomaPipeline);
        pass.setVertexBuffer(0, this.somaVertexBuffer);
        pass.setVertexBuffer(1, this.patchSomaBuffer);
        pass.setIndexBuffer(this.somaIndexBuffer, 'uint16');
        pass.drawIndexed(this.somaIndexCount, this.patchGpu.somaCount);

        pass.setPipeline(this.patchPipeline);
        pass.setVertexBuffer(0, this.patchVertexBuffer);
        pass.setIndexBuffer(this.patchIndexBuffer, 'uint16');
        pass.drawIndexed(this.patchGpu.indexCount);
    };

    /**
     * Feeds the budget governor after a frame is submitted: GPU time when
     * timestamp queries are available, the rAF interval otherwise.
     * @param {number} startedAt - performance.now() at the top of render().
     */
    Target.prototype.observeClipmapFrame = function(startedAt) {
        const now = performance.now();
        const intervalMs = this._lastRenderAt ? startedAt - this._lastRenderAt : null;
        this._lastRenderAt = startedAt;
        this._lastIntervalMs = intervalMs;
        this._lastEncodeMs = now - startedAt;
        const timer = this.gpuTimer;
        const gpuMs = timer && timer.enabled && timer.samples > 0 ? timer.lastTotalMs : null;
        this.clipmap?.observeFrame({ gpuMs, intervalMs });
    };

    /**
     * WebGPU-only debug extension (see renderer-contract.js "Extensions"):
     * reads the brick's render copy back to the CPU, un-toroided into lattice
     * order. `fine` / `coarse` / `tract` are BRICK_DIM³ arrays indexed
     * `z·dim² + y·dim + x` from `origin`. Resolves null while the brick is off.
     * @returns {Promise<{origin: number[], dim: number, fine: Float32Array, coarse: Float32Array, tract: Float32Array}|null>}
     */
    Target.prototype.readBrickSnapshot = async function() {
        const frame = this.clipmapFrame;
        if (!this.device || !frame?.active || !this.brickRenderTexture || this.brickRenderTexture.width !== BRICK_DIM) return null;
        const origin = [...frame.latticeOrigin];
        const bytesPerRow = BRICK_DIM * 8; // rgba16float; 512 is a multiple of 256
        const size = bytesPerRow * BRICK_DIM * BRICK_DIM;
        const readback = this.device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
            const encoder = this.device.createCommandEncoder();
            encoder.copyTextureToBuffer(
                { texture: this.brickRenderTexture },
                { buffer: readback, bytesPerRow, rowsPerImage: BRICK_DIM },
                { width: BRICK_DIM, height: BRICK_DIM, depthOrArrayLayers: BRICK_DIM },
            );
            this.device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            const halves = new Uint16Array(readback.getMappedRange().slice(0));
            const half = (h) => {
                const exp = (h >> 10) & 0x1f;
                const mant = h & 0x3ff;
                const sign = h & 0x8000 ? -1 : 1;
                if (exp === 0) return sign * mant * 2 ** -24;
                if (exp === 31) return mant ? NaN : sign * Infinity;
                return sign * (1 + mant / 1024) * 2 ** (exp - 15);
            };
            const n = BRICK_DIM;
            const fine = new Float32Array(n ** 3);
            const coarse = new Float32Array(n ** 3);
            const tract = new Float32Array(n ** 3);
            for (let z = 0; z < n; z++) {
                for (let y = 0; y < n; y++) {
                    for (let x = 0; x < n; x++) {
                        const s = (toroidalTexel(origin[2] + z) * n + toroidalTexel(origin[1] + y)) * n + toroidalTexel(origin[0] + x);
                        const i = (z * n + y) * n + x;
                        fine[i] = half(halves[s * 4]);
                        coarse[i] = half(halves[s * 4 + 1]);
                        tract[i] = half(halves[s * 4 + 2]);
                    }
                }
            }
            return { origin, dim: n, fine, coarse, tract };
        } finally {
            if (readback.mapState === 'mapped') readback.unmap();
            readback.destroy();
        }
    };

    // --- Shared facade (src/renderer-contract.js) ---

    /** @type {import('../renderer-contract.js').BrainRendererFacade['setClipmapOptions']} */
    Target.prototype.setClipmapOptions = function(options = {}) {
        if (!this.clipmap) return false;
        this.clipmap.setOptions(options);
        return this.clipmap.supported;
    };

    /** @type {import('../renderer-contract.js').BrainRendererFacade['getClipmapState']} */
    Target.prototype.getClipmapState = function() {
        if (!this.clipmap) return { supported: false, reason: 'not initialised', active: false };
        return {
            ...this.clipmap.getState(),
            backend: 'webgpu',
            gpuBytes: this.clipmap.supported ? brickResourceBytes() : 0,
        };
    };

    /** @type {import('../renderer-contract.js').BrainRendererFacade['getFrameTimings']} */
    Target.prototype.getFrameTimings = function() {
        const timer = this.gpuTimer;
        const live = Boolean(timer && timer.enabled && timer.samples > 0);
        const span = (name) => (live && timer.lastSpanMs ? timer.lastSpanMs[name] ?? 0 : null);
        const budget = this.clipmap ? this.clipmap.budget.getState() : null;
        return {
            backend: 'webgpu',
            gpuTimestamps: Boolean(timer && timer.enabled),
            renderMs: live ? timer.lastFrameMs : null,
            computeMs: live ? timer.lastComputeMs : null,
            totalMs: live ? timer.lastTotalMs : null,
            fieldMs: span('field'),
            brickMs: span('brick'),
            sceneMs: span('scene'),
            postMs: span('post'),
            cpuFrameMs: this._lastIntervalMs ?? null,
            cpuEncodeMs: this._lastEncodeMs ?? null,
            budgetMs: budget ? budget.budgetMs : null,
            pressure: budget ? budget.pressure : 0,
            lodLoad: budget ? budget.lodLoad : 0,
            source: budget ? budget.source : 'none',
        };
    };
}

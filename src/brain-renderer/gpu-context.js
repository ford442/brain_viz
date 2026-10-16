// @ts-check
// src/brain-renderer/gpu-context.js
// [Neuro-Weaver] Single owner of WebGPU adapter / device / canvas configuration.
//
// Everything about how this app talks to the GPU driver lives here so the
// options are reviewable in one place instead of being spread through
// initialize().  The renderer keeps ownership of the returned device — this
// module only creates, configures, and tears it down.

import { RENDER_UNIFORM_BUFFER_SIZE, COMPUTE_UNIFORM_BUFFER_SIZE } from './constants.js';
import { MAX_VOXEL_DIM, voxelCountFor } from '../voxel-dim.js';
import { AFFINITY_SLOTS, MAX_BRICK_DIM } from '../clipmap/brick-layout.js';

/**
 * Device features we actually consume.
 *
 * Intentionally empty: every optional feature we used to request
 * ('float32-filterable', 'float32-blendable', 'clip-distances',
 * 'depth32float-stencil8', 'texture-component-swizzle') was unused by any
 * shader or pipeline state, and requesting a feature widens the device
 * capability surface (and the driver paths we can hit) for no benefit.
 * Add a feature here only together with the pipeline/shader code that uses it.
 *
 * 'timestamp-query' is handled separately below: it is opportunistic
 * instrumentation, not a rendering requirement, so it must never fail device
 * creation.
 *
 * [Clipmap] The fine brick deliberately needs nothing here either. Its
 * simulation state is rg32float (storage-writable in core WebGPU, but only
 * *filterable* with 'float32-filterable'); the render path instead samples an
 * rgba16float copy the brick pass writes alongside, which core WebGPU can
 * both store to and filter. So hardware trilinear filtering of the brick
 * costs no optional feature, and no device is refused for lacking one.
 * @type {GPUFeatureName[]}
 */
export const REQUIRED_GPU_FEATURES = [];

/** Opportunistic features: requested only when the adapter advertises them.
 * @type {GPUFeatureName[]}
 */
export const OPTIONAL_GPU_FEATURES = ['timestamp-query'];

/**
 * Derive the device limits this renderer needs, clamped to what the adapter
 * can actually provide. Requesting more than the adapter supports throws, so
 * every value is min()'d against the adapter limit. Requesting less than the
 * WebGPU default is harmless too — maximum limits are clamped up to the default
 * — so these values document what the renderer needs rather than capping it.
 *
 * [Field Resolution] The limits are derived from the *largest* resolution this
 * build supports, not from the resolution the renderer happens to boot at.
 * Device limits are fixed for the device's lifetime, so sizing them to the
 * 32³ default would make `setVoxelDim(64)` impossible without tearing down and
 * recreating the device (and with it every pipeline, buffer and canvas
 * configuration). Headroom for 64³ costs nothing on any adapter that can
 * already run 32³ — the values are maximums, not reservations.
 *
 * @param {GPUAdapter} adapter
 * @param {{ voxelCount?: number }} [opts] - Ignored for sizing; accepted so
 *   callers that still pass the boot-time voxel count keep working.
 */
export function deriveRequiredLimits(adapter, opts = {}) {
    const adapterLimits = adapter.limits;
    const voxelCount = voxelCountFor(MAX_VOXEL_DIM);
    // Largest storage binding: the fiber-direction buffer is 3 vec4<f32> per voxel.
    const maxStorageBytes = voxelCount * 12 * 4;
    // Largest uniform binding across the render / compute contracts.
    const maxUniformBytes = Math.max(RENDER_UNIFORM_BUFFER_SIZE, COMPUTE_UNIFORM_BUFFER_SIZE, 256);

    const wanted = {
        // Volumetric tensor + fiber affinity storage buffers.
        maxStorageBufferBindingSize: maxStorageBytes,
        maxBufferSize: Math.max(maxStorageBytes, maxUniformBytes),
        // Uniforms struct in shaders.js (see RENDER_UNIFORM_BUFFER_SIZE).
        maxUniformBufferBindingSize: maxUniformBytes,
        // The tensor compute pass dispatches ceil(voxelCount / 64) workgroups of 64.
        maxComputeWorkgroupSizeX: 64,
        maxComputeInvocationsPerWorkgroup: 64,
        maxComputeWorkgroupsPerDimension: Math.ceil(voxelCount / 64),
        // Render bind group: 1 uniform + 3 read-only storage + 1 uniform.
        maxStorageBuffersPerShaderStage: 4,
        maxUniformBuffersPerShaderStage: 4,
        // [Clipmap] The brick's affinity atlas stacks one brick-deep slab per
        // tract slot along z — the tallest 3D texture. Sized for MAX_BRICK_DIM
        // (128) so a larger brick never needs a new device, as storage limits
        // are sized for MAX_VOXEL_DIM above; both are far below the WebGPU
        // default of 2048.
        maxTextureDimension3D: MAX_BRICK_DIM * AFFINITY_SLOTS,
        // Brick correct pass: state + render copy (storage); stepped state,
        // cell means and affinity atlas (sampled). Render pipelines sample one.
        maxStorageTexturesPerShaderStage: 2,
        maxSampledTexturesPerShaderStage: 3,
        // Fiber pipeline binds 5 vertex buffers / 6 attributes.
        maxVertexBuffers: 8,
        maxVertexAttributes: 8
    };

    /** @type {Record<string, number>} */
    const limits = {};
    for (const [key, value] of Object.entries(wanted)) {
        const supported = adapterLimits[key];
        if (typeof supported !== 'number') continue;
        limits[key] = Math.min(value, supported);
    }
    return limits;
}

/**
 * Canvas configuration. Split out so both first init and post-device-loss
 * reconfiguration use identical options.
 *
 * @param {GPUCanvasContext} context
 * @param {GPUDevice} device
 */
export function configureCanvas(context, device) {
    context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        // COPY_SRC lets session capture / verification read the swap chain back.
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        // The brain is authored and lit in sRGB; 'opaque' skips the compositor
        // blend since the post pass always writes alpha = 1.
        colorSpace: 'srgb',
        alphaMode: 'opaque'
    });
}

/**
 * Acquire adapter + device + configured canvas context.
 *
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   voxelCount: number,
 *   onDeviceLost?: (info: GPUDeviceLostInfo) => void,
 *   onUncapturedError?: (error: unknown) => void
 * }} opts
 */
export async function createGPUContext({ canvas, voxelCount, onDeviceLost, onUncapturedError }) {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser.');

    const adapter = await navigator.gpu.requestAdapter({
        // This is a 60 fps volumetric visualization, not a battery-first widget:
        // prefer the discrete GPU when the system exposes one.
        powerPreference: 'high-performance',
        // 'core' keeps us on the full WebGPU feature set rather than silently
        // landing on a compatibility-mode adapter with reduced limits. Older
        // Chrome builds ignore unknown options, so this is safe to always pass.
        featureLevel: 'core'
    });
    if (!adapter) throw new Error('No GPU');

    const requiredFeatures = REQUIRED_GPU_FEATURES.filter((f) => adapter.features.has(f));
    for (const feature of OPTIONAL_GPU_FEATURES) {
        if (adapter.features.has(feature)) requiredFeatures.push(feature);
    }

    const device = await adapter.requestDevice({
        label: 'neuro-weaver-device',
        requiredFeatures,
        requiredLimits: deriveRequiredLimits(adapter, { voxelCount }),
        // Labels surface in Spector/devtools captures and in validation messages.
        defaultQueue: { label: 'neuro-weaver-queue' }
    });

    // Without this, WebGPU validation errors are console-only in some builds and
    // effectively invisible in the field.
    if (typeof device.addEventListener === 'function') {
        device.addEventListener('uncapturederror', (event) => {
            const error = /** @type {any} */ (event).error ?? event;
            console.error('[WebGPU] Uncaptured error:', error);
            if (onUncapturedError) onUncapturedError(error);
        });
    }

    if (onDeviceLost && device.lost) {
        device.lost.then((info) => onDeviceLost(info));
    }

    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Failed to acquire a WebGPU canvas context.');
    configureCanvas(context, device);

    return {
        adapter,
        device,
        context,
        format: navigator.gpu.getPreferredCanvasFormat(),
        features: new Set(requiredFeatures),
        hasTimestampQuery: requiredFeatures.includes('timestamp-query')
    };
}

/**
 * Every GPU object the renderer allocates, by property name. Kept next to the
 * creation code it mirrors so device-loss recovery can free them all before
 * reallocating instead of leaking a full set per recovery.
 */
export const GPU_BUFFER_KEYS = [
    'vertexBuffer', 'normalBuffer', 'indexBuffer',
    'fiberBuffer', 'fiberNormalBuffer', 'fiberMetaBuffer', 'fiberPathBuffer', 'pathwayMetaBuffer',
    'tensorBuffer', 'tensorScratchBuffer', 'aiTensorBuffer', 'fiberDirectionBuffer', 'pathwayStateBuffer',
    'uniformBuffer', 'avatarAUniformBuffer', 'partnerUniformBuffer', 'computeUniformBuffer',
    'somaInstanceBuffer', 'somaVertexBuffer', 'somaIndexBuffer',
    'pointCloudInstanceBuffer', 'pointCloudQuadBuffer',
    'sparkInstanceBuffer', 'sparkQuadBuffer',
    'immuneInstanceBuffer', 'immuneQuadBuffer',
    'synaptixBridgeBuffer',
    // [Clipmap] src/brain-renderer/clipmap.js
    'brickUniformBuffer', 'patchVertexBuffer', 'patchIndexBuffer', 'patchSomaBuffer'
];

export const GPU_TEXTURE_KEYS = [
    'depthTexture', 'renderTarget',
    // [Clipmap] src/brain-renderer/clipmap.js
    'brickStateTextureA', 'brickStateTextureB', 'brickRenderTexture', 'brickAffinityTexture', 'brickMeansTexture'
];

/**
 * Destroy every GPU object owned by `renderer` and null the handles so a stale
 * reference can never be bound against a new device.
 * @param {any} renderer
 */
export function destroyGPUResources(renderer) {
    for (const key of [...GPU_BUFFER_KEYS, ...GPU_TEXTURE_KEYS]) {
        const resource = renderer[key];
        if (resource && typeof resource.destroy === 'function') {
            try {
                resource.destroy();
            } catch (e) {
                console.warn(`[WebGPU] Failed to destroy ${key}:`, e);
            }
        }
        renderer[key] = null;
    }

    // Pipelines / bind groups / samplers have no destroy(); dropping the
    // references is what lets the old device be collected.
    for (const key of [
        'pipeline', 'fiberPipeline', 'somaPipeline', 'sparkPipeline', 'immunePipeline',
        'pointCloudPipeline', 'postPipeline', 'computePipeline', 'synaptixBridgePipeline',
        'bindGroup', 'avatarABindGroup', 'partnerBindGroup', 'computeBindGroup', 'postBindGroup',
        'synaptixBridgeBindGroup',
        'sampler',
        // [Clipmap]
        'brickComputePipeline', 'brickBindGroupLayout', 'brickBindGroup',
        'brickRestrictPipeline', 'brickRestrictBindGroupLayout', 'brickRestrictBindGroup',
        'brickCorrectPipeline', 'brickCorrectBindGroupLayout', 'brickCorrectBindGroup',
        'patchPipeline', 'patchSomaPipeline', 'patchImpostorPipeline', 'brickSampler'
    ]) {
        if (key in renderer) renderer[key] = null;
    }
}

/**
 * [Clipmap] Passes the GPU timer can time, in encoder order. Two timestamp
 * slots each (beginning / end of pass).
 *   field — the coarse tensor compute pass
 *   brick — the fine-brick compute pass
 *   scene — the main render pass
 *   post  — the post-processing pass to the swap chain
 */
export const GPU_TIMER_SPANS = Object.freeze(['field', 'brick', 'scene', 'post']);
export const GPU_COMPUTE_SPANS = Object.freeze(['field', 'brick']);
export const GPU_RENDER_SPANS = Object.freeze(['scene', 'post']);

/**
 * Per-span durations in ms from a resolved timestamp block. A span the frame
 * did not encode (no compute pass in WASM mode, no brick when zoomed out)
 * reads 0 — its query slots still hold some older frame's values, which is
 * why the caller passes the set it actually wrote. Out-of-order timestamps
 * (allowed by the spec under some power states) clamp to 0 rather than
 * reporting a negative pass.
 *
 * @param {BigUint64Array|bigint[]} times - Nanosecond timestamps, 2 per span.
 * @param {readonly string[]} spans - Span names in slot order.
 * @param {Set<string>|string[]} written - Spans encoded in the resolved frame.
 * @returns {Record<string, number>}
 */
export function spanDurationsMs(times, spans, written) {
    const wrote = written instanceof Set ? written : new Set(written);
    /** @type {Record<string, number>} */
    const out = {};
    spans.forEach((span, i) => {
        if (!wrote.has(span)) { out[span] = 0; return; }
        const begin = times[i * 2];
        const end = times[i * 2 + 1];
        out[span] = end > begin ? Number(end - begin) / 1e6 : 0;
    });
    return out;
}

/**
 * GPU-time probe, gated on adapter support for 'timestamp-query'. When the
 * feature is absent every method is a no-op and every reading stays null, so
 * callers need no branching.
 *
 * [Clipmap] It used to wrap only the scene render pass, and nothing read it.
 * It now times every pass the frame encodes (GPU_TIMER_SPANS) and is read by
 * the clipmap budget governor and the Activity tab's GPU HUD:
 *   lastFrameMs   — render passes (scene + post). The name predates compute
 *                   timing and is kept for what it always meant: draw time.
 *   lastComputeMs — compute passes (coarse field + fine brick).
 *   lastTotalMs   — both.
 *   lastSpanMs    — each pass on its own.
 *
 * Timestamps resolve asynchronously; only one readback is in flight at a
 * time, so this costs one small copy per frame and never blocks the loop.
 * Readings therefore trail the frame they describe by a frame or two.
 */
export class GPUTimer {
    /**
     * @param {GPUDevice} device
     * @param {boolean} enabled
     * @param {readonly string[]} [spans]
     */
    constructor(device, enabled, spans = GPU_TIMER_SPANS) {
        this.enabled = Boolean(enabled);
        this.spans = spans;
        /** @type {number|null} */
        this.lastFrameMs = null;
        /** @type {number|null} */
        this.lastComputeMs = null;
        /** @type {number|null} */
        this.lastTotalMs = null;
        /** @type {Record<string, number>|null} */
        this.lastSpanMs = null;
        this.samples = 0;
        this._reading = false;
        /** @type {Set<string>} */
        this._written = new Set();
        /** @type {Set<string>|null} */
        this._pendingSpans = null;
        if (!this.enabled) return;
        this.device = device;
        const count = spans.length * 2;
        this.querySet = device.createQuerySet({ label: 'frame-timer', type: 'timestamp', count });
        this.resolveBuffer = device.createBuffer({
            label: 'frame-timer-resolve',
            size: count * 8,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        this.readbackBuffer = device.createBuffer({
            label: 'frame-timer-readback',
            size: count * 8,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
    }

    /** Start a frame: forget which spans the previous frame wrote. */
    beginFrame() {
        this._written = new Set();
    }

    /**
     * Pass-descriptor `timestampWrites` for `span`, or undefined when disabled.
     * @param {string} [span] - Defaults to 'scene' (the only pass timed before).
     */
    timestampWrites(span = 'scene') {
        if (!this.enabled) return undefined;
        const index = this.spans.indexOf(span);
        if (index < 0) return undefined;
        this._written.add(span);
        return { querySet: this.querySet, beginningOfPassWriteIndex: index * 2, endOfPassWriteIndex: index * 2 + 1 };
    }

    /** Queue the resolve + copy for this frame. Call before encoder.finish(). */
    resolve(encoder) {
        if (!this.enabled || this._reading || this._written.size === 0) return;
        // Only reachable when `enabled` is true, which is the same branch that
        // populates these buffers in the constructor.
        const querySet = /** @type {GPUQuerySet} */ (this.querySet);
        const resolveBuffer = /** @type {GPUBuffer} */ (this.resolveBuffer);
        const readbackBuffer = /** @type {GPUBuffer} */ (this.readbackBuffer);
        const count = this.spans.length * 2;
        encoder.resolveQuerySet(querySet, 0, count, resolveBuffer, 0);
        encoder.copyBufferToBuffer(resolveBuffer, 0, readbackBuffer, 0, count * 8);
        this._pendingSpans = new Set(this._written);
    }

    /** Kick the async map for the frame just submitted. Call after submit(). */
    readback() {
        if (!this.enabled || !this._pendingSpans || this._reading) return;
        const spansWritten = this._pendingSpans;
        this._pendingSpans = null;
        this._reading = true;
        const readbackBuffer = /** @type {GPUBuffer} */ (this.readbackBuffer);
        readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
            const times = new BigUint64Array(readbackBuffer.getMappedRange().slice(0));
            readbackBuffer.unmap();
            const ms = spanDurationsMs(times, this.spans, spansWritten);
            this.lastSpanMs = ms;
            this.lastComputeMs = GPU_COMPUTE_SPANS.reduce((sum, span) => sum + (ms[span] || 0), 0);
            this.lastFrameMs = GPU_RENDER_SPANS.reduce((sum, span) => sum + (ms[span] || 0), 0);
            this.lastTotalMs = this.lastComputeMs + this.lastFrameMs;
            this.samples++;
            this._reading = false;
        }).catch(() => {
            this._reading = false;
        });
    }

    destroy() {
        if (!this.enabled) return;
        /** @type {GPUQuerySet} */ (this.querySet).destroy();
        /** @type {GPUBuffer} */ (this.resolveBuffer).destroy();
        /** @type {GPUBuffer} */ (this.readbackBuffer).destroy();
        this.enabled = false;
    }
}

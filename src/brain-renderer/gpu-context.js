// src/brain-renderer/gpu-context.js
// [Neuro-Weaver] Single owner of WebGPU adapter / device / canvas configuration.
//
// Everything about how this app talks to the GPU driver lives here so the
// options are reviewable in one place instead of being spread through
// initialize().  The renderer keeps ownership of the returned device — this
// module only creates, configures, and tears it down.

import { RENDER_UNIFORM_BUFFER_SIZE, COMPUTE_UNIFORM_BUFFER_SIZE } from './constants.js';

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
 * @type {string[]}
 */
export const REQUIRED_GPU_FEATURES = [];

/** Opportunistic features: requested only when the adapter advertises them. */
export const OPTIONAL_GPU_FEATURES = ['timestamp-query'];

/**
 * Derive the device limits this renderer needs, clamped to what the adapter
 * can actually provide. Requesting more than the adapter supports throws, so
 * every value is min()'d against the adapter limit. Requesting less than the
 * WebGPU default is harmless too — maximum limits are clamped up to the default
 * — so these values document what the renderer needs rather than capping it.
 *
 * @param {GPUAdapter} adapter
 * @param {{ voxelCount: number }} opts
 */
export function deriveRequiredLimits(adapter, { voxelCount }) {
    const adapterLimits = adapter.limits;
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
    'tensorBuffer', 'aiTensorBuffer', 'fiberDirectionBuffer', 'pathwayStateBuffer',
    'uniformBuffer', 'avatarAUniformBuffer', 'partnerUniformBuffer', 'computeUniformBuffer',
    'somaInstanceBuffer', 'somaVertexBuffer', 'somaIndexBuffer',
    'pointCloudInstanceBuffer', 'pointCloudQuadBuffer',
    'sparkInstanceBuffer', 'sparkQuadBuffer',
    'immuneInstanceBuffer', 'immuneQuadBuffer',
    'synaptixBridgeBuffer'
];

export const GPU_TEXTURE_KEYS = ['depthTexture', 'renderTarget'];

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
        'sampler'
    ]) {
        if (key in renderer) renderer[key] = null;
    }
}

/**
 * Minimal GPU-time probe around the main render pass, gated on adapter support
 * for 'timestamp-query'. When the feature is absent every method is a no-op and
 * `lastFrameMs` stays null, so callers need no branching.
 *
 * Timestamps resolve asynchronously; only one readback is in flight at a time,
 * so this costs one small copy per frame and never blocks the loop.
 */
export class GPUTimer {
    /**
     * @param {GPUDevice} device
     * @param {boolean} enabled
     */
    constructor(device, enabled) {
        this.enabled = Boolean(enabled);
        this.lastFrameMs = null;
        this._reading = false;
        if (!this.enabled) return;
        this.device = device;
        this.querySet = device.createQuerySet({ label: 'frame-timer', type: 'timestamp', count: 2 });
        this.resolveBuffer = device.createBuffer({
            label: 'frame-timer-resolve',
            size: 16,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC
        });
        this.readbackBuffer = device.createBuffer({
            label: 'frame-timer-readback',
            size: 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
    }

    /** Render-pass descriptor fragment, or undefined when disabled. */
    timestampWrites() {
        if (!this.enabled) return undefined;
        return { querySet: this.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
    }

    /** Queue the resolve + copy for this frame. Call before encoder.finish(). */
    resolve(encoder) {
        if (!this.enabled || this._reading) return;
        encoder.resolveQuerySet(this.querySet, 0, 2, this.resolveBuffer, 0);
        encoder.copyBufferToBuffer(this.resolveBuffer, 0, this.readbackBuffer, 0, 16);
        this._pendingRead = true;
    }

    /** Kick the async map for the frame just submitted. Call after submit(). */
    readback() {
        if (!this.enabled || !this._pendingRead || this._reading) return;
        this._pendingRead = false;
        this._reading = true;
        this.readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
            const times = new BigUint64Array(this.readbackBuffer.getMappedRange().slice(0));
            this.readbackBuffer.unmap();
            // Timestamps are nanoseconds.
            this.lastFrameMs = Number(times[1] - times[0]) / 1e6;
            this._reading = false;
        }).catch(() => {
            this._reading = false;
        });
    }

    destroy() {
        if (!this.enabled) return;
        this.querySet.destroy();
        this.resolveBuffer.destroy();
        this.readbackBuffer.destroy();
        this.enabled = false;
    }
}

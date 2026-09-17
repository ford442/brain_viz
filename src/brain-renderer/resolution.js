// @ts-check
// src/brain-renderer/resolution.js
// [Field Resolution] Runtime resolution switching for the WebGPU backend.
//
// The field used to be permanently 32³ because the dimension was a constant in
// six places at once. It is now a value carried by the renderer, and this
// module is what makes changing it actually work: every GPU resource whose
// size is a function of `voxelDim` is torn down and rebuilt, the in-flight
// field is resampled rather than discarded, and the bind groups that hold the
// old buffers are recreated (a bind group captures the buffer it was built
// with, so a "resize" is invisible until the group is rebuilt).
//
// What deliberately does *not* get rebuilt:
//   - the device. `deriveRequiredLimits()` provisions it for MAX_VOXEL_DIM up
//     front, so a switch never needs a new adapter/device/canvas config.
//   - the pipelines or bind group *layouts*. Neither depends on the dim —
//     the shaders read it from `uniforms.voxelDim` / `params.voxelDim`.
//   - the uniform buffers. Their size comes from the generated layout.

import {
    assertVoxelDim,
    fiberAffinityByteLengthFor,
    resampleField,
    voxelCountFor,
} from '../voxel-dim.js';
import { WasmTensorEngine } from '../wasm-engine.js';

/**
 * Throws if `dim` needs more than the device was provisioned for. This should
 * only ever fire on an adapter that clamped `deriveRequiredLimits()` down —
 * i.e. hardware that genuinely cannot hold the larger field — which is a
 * refusal, not a silent downgrade to a resolution the caller did not ask for.
 *
 * @param {GPUDevice} device
 * @param {number} dim
 */
function assertDeviceCanHold(device, dim) {
    const needBytes = fiberAffinityByteLengthFor(dim);
    const limits = device.limits;
    if (limits.maxStorageBufferBindingSize < needBytes) {
        throw new Error(
            `[Field Resolution] ${dim}³ needs a ${needBytes}-byte storage binding for the fiber ` +
            `affinity buffer, but this device caps storage bindings at ` +
            `${limits.maxStorageBufferBindingSize} bytes.`
        );
    }
    if (limits.maxBufferSize < needBytes) {
        throw new Error(
            `[Field Resolution] ${dim}³ needs a ${needBytes}-byte buffer, but this device caps ` +
            `buffers at ${limits.maxBufferSize} bytes.`
        );
    }
    const workgroups = Math.ceil(voxelCountFor(dim) / 64);
    if (limits.maxComputeWorkgroupsPerDimension < workgroups) {
        throw new Error(
            `[Field Resolution] ${dim}³ dispatches ${workgroups} workgroups, but this device caps ` +
            `dispatches at ${limits.maxComputeWorkgroupsPerDimension}.`
        );
    }
}

export function applyResolutionMethods(Target) {
    /**
     * Changes the neural field's grid resolution at runtime.
     *
     * The in-flight human and partner fields are trilinearly resampled into the
     * new grid, so a resolution change continues the simulation rather than
     * resetting it. The geometry is rebuilt because the per-voxel fiber
     * affinity map is baked at a specific dim (see
     * `BrainGeometry#buildFiberAffinityMap`) and an affinity buffer at the
     * wrong dim feeds the anisotropic diffusion term tract directions from the
     * wrong voxels — a different simulation, not a coarser one.
     *
     * @param {number} dim - A member of SUPPORTED_VOXEL_DIMS.
     * @returns {boolean} true if the resolution changed, false if it was already `dim`.
     */
    Target.prototype.setVoxelDim = function(dim) {
        assertVoxelDim(dim, 'BrainRenderer.setVoxelDim');
        if (dim === this.voxelDim) return false;

        const previousDim = this.voxelDim;

        // Before the device exists this is just bookkeeping — initialize()
        // will size everything from the new value.
        if (!this.device) {
            this.voxelDim = dim;
            this.voxelCount = voxelCountFor(dim);
            this._lastHumanTensor = new Float32Array(this.voxelCount);
            this._lastAITensor = new Float32Array(this.voxelCount);
            return true;
        }

        assertDeviceCanHold(this.device, dim);

        // Carry the live field across. Resample before anything is destroyed so
        // a failure here leaves the renderer at the old resolution intact.
        const human = resampleField(this._lastHumanTensor, previousDim, dim);
        const ai = resampleField(this._lastAITensor, previousDim, dim);

        this.voxelDim = dim;
        this.voxelCount = voxelCountFor(dim);
        this._lastHumanTensor = new Float32Array(human);
        this._lastAITensor = new Float32Array(ai);

        this.tensorBuffer?.destroy?.();
        this.aiTensorBuffer?.destroy?.();
        this.fiberDirectionBuffer?.destroy?.();
        this.createTensorStorageBuffers();

        // Affinity data is baked per-dim, so the cached copy is stale now.
        this._fiberAffinityData = null;
        this.rebuildGeometry();

        this.createRenderBindGroups();
        this.createComputeBindGroup();

        this.device.queue.writeBuffer(this.tensorBuffer, 0, this._lastHumanTensor);
        this.device.queue.writeBuffer(this.aiTensorBuffer, 0, this._lastAITensor);

        // The WASM engine allocates its grid in bte_create(dim), so it has to be
        // replaced rather than reconfigured. Re-init is async; the renderer
        // stays on the WebGPU compute path until it completes, which is the
        // same fallback enableWasmMode() already uses.
        if (this.wasmEngine) {
            const wantWasm = this.wasmMode;
            this.wasmMode = false;
            this.wasmEngine.dispose?.();
            this.wasmEngine = new WasmTensorEngine(dim);
            if (wantWasm) {
                this.enableWasmMode().catch((err) => {
                    console.warn('[Field Resolution] WASM re-init after setVoxelDim failed:', err);
                });
            }
        }

        console.log(`[Field Resolution] voxelDim ${previousDim} -> ${dim} (${this.voxelCount} voxels)`);
        return true;
    };

    /** @returns {number} The field's current grid resolution. */
    Target.prototype.getVoxelDim = function() {
        return this.voxelDim;
    };
}

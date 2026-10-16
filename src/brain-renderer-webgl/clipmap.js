// @ts-check
// src/brain-renderer-webgl/clipmap.js
// [Clipmap] The shared clipmap/timing facade on the WebGL2 fallback.
//
// The fine brick and the cortical patch are WebGPU-only (docs/webgl-fallback.md
// capability matrix): this backend steps the whole coarse field on the CPU
// every frame, and a 64³ fine brick on top would be another 262k voxels of
// scalar JS per frame — the opposite of what a fallback is for. So these
// methods exist (app code calls them without a capability check, like every
// facade method) but report the brick as unsupported, and setClipmapOptions()
// records options without enabling anything. Coarse setVoxelDim() is
// unchanged here.
//
// getFrameTimings() reports what this backend can actually measure: the rAF
// frame interval and the CPU field step, never GPU time.

import { DEFAULT_CLIPMAP_OPTIONS, mergeClipmapOptions } from '../clipmap/clipmap-controller.js';

const UNSUPPORTED_REASON =
    'The fine brick is WebGPU-only: the WebGL2 fallback steps the coarse field on the CPU (docs/webgl-fallback.md).';

export function applyClipmapMethods(Klass) {
    /** @type {import('../renderer-contract.js').BrainRendererFacade['setClipmapOptions']} */
    Klass.prototype.setClipmapOptions = function(options = {}) {
        this._clipmapOptions = mergeClipmapOptions(this._clipmapOptions ?? { ...DEFAULT_CLIPMAP_OPTIONS }, options);
        return false;
    };

    /** @type {import('../renderer-contract.js').BrainRendererFacade['getClipmapState']} */
    Klass.prototype.getClipmapState = function() {
        return {
            supported: false,
            reason: UNSUPPORTED_REASON,
            backend: 'webgl',
            active: false,
            mode: 'off',
            options: { ...(this._clipmapOptions ?? DEFAULT_CLIPMAP_OPTIONS) },
        };
    };

    /** @type {import('../renderer-contract.js').BrainRendererFacade['getFrameTimings']} */
    Klass.prototype.getFrameTimings = function() {
        return {
            backend: 'webgl',
            gpuTimestamps: false,
            renderMs: null,
            computeMs: null,
            totalMs: null,
            fieldMs: null,
            brickMs: null,
            sceneMs: null,
            postMs: null,
            cpuFrameMs: this._lastIntervalMs ?? null,
            cpuEncodeMs: null,
            // The CPU reference stepper's own cost — the number that scales with voxelDim³ here.
            cpuFieldStepMs: this._lastFieldStepMs ?? null,
            budgetMs: null,
            pressure: 0,
            lodLoad: Math.max(0, Math.min(1, Number(this.params?.cognitiveLoad) || 0)),
            source: 'interval',
        };
    };
}

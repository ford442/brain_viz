// @ts-check
// src/clipmap/clipmap-controller.js
// [Clipmap] Per-frame policy for the fine brick and the cortical patch.
//
// Everything that decides *what* the clipmap does lives here, with no GPU API
// in it, so it runs (and is tested) in Node: where the brick goes, whether it
// steps this frame, which affinity chunks it still needs, when the cortical
// patch swaps in, and what quality tier the GPU budget allows. The WebGPU
// mixin (src/brain-renderer/clipmap.js) owns the textures and passes, and is
// handed GPU work through the small `gpu` adapter below.
//
// Zoom gating: the brick fades in between `brickStart` and `brickFull` and the
// patch between `patchStart` and `patchFull` (camera distance, same units as
// `renderer.zoom`, clamped to [2, 10]; the app boots at 3.5, so neither is on
// at startup). Pulling back fades both out and, once the brick weight reaches
// zero, the brick stops being stepped at all.

import { Mat4 } from '../math-utils.js';
import {
    BRICK_CHUNK_DIM,
    BRICK_DIM,
    FINE_LATTICE_DIM,
    FINE_SPACING,
    brickCenterWorld,
    brickOriginFor,
    chunkKey,
    chunksExposedByMove,
    chunksInBrick,
    toroidalTexel,
    worldToLattice,
} from './brick-layout.js';
import { AffinityCache, AffinityChunkBaker, EMPTY_CHUNK } from './affinity-chunks.js';
import { BRICK_TIERS, FrameBudget, TIER_NAMES } from './frame-budget.js';
import { generateCorticalPatch, patchFrameFor } from './cortical-patch.js';

export const CLIPMAP_ZOOM = Object.freeze({
    brickStart: 3.25,
    brickFull: 2.7,
    patchStart: 2.75,
    patchFull: 2.3,
});

export const CLIPMAP_FOCUS_MODES = Object.freeze(['auto', 'camera', 'stimulus']);

/**
 * @typedef {Object} ClipmapOptions
 * @property {boolean} enabled
 * @property {'auto'|'camera'|'stimulus'} focus
 * @property {boolean} autoQuality
 * @property {number} budgetMs
 * @property {boolean} patch
 * @property {number} nudge
 * @property {number} jobBudgetMs
 */

/** @type {Readonly<ClipmapOptions>} */
export const DEFAULT_CLIPMAP_OPTIONS = Object.freeze({
    /** Master switch for the fine brick (and with it the patch). */
    enabled: true,
    /** 'auto' follows a recent stimulus, else the camera. */
    focus: 'auto',
    /** Let GPU budget pressure lower the tier. cognitiveLoad always can. */
    autoQuality: true,
    /** GPU-time budget for compute + render, ms. */
    budgetMs: 12,
    /** Phase C: swap the organic mesh for the cortical patch below the patch zoom. */
    patch: true,
    /**
     * §11.3 Share of the fine/coarse cell-mean mismatch corrected each step.
     * 1 (dead-beat) keeps the brick within one step's tendency of the coarse
     * field at the coarse scale; detail finer than a cell is never touched.
     */
    nudge: 1,
    /** CPU time per frame for affinity bakes + patch generation, ms. */
    jobBudgetMs: 4,
});

/** How long after an injection 'auto' focus keeps following the stimulus, ms. */
const STIMULUS_FOCUS_MS = 3000;

/** How far inside the cortical surface the camera focus sits, world units. */
const CAMERA_FOCUS_INSET = 0.18;

/** Heatmap raymarch steps spent inside the brick, per tier. */
const FINE_STEPS = Object.freeze({ [BRICK_TIERS.REDUCED]: 20, [BRICK_TIERS.FULL]: 48 });

const MAX_CACHED_PATCHES = 4;

/** @param {number} e0 @param {number} e1 @param {number} x */
function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
}

/** Ease `current` toward `target`, snapping to it once within `eps`. */
function approach(current, target, rate, eps = 0.002) {
    const next = current + (target - current) * rate;
    return Math.abs(next - target) < eps ? target : next;
}

/**
 * Model-space unit vector from the brain's centre toward the camera.
 *
 * The camera sits at world (0, 0, zoom) looking at the origin, and the model
 * matrix is built exactly as src/brain-renderer/uniforms.js builds it
 * (`Mat4.multiply(rotateX(x), rotateY(y))`, column-major — see CLAUDE.md §1).
 * It is a pure rotation, so its inverse is its transpose and the model-space
 * direction of world +Z is the matrix's third row: (m[2], m[6], m[10]).
 *
 * @param {{x: number, y: number}} rotation
 * @returns {number[]}
 */
export function cameraDirectionInModel(rotation) {
    const model = Mat4.multiply(Mat4.rotateX(rotation.x), Mat4.rotateY(rotation.y));
    const d = [model[2], model[6], model[10]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    return [d[0] / len, d[1] / len, d[2] / len];
}

/**
 * Validates and merges clipmap options. Shared by both backends so an invalid
 * option is refused the same way whether or not the brick can run.
 * Unknown keys are ignored; invalid values throw.
 *
 * @param {ClipmapOptions} current
 * @param {Record<string, unknown>} opts
 * @returns {ClipmapOptions}
 */
export function mergeClipmapOptions(current, opts = {}) {
    /** @type {any} */
    const next = { ...current };
    for (const [key, value] of Object.entries(opts || {})) {
        if (!(key in DEFAULT_CLIPMAP_OPTIONS) || value === undefined) continue;
        if (key === 'focus') {
            if (!CLIPMAP_FOCUS_MODES.includes(/** @type {string} */ (value))) {
                throw new Error(`[Clipmap] focus must be one of ${CLIPMAP_FOCUS_MODES.join(', ')}; got ${String(value)}`);
            }
            next.focus = value;
        } else if (typeof DEFAULT_CLIPMAP_OPTIONS[key] === 'boolean') {
            next[key] = Boolean(value);
        } else {
            const n = Number(value);
            if (!Number.isFinite(n) || n < 0) throw new Error(`[Clipmap] ${key} must be a non-negative number; got ${String(value)}`);
            next[key] = key === 'nudge' ? Math.min(1, n) : n;
        }
    }
    return next;
}

/**
 * @typedef {Object} ClipmapGpuAdapter
 * @property {(chunk: number[], data: Float32Array|{empty: true}) => void} uploadAffinityChunk
 * @property {(chunk: number[]) => void} clearAffinityChunk
 * @property {(patch: import('./cortical-patch.js').CorticalPatch) => void} uploadPatch
 */

export class ClipmapController {
    /**
     * @param {{ gpu?: ClipmapGpuAdapter|null, now?: () => number, cache?: AffinityCache }} [opts]
     */
    constructor({ gpu = null, now = () => performance.now(), cache = new AffinityCache() } = {}) {
        this.gpu = gpu;
        this.now = now;
        /** @type {ClipmapOptions} */
        this.options = { ...DEFAULT_CLIPMAP_OPTIONS };
        this.budget = new FrameBudget({ budgetMs: this.options.budgetMs });
        this.cache = cache;
        this.baker = new AffinityChunkBaker({ cache, now });

        this.supported = false;
        this.unsupportedReason = 'WebGPU device not initialised';
        this.geometry = null;
        this.geometryKey = '';

        /** Brick placement the controller wants (null = never placed). */
        this.origin = null;
        /** Placement of the texels the last dispatched step wrote. */
        this.stepOrigin = null;
        /** False until a step has written the brick since it was last idle. */
        this.valid = false;
        this.weight = 0;
        this.focusPoint = [0, 0, 0];
        this.frameCounter = 0;
        this.lastFrame = this._idleFrame(BRICK_TIERS.OFF);

        /** Chunk keys whose real affinity is in the atlas for the current placement. */
        this.residentChunks = new Set();
        /**
         * Toroidal atlas slots currently holding non-zero tract data. A slot
         * that is already zero (fresh texture, cleared, or last given an empty
         * chunk) needs no GPU write to be cleared or to receive an empty chunk
         * — which on first activation skips ~12 MB of zero uploads.
         */
        this.dirtySlots = new Set();
        /** @type {Map<string, number[]>} Chunks of the current brick still awaiting a bake. */
        this.pendingChunks = new Map();
        this.affinityDirty = true;

        /** @type {Map<string, any>} LRU of finished patches by key. */
        this.patchCache = new Map();
        /** @type {{ key: string, steps: Generator<void, any, void> } | null} */
        this.patchJob = null;
        /** @type {{ key: string, vertexCount: number, somaCount: number, indexCount: number, axis: number[], cosInner: number, cosOuter: number } | null} */
        this.patch = null;
        this.patchBlend = 0;
    }

    /**
     * Mark the backend able (or not) to run the brick. The WebGPU renderer
     * calls this once its brick resources exist.
     * @param {boolean} supported
     * @param {string} [reason]
     */
    setSupported(supported, reason = '') {
        this.supported = Boolean(supported);
        this.unsupportedReason = supported ? '' : (reason || 'unsupported');
        if (!supported) this.valid = false;
    }

    /**
     * Merge options (see mergeClipmapOptions()).
     * @param {Partial<ClipmapOptions>} opts
     */
    setOptions(opts = {}) {
        this.options = mergeClipmapOptions(this.options, opts);
        this.budget.budgetMs = Math.max(1, this.options.budgetMs);
        return { ...this.options };
    }

    /**
     * Adopt a (re)built geometry. Its tracts and surface may have changed, so
     * every resident affinity chunk and any patch in progress are stale; the
     * brick's *field* values are not, so the brick keeps stepping from them.
     * @param {any} geometry - BrainGeometry
     */
    setGeometry(geometry) {
        this.geometry = geometry;
        const key = geometry ? geometry.getFiberGeometryKey() : '';
        if (key === this.geometryKey && !this.affinityDirty) return;
        this.geometryKey = key;
        this.baker.setGeometry(geometry);
        this.affinityDirty = true;
        this.residentChunks.clear();
        this.pendingChunks.clear();
        this.patchJob = null;
        // The displayed patch stays until its replacement is ready.
    }

    /**
     * The GPU objects were (re)created — first init, or device-loss recovery.
     * Nothing the controller believed was on the GPU is there any more: the
     * atlas is empty, the brick state is zero, the patch buffers are gone.
     * CPU-side caches (baked chunks, generated patches) survive and refill
     * the new textures without re-baking.
     */
    resetGpuState() {
        this.affinityDirty = true;
        this.residentChunks.clear();
        this.dirtySlots.clear();
        this.pendingChunks.clear();
        this.baker.request([]);
        this.valid = false;
        this.stepOrigin = null;
        this.patch = null;
        this.patchJob = null;
        this.patchBlend = 0;
    }

    /**
     * Feed one frame's measured cost to the budget governor.
     * @param {{ gpuMs?: number|null, intervalMs?: number|null }} sample
     */
    observeFrame(sample) {
        this.budget.observe(sample);
    }

    /** @param {number} tier */
    _idleFrame(tier) {
        return {
            active: false,
            dispatch: false,
            mode: 0,
            tier,
            lodLoad: this.budget ? this.budget.lodLoad : 0,
            weight: 0,
            latticeOrigin: [0, 0, 0],
            prevOrigin: [0, 0, 0],
            prevValid: 0,
            nudge: this.options.nudge,
            fineSteps: 0,
            patch: { draw: false, impostor: false, blend: 0, axis: [0, 0, 1], cosInner: 1, cosOuter: 1 },
        };
    }

    /**
     * @param {{ cameraDir: number[], stimulus?: { pos?: number[], injectedAt?: number }|null }} inputs
     * @param {number} now
     */
    _focus({ cameraDir, stimulus }, now) {
        const mode = this.options.focus;
        const pos = stimulus?.pos;
        const injectedAt = stimulus?.injectedAt;
        if (pos && typeof injectedAt === 'number' && Number.isFinite(injectedAt)) {
            const recent = now - injectedAt <= STIMULUS_FOCUS_MS;
            if (mode === 'stimulus' || (mode === 'auto' && recent)) return pos.slice(0, 3);
        }
        const radius = this.geometry
            ? this.geometry.sampleCorticalSurface(cameraDir[0], cameraDir[1], cameraDir[2], true).radius
            : 1.5;
        const r = Math.max(0, radius - CAMERA_FOCUS_INSET);
        return [cameraDir[0] * r, cameraDir[1] * r, cameraDir[2] * r];
    }

    /**
     * Re-plan affinity for a new placement: upload what the cache has, clear
     * and queue what it does not, keep queued chunks that are still inside.
     * @param {number[]} origin
     */
    _place(origin) {
        const previous = this.affinityDirty ? null : this.origin;
        const exposed = chunksExposedByMove(previous, origin, this.focusPoint);
        const inBrick = new Set(chunksInBrick(origin).map(chunkKey));
        for (const key of [...this.residentChunks]) if (!inBrick.has(key)) this.residentChunks.delete(key);
        for (const key of [...this.pendingChunks.keys()]) if (!inBrick.has(key)) this.pendingChunks.delete(key);
        for (const chunk of exposed) {
            const key = chunkKey(chunk);
            const cached = this.baker.lookup(chunk);
            if (cached !== undefined) {
                this._uploadChunk(chunk, cached);
                this.residentChunks.add(key);
                this.pendingChunks.delete(key);
            } else {
                // The atlas texel block now maps to this chunk but still holds
                // whatever the old placement left there (toroidal addressing):
                // tract directions from the far side of the old brick. Zero it
                // so the step diffuses isotropically there until the bake lands.
                this._uploadChunk(chunk, EMPTY_CHUNK);
                this.residentChunks.delete(key);
                this.pendingChunks.set(key, chunk);
            }
        }
        this._requestPending();
        this.origin = origin;
        this.affinityDirty = false;
    }

    /**
     * Write a chunk's affinity (EMPTY_CHUNK = zeros) to its atlas slot,
     * skipping the write when the slot is already zero and the data is too.
     * @param {number[]} chunk
     * @param {Float32Array|typeof EMPTY_CHUNK} data
     */
    _uploadChunk(chunk, data) {
        const slot = chunk.map((g) => toroidalTexel(g) / BRICK_CHUNK_DIM).join(',');
        if (data === EMPTY_CHUNK) {
            if (!this.dirtySlots.has(slot)) return;
            this.gpu?.clearAffinityChunk(chunk);
            this.dirtySlots.delete(slot);
            return;
        }
        this.gpu?.uploadAffinityChunk(chunk, data);
        this.dirtySlots.add(slot);
    }

    _requestPending() {
        const f = this.focusPoint.map((w) => worldToLattice(w));
        const ordered = [...this.pendingChunks.values()].sort((a, b) => {
            const da = a.reduce((s, g, i) => s + (g + 8 - f[i]) ** 2, 0);
            const db = b.reduce((s, g, i) => s + (g + 8 - f[i]) ** 2, 0);
            return da - db;
        });
        this.baker.request(ordered);
    }

    /** @param {number[]} origin */
    _patchKey(origin) {
        return `${this.geometryKey}|${origin.join(',')}`;
    }

    /**
     * @param {string} key
     * @param {any} patch
     */
    _swapPatch(key, patch) {
        this.gpu?.uploadPatch(patch);
        this.patch = {
            key,
            vertexCount: patch.vertexCount,
            indexCount: patch.indexCount,
            somaCount: patch.somaCount,
            axis: patch.axis,
            cosInner: patch.cosInner,
            cosOuter: patch.cosOuter,
        };
    }

    /**
     * Spend up to `budgetMs` of CPU on pending affinity chunks, then on the patch.
     * @param {number} budgetMs
     */
    _pumpJobs(budgetMs) {
        const start = this.now();
        if (this.baker.pending > 0) {
            this.baker.pump(budgetMs, (chunk, data) => {
                const key = chunkKey(chunk);
                if (!this.pendingChunks.has(key)) return; // brick moved on
                this.pendingChunks.delete(key);
                this._uploadChunk(chunk, data);
                this.residentChunks.add(key);
            });
        }
        const left = budgetMs - (this.now() - start);
        if (this.patchJob && left > 0.5) {
            const jobStart = this.now();
            while (this.now() - jobStart < left) {
                const result = this.patchJob.steps.next();
                if (!result.done) continue;
                const { key } = this.patchJob;
                this.patchJob = null;
                this.patchCache.set(key, result.value);
                while (this.patchCache.size > MAX_CACHED_PATCHES) {
                    this.patchCache.delete(/** @type {string} */ (this.patchCache.keys().next().value));
                }
                this._swapPatch(key, result.value);
                break;
            }
        }
    }

    /** @param {boolean} impostor - Draw the cheap point-sprite form. */
    _patchFrame(impostor) {
        if (!this.patch || this.patchBlend <= 0) {
            return { draw: false, impostor: false, blend: 0, axis: [0, 0, 1], cosInner: 1, cosOuter: 1 };
        }
        return {
            draw: true,
            impostor,
            blend: this.patchBlend,
            axis: this.patch.axis,
            cosInner: this.patch.cosInner,
            cosOuter: this.patch.cosOuter,
        };
    }

    /**
     * Decide this frame's clipmap work.
     *
     * @param {{
     *   zoom: number,
     *   cameraDir: number[],
     *   style: number,
     *   cognitiveLoad: number,
     *   playback?: boolean,
     *   voxelDim: number,
     *   stimulus?: { pos?: number[], injectedAt?: number } | null,
     *   now?: number,
     * }} inputs
     */
    update(inputs) {
        const now = inputs.now ?? this.now();
        const tier = this.budget.chooseTier(inputs.cognitiveLoad, now, { auto: this.options.autoQuality });
        const style = Number(inputs.style) || 0;
        // Consumers of the brick: the organic/cyber shell (and its patch) and
        // the heatmap raymarch. Connectome and SynaptiX draw no brick reads, so
        // stepping one there would be pure cost.
        const surfaceStyle = style < 2;
        const brickStyle = surfaceStyle || (style >= 3 && style < 4);
        const zoomWeight = 1 - smoothstep(CLIPMAP_ZOOM.brickFull, CLIPMAP_ZOOM.brickStart, inputs.zoom);
        const canRun = this.supported && this.options.enabled && this.geometry && brickStyle && tier > BRICK_TIERS.OFF;
        const target = canRun ? zoomWeight : 0;
        this.weight = approach(this.weight, target, 0.12);

        if ((this.weight <= 0 && target <= 0) || (target <= 0 && !(this.valid && this.stepOrigin))) {
            // Idle: stop stepping, and forget the state — by the time the brick
            // is wanted again the coarse field has moved on, so it reseeds.
            this.valid = false;
            this.weight = 0;
            this.patchBlend = 0;
            this.lastFrame = this._idleFrame(tier);
            return this.lastFrame;
        }
        if (target <= 0) {
            // Fading out (zoomed out, budget or cognitiveLoad at OFF, a style
            // with no brick reads): nothing new is wanted, so nothing new is
            // computed. The last step's brick stays on screen, frozen, while
            // its weight eases to zero — the frames where the budget was blown
            // are exactly the ones that must not keep paying for the brick.
            this.patchBlend = approach(this.patchBlend, 0, 0.12);
            this.lastFrame = {
                ...this._idleFrame(tier),
                active: true,
                weight: this.weight,
                latticeOrigin: [.../** @type {number[]} */ (this.stepOrigin)],
                prevOrigin: [.../** @type {number[]} */ (this.stepOrigin)],
                prevValid: 1,
                fineSteps: FINE_STEPS[BRICK_TIERS.REDUCED],
                patch: this._patchFrame(true),
            };
            return this.lastFrame;
        }

        this.focusPoint = this._focus(inputs, now);
        const origin = brickOriginFor(this.focusPoint, this.affinityDirty ? null : this.origin);
        const moved = !this.origin || origin.some((g, i) => g !== this.origin?.[i]);
        if (moved || this.affinityDirty) this._place(origin);

        const placementChanged = !this.stepOrigin || origin.some((g, i) => g !== this.stepOrigin?.[i]);
        const dispatch = tier === BRICK_TIERS.FULL || !this.valid || placementChanged || (this.frameCounter % 2 === 0);
        this.frameCounter++;
        const prevOrigin = this.stepOrigin ? [...this.stepOrigin] : [...origin];
        const prevValid = this.valid && this.stepOrigin ? 1 : 0;
        if (dispatch) {
            this.stepOrigin = [...origin];
            this.valid = true;
        }

        // --- Phase C: cortical patch ---
        const patchZone = this.options.patch && surfaceStyle && tier > BRICK_TIERS.OFF
            && inputs.zoom < CLIPMAP_ZOOM.patchStart + 0.25;
        if (patchZone && this.geometry) {
            const key = this._patchKey(origin);
            if (this.patch?.key !== key) {
                const cached = this.patchCache.get(key);
                if (cached) {
                    this.patchJob = null;
                    this._swapPatch(key, cached);
                } else if (this.patchJob?.key !== key) {
                    const frame = patchFrameFor(this.geometry, brickCenterWorld(origin));
                    const seed = (origin[0] * 73856093) ^ (origin[1] * 19349663) ^ (origin[2] * 83492791);
                    this.patchJob = { key, steps: generateCorticalPatch(this.geometry, frame, { seed }) };
                }
            }
        }
        this._pumpJobs(this.options.jobBudgetMs);

        const patchZoom = 1 - smoothstep(CLIPMAP_ZOOM.patchFull, CLIPMAP_ZOOM.patchStart, inputs.zoom);
        const patchTarget = patchZone && this.patch ? patchZoom * Math.min(1, this.weight / 0.6) : 0;
        this.patchBlend = approach(this.patchBlend, patchTarget, 0.12);
        const patch = this._patchFrame(tier < BRICK_TIERS.FULL);

        this.lastFrame = {
            active: true,
            dispatch,
            // Tensor playback drives the coarse buffer from a recording; the
            // brick then only refines it (interpolates) rather than adding
            // dynamics the recording does not contain.
            mode: inputs.playback ? 1 : 2,
            tier,
            lodLoad: this.budget.lodLoad,
            weight: this.weight,
            latticeOrigin: [.../** @type {number[]} */ (this.stepOrigin)],
            prevOrigin,
            prevValid,
            nudge: this.options.nudge,
            fineSteps: FINE_STEPS[tier] ?? 0,
            patch,
        };
        return this.lastFrame;
    }

    /** HUD / debug snapshot. */
    getState() {
        const f = this.lastFrame;
        const origin = this.stepOrigin || this.origin;
        return {
            supported: this.supported,
            reason: this.unsupportedReason,
            options: { ...this.options },
            active: f.active,
            mode: !f.active ? 'off' : f.mode === 1 ? 'interpolate' : 'simulate',
            tier: f.tier,
            tierName: TIER_NAMES[f.tier],
            weight: f.weight,
            lodLoad: f.lodLoad,
            brickDim: BRICK_DIM,
            latticeDim: FINE_LATTICE_DIM,
            fineSpacing: FINE_SPACING,
            origin: origin ? [...origin] : null,
            center: origin ? brickCenterWorld(origin) : null,
            focus: [...this.focusPoint],
            affinity: {
                resident: this.residentChunks.size,
                pending: this.pendingChunks.size,
                baked: this.baker.bakedCount,
                bakeMs: this.baker.bakeMs,
                cacheBytes: this.cache.bytes,
                cacheEntries: this.cache.size,
                cacheHits: this.cache.hits,
                cacheMisses: this.cache.misses,
            },
            patch: {
                state: !f.patch.draw ? (this.patchJob ? 'building' : 'off') : f.patch.impostor ? 'impostor' : 'mesh',
                blend: f.patch.blend,
                vertices: this.patch ? this.patch.vertexCount : 0,
                somas: this.patch ? this.patch.somaCount : 0,
                building: Boolean(this.patchJob),
            },
            budget: this.budget.getState(),
        };
    }
}

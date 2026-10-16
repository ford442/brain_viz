// @ts-check
// src/clipmap/affinity-chunks.js
// [Clipmap] Per-level fiber affinity, baked on demand and cached.
//
// The fine brick runs the same anisotropic diffusion as the coarse field
// (docs/tensor-physics.md §6.3–§6.4), so it needs tract directions at *its*
// resolution: a tract one coarse voxel wide is resolved across eight fine
// ones. Baking that for the whole 256³ virtual lattice would be ~800 MB; the
// brick only ever needs its own 64³ window. So the fine level is baked in
// BRICK_CHUNK_DIM³ chunks, by the same rasteriser as the coarse map
// (BrainGeometry#bakeFiberAffinityRegion), on demand, a time slice at a time,
// and cached by chunk so a brick that moves back over ground it has seen pays
// nothing (docs/field-resolution.md §7: "that is the expensive part").
//
// The cache is byte-bounded and shared with the coarse level's whole-grid maps
// (keyed `level:<dim>:full:<geometry>`), which is what makes a 32 → 64 → 32
// resolution round trip skip its second ~1 s bake.

import { AFFINITY_SLOTS, BRICK_CHUNK_DIM, FINE_LATTICE_DIM, chunkKey } from './brick-layout.js';

/** Default cache capacity: every coarse map plus a few bricks' worth of fine chunks. */
export const DEFAULT_AFFINITY_CACHE_BYTES = 64 * 1024 * 1024;

/**
 * A chunk with no tract slot above the shader's 0.01 cutoff. Stored instead of
 * its data: the shader would ignore every direction in it, so it uploads as
 * zeros, and most of the brain's volume is chunks like this.
 */
export const EMPTY_CHUNK = Object.freeze({ empty: true });

/**
 * Byte-bounded LRU map. Entries are Float32Arrays (weight = byteLength) or
 * EMPTY_CHUNK (weight ≈ 0).
 */
export class AffinityCache {
    /** @param {number} [capacityBytes] */
    constructor(capacityBytes = DEFAULT_AFFINITY_CACHE_BYTES) {
        this.capacityBytes = capacityBytes;
        this.bytes = 0;
        /** @type {Map<string, any>} */
        this._map = new Map();
        this.hits = 0;
        this.misses = 0;
    }

    /** @param {any} value */
    static weightOf(value) {
        return value && typeof value.byteLength === 'number' ? value.byteLength : 64;
    }

    /** @param {string} key */
    get(key) {
        const value = this._map.get(key);
        if (value === undefined) {
            this.misses++;
            return undefined;
        }
        this.hits++;
        // Refresh recency.
        this._map.delete(key);
        this._map.set(key, value);
        return value;
    }

    /** @param {string} key */
    has(key) {
        return this._map.has(key);
    }

    /**
     * @param {string} key
     * @param {any} value
     */
    set(key, value) {
        const existing = this._map.get(key);
        if (existing !== undefined) {
            this.bytes -= AffinityCache.weightOf(existing);
            this._map.delete(key);
        }
        this._map.set(key, value);
        this.bytes += AffinityCache.weightOf(value);
        for (const [oldKey, oldValue] of this._map) {
            if (this.bytes <= this.capacityBytes || oldKey === key) break;
            this._map.delete(oldKey);
            this.bytes -= AffinityCache.weightOf(oldValue);
        }
    }

    clear() {
        this._map.clear();
        this.bytes = 0;
    }

    get size() {
        return this._map.size;
    }
}

/**
 * Cache key for one fine chunk of one geometry.
 * @param {string} geometryKey - BrainGeometry#getFiberGeometryKey()
 * @param {number[]} chunk - Chunk origin, in fine-lattice voxels.
 */
export function fineChunkCacheKey(geometryKey, chunk) {
    return `level:${FINE_LATTICE_DIM}:chunk:${chunkKey(chunk)}:${geometryKey}`;
}

/**
 * Re-lays a baked block from the rasteriser's interleaved form (12 floats per
 * voxel, slot-interleaved — the coarse storage buffer's layout) into one
 * contiguous vec4 plane per slot, which is what a 3D-texture upload of each
 * slot's slab of the atlas needs. Returns EMPTY_CHUNK when no slot of any
 * voxel would pass the shader's weight cutoff.
 *
 * @param {Float32Array} interleaved - `size³ × 12` floats.
 * @param {number} [size]
 * @returns {Float32Array|typeof EMPTY_CHUNK}
 */
export function planarizeChunk(interleaved, size = BRICK_CHUNK_DIM) {
    const voxels = size ** 3;
    let anyTract = false;
    for (let i = 0; i < voxels && !anyTract; i++) {
        for (let k = 0; k < AFFINITY_SLOTS; k++) {
            if (interleaved[i * 12 + k * 4 + 3] >= 0.01) { anyTract = true; break; }
        }
    }
    if (!anyTract) return EMPTY_CHUNK;
    const planar = new Float32Array(voxels * 4 * AFFINITY_SLOTS);
    for (let k = 0; k < AFFINITY_SLOTS; k++) {
        const plane = k * voxels * 4;
        for (let i = 0; i < voxels; i++) {
            planar[plane + i * 4] = interleaved[i * 12 + k * 4];
            planar[plane + i * 4 + 1] = interleaved[i * 12 + k * 4 + 1];
            planar[plane + i * 4 + 2] = interleaved[i * 12 + k * 4 + 2];
            planar[plane + i * 4 + 3] = interleaved[i * 12 + k * 4 + 3];
        }
    }
    return planar;
}

/**
 * Bakes the chunks a brick needs, nearest-first, inside a per-frame time
 * budget, handing each finished chunk to `onReady`.
 */
export class AffinityChunkBaker {
    /**
     * @param {{ cache: AffinityCache, now?: () => number }} opts
     */
    constructor({ cache, now = () => performance.now() }) {
        this.cache = cache;
        this.now = now;
        /** @type {any} BrainGeometry (has bakeFiberAffinityRegion / getFiberGeometryKey). */
        this.geometry = null;
        this.geometryKey = '';
        /** @type {number[][]} */
        this.queue = [];
        /** @type {{ chunk: number[], steps: Generator<void, Float32Array, void> } | null} */
        this.inFlight = null;
        this.bakedCount = 0;
        this.bakeMs = 0;
    }

    /**
     * Switch to a new geometry. Its tracts differ, so in-flight work is
     * dropped; cached chunks of the old geometry simply stop matching keys.
     * @param {any} geometry
     */
    setGeometry(geometry) {
        this.geometry = geometry;
        this.geometryKey = geometry ? geometry.getFiberGeometryKey() : '';
        this.queue = [];
        this.inFlight = null;
    }

    /**
     * Cached affinity for a chunk, if any (no bake).
     * @param {number[]} chunk
     */
    lookup(chunk) {
        if (!this.geometry) return undefined;
        return this.cache.get(fineChunkCacheKey(this.geometryKey, chunk));
    }

    /**
     * Replace the pending set with `chunks` (already priority-ordered). A chunk
     * already in flight keeps baking if it is still wanted.
     * @param {number[][]} chunks
     */
    request(chunks) {
        const wanted = new Set(chunks.map(chunkKey));
        if (this.inFlight && !wanted.has(chunkKey(this.inFlight.chunk))) this.inFlight = null;
        const inFlightKey = this.inFlight ? chunkKey(this.inFlight.chunk) : null;
        this.queue = chunks.filter((chunk) => chunkKey(chunk) !== inFlightKey);
    }

    get pending() {
        return this.queue.length + (this.inFlight ? 1 : 0);
    }

    /**
     * Advance baking until `budgetMs` is spent or nothing is pending.
     * @param {number} budgetMs
     * @param {(chunk: number[], data: Float32Array|typeof EMPTY_CHUNK) => void} onReady
     * @returns {number} Chunks finished this call.
     */
    pump(budgetMs, onReady) {
        if (!this.geometry) return 0;
        const start = this.now();
        let finished = 0;
        while (this.now() - start < budgetMs) {
            if (!this.inFlight) {
                const chunk = this.queue.shift();
                if (!chunk) break;
                const key = fineChunkCacheKey(this.geometryKey, chunk);
                const cached = this.cache.get(key);
                if (cached !== undefined) {
                    onReady(chunk, cached);
                    finished++;
                    continue;
                }
                this.inFlight = {
                    chunk,
                    steps: this.geometry.bakeFiberAffinityRegion({
                        latticeDim: FINE_LATTICE_DIM,
                        origin: chunk,
                        size: BRICK_CHUNK_DIM,
                    }),
                };
            }
            const result = this.inFlight.steps.next();
            if (result.done) {
                const { chunk } = this.inFlight;
                this.inFlight = null;
                const data = planarizeChunk(result.value);
                this.cache.set(fineChunkCacheKey(this.geometryKey, chunk), data);
                this.bakedCount++;
                onReady(chunk, data);
                finished++;
            }
        }
        this.bakeMs += this.now() - start;
        return finished;
    }
}

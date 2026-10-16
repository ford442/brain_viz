// @ts-check
// src/clipmap/brick-layout.js
// [Clipmap] Geometry of the fine brick: the virtual fine lattice it is a
// window into, where the window sits, and how its texels are addressed.
//
// The clipmap has two levels (docs/field-resolution.md §7):
//
//   level 0 — the coarse whole-brain field, `voxelDim³` (32³ by default),
//             stepped by the existing compute shader, recorded by NWS1 and
//             pinned by the golden fixture. Nothing here changes it.
//   level 1 — a `BRICK_DIM³` window into a virtual `FINE_LATTICE_DIM³`
//             lattice over the same field cube. Only the window is resident.
//
// Both levels place voxel `g` at `((g / latticeDim) * 2 - 1) * BRAIN_RANGE`
// (docs/tensor-physics.md §4.1), so a fine voxel and the coarse voxel under it
// agree on where they are regardless of the coarse `voxelDim`.
//
// The window moves in whole chunks (`BRICK_CHUNK_DIM`) and is addressed
// toroidally — lattice voxel `g` always lives in texel `g mod BRICK_DIM` — so a
// move keeps every texel the old and new windows share and only the newly
// exposed slab is reseeded and re-baked. That is what makes this a clipmap
// rather than a brick that resets every time the camera drifts.

import { BRAIN_RANGE } from '../physics/tensor-field.js';

/** Resolution of the virtual fine lattice over the whole field cube. */
export const FINE_LATTICE_DIM = 256;

/** Edge length of the resident brick, in fine voxels. 64³ first (see #345). */
export const BRICK_DIM = 64;

/** Granularity of brick moves, affinity bakes and the affinity cache. */
export const BRICK_CHUNK_DIM = 16;

/** Tract slots per voxel, as in the coarse `fiberDirections` buffer. */
export const AFFINITY_SLOTS = 3;

/** Floats per voxel in a baked affinity block: AFFINITY_SLOTS × (dir.xyz, weight). */
export const AFFINITY_STRIDE = AFFINITY_SLOTS * 4;

/**
 * The largest brick the WebGPU device is provisioned for. `deriveRequiredLimits()`
 * sizes the 3D-texture limit from this, the way it sizes storage limits from
 * MAX_VOXEL_DIM, so a later 128³ brick does not need a new device.
 */
export const MAX_BRICK_DIM = 128;

const CHUNKS_PER_BRICK_AXIS = BRICK_DIM / BRICK_CHUNK_DIM;

/** World-space edge length of one fine voxel. */
export const FINE_SPACING = (BRAIN_RANGE * 2) / FINE_LATTICE_DIM;

/** World-space edge length of the brick. */
export const BRICK_WORLD_SIZE = FINE_SPACING * BRICK_DIM;

/**
 * Bytes of GPU memory the brick needs, for the capability report: two
 * rg32float state textures (state, stepped), one rgba16float render texture,
 * the rgba32float affinity atlas (one slab per slot), and the rg32float 8³
 * restriction cell means.
 * @param {number} [brickDim]
 */
export function brickResourceBytes(brickDim = BRICK_DIM) {
    const texels = brickDim ** 3;
    return texels * 8 * 2 + texels * 8 + texels * 16 * AFFINITY_SLOTS + (brickDim / 8) ** 3 * 8;
}

/**
 * §4.1 world position of a fine-lattice voxel.
 * @param {number} g
 * @param {number} [latticeDim]
 */
export function latticeToWorld(g, latticeDim = FINE_LATTICE_DIM) {
    return ((g / latticeDim) * 2 - 1) * BRAIN_RANGE;
}

/**
 * Continuous fine-lattice coordinate of a world position (voxel `g`'s value
 * sits at exactly `g`).
 * @param {number} w
 * @param {number} [latticeDim]
 */
export function worldToLattice(w, latticeDim = FINE_LATTICE_DIM) {
    return ((w / BRAIN_RANGE) * 0.5 + 0.5) * latticeDim;
}

/**
 * Texel that holds lattice voxel `g` under toroidal addressing.
 * @param {number} g
 * @param {number} [brickDim]
 */
export function toroidalTexel(g, brickDim = BRICK_DIM) {
    return ((g % brickDim) + brickDim) % brickDim;
}

/**
 * Lattice voxel held by texel `s` of a brick whose origin is `origin`
 * (the inverse of toroidalTexel within the window). Mirrors the WGSL in
 * src/shaders/brick-compute.js.
 * @param {number} s
 * @param {number} origin
 * @param {number} [brickDim]
 */
export function texelToLattice(s, origin, brickDim = BRICK_DIM) {
    return origin + toroidalTexel(s - origin, brickDim);
}

/**
 * The brick origin (lowest lattice index per axis, a multiple of
 * BRICK_CHUNK_DIM) that best centres the brick on `center`, clamped so the
 * brick stays inside the lattice.
 *
 * With `current`, the brick only moves once the centre has left a dead zone of
 * ±¾ of a chunk around the current brick's centre. Without it, a focus point
 * sitting on a chunk boundary would flip the brick back and forth every frame,
 * reseeding a slab and re-baking its affinity each time.
 *
 * @param {number[]} center - World-space (model-space) point.
 * @param {number[]|null} [current] - The brick's current origin, if any.
 * @returns {number[]}
 */
export function brickOriginFor(center, current = null) {
    const maxOrigin = FINE_LATTICE_DIM - BRICK_DIM;
    const half = BRICK_DIM / 2;
    return center.map((w, axis) => {
        const c = worldToLattice(w);
        if (current) {
            const currentCenter = current[axis] + half;
            if (Math.abs(c - currentCenter) <= BRICK_CHUNK_DIM * 0.75) return current[axis];
        }
        const snapped = Math.round((c - half) / BRICK_CHUNK_DIM) * BRICK_CHUNK_DIM;
        return Math.max(0, Math.min(maxOrigin, snapped));
    });
}

/**
 * World-space centre of a brick.
 * @param {number[]} origin
 * @returns {number[]}
 */
export function brickCenterWorld(origin) {
    // Lattice voxel g sits at g; the brick spans [origin, origin + BRICK_DIM - 1].
    return origin.map((g) => latticeToWorld(g + (BRICK_DIM - 1) / 2));
}

/**
 * True if lattice voxel `g` (per axis) is inside the brick at `origin`.
 * @param {number[]} g
 * @param {number[]} origin
 */
export function latticeInBrick(g, origin) {
    return g.every((v, axis) => v >= origin[axis] && v < origin[axis] + BRICK_DIM);
}

/**
 * Chunk origins (lattice indices) covering the brick at `origin`.
 * @param {number[]} origin
 * @returns {number[][]}
 */
export function chunksInBrick(origin) {
    /** @type {number[][]} */
    const out = [];
    for (let cz = 0; cz < CHUNKS_PER_BRICK_AXIS; cz++) {
        for (let cy = 0; cy < CHUNKS_PER_BRICK_AXIS; cy++) {
            for (let cx = 0; cx < CHUNKS_PER_BRICK_AXIS; cx++) {
                out.push([
                    origin[0] + cx * BRICK_CHUNK_DIM,
                    origin[1] + cy * BRICK_CHUNK_DIM,
                    origin[2] + cz * BRICK_CHUNK_DIM,
                ]);
            }
        }
    }
    return out;
}

/**
 * Chunks of the brick at `next` that the brick at `previous` did not cover —
 * exactly the texels a move reseeds and whose affinity has to be (re)loaded.
 * Every chunk when there is no previous brick.
 *
 * Sorted nearest-first to `focus` (when given) so the region being looked at
 * gets its tract map before the far corner of the brick does.
 *
 * @param {number[]|null} previous
 * @param {number[]} next
 * @param {number[]} [focus] - World-space point to prioritise.
 * @returns {number[][]}
 */
export function chunksExposedByMove(previous, next, focus) {
    const exposed = chunksInBrick(next).filter((chunk) => !previous || !latticeInBrick(chunk, previous));
    if (focus) {
        const f = focus.map((w) => worldToLattice(w));
        const d2 = (chunk) => chunk.reduce((sum, g, axis) => {
            const d = g + BRICK_CHUNK_DIM / 2 - f[axis];
            return sum + d * d;
        }, 0);
        exposed.sort((a, b) => d2(a) - d2(b));
    }
    return exposed;
}

/**
 * Stable cache/queue key for a chunk.
 * @param {number[]} chunk
 */
export function chunkKey(chunk) {
    return `${chunk[0]},${chunk[1]},${chunk[2]}`;
}

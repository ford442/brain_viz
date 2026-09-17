// src/voxel-dim.js
// [Field Resolution] Single source of truth for the neural field's grid
// resolution.
//
// The engine was permanently 32³: `voxelDim = 32` was re-declared in the two
// renderer constructors, pasted into WGSL as `const VOXEL_DIM: u32 = 32u`,
// hardcoded in the SynaptiX projector and the BCI resampler, and assumed by
// every consumer of a tensor buffer. Nothing could ask the engine what
// resolution it was running at, so nothing could change it.
//
// This module replaces all of those literals. `DEFAULT_VOXEL_DIM` is still 32
// — the default is unchanged and every existing session file still loads —
// but the dimension is now a *value* that travels with the field instead of a
// constant baked into six implementations.
//
// See docs/field-resolution.md for the roadmap (clipmap bricks, recursive
// zoom) this is the foundation for.

/** The resolution the engine boots at. Unchanged from the hardcoded era. */
export const DEFAULT_VOXEL_DIM = 32;

/**
 * Resolutions the engine is built and tested for, ascending.
 *
 * The list is deliberately short and power-of-two-ish rather than "any integer":
 *   - the compute pass dispatches ceil(dim³ / 64) workgroups, so dim³ should be
 *     a multiple of the 64-invocation workgroup size (32³, 48³ and 64³ all are);
 *   - `deriveRequiredLimits()` sizes the WebGPU device for `MAX_VOXEL_DIM` up
 *     front, so a runtime switch never needs a new device;
 *   - every dim here is exercised by tests/test_voxel_dim.js.
 */
export const SUPPORTED_VOXEL_DIMS = Object.freeze([32, 48, 64]);

/** Largest supported resolution. GPU limits are sized for this, not for the default. */
export const MAX_VOXEL_DIM = SUPPORTED_VOXEL_DIMS[SUPPORTED_VOXEL_DIMS.length - 1];

/**
 * Voxels in a `dim³` field.
 * @param {number} dim
 * @returns {number}
 */
export function voxelCountFor(dim) {
    return dim * dim * dim;
}

/**
 * Bytes in a `dim³` scalar (f32) tensor buffer.
 * @param {number} dim
 * @returns {number}
 */
export function tensorByteLengthFor(dim) {
    return voxelCountFor(dim) * 4;
}

/**
 * Bytes in a `dim³` fiber-affinity buffer (3 × vec4<f32> per voxel).
 * @param {number} dim
 * @returns {number}
 */
export function fiberAffinityByteLengthFor(dim) {
    return voxelCountFor(dim) * 12 * 4;
}

/**
 * True if `dim` is a resolution this build supports.
 * @param {unknown} dim
 * @returns {boolean}
 */
export function isSupportedVoxelDim(dim) {
    return typeof dim === 'number' && SUPPORTED_VOXEL_DIMS.includes(dim);
}

/**
 * Throws unless `dim` is supported. Used at every boundary where a dimension
 * arrives from outside the engine — a session file header, a `.nwbci`
 * recording, a `setVoxelDim()` call from the UI.
 *
 * @param {unknown} dim
 * @param {string} [context] - Prefixed to the error, e.g. 'NWS1 manifest'.
 * @returns {number} The validated dimension.
 */
export function assertVoxelDim(dim, context = 'voxelDim') {
    if (!isSupportedVoxelDim(dim)) {
        throw new Error(
            `[Field Resolution] ${context}: ${String(dim)} is not a supported voxel dimension ` +
            `(expected one of ${SUPPORTED_VOXEL_DIMS.join(', ')}).`
        );
    }
    return /** @type {number} */ (dim);
}

/**
 * Coerces an untrusted value to a supported dimension, falling back to the
 * default. For UI paths that should degrade rather than throw.
 *
 * @param {unknown} dim
 * @param {number} [fallback=DEFAULT_VOXEL_DIM]
 * @returns {number}
 */
export function normalizeVoxelDim(dim, fallback = DEFAULT_VOXEL_DIM) {
    return isSupportedVoxelDim(dim) ? /** @type {number} */ (dim) : fallback;
}

/**
 * Recovers the grid resolution of a flat field from its length.
 *
 * Every tensor in the engine is a `dim³` Float32Array, so the length pins the
 * dimension exactly — which lets consumers that only ever see a buffer (region
 * statistics, analysis, sonification) stop assuming 32³ without every caller
 * having to be re-plumbed to pass a dim.
 *
 * @param {ArrayLike<number>|null|undefined} field
 * @param {number} [fallback=DEFAULT_VOXEL_DIM] - Returned when the length is
 *   not a supported cube.
 * @returns {number}
 */
export function inferVoxelDim(field, fallback = DEFAULT_VOXEL_DIM) {
    const length = field?.length;
    if (typeof length !== 'number') return fallback;
    for (const dim of SUPPORTED_VOXEL_DIMS) {
        if (voxelCountFor(dim) === length) return dim;
    }
    return fallback;
}

/** Clamp a grid index into [0, dim - 1]. */
function clampIndex(index, dim) {
    return index < 0 ? 0 : index > dim - 1 ? dim - 1 : index;
}

/**
 * Resamples a `dim³` scalar field to `targetDim³` with trilinear filtering.
 *
 * Needed wherever a tensor crosses a resolution boundary: a 32³ session file
 * replayed into a 64³ engine, a SynaptiX phantom projected at the projector's
 * native dim into a field running at another, a BCI recording made on a
 * different build. Returns `field` unchanged (same reference) when the dims
 * already match, so the common path allocates nothing.
 *
 * @param {Float32Array} field - Source field, `sourceDim³` floats.
 * @param {number} sourceDim
 * @param {number} targetDim
 * @returns {Float32Array}
 */
export function resampleField(field, sourceDim, targetDim) {
    if (sourceDim === targetDim) return field;
    if (!(field instanceof Float32Array) || field.length !== voxelCountFor(sourceDim)) {
        throw new Error(
            `[Field Resolution] resampleField: expected ${voxelCountFor(sourceDim)} floats ` +
            `for a ${sourceDim}³ field, got ${field?.length}.`
        );
    }

    const out = new Float32Array(voxelCountFor(targetDim));
    const sd2 = sourceDim * sourceDim;
    // Map cell centres to cell centres so the resample is symmetric and does
    // not shift the field by half a voxel at the grid edges.
    const scale = sourceDim / targetDim;

    // Both neighbours are clamped from the *unclamped* floor, never from the
    // already-clamped low index: clamping first and then adding one makes the
    // pair (0, 1) at the boundary while the weight still says "three quarters
    // of the way to the next cell", which reads a value from outside the field
    // and breaks monotonicity at the edge. Clamping both to the same cell is
    // the correct constant extrapolation.
    for (let z = 0; z < targetDim; z++) {
        const sz = (z + 0.5) * scale - 0.5;
        const fz = Math.floor(sz);
        const z0 = clampIndex(fz, sourceDim);
        const z1 = clampIndex(fz + 1, sourceDim);
        const tz = Math.max(0, Math.min(1, sz - fz));
        for (let y = 0; y < targetDim; y++) {
            const sy = (y + 0.5) * scale - 0.5;
            const fy = Math.floor(sy);
            const y0 = clampIndex(fy, sourceDim);
            const y1 = clampIndex(fy + 1, sourceDim);
            const ty = Math.max(0, Math.min(1, sy - fy));
            for (let x = 0; x < targetDim; x++) {
                const sx = (x + 0.5) * scale - 0.5;
                const fx = Math.floor(sx);
                const x0 = clampIndex(fx, sourceDim);
                const x1 = clampIndex(fx + 1, sourceDim);
                const tx = Math.max(0, Math.min(1, sx - fx));

                const c000 = field[z0 * sd2 + y0 * sourceDim + x0];
                const c100 = field[z0 * sd2 + y0 * sourceDim + x1];
                const c010 = field[z0 * sd2 + y1 * sourceDim + x0];
                const c110 = field[z0 * sd2 + y1 * sourceDim + x1];
                const c001 = field[z1 * sd2 + y0 * sourceDim + x0];
                const c101 = field[z1 * sd2 + y0 * sourceDim + x1];
                const c011 = field[z1 * sd2 + y1 * sourceDim + x0];
                const c111 = field[z1 * sd2 + y1 * sourceDim + x1];

                const c00 = c000 + (c100 - c000) * tx;
                const c10 = c010 + (c110 - c010) * tx;
                const c01 = c001 + (c101 - c001) * tx;
                const c11 = c011 + (c111 - c011) * tx;
                const c0 = c00 + (c10 - c00) * ty;
                const c1 = c01 + (c11 - c01) * ty;

                out[z * targetDim * targetDim + y * targetDim + x] = c0 + (c1 - c0) * tz;
            }
        }
    }
    return out;
}

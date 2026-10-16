// @ts-check
// src/clipmap/cortical-patch.js
// [Clipmap Phase C] A locally generated, high-resolution piece of cortex.
//
// The organic mesh is an 81×51 deformed UV sphere: ~0.09 world units between
// vertices, while the cortical surface it samples (BrainGeometry#
// sampleCorticalSurface) has folds at ~0.05. Zoomed out that is invisible;
// leaning into a gyrus it is a faceted ball. A finer *field* cannot fix that,
// so below the recursive-zoom threshold the renderer swaps the mesh, inside
// the fine brick's footprint, for this patch: the same surface function
// sampled ~10× more densely, plus soma instances laid out in cortical layers.
// The vertex shader then displaces it by the fine brick's activity
// (src/shaders/cortical-patch.js), so the detail is driven by the field, not
// painted on.
//
// It is one implementation of the surface — the patch calls the geometry's own
// sampleCorticalSurface(), never a WGSL port of it — so the patch and the mesh
// it replaces cannot disagree about where the cortex is beyond the mesh's own
// chord error, which the patch's edge fade hides.
//
// Sampling costs ~15 µs per vertex, so generation is a generator the clipmap
// controller time-slices across frames, and finished patches are cached per
// brick placement.

import { BRICK_WORLD_SIZE } from './brick-layout.js';

/** Vertices per patch side. 72² ≈ 5.2k vertices over ~0.7 world units. */
export const PATCH_GRID = 72;

/** Floats per patch vertex: position.xyz, normal.xyz, edgeFade, foldSignal, u, v. */
export const PATCH_VERTEX_FLOATS = 10;

/** Floats per patch soma: position.xyz, scale, apical axis.xyz, layer depth (0..1), phase, seed, edgeFade, layer index. */
export const PATCH_SOMA_FLOATS = 12;

export const PATCH_SOMA_COUNT = 1400;

/**
 * Depth of the modelled cortical sheet below the pial surface, world units.
 * Real neocortex is ~2.5 mm of a ~170 mm brain (~0.02 here); this is
 * exaggerated about 2× so the laminae read at the zoom the patch appears.
 */
export const PATCH_CORTEX_DEPTH = 0.045;

/**
 * Laminar layout of the soma scatter: fractional depth through the sheet,
 * relative cell size, and share of the population. Layer V pyramids are the
 * largest cell bodies; layer IV granule cells the smallest. Proportions are
 * indicative, not a cell count.
 */
const CORTICAL_LAYERS = Object.freeze([
    { name: 'II/III', depth: 0.28, size: 0.0034, share: 0.36 },
    { name: 'IV', depth: 0.47, size: 0.0026, share: 0.2 },
    { name: 'V', depth: 0.66, size: 0.0048, share: 0.24 },
    { name: 'VI', depth: 0.86, size: 0.0031, share: 0.2 },
]);

/**
 * Lateral half-extent of the patch, world units. Kept inside the brick's
 * half-size so the patch is driven by fine-brick texels, not the coarse
 * fallback, everywhere except its fading rim.
 */
export const PATCH_HALF_EXTENT = BRICK_WORLD_SIZE * 0.42;

/**
 * @param {number[]} v
 * @returns {number[]}
 */
function normalize3(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
}

/**
 * @param {number[]} a
 * @param {number[]} b
 */
function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * @param {number} e0
 * @param {number} e1
 * @param {number} x
 */
function smoothstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
}

/**
 * Edge fade of the patch at grid coordinate (u, v) ∈ [0, 1]²: 1 inside ~60% of
 * the patch's angular radius, 0 at ~95%. Radial rather than square so the patch
 * meets the mesh's circular hand-off cone (cosInner/cosOuter below) instead of
 * reading as a tile; the two ramps overlap so neither surface leaves a gap.
 * @param {number} u
 * @param {number} v
 */
export function radialFade(u, v) {
    const r = Math.hypot(u * 2 - 1, v * 2 - 1);
    return 1 - smoothstep(0.6, 0.95, r);
}

/**
 * The tangent frame and angular extent of a patch centred on `center`'s
 * direction from the brain's origin.
 *
 * @param {any} geometry - BrainGeometry (sampleCorticalSurface).
 * @param {number[]} center - Model-space point the patch is centred under (the brick centre).
 */
export function patchFrameFor(geometry, center) {
    const axis = normalize3(center);
    const up = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const t1 = normalize3(cross3(up, axis));
    const t2 = cross3(axis, t1);
    const surfaceRadius = geometry.sampleCorticalSurface(axis[0], axis[1], axis[2], true).radius;
    const halfAngle = Math.atan(PATCH_HALF_EXTENT / surfaceRadius);
    return {
        axis,
        t1,
        t2,
        surfaceRadius,
        halfAngle,
        // The global mesh fades out over [outer → inner] inside this cone; the
        // patch's own edge fade covers the same band from the other side.
        cosInner: Math.cos(halfAngle * 0.62),
        cosOuter: Math.cos(halfAngle * 0.9),
    };
}

/**
 * Deterministic generator for a patch's soma scatter (an LCG, like the geometry's own).
 * @param {number} seed
 */
function makeRandom(seed) {
    let state = (seed >>> 0) || 1;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/**
 * Builds a patch a few rows at a time.
 *
 * @param {any} geometry - BrainGeometry.
 * @param {ReturnType<typeof patchFrameFor>} frame
 * @param {{ grid?: number, somaCount?: number, seed?: number, rowsPerSlice?: number }} [opts]
 * @returns {Generator<void, CorticalPatch, void>}
 */
export function* generateCorticalPatch(geometry, frame, { grid = PATCH_GRID, somaCount = PATCH_SOMA_COUNT, seed = 1, rowsPerSlice = 2 } = {}) {
    const { axis, t1, t2, halfAngle } = frame;
    const span = Math.tan(halfAngle);
    const n = grid;
    const positions = new Float64Array(n * n * 3);
    const folds = new Float64Array(n * n);

    for (let i = 0; i < n; i++) {
        const a = (2 * i / (n - 1) - 1) * span;
        for (let j = 0; j < n; j++) {
            const b = (2 * j / (n - 1) - 1) * span;
            const dir = normalize3([
                axis[0] + a * t1[0] + b * t2[0],
                axis[1] + a * t1[1] + b * t2[1],
                axis[2] + a * t1[2] + b * t2[2],
            ]);
            const sample = geometry.sampleCorticalSurface(dir[0], dir[1], dir[2], true);
            const k = i * n + j;
            positions[k * 3] = dir[0] * sample.radius;
            positions[k * 3 + 1] = dir[1] * sample.radius;
            positions[k * 3 + 2] = dir[2] * sample.radius;
            folds[k] = sample.foldSignal;
        }
        if ((i + 1) % rowsPerSlice === 0) yield;
    }

    const vertices = new Float32Array(n * n * PATCH_VERTEX_FLOATS);
    const normals = new Float64Array(n * n * 3);
    const at = (i, j, c) => positions[(i * n + j) * 3 + c];
    for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(n - 1, i + 1);
        for (let j = 0; j < n; j++) {
            const j0 = Math.max(0, j - 1);
            const j1 = Math.min(n - 1, j + 1);
            const du = [at(i1, j, 0) - at(i0, j, 0), at(i1, j, 1) - at(i0, j, 1), at(i1, j, 2) - at(i0, j, 2)];
            const dv = [at(i, j1, 0) - at(i, j0, 0), at(i, j1, 1) - at(i, j0, 1), at(i, j1, 2) - at(i, j0, 2)];
            let normal = normalize3(cross3(du, dv));
            const k = i * n + j;
            const p = [positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]];
            // Outward, i.e. away from the brain's centre.
            if (normal[0] * p[0] + normal[1] * p[1] + normal[2] * p[2] < 0) normal = [-normal[0], -normal[1], -normal[2]];
            normals[k * 3] = normal[0];
            normals[k * 3 + 1] = normal[1];
            normals[k * 3 + 2] = normal[2];
            const u = i / (n - 1);
            const v = j / (n - 1);
            const edge = radialFade(u, v);
            const o = k * PATCH_VERTEX_FLOATS;
            vertices[o] = p[0];
            vertices[o + 1] = p[1];
            vertices[o + 2] = p[2];
            vertices[o + 3] = normal[0];
            vertices[o + 4] = normal[1];
            vertices[o + 5] = normal[2];
            vertices[o + 6] = edge;
            vertices[o + 7] = folds[k];
            vertices[o + 8] = u;
            vertices[o + 9] = v;
        }
    }
    yield;

    const indices = new Uint16Array((n - 1) * (n - 1) * 6);
    let w = 0;
    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1; j++) {
            const a = i * n + j;
            const b = a + n;
            indices[w++] = a; indices[w++] = b; indices[w++] = a + 1;
            indices[w++] = b; indices[w++] = b + 1; indices[w++] = a + 1;
        }
    }

    // Somas: bilinear position/normal on the grid, pushed down to a laminar
    // depth along the local normal. The apical axis is the outward normal —
    // pyramidal cells orient perpendicular to the pial surface.
    const random = makeRandom((Math.imul(seed | 0, 2654435761 | 0) + 97) >>> 0);
    const somas = new Float32Array(somaCount * PATCH_SOMA_FLOATS);
    const cumulative = [];
    let total = 0;
    for (const layer of CORTICAL_LAYERS) { total += layer.share; cumulative.push(total); }
    for (let s = 0; s < somaCount; s++) {
        // Uniform over the disc the radial fade keeps visible.
        let u = 0.5;
        let v = 0.5;
        do {
            u = random();
            v = random();
        } while (Math.hypot(u * 2 - 1, v * 2 - 1) > 0.92);
        const fi = u * (n - 1);
        const fj = v * (n - 1);
        const i0 = Math.min(n - 2, Math.floor(fi));
        const j0 = Math.min(n - 2, Math.floor(fj));
        const ti = fi - i0;
        const tj = fj - j0;
        const lerp = (arr, c) => {
            const v00 = arr[(i0 * n + j0) * 3 + c];
            const v10 = arr[((i0 + 1) * n + j0) * 3 + c];
            const v01 = arr[(i0 * n + j0 + 1) * 3 + c];
            const v11 = arr[((i0 + 1) * n + j0 + 1) * 3 + c];
            return (v00 * (1 - ti) + v10 * ti) * (1 - tj) + (v01 * (1 - ti) + v11 * ti) * tj;
        };
        const p = [lerp(positions, 0), lerp(positions, 1), lerp(positions, 2)];
        const normal = normalize3([lerp(normals, 0), lerp(normals, 1), lerp(normals, 2)]);
        const pick = random() * total;
        let layerIndex = cumulative.findIndex((c) => pick <= c);
        if (layerIndex < 0) layerIndex = CORTICAL_LAYERS.length - 1;
        const layer = CORTICAL_LAYERS[layerIndex];
        const depth01 = Math.max(0.08, Math.min(0.98, layer.depth + (random() - 0.5) * 0.14));
        const depth = depth01 * PATCH_CORTEX_DEPTH;
        const o = s * PATCH_SOMA_FLOATS;
        somas[o] = p[0] - normal[0] * depth;
        somas[o + 1] = p[1] - normal[1] * depth;
        somas[o + 2] = p[2] - normal[2] * depth;
        somas[o + 3] = layer.size * (0.8 + random() * 0.45);
        somas[o + 4] = normal[0];
        somas[o + 5] = normal[1];
        somas[o + 6] = normal[2];
        somas[o + 7] = depth01;
        somas[o + 8] = random() * Math.PI * 2;
        somas[o + 9] = random();
        somas[o + 10] = radialFade(u, v);
        somas[o + 11] = layerIndex;
    }

    return {
        vertices,
        indices,
        somas,
        vertexCount: n * n,
        indexCount: indices.length,
        somaCount,
        axis: frame.axis,
        cosInner: frame.cosInner,
        cosOuter: frame.cosOuter,
    };
}

/**
 * @typedef {Object} CorticalPatch
 * @property {Float32Array} vertices - PATCH_VERTEX_FLOATS per vertex.
 * @property {Uint16Array} indices
 * @property {Float32Array} somas - PATCH_SOMA_FLOATS per soma.
 * @property {number} vertexCount
 * @property {number} indexCount
 * @property {number} somaCount
 * @property {number[]} axis
 * @property {number} cosInner
 * @property {number} cosOuter
 */

/** The layer table, for the HUD and the tests. */
export const PATCH_LAYERS = CORTICAL_LAYERS;

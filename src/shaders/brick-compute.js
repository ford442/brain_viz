// src/shaders/brick-compute.js
// [Clipmap] Compute shaders for the fine brick — level 1 of the clipmap field
// (docs/tensor-physics.md §11, docs/field-resolution.md §7). Three dispatches,
// in one compute pass, in this order:
//
//   step      brickState (A) → brickStepped (B). Runs the §6 step body from
//             field-step.js — the same text the coarse shader runs — with
//             brick addressing hooks:
//               - the brick is a BRICK_DIM³ window into a FINE_LATTICE_DIM³
//                 lattice, stored toroidally (lattice voxel g in texel
//                 g mod BRICK_DIM); a texel whose voxel the previous placement
//                 did not cover is reseeded from the coarse field (§11.2);
//               - neighbours and directional samples inside the brick read the
//                 fine state, outside it the coarse field, trilinearly: the
//                 coarse level is the fine level's boundary condition (§11.1).
//   restrict  B → cell means: each BRICK_MEAN_CELL³ cell's mean fine value and
//             mean coarse value (§11.3).
//   correct   B + means → A and the render copy: each cell's mean is moved to
//             the coarse field's mean over the same cell, by a trilinear blend
//             of per-cell corrections, so the brick agrees with the coarse
//             field at the coarse scale *after* every step and only adds what
//             the coarse grid cannot resolve (§11.3).
//
// The nesting is one-way: nothing here writes the coarse buffer. The coarse
// field, its NWS1 recording, the CPU reference and the C++ engine are the same
// whether or not a brick exists (§8.5).
//
// The state textures are rg32float: r = fine activity, g = the coarse field
// at that texel (so the restriction and the render copy never re-read the
// coarse buffer). The render copy the raymarch and the cortical patch sample
// is rgba16float — filterable in core WebGPU, which r32float is not without
// 'float32-filterable' — with b = primary tract weight, a = 1 (populated).

import { CONSTANTS, HELPERS, VOXEL_DIM_FROM_PARAMS } from './render-shared.js';
import { TENSOR_PARAMS_STRUCT_WGSL, BRICK_PARAMS_STRUCT_WGSL } from './uniform-layout.js';
import { fieldStepWGSL, FIELD_STEP_HELPERS } from './field-step.js';

/** Workgroup edge; the step and correct dispatches are ceil(brickDim / BRICK_WORKGROUP) per axis. */
export const BRICK_WORKGROUP = 4;

/**
 * Fine voxels per restriction cell edge (§11.3): 8 fine voxels = 0.1 world
 * units = one coarse voxel at the default 32³. The restriction pass dispatches
 * one 64-invocation workgroup per cell, (brickDim / BRICK_MEAN_CELL)³ in all.
 */
export const BRICK_MEAN_CELL = 8;

/** @type {import('./field-step.js').FieldStepHooks} */
export const BRICK_FIELD_STEP = Object.freeze({
    center: 'fineLoad(g)',
    worldPosition: 'latticeToWorld(g)',
    neighborReads: `    // Safe neighbor reads (§11.1): the fine state inside the brick, the coarse
    // field (trilinear) outside it, clamped at the lattice edge.
    let valXm = fineNeighbor(g, vec3<i32>(-1, 0, 0));
    let valXp = fineNeighbor(g, vec3<i32>(1, 0, 0));
    let valYm = fineNeighbor(g, vec3<i32>(0, -1, 0));
    let valYp = fineNeighbor(g, vec3<i32>(0, 1, 0));
    let valZm = fineNeighbor(g, vec3<i32>(0, 0, -1));
    let valZp = fineNeighbor(g, vec3<i32>(0, 0, 1));`,
    voxelStep: '(BRAIN_RANGE / brick.latticeDim) * 0.9',
    affinity: (slot) => `fineAffinity(s, ${slot})`,
    sample: (pos) => `fineSample(${pos})`,
    hasUpstreamZ: 'g.z < latticeDimI() - 1',
    upstreamZ: 'fineNeighbor(g, vec3<i32>(0, 0, 1))',
    advect: '        let upstreamVal = fineSampleClamped(samplePos);',
    // The §11.3 correction toward the coarse field happens after this pass
    // (brickCorrectShader), once the cell means of the stepped field exist.
    store: '    textureStore(brickStepped, s, vec4<f32>(clamp(val, 0.0, 1.0), coarseHere, 0.0, 0.0));',
});

// Brick addressing shared by the step and the correct pass. Requires `brick`.
const BRICK_ADDRESSING = `
fn brickDimI() -> i32 { return i32(brick.brickDim); }
fn latticeDimI() -> i32 { return i32(brick.latticeDim); }
fn brickOrigin() -> vec3<i32> { return vec3<i32>(brick.latticeOrigin); }

// Toroidal addressing: lattice voxel g lives in texel g mod brickDim.
fn texelOf(g: vec3<i32>) -> vec3<i32> {
    let n = brickDimI();
    return ((g % vec3<i32>(n)) + vec3<i32>(n)) % vec3<i32>(n);
}

// The lattice voxel texel s holds under the current placement.
fn latticeOfTexel(s: vec3<i32>) -> vec3<i32> {
    let o = brickOrigin();
    return o + texelOf(s - o);
}
`;

export const brickComputeShader = `
// [Clipmap] Fine brick step — generated around the shared §6 body (field-step.js).
${CONSTANTS}
${VOXEL_DIM_FROM_PARAMS}
${HELPERS}
${FIELD_STEP_HELPERS}

${TENSOR_PARAMS_STRUCT_WGSL}

${BRICK_PARAMS_STRUCT_WGSL}

// The coarse field, as this frame's coarse compute pass left it. Read-only
// here: the nesting is one-way. Named activityTensor so HELPERS'
// getVoxelValue() is the coarse §4.2 sample.
@group(0) @binding(0) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
@group(0) @binding(3) var<uniform> brick: BrickParams;
@group(0) @binding(4) var brickState: texture_3d<f32>;
@group(0) @binding(5) var brickStepped: texture_storage_3d<rg32float, write>;
@group(0) @binding(6) var brickAffinity: texture_3d<f32>;
${BRICK_ADDRESSING}
fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

fn worldToIndex(worldPosition: vec3<f32>, dim: u32) -> u32 {
    let normalized = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(0.99999));
    let x = u32(normalized.x * f32(dim));
    let y = u32(normalized.y * f32(dim));
    let z = u32(normalized.z * f32(dim));
    return getIndex(x, y, z);
}

// §6.12 reads the partner field at the coarse resolution: there is no fine AI level.
fn sampleAIActivation(worldPosition: vec3<f32>, dim: u32) -> f32 {
    return aiTensor[worldToIndex(worldPosition, dim)];
}

fn inBrick(g: vec3<i32>) -> bool {
    let o = brickOrigin();
    return all(g >= o) && all(g < o + vec3<i32>(brickDimI()));
}

// §4.1 on the fine lattice.
fn latticeToWorld(g: vec3<i32>) -> vec3<f32> {
    return ((vec3<f32>(g) / brick.latticeDim) * 2.0 - 1.0) * BRAIN_RANGE;
}

fn coarseAt(i: vec3<i32>) -> f32 {
    let d = i32(voxel_dim());
    let c = clamp(i, vec3<i32>(0), vec3<i32>(d - 1));
    return activityTensor[getIndex(u32(c.x), u32(c.y), u32(c.z))];
}

// §11.1 The coarse field between its voxels: trilinear over §4.1 voxel
// positions (coarse voxel i sits at ((i / dim) * 2 - 1) * BRAIN_RANGE).
fn coarseTrilinear(p: vec3<f32>) -> f32 {
    let c = ((p / BRAIN_RANGE) * 0.5 + 0.5) * f32(voxel_dim());
    let f = floor(c);
    let t = c - f;
    let i = vec3<i32>(f);
    let c00 = mix(coarseAt(i), coarseAt(i + vec3<i32>(1, 0, 0)), t.x);
    let c10 = mix(coarseAt(i + vec3<i32>(0, 1, 0)), coarseAt(i + vec3<i32>(1, 1, 0)), t.x);
    let c01 = mix(coarseAt(i + vec3<i32>(0, 0, 1)), coarseAt(i + vec3<i32>(1, 0, 1)), t.x);
    let c11 = mix(coarseAt(i + vec3<i32>(0, 1, 1)), coarseAt(i + vec3<i32>(1, 1, 1)), t.x);
    return mix(mix(c00, c10, t.y), mix(c01, c11, t.y), t.z);
}

fn fineLoad(g: vec3<i32>) -> f32 {
    return textureLoad(brickState, texelOf(g), 0).r;
}

fn fineNeighbor(g: vec3<i32>, offset: vec3<i32>) -> f32 {
    let n = clamp(g + offset, vec3<i32>(0), vec3<i32>(latticeDimI() - 1));
    if (inBrick(n)) { return fineLoad(n); }
    return coarseTrilinear(latticeToWorld(n));
}

fn fineAtLattice(n: vec3<f32>) -> f32 {
    let g = min(vec3<i32>(floor(n * brick.latticeDim)), vec3<i32>(latticeDimI() - 1));
    if (inBrick(g)) { return fineLoad(g); }
    return coarseTrilinear(((n * 2.0) - 1.0) * BRAIN_RANGE);
}

// §4.2 on the nested level: positions outside the field cube read 0; inside
// the brick the fine state, elsewhere the coarse field.
fn fineSample(p: vec3<f32>) -> f32 {
    let n = (p / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(n < vec3<f32>(0.0)) || any(n > vec3<f32>(1.0))) { return 0.0; }
    return fineAtLattice(n);
}

// §6.8's advection sample clamps to the cube rather than rejecting.
fn fineSampleClamped(p: vec3<f32>) -> f32 {
    return fineAtLattice(clamp((p / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(1.0)));
}

fn sampleDirectionalActivity(worldPosition: vec3<f32>, axis: vec3<f32>, step: f32) -> f32 {
    let axisN = normalize(axis + vec3<f32>(0.0001, 0.0001, 0.0001));
    let center = fineSample(worldPosition);
    let forward = fineSample(worldPosition + axisN * step);
    let backward = fineSample(worldPosition - axisN * step);
    return center * 0.34 + max(forward, backward) * 0.46 + min(forward, backward) * 0.20;
}

// Affinity atlas: slot k of texel s is at (s.x, s.y, s.z + k * brickDim).
fn fineAffinity(s: vec3<i32>, slot: u32) -> vec4<f32> {
    return textureLoad(brickAffinity, vec3<i32>(s.x, s.y, s.z + i32(slot) * brickDimI()), 0);
}

@compute @workgroup_size(${BRICK_WORKGROUP}, ${BRICK_WORKGROUP}, ${BRICK_WORKGROUP})
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let n = brickDimI();
    let s = vec3<i32>(globalId);
    if (any(s >= vec3<i32>(n))) { return; }

    let g = latticeOfTexel(s);
    // The coarse grid — §6.12's sampleAIActivation(…, dim) and the coarse
    // reads above are at this resolution, not the brick's.
    let dim = params.voxelDim;
    let coarseHere = coarseTrilinear(latticeToWorld(g));

    // §11.2 A texel carries its state across a move only if the previous
    // placement covered the same lattice voxel; otherwise it starts from the
    // coarse field. During tensor playback (mode 1) the brick only refines the
    // recording and never adds dynamics of its own.
    let po = vec3<i32>(brick.prevOrigin);
    let carried = brick.prevValid > 0.5 && all(g >= po) && all(g < po + vec3<i32>(n));
    if (brick.mode < 1.5 || !carried) {
        textureStore(brickStepped, s, vec4<f32>(coarseHere, coarseHere, 0.0, 0.0));
        return;
    }

${fieldStepWGSL(BRICK_FIELD_STEP)}
}
`;

/**
 * §11.3 Restriction: one workgroup per BRICK_MEAN_CELL³ cell averages the
 * stepped state's fine (r) and coarse (g) channels into the cell-means texture.
 */
export const brickRestrictShader = `
// [Clipmap] Fine brick restriction (cell means) — docs/tensor-physics.md §11.3.
@group(0) @binding(0) var brickStepped: texture_3d<f32>;
@group(0) @binding(1) var brickMeansOut: texture_storage_3d<rg32float, write>;

const CELL: i32 = ${BRICK_MEAN_CELL};
var<workgroup> partial: array<vec2<f32>, 64>;

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) cell: vec3<u32>, @builtin(local_invocation_index) lane: u32) {
    // Storage cell = lattice cell mod (brickDim / CELL): brick moves are whole
    // chunks (a multiple of CELL), so a lattice cell is always a plain block
    // of texels under toroidal addressing.
    let base = vec3<i32>(cell) * CELL;
    let y = i32(lane) % CELL;
    let z = i32(lane) / CELL;
    var sum = vec2<f32>(0.0);
    for (var x = 0; x < CELL; x = x + 1) {
        sum = sum + textureLoad(brickStepped, base + vec3<i32>(x, y, z), 0).rg;
    }
    partial[lane] = sum;
    workgroupBarrier();
    for (var stride = 32u; stride > 0u; stride = stride / 2u) {
        if (lane < stride) {
            partial[lane] = partial[lane] + partial[lane + stride];
        }
        workgroupBarrier();
    }
    if (lane == 0u) {
        textureStore(brickMeansOut, vec3<i32>(cell), vec4<f32>(partial[0] / f32(CELL * CELL * CELL), 0.0, 0.0));
    }
}
`;

/**
 * §11.3 Correction: moves each cell's mean to the coarse field's mean over the
 * same cell, then writes the next state and the render copy.
 */
export const brickCorrectShader = `
// [Clipmap] Fine brick two-grid correction — docs/tensor-physics.md §11.3.
${BRICK_PARAMS_STRUCT_WGSL}

@group(0) @binding(0) var<uniform> brick: BrickParams;
@group(0) @binding(1) var brickStepped: texture_3d<f32>;
@group(0) @binding(2) var brickMeans: texture_3d<f32>;
@group(0) @binding(3) var brickAffinity: texture_3d<f32>;
@group(0) @binding(4) var brickState: texture_storage_3d<rg32float, write>;
@group(0) @binding(5) var brickRender: texture_storage_3d<rgba16float, write>;
${BRICK_ADDRESSING}
const MEAN_CELL: i32 = ${BRICK_MEAN_CELL};

fn cellMeans(m: vec3<i32>) -> vec2<f32> {
    let n = brickDimI() / MEAN_CELL;
    return textureLoad(brickMeans, ((m % vec3<i32>(n)) + vec3<i32>(n)) % vec3<i32>(n), 0).rg;
}

// (fine mean, coarse mean) at lattice voxel g: trilinear over cell centres,
// clamped to the brick's own cells (constant extrapolation at its faces).
fn meansAt(g: vec3<i32>) -> vec2<f32> {
    let first = brickOrigin() / MEAN_CELL;
    let last = first + vec3<i32>(brickDimI() / MEAN_CELL - 1);
    let c = (vec3<f32>(g) - f32(MEAN_CELL - 1) * 0.5) / f32(MEAN_CELL);
    let f = floor(c);
    let t = c - f;
    let m0 = clamp(vec3<i32>(f), first, last);
    let m1 = clamp(vec3<i32>(f) + vec3<i32>(1), first, last);
    let e00 = mix(cellMeans(m0), cellMeans(vec3<i32>(m1.x, m0.y, m0.z)), t.x);
    let e10 = mix(cellMeans(vec3<i32>(m0.x, m1.y, m0.z)), cellMeans(vec3<i32>(m1.x, m1.y, m0.z)), t.x);
    let e01 = mix(cellMeans(vec3<i32>(m0.x, m0.y, m1.z)), cellMeans(vec3<i32>(m1.x, m0.y, m1.z)), t.x);
    let e11 = mix(cellMeans(vec3<i32>(m0.x, m1.y, m1.z)), cellMeans(m1), t.x);
    return mix(mix(e00, e10, t.y), mix(e01, e11, t.y), t.z);
}

@compute @workgroup_size(${BRICK_WORKGROUP}, ${BRICK_WORKGROUP}, ${BRICK_WORKGROUP})
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let s = vec3<i32>(globalId);
    if (any(s >= vec3<i32>(brickDimI()))) { return; }
    let stepped = textureLoad(brickStepped, s, 0).rg;
    let means = meansAt(latticeOfTexel(s));
    // The correction is a trilinear blend of per-cell constants: it moves
    // structure at the cell scale and leaves anything finer untouched.
    let value = clamp(stepped.x + (means.y - means.x) * brick.nudge, 0.0, 1.0);
    textureStore(brickState, s, vec4<f32>(value, stepped.y, 0.0, 0.0));
    let tract = textureLoad(brickAffinity, s, 0).w;
    textureStore(brickRender, s, vec4<f32>(value, stepped.y, clamp(tract, 0.0, 1.0), 1.0));
}
`;

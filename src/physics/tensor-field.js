// src/physics/tensor-field.js
// [Tensor Physics] The CPU reference implementation of the Neuro-Weaver neural
// field — the single JavaScript stepper behind both the WebGL2 fallback
// renderer and the golden fixture the C++ `BrainTensorEngine` is validated
// against.
//
// Before this module there were three hand-written neural fields (WGSL compute,
// C++ WASM, WebGL JS) that had drifted into three different feature sets. There
// are now two implementations of one written contract — this file and
// wasm/brain_tensor_engine.cpp — plus the WGSL shader, which stays the
// authoritative *visual* path.
//
// ***Read docs/tensor-physics.md before changing anything here.*** It is the
// spec: every step below cites a section of it, the C++ port cites the same
// sections, and tests/test_tensor_physics.js pins the result. A change here
// that is not mirrored in wasm/brain_tensor_engine.cpp fails
// `npm run test:golden`.
//
// Deliberate divergences from the WGSL shader (spec §8) exist only where WGSL
// relies on GPU-convenient constructs that cannot be reproduced bit-stably on
// two CPUs: the `fract(sin(...))` hash and the hard `step()` cascade gate.

/**
 * World-space half-extent of the voxel grid. Mirrors CONSTANTS.BRAIN_RANGE.
 *
 * Held as the float32 value of 1.6, not the double. Every world coordinate is
 * scaled by it and then quantised to a voxel index, so `a * 1.6` (double) and
 * `a * 1.6f` (C++/WGSL) pick different voxels for coordinates near a cell
 * boundary. Any literal in this file that feeds a `floor()` gets the same
 * treatment — see docs/tensor-physics.md §8.3.
 */
export const BRAIN_RANGE = Math.fround(1.6);

/** Fiber affinity slots per voxel (each slot is a vec4: dir.xyz, weight). */
export const FIBER_SLOTS = 3;

/** Floats per voxel in a fiber affinity buffer. */
export const FIBER_STRIDE = FIBER_SLOTS * 4;

/** §8.2 Width of the soft band replacing WGSL's hard `step()` cascade gate. */
export const CASCADE_GATE_WIDTH = 0.01;

/** Directional sample distance, as a fraction of a voxel. float32 — it quantises. */
const VOXEL_STEP_SCALE = Math.fround(0.9);

// --- §2 Scalar helpers ------------------------------------------------------

/**
 * Round to the nearest float32.
 *
 * The C++/WASM engine computes in `float`. Most of that precision difference is
 * invisible — the field is stored in a Float32Array either way, so it is
 * re-rounded every step. It stops being invisible wherever a value feeds a
 * *discontinuous* operation: the `floor()` in nearest-voxel sampling turns a
 * 1-ulp difference into a whole-voxel difference, which then compounds. So the
 * reference stepper rounds to float32 exactly where the engine's precision is
 * observable — world positions, sample coordinates and tract directions — and
 * leaves the smooth arithmetic in double. See docs/tensor-physics.md §8.3.
 */
const fr = Math.fround;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const mix = (a, b, t) => a + (b - a) * t;

export function smoothstep(edge0, edge1, x) {
    if (edge1 === edge0) return x < edge0 ? 0 : 1;
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

/** gaussian_pulse() from render-shared.js HELPERS. */
export function gaussianPulse(dist, width) {
    const k = 4.0 / (width * width);
    return Math.exp(-k * dist * dist);
}

/**
 * §8.1 Integer voxel hash, replacing WGSL's `fract(sin(dot(p, k)) * 43758.5453)`.
 *
 * The sin-hash is catastrophically ill-conditioned — a 1-ulp difference in
 * `sin` produces a completely different result after the multiply-and-fract —
 * so it can never agree between two CPU implementations, let alone a GPU. This
 * 32-bit integer mix is exactly reproducible in JS (`Math.imul`, `>>>`) and in
 * C++ (`uint32_t`), which is what lets the golden fixture exist at all.
 *
 * @param {number} x integer voxel coordinate
 * @param {number} y integer voxel coordinate
 * @param {number} z integer voxel coordinate
 * @param {number} salt integer stream selector (e.g. frame index)
 * @returns {number} value in [0, 1)
 */
export function hashVoxel(x, y, z, salt) {
    let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^
            Math.imul(z | 0, 0xcb1ab31f) ^ Math.imul(salt | 0, 0x165667b1);
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, 0x2c1b3c6d) >>> 0;
    h = (h ^ (h >>> 12)) >>> 0;
    h = Math.imul(h, 0x297a2d39) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    return (h >>> 8) / 16777216;
}

// --- §3 Region and hypoxia physics -----------------------------------------

/**
 * §3.1 `getRegionPhysics(worldPosition, style)` — the anatomical zone model.
 * Ported verbatim from render-shared.js (the 2-argument signature; the former
 * 4-argument neuromodulator fork in src/shaders/shared.js no longer exists).
 *
 * The zone boundaries are compared against the *float32* value of each literal.
 * A voxel centre often lands exactly on a boundary (wy = 0.6 for y = 22 at
 * dim 32), and float32 0.6 is 0.6000000238…, so `wy > 0.6` is true in double
 * and false in float. Comparing in float32 is what puts that voxel in the same
 * lobe in JS as it is in C++/WGSL. See docs/tensor-physics.md §8.3.
 *
 * @returns {{decay: number, diffusion: number, flowBias: number}}
 */
export function regionPhysics(wx, wy, wz, style) {
    let decay = 0.96;
    let diffusion = 0.1;
    let flowBias = 0.0;

    if (wz > fr(0.5)) {                    // Frontal: hyper-retention
        decay = 0.998;
        diffusion = 0.15;
        flowBias = -1.0;
    } else if (wz < fr(-0.5)) {            // Occipital: fast visual processing
        decay = 0.92;
        diffusion = 0.04;
    } else if (Math.abs(wx) > fr(0.8)) {   // Temporal: auditory / memory
        decay = 0.95;
    } else if (wy > fr(0.6)) {             // Parietal: sensory integration
        decay = 0.94;
        diffusion = 0.12;
    }

    if (Math.abs(style - 1.0) < fr(0.1)) { // Cyber mode: digital signal logic
        diffusion = 0.05;
        decay = 0.92;
        flowBias = 0.0;
    }

    return { decay, diffusion, flowBias };
}

/** §3.2 `getHypoxiaPhysics()` — (decayMod, diffusionMod, freqBoost). */
export function hypoxiaPhysics(hypoxiaStress, metabolicRate, mitochondrialFunction) {
    const decayMod = 0.96 - hypoxiaStress * 0.08 * metabolicRate * (1.0 - mitochondrialFunction);
    const diffusionMod = Math.max(0.01, 1.0 - hypoxiaStress * 0.5);
    const freqBoost = hypoxiaStress * 2.0 * (1.0 - hypoxiaStress * 0.5);
    return { decayMod, diffusionMod, freqBoost };
}

/** §3.3 `avalancheCriticality()`. */
export function avalancheCriticality(cognitiveLoad, stress, fluidActive) {
    return clamp01(cognitiveLoad * 0.75 + stress * 0.9 + fluidActive * 0.35);
}

// --- §4 Grid addressing -----------------------------------------------------

/** §4.1 Voxel index -> world position. Mirrors `indexToWorld()`. */
export function indexToWorld(index, dim, out) {
    const z = Math.floor(index / (dim * dim));
    const rem = index % (dim * dim);
    const y = Math.floor(rem / dim);
    const x = rem % dim;
    out[0] = ((x / dim) * 2.0 - 1.0) * BRAIN_RANGE;
    out[1] = ((y / dim) * 2.0 - 1.0) * BRAIN_RANGE;
    out[2] = ((z / dim) * 2.0 - 1.0) * BRAIN_RANGE;
    return out;
}

/**
 * §4.2 Nearest-voxel world-space sample. Mirrors `getVoxelValue()`: positions
 * outside the normalised [0,1] cube read as 0 (no clamping to the border).
 */
export function sampleVoxel(field, dim, wx, wy, wz) {
    const nx = fr(fr(wx / BRAIN_RANGE) * 0.5 + 0.5);
    const ny = fr(fr(wy / BRAIN_RANGE) * 0.5 + 0.5);
    const nz = fr(fr(wz / BRAIN_RANGE) * 0.5 + 0.5);
    if (nx < 0 || ny < 0 || nz < 0 || nx > 1 || ny > 1 || nz > 1) return 0;
    const x = Math.min(dim - 1, Math.floor(fr(nx * dim)));
    const y = Math.min(dim - 1, Math.floor(fr(ny * dim)));
    const z = Math.min(dim - 1, Math.floor(fr(nz * dim)));
    return field[z * dim * dim + y * dim + x];
}

/**
 * §4.4 Trilinear world-space sample, used only for fluid advection.
 *
 * Every other sampler in the model reads the nearest voxel, matching WGSL. The
 * advection sample is the one whose *coordinate* comes out of `sin`/`cos`, and
 * no two libm implementations agree on those to the last bit — V8 ships its own
 * fdlibm port, Emscripten another. Through a nearest-voxel read a 1-ulp
 * coordinate difference becomes a whole-voxel difference in the value; through
 * a trilinear read it stays a 1-ulp difference. See docs/tensor-physics.md §8.3.
 */
export function sampleVoxelTrilinear(field, dim, wx, wy, wz) {
    const gx = fr(fr(fr(fr(wx / BRAIN_RANGE) * 0.5 + 0.5) * dim) - 0.5);
    const gy = fr(fr(fr(fr(wy / BRAIN_RANGE) * 0.5 + 0.5) * dim) - 0.5);
    const gz = fr(fr(fr(fr(wz / BRAIN_RANGE) * 0.5 + 0.5) * dim) - 0.5);
    const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
    const tx = gx - x0, ty = gy - y0, tz = gz - z0;
    const cx0 = clamp(x0, 0, dim - 1), cx1 = clamp(x0 + 1, 0, dim - 1);
    const cy0 = clamp(y0, 0, dim - 1), cy1 = clamp(y0 + 1, 0, dim - 1);
    const cz0 = clamp(z0, 0, dim - 1), cz1 = clamp(z0 + 1, 0, dim - 1);
    const d2 = dim * dim;
    const c000 = field[cz0 * d2 + cy0 * dim + cx0], c100 = field[cz0 * d2 + cy0 * dim + cx1];
    const c010 = field[cz0 * d2 + cy1 * dim + cx0], c110 = field[cz0 * d2 + cy1 * dim + cx1];
    const c001 = field[cz1 * d2 + cy0 * dim + cx0], c101 = field[cz1 * d2 + cy0 * dim + cx1];
    const c011 = field[cz1 * d2 + cy1 * dim + cx0], c111 = field[cz1 * d2 + cy1 * dim + cx1];
    const x00 = mix(c000, c100, tx), x10 = mix(c010, c110, tx);
    const x01 = mix(c001, c101, tx), x11 = mix(c011, c111, tx);
    return mix(mix(x00, x10, ty), mix(x01, x11, ty), tz);
}

/**
 * §4.3 `sampleDirectionalActivity()` — biased 3-tap read along a unit `axis`,
 * given the downstream/upstream taps the caller already read.
 *
 * §6.3 and §6.4 sample the *same* two positions per tract slot, so the step
 * reads them once and passes them to both.
 */
function sampleDirectional(center, forward, backward) {
    return center * 0.34 + Math.max(forward, backward) * 0.46 + Math.min(forward, backward) * 0.20;
}

/** The `+ 0.0001` WGSL adds before normalising a direction, as a float32. */
const DIR_EPSILON = fr(1e-4);

/**
 * §7.1 Normalise a raw fiber-affinity buffer once, at upload.
 *
 * The step used to re-normalise all three slots of every voxel on every frame:
 * wasted work (the tracts are static), and a second place for the JS and C++
 * float rounding to disagree. Normalising once — here, and in
 * bte_set_fiber_affinities() on the C++ side — makes the sample coordinates
 * derived from these directions bit-identical between the two.
 *
 * @param {Float32Array} raw dim³ * 12 floats, directions need not be unit
 * @param {number} dim
 * @returns {Float32Array} a new buffer with unit directions and copied weights
 */
export function normalizeFiberAffinities(raw, dim) {
    const total = dim * dim * dim;
    const out = new Float32Array(total * FIBER_STRIDE);
    for (let i = 0; i < total * FIBER_SLOTS; i++) {
        const b = i * 4;
        const w = raw[b + 3];
        out[b + 3] = w;
        if (!(w >= fr(0.01))) continue;
        const lx = fr(raw[b + 0] + DIR_EPSILON);
        const ly = fr(raw[b + 1] + DIR_EPSILON);
        const lz = fr(raw[b + 2] + DIR_EPSILON);
        const len = fr(Math.sqrt(fr(fr(fr(lx * lx) + fr(ly * ly)) + fr(lz * lz)))) || 1;
        out[b + 0] = fr(lx / len);
        out[b + 1] = fr(ly / len);
        out[b + 2] = fr(lz / len);
    }
    return out;
}

// --- §5 Parameter defaults --------------------------------------------------

/**
 * §5 Every `TensorParams` field the reference model reads, with the default the
 * renderer uploads. Fields declared in COMPUTE_UNIFORM_LAYOUT but *not* listed
 * here are documented as reserved in docs/tensor-physics.md §6 — the field does
 * not consume them on any path, and the doc is the place that says so.
 *
 * @type {Readonly<Object<string, number>>}
 */
export const DEFAULT_FIELD_PARAMS = Object.freeze({
    time: 0.0,
    voxelDim: 32,
    frequency: 2.0,
    amplitude: 0.5,
    spikeThreshold: 0.6,
    style: 0.0,
    stimulusPosX: 0.0,
    stimulusPosY: 0.0,
    stimulusPosZ: 0.0,
    stimulusActive: 0.0,
    stimulusRadius: 0.0,
    stimulusErase: 0.0,
    hypoxiaStress: 0.0,
    metabolicRate: 1.0,
    mitochondrialFunction: 1.0,
    fluidActive: 0.0,
    electricalActive: 0.0,
    mercuryActive: 0.0,
    cognitiveLoad: 0.0,
    stress: 0.0,
    heavyMetal: 0.0,
    aiInfluence: 0.0,
    resonanceThreshold: 0.2,
    synaptiXActive: 0.0,
    fiberCoupling: 0.5,
});

/**
 * Builds a fully-populated parameter object: caller values win, everything else
 * falls back to DEFAULT_FIELD_PARAMS. Accepts the renderer's `params` shape
 * (flat `stimulusPosX`… or a `stimulusPos` array).
 *
 * @param {Object<string, any>} [partial]
 * @returns {Object<string, number>}
 */
export function resolveFieldParams(partial = {}) {
    const p = { ...DEFAULT_FIELD_PARAMS };
    for (const key of Object.keys(DEFAULT_FIELD_PARAMS)) {
        const v = partial[key];
        if (typeof v === 'number' && Number.isFinite(v)) p[key] = v;
    }
    if (Array.isArray(partial.stimulusPos) || ArrayBuffer.isView(partial.stimulusPos)) {
        p.stimulusPosX = partial.stimulusPos[0];
        p.stimulusPosY = partial.stimulusPos[1];
        p.stimulusPosZ = partial.stimulusPos[2];
    }
    return p;
}

// --- §7 Reference fiber affinity field --------------------------------------

/**
 * §7 Deterministic procedural fiber affinities, used by the golden fixture so
 * the JS and C++ steppers see byte-identical tract geometry without shipping a
 * binary alongside the test. Built only from `hashVoxel`, so it is exact in
 * both languages. The live renderers pass their real BrainGeometry affinities
 * instead.
 *
 * @param {number} dim
 * @returns {Float32Array} dim³ * 12 floats (3 slots of (dir.xyz, weight))
 */
export function makeReferenceFiberAffinities(dim) {
    const out = new Float32Array(dim * dim * dim * FIBER_STRIDE);
    for (let z = 0; z < dim; z++) {
        for (let y = 0; y < dim; y++) {
            for (let x = 0; x < dim; x++) {
                const index = z * dim * dim + y * dim + x;
                for (let slot = 0; slot < FIBER_SLOTS; slot++) {
                    const base = index * FIBER_STRIDE + slot * 4;
                    // Raw directions; normalizeFiberAffinities() below turns them
                    // into unit vectors with the same float32 op order as C++.
                    out[base + 0] = hashVoxel(x, y, z, 1 + slot * 7) * 2.0 - 1.0;
                    out[base + 1] = hashVoxel(x, y, z, 2 + slot * 7) * 2.0 - 1.0;
                    out[base + 2] = hashVoxel(x, y, z, 3 + slot * 7) * 2.0 - 1.0;
                    // Slot 0 carries the dominant tract where one exists; slots
                    // 1 and 2 are sparse crossings. Weights are kept well below
                    // 1.0 so the reference field neither dies nor saturates over
                    // the fixture run — a saturated fixture discriminates nothing.
                    const w = hashVoxel(x, y, z, 4 + slot * 7);
                    out[base + 3] = slot === 0
                        ? (w > 0.45 ? 0.08 + (w - 0.45) * 0.30 : 0.0)
                        : (w > 0.82 ? 0.03 + (w - 0.82) * 0.30 : 0.0);
                }
            }
        }
    }
    return normalizeFiberAffinities(out, dim);
}

// --- §6 The step ------------------------------------------------------------

/**
 * Advance the neural field by one step, writing into `next`.
 *
 * Section numbers in the comments are docs/tensor-physics.md sections, and
 * wasm/brain_tensor_engine.cpp carries the same markers on the same steps —
 * that pairing is the contract.
 *
 * @param {Float32Array} field   current activity, dim³
 * @param {Float32Array} next    destination, dim³ (may not alias `field`)
 * @param {Object} opts
 * @param {Object<string, number>} opts.params  resolved TensorParams values
 * @param {Float32Array|null} [opts.fiberAffinity]  dim³*12 tract affinities,
 *        already unit-normalised by normalizeFiberAffinities()
 * @param {Float32Array|null} [opts.aiField]        dim³ SynaptiX AI tensor
 * @param {number} [opts.frame]  integer step counter, seeds the voxel hash
 */
export function stepTensorField(field, next, { params, fiberAffinity = null, aiField = null, frame = 0 }) {
    const p = params;
    const dim = p.voxelDim | 0;
    const total = dim * dim * dim;
    const dim2 = dim * dim;
    const voxelStep = fr(fr(BRAIN_RANGE / dim) * VOXEL_STEP_SCALE);
    const hasFibers = fiberAffinity != null && fiberAffinity.length >= total * FIBER_STRIDE;
    const synaptiX = p.synaptiXActive > 0.5 && aiField != null;

    // Per-slot tap cache, shared between the diffusion and highway passes.
    const slotUp = new Float64Array(FIBER_SLOTS);
    const slotDown = new Float64Array(FIBER_SLOTS);
    const slotUpPos = new Float64Array(FIBER_SLOTS * 3);
    const slotDownPos = new Float64Array(FIBER_SLOTS * 3);

    const hyp = hypoxiaPhysics(p.hypoxiaStress, p.metabolicRate, p.mitochondrialFunction);
    const criticality = avalancheCriticality(p.cognitiveLoad, p.stress, p.fluidActive);
    // §6.11 Ambient drive: the low-amplitude "heartbeat" that keeps the field
    // alive between stimuli. `amplitude`/`frequency` feed only this term.
    const ambientWave = Math.sin(p.time * p.frequency) * 0.5 + 0.5;

    for (let index = 0; index < total; index++) {
        const z = (index / dim2) | 0;
        const rem = index % dim2;
        const y = (rem / dim) | 0;
        const x = rem % dim;

        const wx = fr(fr(fr(x / dim) * 2.0 - 1.0) * BRAIN_RANGE);
        const wy = fr(fr(fr(y / dim) * 2.0 - 1.0) * BRAIN_RANGE);
        const wz = fr(fr(fr(z / dim) * 2.0 - 1.0) * BRAIN_RANGE);
        const npx = clamp01((wx / BRAIN_RANGE) * 0.5 + 0.5);
        const npy = clamp01((wy / BRAIN_RANGE) * 0.5 + 0.5);
        const npz = clamp01((wz / BRAIN_RANGE) * 0.5 + 0.5);

        let val = field[index];

        // §6.1 Region physics, modulated by hypoxia.
        const region = regionPhysics(wx, wy, wz, p.style);
        let decay = region.decay * hyp.decayMod;
        let diffusion = region.diffusion * hyp.diffusionMod;
        const flowBias = region.flowBias;

        // §6.2 Clamped 6-neighbourhood.
        const xm = x > 0 ? x - 1 : 0;
        const xp = x < dim - 1 ? x + 1 : dim - 1;
        const ym = y > 0 ? y - 1 : 0;
        const yp = y < dim - 1 ? y + 1 : dim - 1;
        const zm = z > 0 ? z - 1 : 0;
        const zp = z < dim - 1 ? z + 1 : dim - 1;

        const valXm = field[z * dim2 + y * dim + xm];
        const valXp = field[z * dim2 + y * dim + xp];
        const valYm = field[z * dim2 + ym * dim + x];
        const valYp = field[z * dim2 + yp * dim + x];
        const valZm = field[zm * dim2 + y * dim + x];
        const valZp = field[zp * dim2 + y * dim + x];

        const gradX = (valXp - valXm) * 0.5;
        const gradY = (valYp - valYm) * 0.5;
        const gradZ = (valZp - valZm) * 0.5;
        const gradLen = Math.sqrt((gradX + 1e-4) ** 2 + (gradY + 1e-4) ** 2 + (gradZ + 1e-4) ** 2) || 1;
        const gnx = (gradX + 1e-4) / gradLen;
        const gny = (gradY + 1e-4) / gradLen;
        const gnz = (gradZ + 1e-4) / gradLen;

        const avg = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0;

        // §6.3 Multi-direction anisotropic diffusion along fiber tracts.
        let directionalTransport = 0.0;
        let isotropicLeak = avg;
        let crossingMix = 0.0;
        let totalFiberWeight = 0.0;
        let primaryX = 0, primaryY = 0, primaryZ = 0, primaryW = 0;

        if (hasFibers) {
            const fb = index * FIBER_STRIDE;
            primaryX = fiberAffinity[fb + 0];
            primaryY = fiberAffinity[fb + 1];
            primaryZ = fiberAffinity[fb + 2];
            primaryW = fiberAffinity[fb + 3];
            const center = sampleVoxel(field, dim, wx, wy, wz);

            for (let slot = 0; slot < FIBER_SLOTS; slot++) {
                const b = fb + slot * 4;
                const weight = fiberAffinity[b + 3];
                if (weight < fr(0.01)) continue;
                const fx = fiberAffinity[b + 0], fy = fiberAffinity[b + 1], fz = fiberAffinity[b + 2];

                // Downstream / upstream taps, reused by the highway pass below.
                const dsx = fr(wx + fr(fx * voxelStep)), dsy = fr(wy + fr(fy * voxelStep)), dsz = fr(wz + fr(fz * voxelStep));
                const usx = fr(wx - fr(fx * voxelStep)), usy = fr(wy - fr(fy * voxelStep)), usz = fr(wz - fr(fz * voxelStep));
                const forward = sampleVoxel(field, dim, dsx, dsy, dsz);
                const backward = sampleVoxel(field, dim, usx, usy, usz);
                slotDown[slot] = forward;
                slotUp[slot] = backward;
                slotDownPos[slot * 3 + 0] = dsx; slotDownPos[slot * 3 + 1] = dsy; slotDownPos[slot * 3 + 2] = dsz;
                slotUpPos[slot * 3 + 0] = usx; slotUpPos[slot * 3 + 1] = usy; slotUpPos[slot * 3 + 2] = usz;

                const alongSample = sampleDirectional(center, forward, backward);
                const along = Math.abs(gnx * fx + gny * fy + gnz * fz);
                directionalTransport += alongSample * weight * mix(0.75, 1.35, along);
                isotropicLeak -= Math.abs(gradX * fx + gradY * fy + gradZ * fz) * diffusion * weight * 0.08;
                crossingMix = Math.max(crossingMix, weight * (1.0 - along));
                totalFiberWeight += weight;
            }
        }

        if (totalFiberWeight > 0.0) {
            directionalTransport /= totalFiberWeight;
            const tractBias = clamp01(totalFiberWeight * (0.7 + crossingMix * 0.55));
            const diffused = mix(avg, directionalTransport, tractBias);
            val = mix(val, diffused, clamp(0.45 + p.fiberCoupling * 0.35, 0.0, 0.92));
            val -= (avg - isotropicLeak) * clamp01(p.fiberCoupling) * 0.16;
        } else {
            val = mix(val, avg, 0.7);
        }

        // §6.4 Highway bias: sustained transport along dominant tracts.
        if (hasFibers && p.fiberCoupling > 0.0) {
            const fb = index * FIBER_STRIDE;
            for (let slot = 0; slot < FIBER_SLOTS; slot++) {
                const weight = fiberAffinity[fb + slot * 4 + 3];
                if (weight < fr(0.01)) continue;
                const upVal = slotUp[slot];
                const downVal = slotDown[slot];
                const centerDrive = Math.max(val, Math.max(upVal, downVal));
                val += Math.max(upVal, downVal) * weight * p.fiberCoupling * 0.34;
                val += centerDrive * weight * p.fiberCoupling * 0.12;
                if (synaptiX) {
                    const u = slot * 3, d = slot * 3;
                    const aiUp = sampleVoxel(aiField, dim, slotUpPos[u], slotUpPos[u + 1], slotUpPos[u + 2]);
                    const aiDown = sampleVoxel(aiField, dim, slotDownPos[d], slotDownPos[d + 1], slotDownPos[d + 2]);
                    val += Math.max(aiUp, aiDown) * weight * p.aiInfluence * p.fiberCoupling * 0.18;
                }
            }
        }

        // §6.5 Criticality cascades.
        // §8.2 divergence: WGSL gates this with `step(threshold, localPeak)`.
        // A hard threshold flips on a 1-ulp difference, so the CPU reference
        // ramps over a narrow band instead — same behaviour away from the
        // threshold, and a bounded response to rounding at it.
        const localPeak = Math.max(
            Math.max(Math.max(val, valXm), valXp),
            Math.max(Math.max(valYm, valYp), Math.max(valZm, valZp))
        );
        const avalancheThreshold = p.spikeThreshold * mix(1.08, 0.72, criticality);
        const seeded = smoothstep(avalancheThreshold, avalancheThreshold + CASCADE_GATE_WIDTH, localPeak);
        const cascadeNoise = 0.72 + 0.28 * hashVoxel(x, y, z, frame + 0x51ed);
        let branchBias = 0.5;
        if (primaryW > fr(0.01)) {
            branchBias = clamp01(0.5 + 0.5 * (gnx * primaryX + gny * primaryY + gnz * primaryZ));
        }
        const cascade = seeded * cascadeNoise * mix(0.18, 1.0, branchBias) * (0.35 + criticality * 0.85);
        // Blended by `cascade` rather than gated on `cascade > 0`. The gate made
        // an otherwise continuous term discontinuous: crossing zero jumped `val`
        // straight to 0.84 * localPeak, so a 1-ulp difference in a neighbour
        // could move a voxel by tenths. Weighting by `cascade` keeps the same
        // behaviour at full cascade and fades it in smoothly.
        const cascadeMix = clamp01(cascade);
        const boosted = Math.max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5));
        val = mix(val, boosted, cascadeMix) + cascade * branchBias * 0.48;
        diffusion *= mix(1.0, 1.32, cascade);
        decay *= mix(1.0, mix(0.94, 0.82, criticality), cascade);

        // §6.6 Traveling phase wave along the strongest tract.
        const phaseSpeed = 4.0;
        const waveFreq = 6.2832;
        let spatialPhase;
        if (primaryW > fr(0.01)) {
            spatialPhase = (npx * primaryX + npy * primaryY + npz * primaryZ) * waveFreq;
        } else {
            spatialPhase = npy * waveFreq;
        }
        const travelingWave = Math.sin(spatialPhase - p.time * phaseSpeed) * 0.5 + 0.5;
        val += val * (travelingWave - 0.5) * 0.08;

        // §6.7 Directional flow bias (frontal lobe draws from upstream +Z).
        if (flowBias < -0.1 && z < dim - 1) {
            const upstream = field[(z + 1) * dim2 + y * dim + x];
            val = mix(val, upstream, diffusion * 0.4);
        }

        // §6.8 Procedural fluid advection.
        if (p.fluidActive > 0.0) {
            const ts = p.time * 2.0;
            const scale = 0.5 * p.fluidActive;
            const fvx = fr(fr(fr(Math.sin(fr(wy * 3.0 + ts))) * fr(Math.cos(fr(wz * 2.0 - ts)))) * scale);
            const fvy = fr(fr(fr(Math.cos(fr(wx * 3.0 - ts))) * fr(Math.sin(fr(wz * 2.0 + ts)))) * scale);
            const fvz = fr(fr(fr(Math.sin(fr(wx * 2.0 + ts))) * fr(Math.cos(fr(wy * 3.0 - ts)))) * scale);
            const upstream = sampleVoxelTrilinear(field, dim, fr(wx - fvx), fr(wy - fvy), fr(wz - fvz));
            val = mix(val, upstream, Math.min(1.0, p.fluidActive * 0.5));
        }

        // §6.9 Stimulus injection (paint radius + eraser).
        if (p.stimulusActive > 0.0) {
            const dx = wx - p.stimulusPosX;
            const dy = wy - p.stimulusPosY;
            const dz = wz - p.stimulusPosZ;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const sigma = p.stimulusRadius > 0.0001 ? p.stimulusRadius : 0.5;
            const signal = gaussianPulse(d, sigma) * p.mitochondrialFunction;
            // §8.4: WGSL early-outs at `signal > 0.01`. That is an optimisation,
            // and a discontinuity exactly where the brush fades out; the CPU
            // model applies the whole Gaussian so the two implementations do not
            // disagree by a full 0.01·intensity on a ring of voxels.
            if (p.stimulusErase > 0.5) {
                val *= clamp01(1.0 - p.stimulusActive * signal);
            } else {
                val += p.stimulusActive * signal;
            }
        }

        // §6.10 Environmental hazards.
        // §8.1 divergence: WGSL seeds the electrical spike from a sin-hash of
        // worldPosition.xy; the CPU reference uses the integer voxel hash.
        if (p.electricalActive > 0.0) {
            if (hashVoxel(x, y, z, frame + 0x9e37) > 0.95) {
                val += p.electricalActive * 5.0;
            }
        }
        if (p.mercuryActive > 0.0) {
            const mz = wz + 1.2;
            const dMerc = Math.sqrt(wx * wx + wy * wy + mz * mz);
            val += p.mercuryActive * gaussianPulse(dMerc, 1.2) * 0.5;
            decay = Math.min(decay, 0.999);
        }
        if (p.heavyMetal > 0.0) {
            val = Math.min(val, 1.0 - p.heavyMetal * 0.8);
            decay = Math.min(decay, 0.999 - p.heavyMetal * 0.05);
        }

        // §6.11 Ambient drive — cortically weighted, keeps the field breathing.
        const radial = Math.sqrt(wx * wx + wy * wy + wz * wz) / BRAIN_RANGE;
        const corticalBias = 1.0 - smoothstep(0.1, 0.95, radial);
        val += (ambientWave - 0.5) * p.amplitude * (0.02 + corticalBias * 0.04);

        // §6.12 SynaptiX AI mirror.
        if (synaptiX) {
            const aiVal = sampleVoxel(aiField, dim, wx, wy, wz);
            if (aiVal * p.aiInfluence > 0.0005 || val > 0.0005) {
                const aiRegion = regionPhysics(wx, wy, wz, 1.0);
                const aiDiffusionBias = clamp01(aiRegion.diffusion / 0.15);
                const aiGeometricDecay = mix(1.18, 0.86, aiDiffusionBias);
                const aiSparsity = smoothstep(0.14, 0.82, aiVal);
                const aiPhase = hashVoxel(x, y, z, frame + 0x27d4);
                const aiSpike = smoothstep(0.72, 0.98, aiPhase) * aiSparsity * (0.35 + p.aiInfluence * 0.65);
                let processedAI = Math.pow(clamp01(aiVal), aiGeometricDecay) * mix(0.7, 1.28, aiSparsity);
                processedAI = clamp01(processedAI + aiSpike * 0.28);

                let blended = mix(val, processedAI, p.aiInfluence);
                const diff = Math.abs(val - processedAI);
                if (diff < p.resonanceThreshold) {
                    const resonanceSoft = 1.0 - smoothstep(0.0, p.resonanceThreshold, diff);
                    blended += (0.22 + 0.58 * resonanceSoft) * Math.max(val, processedAI);
                }
                const divergence = smoothstep(p.resonanceThreshold * 1.75, p.resonanceThreshold * 4.0, diff);
                val = blended * (1.0 - divergence * 0.18);
            }
        }

        // §6.13 Decay and clamp.
        next[index] = clamp01(val * decay);
    }
}

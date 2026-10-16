// tests/test_tensor_physics.js
// [Tensor Physics] Headless guard for the neural-field contract.
//
// The field used to exist as three independent implementations (WGSL compute,
// C++ WASM, WebGL JS) that had quietly drifted into three different feature
// sets, with nothing in CI able to tell them apart. This test pins the JS
// reference stepper — the implementation the WebGL renderer runs and the one
// the C++ engine is validated against — to a committed fixture, and checks the
// invariants the spec states.
//
// The C++/WASM half of the contract is `npm run test:golden`, which needs a
// host C++ compiler and so runs as its own step.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    BRAIN_RANGE,
    FIBER_STRIDE,
    hashVoxel,
    regionPhysics,
    hypoxiaPhysics,
    makeReferenceFiberAffinities,
    normalizeFiberAffinities,
    resolveFieldParams,
    stepTensorField,
    DEFAULT_FIELD_PARAMS,
    neuromodulation,
    retentionLossScale,
    spread,
    regionZone,
    ZONE_DEFAULT,
    ZONE_FRONTAL,
    ZONE_OCCIPITAL,
    ZONE_TEMPORAL,
    ZONE_PARIETAL,
    RETENTION_BASELINE,
} from '../src/physics/tensor-field.js';
import { GOLDEN_FIXTURES, GOLDEN_EPSILON, runGoldenScenario, summarizeField } from './golden-scenario.js';
import { COMPUTE_UNIFORM_LAYOUT } from '../src/shaders/uniform-layout.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

// ---------------------------------------------------------------------------
// 1. The reference stepper reproduces every committed fixture exactly.
// ---------------------------------------------------------------------------
const fixtureHashes = [];
for (const { stem, scenario } of GOLDEN_FIXTURES) {
    const meta = JSON.parse(readFileSync(join(fixtureDir, `${stem}.json`), 'utf8'));
    const raw = readFileSync(join(fixtureDir, `${stem}.bin`));
    const expected = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);

    assert.equal(expected.length, scenario.voxelDim ** 3, `${stem}: fixture voxel count does not match the scenario`);
    assert.deepEqual(meta.scenario, JSON.parse(JSON.stringify(scenario)), `${stem}: fixture was generated from a different scenario`);

    const actual = runGoldenScenario(scenario);
    let maxDiff = 0;
    for (let i = 0; i < expected.length; i++) {
        const d = Math.abs(actual[i] - expected[i]);
        if (d > maxDiff) maxDiff = d;
    }
    assert.equal(
        maxDiff, 0,
        `The JS reference stepper no longer reproduces tests/fixtures/${stem}.bin ` +
        `(max diff ${maxDiff}). If the physics changed on purpose, update ` +
        `docs/tensor-physics.md, mirror the change in the C++ engine (wasm/src/), ` +
        `regenerate with 'node scripts/gen_tensor_fixture.mjs', and re-run 'npm run test:golden'.`
    );
    assert.deepEqual(summarizeField(actual), meta.stats, `${stem}: fixture summary statistics drifted`);
    assert.equal(meta.epsilon, GOLDEN_EPSILON, `${stem}: fixture epsilon drifted from tests/golden-scenario.js`);
    fixtureHashes.push(`${stem} ${meta.sha256.slice(0, 16)}…`);
}
// The neuromod scenario only means something if §3.4 moved the field.
{
    const [baseline, neuromod] = GOLDEN_FIXTURES.map(({ stem }) => JSON.parse(readFileSync(join(fixtureDir, `${stem}.json`), 'utf8')));
    assert.notEqual(baseline.sha256, neuromod.sha256, 'the neuromod fixture is identical to the baseline: §3.4 is not reaching the field');
}

// ---------------------------------------------------------------------------
// 1b. §3.4 neuromodulation: exact identity at the defaults, bounded elsewhere.
// ---------------------------------------------------------------------------
{
    const d = DEFAULT_FIELD_PARAMS;
    const nm = neuromodulation(d.decayRate, d.diffusionRate);
    assert.equal(nm.lossScale, 1, 'lossScale must be exactly 1 at the default decayRate');
    assert.equal(nm.diffusionScale, 1, 'diffusionScale must be exactly 1 at the default diffusionRate');
    // Same values in float32 (what C++ and WGSL see) must also be an identity.
    const nm32 = neuromodulation(Math.fround(d.decayRate), Math.fround(d.diffusionRate));
    assert.equal(Math.fround(nm32.lossScale), 1, 'the float32 default decayRate must also be an identity');
    const defaultBias = [d.retentionBiasX, d.retentionBiasY, d.retentionBiasZ, d.retentionBiasW];
    assert.deepEqual(defaultBias, [...RETENTION_BASELINE], 'retentionBias defaults drifted from RETENTION_BASELINE');
    for (const zone of [ZONE_DEFAULT, ZONE_FRONTAL, ZONE_OCCIPITAL, ZONE_TEMPORAL, ZONE_PARIETAL]) {
        assert.equal(retentionLossScale(zone, defaultBias), 1, `zone ${zone}: regionalLoss must be exactly 1 at the defaults`);
    }
    for (const m of [0.0, 0.3, 0.45, 0.625, 0.7, 0.795, 0.92]) {
        assert.equal(spread(m, 1), m, `spread(${m}, 1) must be exactly ${m}`);
        assert.equal(spread(m, 0), 0, `spread(${m}, 0) must be 0`);
        assert.ok(spread(m, 4) < 1 && spread(m, 4) >= m, `spread(${m}, 4) must lie in [m, 1)`);
    }
    // Clamps: no setting may turn decay into gain or spread into overshoot.
    assert.equal(neuromodulation(1.5, -1).lossScale, 0, 'decayRate above 1 must clamp lossScale to 0, not make it negative');
    assert.equal(neuromodulation(1.5, -1).diffusionScale, 0, 'negative diffusionRate must clamp to 0');
    assert.equal(neuromodulation(-10, 100).lossScale, 8, 'lossScale must clamp at 8');
    assert.equal(neuromodulation(-10, 100).diffusionScale, 4, 'diffusionScale must clamp at 4');
    // A lobe's bias moves only that lobe.
    const frontalUp = [RETENTION_BASELINE[0] + 1, ...RETENTION_BASELINE.slice(1)];
    assert.equal(retentionLossScale(ZONE_FRONTAL, frontalUp), 0.5, '+1 retention must halve the lobe loss');
    assert.equal(retentionLossScale(ZONE_OCCIPITAL, frontalUp), 1, 'frontal retention leaked into occipital');
    assert.equal(retentionLossScale(ZONE_DEFAULT, [9, 9, 9, 9]), 1, 'the Default zone has no lobe to modulate');
    // Zone order is the §3.1 order: frontal wins over temporal and parietal.
    assert.equal(regionZone(1.0, 1.0, 1.0), ZONE_FRONTAL);
    assert.equal(regionZone(1.0, 1.0, -1.0), ZONE_OCCIPITAL);
    assert.equal(regionZone(1.0, 1.0, 0.0), ZONE_TEMPORAL);
    assert.equal(regionZone(0.0, 1.0, 0.0), ZONE_PARIETAL);
    assert.equal(regionZone(0.0, 0.0, 0.0), ZONE_DEFAULT);

    // Each slider moves the field on the CPU path (WebGL fallback). This is
    // the acceptance check in miniature: one step from the same state, one
    // parameter changed, the field must differ — in the expected direction.
    const dim = 16;
    const affinity = makeReferenceFiberAffinities(dim);
    const seed = new Float32Array(dim ** 3);
    for (let i = 0; i < seed.length; i++) seed[i] = hashVoxel(i, 3, 5, 7) * 0.6;
    const meanAfter = (overrides, zone = null) => {
        const next = new Float32Array(seed.length);
        stepTensorField(seed, next, { params: resolveFieldParams({ voxelDim: dim, ...overrides }), fiberAffinity: affinity, frame: 0 });
        let sum = 0, n = 0;
        const w = [0, 0, 0];
        for (let i = 0; i < next.length; i++) {
            if (zone !== null) {
                const x = i % dim, y = ((i / dim) | 0) % dim, z = (i / (dim * dim)) | 0;
                w[0] = Math.fround(Math.fround(Math.fround(x / dim) * 2 - 1) * BRAIN_RANGE);
                w[1] = Math.fround(Math.fround(Math.fround(y / dim) * 2 - 1) * BRAIN_RANGE);
                w[2] = Math.fround(Math.fround(Math.fround(z / dim) * 2 - 1) * BRAIN_RANGE);
                if (regionZone(w[0], w[1], w[2]) !== zone) continue;
            }
            sum += next[i]; n++;
        }
        return sum / n;
    };
    const base = meanAfter({});
    assert.ok(meanAfter({ decayRate: 0.99 }) > base, 'raising decayRate must retain more activity');
    assert.ok(meanAfter({ decayRate: 0.85 }) < base, 'lowering decayRate must retain less activity');
    // diffusionRate: more spread = closer to the neighbourhood mean = lower variance.
    const variance = (overrides) => {
        const next = new Float32Array(seed.length);
        stepTensorField(seed, next, { params: resolveFieldParams({ voxelDim: dim, ...overrides }), fiberAffinity: affinity, frame: 0 });
        let s1 = 0, s2 = 0;
        for (const v of next) { s1 += v; s2 += v * v; }
        return s2 / next.length - (s1 / next.length) ** 2;
    };
    assert.ok(variance({ diffusionRate: 0.3 }) < variance({}), 'raising diffusionRate must smooth the field');
    assert.ok(variance({ diffusionRate: 0.02 }) > variance({}), 'lowering diffusionRate must sharpen the field');
    const occBase = meanAfter({}, ZONE_OCCIPITAL);
    assert.ok(meanAfter({ retentionBiasY: 1.0 }, ZONE_OCCIPITAL) > occBase, 'occipital retention must raise occipital activity');
    assert.equal(meanAfter({ retentionBiasY: 1.0 }, ZONE_DEFAULT), meanAfter({}, ZONE_DEFAULT),
        'occipital retention must leave the Default zone untouched in a single step');
    // The panel applies its first profile on load: that one must be the identity.
    const { DEFAULT_PROFILES } = await import('../src/neuromodulators.js');
    const [firstKey] = Object.keys(DEFAULT_PROFILES);
    const first = resolveFieldParams(DEFAULT_PROFILES[firstKey]);
    for (const key of ['decayRate', 'diffusionRate', 'retentionBiasX', 'retentionBiasY', 'retentionBiasZ', 'retentionBiasW']) {
        assert.equal(first[key], DEFAULT_FIELD_PARAMS[key],
            `the panel's initial profile '${firstKey}' must be the §3.4 identity, but its ${key} is ${first[key]}`);
    }
    // A neuromodulator profile object resolves to the flat params the stepper reads.
    const fromProfile = resolveFieldParams({ retentionBias: { frontal: 1.0, occipital: -0.2, temporal: 0.5, parietal: 0.2 } });
    assert.deepEqual([fromProfile.retentionBiasX, fromProfile.retentionBiasY, fromProfile.retentionBiasZ, fromProfile.retentionBiasW], [1.0, -0.2, 0.5, 0.2]);
}

// ---------------------------------------------------------------------------
// 2. Every parameter the reference model reads exists in the shared layout.
//    This is what stops a CPU-only parameter from being invented: if the field
//    consumes it, the WGSL struct and the WASM ABI must carry it too.
// ---------------------------------------------------------------------------
const layoutNames = new Set(COMPUTE_UNIFORM_LAYOUT.map((f) => f.name));
const VECTOR_COMPONENTS = {
    stimulusPosX: 'stimulusPos', stimulusPosY: 'stimulusPos', stimulusPosZ: 'stimulusPos',
    retentionBiasX: 'retentionBias', retentionBiasY: 'retentionBias',
    retentionBiasZ: 'retentionBias', retentionBiasW: 'retentionBias',
};
for (const name of Object.keys(DEFAULT_FIELD_PARAMS)) {
    const layoutName = VECTOR_COMPONENTS[name] ?? name;
    assert.ok(
        layoutNames.has(layoutName),
        `The reference stepper reads '${name}', which is not in COMPUTE_UNIFORM_LAYOUT. ` +
        `A parameter the field consumes has to travel through the shared uniform layout, ` +
        `or the WebGPU and WASM paths cannot receive it.`
    );
}

// ---------------------------------------------------------------------------
// 3. Region boundaries are evaluated in float32 (spec §8.3).
//    y = 22 at dim 32 lands exactly on the parietal boundary: in double the
//    voxel is parietal, in float32 it is not. Getting this wrong is invisible
//    in a screenshot and moves a whole plane of voxels into another lobe.
// ---------------------------------------------------------------------------
const boundaryY = Math.fround(((22 / 32) * 2 - 1) * Math.fround(1.6));
assert.ok(boundaryY > 0.6, 'test premise: the float32 boundary voxel is above the double literal');
assert.equal(
    regionPhysics(0, boundaryY, 0, 0).decay, 0.96,
    'regionPhysics compared a zone boundary in double precision — it must use the float32 literal'
);

// ---------------------------------------------------------------------------
// 4. The voxel hash is the integer mix, not a sin-hash (spec §8.1).
// ---------------------------------------------------------------------------
for (let i = 0; i < 64; i++) {
    const h = hashVoxel(i, i * 7, i * 13, i);
    assert.ok(h >= 0 && h < 1, 'hashVoxel left [0, 1)');
}
assert.notEqual(hashVoxel(1, 2, 3, 0), hashVoxel(1, 2, 3, 1), 'hashVoxel ignores its salt');
assert.equal(hashVoxel(1, 2, 3, 4), hashVoxel(1, 2, 3, 4), 'hashVoxel is not deterministic');

// ---------------------------------------------------------------------------
// 5. Fiber affinities are unit-normalised once, at upload (spec §7.1).
// ---------------------------------------------------------------------------
const affinities = makeReferenceFiberAffinities(8);
assert.equal(affinities.length, 8 ** 3 * FIBER_STRIDE);
for (let b = 0; b + 3 < affinities.length; b += 4) {
    if (affinities[b + 3] < 0.01) continue;
    const len = Math.hypot(affinities[b], affinities[b + 1], affinities[b + 2]);
    assert.ok(Math.abs(len - 1) < 1e-6, `fiber direction is not unit length (${len})`);
}
// Normalising is not idempotent to the last bit — WGSL's `+ 0.0001` guard
// against a zero-length direction is applied each time — but it must stay a
// unit-vector operation, and must leave weights untouched.
const reNormalized = normalizeFiberAffinities(affinities, 8);
for (let b = 0; b + 3 < affinities.length; b += 4) {
    assert.equal(reNormalized[b + 3], affinities[b + 3], 'normalizeFiberAffinities altered a tract weight');
    if (affinities[b + 3] < 0.01) continue;
    const len = Math.hypot(reNormalized[b], reNormalized[b + 1], reNormalized[b + 2]);
    assert.ok(Math.abs(len - 1) < 1e-6, 're-normalising left the unit sphere');
    assert.ok(Math.abs(reNormalized[b] - affinities[b]) < 1e-3, 're-normalising rotated a tract');
}

// ---------------------------------------------------------------------------
// 6. Physical invariants: the field stays in [0, 1] and a quiet brain decays.
// ---------------------------------------------------------------------------
const dim = 16;
const count = dim ** 3;
const field = new Float32Array(count).fill(0.9);
const next = new Float32Array(count);
const quiet = resolveFieldParams({ voxelDim: dim, amplitude: 0, frequency: 0, fiberCoupling: 0, spikeThreshold: 10 });

let previousMean = 0.9;
for (let step = 0; step < 40; step++) {
    stepTensorField(field, next, { params: quiet, frame: step });
    field.set(next);
    let sum = 0;
    for (const v of field) {
        assert.ok(v >= 0 && v <= 1, `activity left [0, 1] at step ${step}: ${v}`);
        sum += v;
    }
    const mean = sum / count;
    assert.ok(mean < previousMean, `an unstimulated field gained energy at step ${step}`);
    previousMean = mean;
}
assert.ok(previousMean < 0.35, `an unstimulated field decayed too slowly (mean ${previousMean})`);

// A mid-brain stimulus has to actually deposit energy near its centre.
const stimField = new Float32Array(count);
const stimNext = new Float32Array(count);
const stim = resolveFieldParams({
    voxelDim: dim, amplitude: 0, frequency: 0, fiberCoupling: 0, spikeThreshold: 10,
    stimulusActive: 1.0, stimulusRadius: 0.4, stimulusPosX: 0, stimulusPosY: 0, stimulusPosZ: 0,
});
stepTensorField(stimField, stimNext, { params: stim, frame: 0 });
const centre = (dim / 2) * dim * dim + (dim / 2) * dim + (dim / 2);
assert.ok(stimNext[centre] > 0.5, `stimulus did not reach the brush centre (${stimNext[centre]})`);
assert.ok(stimNext[0] < 0.05, `stimulus leaked to the far corner (${stimNext[0]})`);

// Erase mode damps instead of adding.
const erased = new Float32Array(count).fill(0.8);
const erasedNext = new Float32Array(count);
const eraseParams = resolveFieldParams({ ...stim, voxelDim: dim, stimulusErase: 1.0 });
stepTensorField(erased, erasedNext, { params: eraseParams, frame: 0 });
assert.ok(erasedNext[centre] < 0.2, `erase mode did not damp the brush centre (${erasedNext[centre]})`);

assert.ok(BRAIN_RANGE === Math.fround(1.6), 'BRAIN_RANGE must be the float32 value of 1.6');

console.log(`test_tensor_physics passed (fixtures: ${fixtureHashes.join(", ")})`);

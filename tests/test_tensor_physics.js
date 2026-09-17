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
} from '../src/physics/tensor-field.js';
import { GOLDEN_SCENARIO, GOLDEN_EPSILON, runGoldenScenario, summarizeField } from './golden-scenario.js';
import { COMPUTE_UNIFORM_LAYOUT } from '../src/shaders/uniform-layout.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

// ---------------------------------------------------------------------------
// 1. The reference stepper reproduces the committed fixture exactly.
// ---------------------------------------------------------------------------
const meta = JSON.parse(readFileSync(join(fixtureDir, 'tensor-field-golden.json'), 'utf8'));
const raw = readFileSync(join(fixtureDir, 'tensor-field-golden.bin'));
const expected = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);

assert.equal(expected.length, GOLDEN_SCENARIO.voxelDim ** 3, 'fixture voxel count does not match the scenario');

const actual = runGoldenScenario();
let maxDiff = 0;
for (let i = 0; i < expected.length; i++) {
    const d = Math.abs(actual[i] - expected[i]);
    if (d > maxDiff) maxDiff = d;
}
assert.equal(
    maxDiff, 0,
    `The JS reference stepper no longer reproduces tests/fixtures/tensor-field-golden.bin ` +
    `(max diff ${maxDiff}). If the physics changed on purpose, update ` +
    `docs/tensor-physics.md, mirror the change in wasm/brain_tensor_engine.cpp, ` +
    `regenerate with 'node scripts/gen_tensor_fixture.mjs', and re-run 'npm run test:golden'.`
);
assert.deepEqual(summarizeField(actual), meta.stats, 'fixture summary statistics drifted');
assert.equal(meta.epsilon, GOLDEN_EPSILON, 'fixture epsilon drifted from tests/golden-scenario.js');

// ---------------------------------------------------------------------------
// 2. Every parameter the reference model reads exists in the shared layout.
//    This is what stops a CPU-only parameter from being invented: if the field
//    consumes it, the WGSL struct and the WASM ABI must carry it too.
// ---------------------------------------------------------------------------
const layoutNames = new Set(COMPUTE_UNIFORM_LAYOUT.map((f) => f.name));
const VECTOR_COMPONENTS = { stimulusPosX: 'stimulusPos', stimulusPosY: 'stimulusPos', stimulusPosZ: 'stimulusPos' };
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

console.log(`test_tensor_physics passed (fixture sha256 ${meta.sha256.slice(0, 16)}…)`);

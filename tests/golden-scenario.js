// tests/golden-scenario.js
// [Tensor Physics] The single scenario definition behind the cross-implementation
// golden fixture. Mirrored field-for-field by SCENARIO in
// wasm/tests/golden_step_test.cpp and documented in docs/tensor-physics.md §9.
//
// It is deliberately "everything at once": a live stimulus with a paint radius,
// partial hypoxia, fluid advection, criticality drive, and both hazard paths, so
// a step that one implementation skips shows up in the diff instead of hiding
// behind a zero parameter.
import { makeReferenceFiberAffinities, resolveFieldParams, stepTensorField } from '../src/physics/tensor-field.js';

export const GOLDEN_SCENARIO = Object.freeze({
    name: 'baseline-v1',
    voxelDim: 32,
    steps: 24,
    dt: 0.016,
    /** Parameters held constant across the run, except `time` (= step * dt). */
    params: Object.freeze({
        frequency: 2.0,
        amplitude: 0.5,
        spikeThreshold: 0.6,
        style: 0.0,
        fiberCoupling: 0.5,
        hypoxiaStress: 0.25,
        metabolicRate: 1.1,
        mitochondrialFunction: 0.85,
        fluidActive: 0.4,
        cognitiveLoad: 0.3,
        stress: 0.2,
        heavyMetal: 0.1,
        electricalActive: 0.02,
        mercuryActive: 0.15,
        stimulusPosX: 0.4,
        stimulusPosY: -0.2,
        stimulusPosZ: 0.6,
        stimulusActive: 0.8,
        stimulusRadius: 0.45,
        stimulusErase: 0.0,
        synaptiXActive: 0.0,
        aiInfluence: 0.0,
        resonanceThreshold: 0.2,
    }),
});

/**
 * Maximum absolute per-voxel difference tolerated between the JavaScript
 * reference stepper (double-precision intermediates) and the C++/WASM engine
 * (single-precision intermediates) after `steps` steps.
 *
 * The two implement the same algorithm; they differ only in intermediate
 * precision and in libm's last-ulp behaviour for sin/cos/exp/pow. The field is
 * dissipative and clamped to [0,1], so those differences stay bounded rather
 * than compounding. Tighten this if it ever starts passing with room to spare —
 * a sudden jump means an algorithm change, not rounding.
 */
export const GOLDEN_EPSILON = 2e-3;

/**
 * Runs the JavaScript reference stepper over the golden scenario.
 *
 * Shared by scripts/gen_tensor_fixture.mjs (which records the result) and
 * tests/test_tensor_physics.js (which re-runs it and requires a bit-exact
 * match), so the fixture and the test can never be generated from two slightly
 * different loops.
 *
 * @returns {Float32Array} the field after GOLDEN_SCENARIO.steps steps.
 */
export function runGoldenScenario() {
    const { voxelDim, steps, dt, params } = GOLDEN_SCENARIO;
    const count = voxelDim ** 3;
    const field = new Float32Array(count);
    const next = new Float32Array(count);
    const fiberAffinity = makeReferenceFiberAffinities(voxelDim);

    for (let step = 0; step < steps; step++) {
        const p = resolveFieldParams({ ...params, voxelDim, time: step * dt });
        stepTensorField(field, next, { params: p, fiberAffinity, frame: step });
        field.set(next);
    }
    return field;
}

/** Summary statistics, so a JSON diff stays readable although the data is binary. */
export function summarizeField(field) {
    let sum = 0;
    let max = 0;
    let active = 0;
    for (const v of field) {
        sum += v;
        if (v > max) max = v;
        if (v > 0.01) active++;
    }
    return {
        mean: Number((sum / field.length).toFixed(9)),
        max: Number(max.toFixed(9)),
        activeVoxels: active,
    };
}

// src/shaders/field-step.js
// [Clipmap] The §6 neural-field step body (docs/tensor-physics.md), written
// once and emitted into every WGSL level of the field.
//
// The clipmap adds a second GPU field — a fine 64³ brick nested inside the
// coarse grid (docs/field-resolution.md §7, docs/tensor-physics.md §11). The
// obvious way to write it, a second compute shader with its own copy of the
// step, is exactly the drift docs/tensor-physics.md exists to prevent: two
// hand-maintained copies of the same algorithm that a later edit updates one
// of. So the step body lives here, as a template whose only free parameters
// are *addressing* — where the centre value, the six neighbours, the tract
// affinities and a world-space sample come from, and where the result goes.
// Every arithmetic stage (§6.1–§6.13) is shared text.
//
//   - volumetric-compute.js emits it with COARSE_FIELD_STEP, which reproduces
//     the coarse shader character for character (the refactor that introduced
//     this file was checked against the previous shader text).
//   - brick-compute.js emits it with the brick's hooks: toroidal 3D-texture
//     reads inside the brick, coarse-field reads outside it.
//
// A change to the field's physics therefore edits this file (after the spec,
// and the CPU reference + C++ engine, per CLAUDE.md §3a) and reaches both GPU
// levels at once.
//
// The emitting shader must declare, in scope before the body: `dim` (the
// COARSE grid dimension — §6.12's sampleAIActivation(…, dim) reads the coarse
// AI tensor at it), `params: TensorParams`, and the module-scope helpers the
// body calls by name (getRegionPhysics, regionZone, getHypoxiaPhysics,
// sampleDirectionalActivity, sampleAIActivation, avalancheCriticality,
// hashNoise3, gaussian_pulse — from render-shared.js HELPERS — plus
// FIELD_STEP_HELPERS below).

/**
 * Module-scope WGSL the step body needs beyond render-shared.js HELPERS: the
 * §3.4 neuromodulation scales. Every shader that emits fieldStepWGSL() must
 * interpolate this once. Mirrors neuromodulation() / retentionLossScale() /
 * spread() in src/physics/tensor-field.js.
 */
export const FIELD_STEP_HELPERS = `
    // [Tensor Physics] §3.4 baselines: the renderer defaults, at which every
    // neuromodulator scale is 1.
    const DECAY_RATE_BASELINE: f32 = 0.96;
    const DIFFUSION_RATE_BASELINE: f32 = 0.1;
    const RETENTION_BASELINE: vec4<f32> = vec4<f32>(0.5, 0.0, 0.2, 0.2);
    // §6.5 width of the soft cascade gate (§8.2).
    const CASCADE_GATE_WIDTH: f32 = 0.01;

    // §3.4 (lossScale, diffusionScale). Clamped so no setting turns a zone's
    // decay into gain or a mix factor into overshoot.
    fn neuromodulationScales(decayRate: f32, diffusionRate: f32) -> vec2<f32> {
        return vec2<f32>(
            clamp((1.0 - decayRate) / (1.0 - DECAY_RATE_BASELINE), 0.0, 8.0),
            clamp(diffusionRate / DIFFUSION_RATE_BASELINE, 0.0, 4.0)
        );
    }

    // §3.4 regionalLoss = exp2(-retention); zone 0 (no lobe) is never modulated.
    fn retentionLossScale(zone: u32, retentionBias: vec4<f32>) -> f32 {
        if (zone == 0u) { return 1.0; }
        let baseline = RETENTION_BASELINE;
        let retention = clamp(retentionBias[zone - 1u] - baseline[zone - 1u], -2.0, 2.0);
        return exp2(-retention);
    }

    // §3.4 spread(m, s): the odds of mix factor m scaled by s; m at s = 1.
    fn spreadMix(m: f32, s: f32) -> f32 {
        return (m * s) / (1.0 + m * (s - 1.0));
    }
`;

/**
 * @typedef {Object} FieldStepHooks
 * @property {string} center - Expression: this voxel's current value.
 * @property {string} worldPosition - Expression: this voxel's §4.1 world position.
 * @property {string} neighborReads - Statements declaring `valXm … valZp`, the six §6.2 neighbours.
 * @property {string} voxelStep - Expression: the §4.3 directional step for this level's spacing.
 * @property {(slot: string) => string} affinity - Expression: the `(dir, weight)` record in tract `slot`.
 * @property {(pos: string) => string} sample - Expression: §4.2 field sample at a world position.
 * @property {string} hasUpstreamZ - Condition: a +z neighbour exists for §6.7.
 * @property {string} upstreamZ - Expression: the +z neighbour's value.
 * @property {string} advect - Statements declaring `upstreamVal`, the §6.8 sample at `samplePos`.
 * @property {string} store - Statements writing the finished `val` (already decayed, unclamped).
 */

/**
 * Emits the §6 step body for one level of the field.
 * @param {FieldStepHooks} h
 * @returns {string} WGSL statements, indented for a `main()` body.
 */
export function fieldStepWGSL(h) {
    return `    var val = ${h.center};

    let worldPosition = ${h.worldPosition};
    let normalizedPosition = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(1.0));

    let physics = getRegionPhysics(worldPosition, params.style);
    // [Tensor Physics] §3.4 / §6.1 neuromodulation: decayRate and the lobe's
    // retentionBias scale the zone's loss (1 - decay); diffusionRate scales
    // its diffusion and, below, the §6.3 neighbourhood mix.
    let neuromod = neuromodulationScales(params.decayRate, params.diffusionRate);
    let lossScale = neuromod.x * retentionLossScale(regionZone(worldPosition), params.retentionBias);
    var decay = clamp(1.0 - (1.0 - physics.x) * lossScale, 0.0, 1.0);
    var diffusion = physics.y * neuromod.y;
    let flowBias = physics.z;

    // Apply hypoxia physics modulation
    let hypoxiaPhysics = getHypoxiaPhysics(params.hypoxiaStress, params.metabolicRate, params.mitochondrialFunction);
    decay *= hypoxiaPhysics.x;
    diffusion *= hypoxiaPhysics.y;

${h.neighborReads}

    var gradX = (valXp - valXm) * 0.5;
    var gradY = (valYp - valYm) * 0.5;
    var gradZ = (valZp - valZm) * 0.5;
    let gradient = vec3<f32>(gradX, gradY, gradZ);

    let avg = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0;

    // [V3.2] Multi-direction anisotropic diffusion with tract-following transport
    let voxelStep = ${h.voxelStep};
    var directionalTransport = 0.0;
    var isotropicLeak = avg;
    var crossingMix = 0.0;
    var totalFiberWeight = 0.0;
    for (var slot = 0u; slot < 3u; slot = slot + 1u) {
        let aff = ${h.affinity('slot')};
        let weight = aff.w;
        if (weight < 0.01) { continue; }
        let fiberDir = normalize(aff.xyz + vec3<f32>(0.0001, 0.0001, 0.0001));
        let alongSample = sampleDirectionalActivity(worldPosition, fiberDir, voxelStep);
        let along = abs(dot(normalize(gradient + vec3<f32>(0.0001, 0.0001, 0.0001)), fiberDir));
        directionalTransport = directionalTransport + alongSample * weight * mix(0.75, 1.35, along);
        isotropicLeak = isotropicLeak - abs(dot(gradient, fiberDir)) * diffusion * weight * 0.08;
        crossingMix = max(crossingMix, weight * (1.0 - along));
        totalFiberWeight = totalFiberWeight + weight;
    }
    if (totalFiberWeight > 0.0) {
        directionalTransport = directionalTransport / totalFiberWeight;
        let tractBias = clamp(totalFiberWeight * (0.7 + crossingMix * 0.55), 0.0, 1.0);
        let diffused = mix(avg, directionalTransport, tractBias);
        val = mix(val, diffused, min(spreadMix(clamp(0.45 + params.fiberCoupling * 0.35, 0.0, 0.92), neuromod.y), 0.92));
        val = val - (avg - isotropicLeak) * clamp(params.fiberCoupling, 0.0, 1.0) * 0.16;
    } else {
        val = mix(val, avg, spreadMix(0.7, neuromod.y));
    }

    // [V3.2] Highway bias: sustained activity along dominant fiber tracts
    if (params.fiberCoupling > 0.0) {
        for (var slot = 0u; slot < 3u; slot = slot + 1u) {
            let aff = ${h.affinity('slot')};
            let weight = aff.w;
            if (weight < 0.01) { continue; }
            let fiberDir = normalize(aff.xyz + vec3<f32>(0.0001, 0.0001, 0.0001));
            let upstreamPos = worldPosition - fiberDir * voxelStep;
            let downstreamPos = worldPosition + fiberDir * voxelStep;
            let upVal = ${h.sample('upstreamPos')};
            let downVal = ${h.sample('downstreamPos')};
            let centerDrive = max(val, max(upVal, downVal));
            let highway = max(upVal, downVal) * weight * params.fiberCoupling * 0.34;
            let priming = centerDrive * weight * params.fiberCoupling * 0.12;
            val = val + highway + priming;
            if (params.synaptiXActive > 0.5) {
                let aiUp = sampleAIActivation(upstreamPos, dim);
                let aiDown = sampleAIActivation(downstreamPos, dim);
                let resonanceDrive = max(aiUp, aiDown) * weight * params.aiInfluence * params.fiberCoupling * 0.18;
                val = val + resonanceDrive;
            }
        }
    }

    // [Phase 10] Criticality Cascades
    let criticality = avalancheCriticality(params.cognitiveLoad, params.stress, params.fluidActive);
    let localPeak = max(max(max(val, valXm), valXp), max(max(valYm, valYp), max(valZm, valZp)));
    let avalancheThreshold = params.spikeThreshold * mix(1.08, 0.72, criticality);
    // [Tensor Physics] §8.2: the soft band all three implementations share.
    // This was still a hard step() here after the CPU paths moved off it.
    let seeded = smoothstep(avalancheThreshold, avalancheThreshold + CASCADE_GATE_WIDTH, localPeak);
    let cascadeNoise = 0.72 + 0.28 * hashNoise3(worldPosition * 1.7 + vec3<f32>(params.time * 0.31));
    let primaryAff = ${h.affinity('0u')};
    var branchBias = 0.5;
    if (primaryAff.w > 0.01) {
        branchBias = clamp(0.5 + 0.5 * dot(normalize(gradient + vec3<f32>(0.001, 0.001, 0.001)), primaryAff.xyz), 0.0, 1.0);
    }
    let cascade = seeded * cascadeNoise * mix(0.18, 1.0, branchBias) * (0.35 + criticality * 0.85);
    // [Tensor Physics] Blended by 'cascade', not gated on 'cascade > 0'.
    // See docs/tensor-physics.md §6.5: the gate made an otherwise continuous
    // term jump 'val' straight to 0.84 * localPeak the instant it became
    // non-zero, which is both a visible popping artefact and the reason the CPU
    // implementations could not be held to the same result.
    let cascadeMix = clamp(cascade, 0.0, 1.0);
    let boosted = max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5));
    val = mix(val, boosted, cascadeMix) + cascade * branchBias * 0.48;
    diffusion *= mix(1.0, 1.32, cascade);
    decay *= mix(1.0, mix(0.94, 0.82, criticality), cascade);

    // [V3.2] Traveling Phase Wave along strongest fiber direction
    let phaseSpeed = 4.0;
    let waveFreq = 6.2832;
    var travelingWave = 0.0;
    if (primaryAff.w > 0.01) {
        let spatialPhase = dot(normalizedPosition, primaryAff.xyz) * waveFreq;
        travelingWave = sin(spatialPhase - params.time * phaseSpeed) * 0.5 + 0.5;
    } else {
        travelingWave = sin(dot(normalizedPosition, vec3<f32>(0.0, 1.0, 0.0)) * waveFreq - params.time * phaseSpeed) * 0.5 + 0.5;
    }
    val = val + val * (travelingWave - 0.5) * 0.08;

    // Directional Flow Logic
    if (flowBias < -0.1) {
        if (${h.hasUpstreamZ}) {
            let upstream = ${h.upstreamZ};
            val = mix(val, upstream, diffusion * 0.4);
        }
    }

    // Fluid Dynamics
    if (params.fluidActive > 0.0) {
        let timeSpeed = params.time * 2.0;
        let flowVelocity = vec3<f32>(
            sin(worldPosition.y * 3.0 + timeSpeed) * cos(worldPosition.z * 2.0 - timeSpeed),
            cos(worldPosition.x * 3.0 - timeSpeed) * sin(worldPosition.z * 2.0 + timeSpeed),
            sin(worldPosition.x * 2.0 + timeSpeed) * cos(worldPosition.y * 3.0 - timeSpeed)
        ) * 0.5 * params.fluidActive;
        let samplePos = worldPosition - flowVelocity;
${h.advect}
        val = mix(val, upstreamVal, min(1.0, params.fluidActive * 0.5));
    }

    // Stimulus Injection
    if (params.stimulusActive > 0.0) {
        let d = distance(worldPosition, params.stimulusPos);
        let sigma = select(0.5, params.stimulusRadius, params.stimulusRadius > 0.0001);
        var signal = gaussian_pulse(d, sigma);
        signal *= params.mitochondrialFunction;
        // [Tensor Physics] §8.4: no 'signal > 0.01' early-out. It saved nothing
        // measurable on the GPU and put a hard step on the ring where the brush
        // fades out, which the CPU implementations then had to reproduce
        // exactly to stay within the golden fixture's epsilon.
        if (params.stimulusErase > 0.5) {
            // [Paint Energy] Eraser mode: damp existing energy within the
            // brush footprint instead of adding new energy.
            let eraseFactor = clamp(1.0 - params.stimulusActive * signal, 0.0, 1.0);
            val = val * eraseFactor;
        } else {
            val = val + params.stimulusActive * signal;
        }
    }

    // Electrical Exposure
    if (params.electricalActive > 0.0) {
        let noise = fract(sin(dot(worldPosition.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.95) {
            val = val + params.electricalActive * 5.0;
        }
    }

    // Mercury Vapor
    if (params.mercuryActive > 0.0) {
        let d_merc = distance(worldPosition, vec3<f32>(0.0, 0.0, -1.2));
        var mercSignal = gaussian_pulse(d_merc, 1.2);
        val = val + params.mercuryActive * mercSignal * 0.5;
        decay = min(decay, 0.999);
    }

    // Heavy Metal
    if (params.heavyMetal > 0.0) {
        val = min(val, 1.0 - (params.heavyMetal * 0.8));
        decay = min(decay, 0.999 - (params.heavyMetal * 0.05));
    }

    // [Tensor Physics] §6.11 Ambient drive — the low-amplitude, cortically
    // weighted heartbeat that keeps the field alive between stimuli. This is
    // what 'amplitude' and 'frequency' drive; before the physics contract they
    // were uploaded to TensorParams and read by nothing on this path, while the
    // CPU paths each invented their own version of the same term.
    let radial = length(worldPosition) / BRAIN_RANGE;
    let corticalBias = 1.0 - smoothstep(0.1, 0.95, radial);
    let ambientWave = sin(params.time * params.frequency) * 0.5 + 0.5;
    val = val + (ambientWave - 0.5) * params.amplitude * (0.02 + corticalBias * 0.04);

    // SynaptiX AI mirror
    if (params.synaptiXActive > 0.5) {
        let aiVal = sampleAIActivation(worldPosition, dim);
        let aiEnergy = aiVal * params.aiInfluence;
        if (aiEnergy > 0.0005 || val > 0.0005) {
            let aiRegion = getRegionPhysics(worldPosition, 1.0);
            let aiDiffusionBias = clamp(aiRegion.y / 0.15, 0.0, 1.0);
            let aiGeometricDecay = mix(1.18, 0.86, aiDiffusionBias);
            let aiSparsity = smoothstep(0.14, 0.82, aiVal);
            let aiPhase = hashNoise3(worldPosition * (8.0 + params.frequency * 0.35) + vec3<f32>(params.time * 0.45));
            let aiSpike = smoothstep(0.72, 0.98, aiPhase) * aiSparsity * (0.35 + params.aiInfluence * 0.65);
            var processedAI = pow(clamp(aiVal, 0.0, 1.0), aiGeometricDecay) * mix(0.7, 1.28, aiSparsity);
            processedAI = processedAI + aiSpike * 0.28;
            processedAI = clamp(processedAI, 0.0, 1.0);
            let humanVal = val;
            var blended = mix(humanVal, processedAI, params.aiInfluence);
            let diff = abs(humanVal - processedAI);
            let resonance = select(0.0, 1.0, diff < params.resonanceThreshold);
            let resonanceSoft = 1.0 - smoothstep(0.0, params.resonanceThreshold, diff);
            if (resonance > 0.5) {
                let burst = (0.22 + 0.58 * resonanceSoft) * max(humanVal, processedAI);
                blended = blended + burst;
            }
            let divergence = smoothstep(params.resonanceThreshold * 1.75, params.resonanceThreshold * 4.0, diff);
            blended *= 1.0 - divergence * 0.18;
            val = blended;
        }
    }

    val *= decay;
${h.store}`;
}

/**
 * The coarse whole-brain level: a flat `dim³` storage buffer, indexed
 * `z·dim² + y·dim + x` with clamped neighbours. It reads `activityTensor` and
 * writes `nextTensor` — §6's source and destination never alias; stepping in
 * place made every neighbour read race with that neighbour's own write.
 * @type {FieldStepHooks}
 */
export const COARSE_FIELD_STEP = Object.freeze({
    center: 'activityTensor[index]',
    worldPosition: 'indexToWorld(index, dim)',
    neighborReads: `    // Safe neighbor reads
    let xm = select(0u, x - 1u, x > 0u);
    let xp = select(dim - 1u, x + 1u, x < dim - 1u);
    let ym = select(0u, y - 1u, y > 0u);
    let yp = select(dim - 1u, y + 1u, y < dim - 1u);
    let zm = select(0u, z - 1u, z > 0u);
    let zp = select(dim - 1u, z + 1u, z < dim - 1u);

    let valXm = activityTensor[getIndex(xm, y, z)];
    let valXp = activityTensor[getIndex(xp, y, z)];
    let valYm = activityTensor[getIndex(x, ym, z)];
    let valYp = activityTensor[getIndex(x, yp, z)];
    let valZm = activityTensor[getIndex(x, y, zm)];
    let valZp = activityTensor[getIndex(x, y, zp)];`,
    voxelStep: '(BRAIN_RANGE / f32(dim)) * 0.9',
    affinity: (slot) => `getFiberAffinity(index, ${slot})`,
    sample: (pos) => `getVoxelValue(${pos})`,
    hasUpstreamZ: 'z < dim - 1u',
    upstreamZ: 'activityTensor[getIndex(x, y, z + 1u)]',
    advect: `        let normalizedSamplePos = (samplePos / BRAIN_RANGE) * 0.5 + 0.5;
        let sx = u32(clamp(normalizedSamplePos.x * f32(dim), 0.0, f32(dim - 1u)));
        let sy = u32(clamp(normalizedSamplePos.y * f32(dim), 0.0, f32(dim - 1u)));
        let sz = u32(clamp(normalizedSamplePos.z * f32(dim), 0.0, f32(dim - 1u)));
        let upstreamIndex = getIndex(sx, sy, sz);
        let upstreamVal = activityTensor[upstreamIndex];`,
    store: '    nextTensor[index] = clamp(val, 0.0, 1.0);',
});

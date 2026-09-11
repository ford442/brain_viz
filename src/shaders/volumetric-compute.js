// src/shaders/volumetric-compute.js
// [Neuro-Weaver] Compute shader updating the volumetric tensor buffer (signal propagation/diffusion).
// Split out of the former monolithic shaders.js.
import { CONSTANTS, HELPERS } from './render-shared.js';

export const computeShader = `
// V3.2 Compute Logic: Multi-direction fiber-coupled diffusion
${CONSTANTS}
${HELPERS}

struct TensorParams {
    time: f32,
    voxelDim: u32,
    frequency: f32,
    amplitude: f32,
    spikeThreshold: f32,
    smoothing: f32,
    style: f32,
    // Implicit padding (28 -> 32) aligns stimulusPos to 16 bytes.
    // V2.2 Stimulus Fields (offset 32)
    stimulusPos: vec3<f32>,
    stimulusActive: f32,
    // Altitude/Hypoxia parameters for compute shader physics
    hypoxiaStress: f32,
    metabolicRate: f32,
    mitochondrialFunction: f32,
    // Environmental hazards + cognitive state (matches JS layout)
    fluidActive: f32,        // offset 60
    electricalActive: f32,   // offset 64
    mercuryActive: f32,      // offset 68
    cognitiveLoad: f32,      // offset 72
    stress: f32,             // offset 76
    heavyMetal: f32,         // offset 80
    pad2: f32,               // offset 84
    // [SynaptiX] AI Tensor Mirror params (offset 88)
    aiInfluence: f32,
    resonanceThreshold: f32,
    synaptiXActive: f32,
    // [V3.2] Fiber-volume coupling (offset 100)
    fiberCoupling: f32,
    // Offsets 104-167 are written by JS (uniforms.js) for neuromodulator/
    // lesion params this compute shader does not consume (pre-existing
    // drift, out of scope for Paint Energy). Scalar filler keeps every
    // subsequent field's byte offset correct — do NOT collapse into an
    // array<f32,N>, which would force 16-byte stride in the uniform address
    // space and silently shift stimulusRadius/stimulusErase below.
    _reserved0: f32, _reserved1: f32, _reserved2: f32, _reserved3: f32,
    _reserved4: f32, _reserved5: f32, _reserved6: f32, _reserved7: f32,
    _reserved8: f32, _reserved9: f32, _reserved10: f32, _reserved11: f32,
    _reserved12: f32, _reserved13: f32, _reserved14: f32, _reserved15: f32,
    // [Paint Energy] offset 168: brush radius (0 = legacy fixed sigma 0.5,
    // used by single-click/region-button callers that don't pass a radius).
    // offset 172: erase/damping mode flag (>0.5 = erase).
    stimulusRadius: f32,
    stimulusErase: f32,
}

@group(0) @binding(0) var<storage, read_write> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;
@group(0) @binding(2) var<storage, read> fiberDirections: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> aiTensor: array<f32>;

fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

fn indexToWorld(index: u32, dim: u32) -> vec3<f32> {
    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;
    let normalizedPosition = vec3<f32>(f32(x), f32(y), f32(z)) / f32(dim);
    return (normalizedPosition * 2.0 - 1.0) * BRAIN_RANGE;
}

fn worldToIndex(worldPosition: vec3<f32>, dim: u32) -> u32 {
    let normalized = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(0.99999));
    let x = u32(normalized.x * f32(dim));
    let y = u32(normalized.y * f32(dim));
    let z = u32(normalized.z * f32(dim));
    return getIndex(x, y, z);
}

fn sampleAIActivation(worldPosition: vec3<f32>, dim: u32) -> f32 {
    return aiTensor[worldToIndex(worldPosition, dim)];
}

// [V3.2] Read 3 fiber affinities for a voxel: each vec4 = (dir.xyz, weight)
fn getFiberAffinity(index: u32, slot: u32) -> vec4<f32> {
    return fiberDirections[index * 3u + slot];
}

fn sampleDirectionalActivity(worldPosition: vec3<f32>, axis: vec3<f32>, step: f32) -> f32 {
    let axisN = normalize(axis + vec3<f32>(0.0001, 0.0001, 0.0001));
    let center = getVoxelValue(worldPosition);
    let forward = getVoxelValue(worldPosition + axisN * step);
    let backward = getVoxelValue(worldPosition - axisN * step);
    return center * 0.34 + max(forward, backward) * 0.46 + min(forward, backward) * 0.20;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    let dim = params.voxelDim;
    let total = dim * dim * dim;
    
    if (index >= total) { return; }

    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;

    var val = activityTensor[index];

    let worldPosition = indexToWorld(index, dim);
    let normalizedPosition = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(1.0));

    let physics = getRegionPhysics(worldPosition, params.style);
    var decay = physics.x;
    var diffusion = physics.y;
    let flowBias = physics.z;

    // Apply hypoxia physics modulation
    let hypoxiaPhysics = getHypoxiaPhysics(params.hypoxiaStress, params.metabolicRate, params.mitochondrialFunction);
    decay *= hypoxiaPhysics.x;
    diffusion *= hypoxiaPhysics.y;

    // Safe neighbor reads
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
    let valZp = activityTensor[getIndex(x, y, zp)];

    var gradX = (valXp - valXm) * 0.5;
    var gradY = (valYp - valYm) * 0.5;
    var gradZ = (valZp - valZm) * 0.5;
    let gradient = vec3<f32>(gradX, gradY, gradZ);

    let avg = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0;

    // [V3.2] Multi-direction anisotropic diffusion with tract-following transport
    let voxelStep = (BRAIN_RANGE / f32(dim)) * 0.9;
    var directionalTransport = 0.0;
    var isotropicLeak = avg;
    var crossingMix = 0.0;
    var totalFiberWeight = 0.0;
    for (var slot = 0u; slot < 3u; slot = slot + 1u) {
        let aff = getFiberAffinity(index, slot);
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
        val = mix(val, diffused, clamp(0.45 + params.fiberCoupling * 0.35, 0.0, 0.92));
        val = val - (avg - isotropicLeak) * clamp(params.fiberCoupling, 0.0, 1.0) * 0.16;
    } else {
        val = mix(val, avg, 0.7);
    }

    // [V3.2] Highway bias: sustained activity along dominant fiber tracts
    if (params.fiberCoupling > 0.0) {
        for (var slot = 0u; slot < 3u; slot = slot + 1u) {
            let aff = getFiberAffinity(index, slot);
            let weight = aff.w;
            if (weight < 0.01) { continue; }
            let fiberDir = normalize(aff.xyz + vec3<f32>(0.0001, 0.0001, 0.0001));
            let upstreamPos = worldPosition - fiberDir * voxelStep;
            let downstreamPos = worldPosition + fiberDir * voxelStep;
            let upVal = getVoxelValue(upstreamPos);
            let downVal = getVoxelValue(downstreamPos);
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
    let seeded = step(avalancheThreshold, localPeak);
    let cascadeNoise = 0.72 + 0.28 * hashNoise3(worldPosition * 1.7 + vec3<f32>(params.time * 0.31));
    let primaryAff = getFiberAffinity(index, 0u);
    var branchBias = 0.5;
    if (primaryAff.w > 0.01) {
        branchBias = clamp(0.5 + 0.5 * dot(normalize(gradient + vec3<f32>(0.001, 0.001, 0.001)), primaryAff.xyz), 0.0, 1.0);
    }
    let cascade = seeded * cascadeNoise * mix(0.18, 1.0, branchBias) * (0.35 + criticality * 0.85);
    if (cascade > 0.0) {
        val = max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5));
        val = val + cascade * branchBias * 0.48;
        diffusion *= mix(1.0, 1.32, cascade);
        decay *= mix(1.0, mix(0.94, 0.82, criticality), cascade);
    }

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
        if (z < dim - 1u) {
            let upstream = activityTensor[getIndex(x, y, z + 1u)];
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
        let normalizedSamplePos = (samplePos / BRAIN_RANGE) * 0.5 + 0.5;
        let sx = u32(clamp(normalizedSamplePos.x * f32(dim), 0.0, f32(dim - 1u)));
        let sy = u32(clamp(normalizedSamplePos.y * f32(dim), 0.0, f32(dim - 1u)));
        let sz = u32(clamp(normalizedSamplePos.z * f32(dim), 0.0, f32(dim - 1u)));
        let upstreamIndex = getIndex(sx, sy, sz);
        let upstreamVal = activityTensor[upstreamIndex];
        val = mix(val, upstreamVal, min(1.0, params.fluidActive * 0.5));
    }

    // Stimulus Injection
    if (params.stimulusActive > 0.0) {
        let d = distance(worldPosition, params.stimulusPos);
        let sigma = select(0.5, params.stimulusRadius, params.stimulusRadius > 0.0001);
        var signal = gaussian_pulse(d, sigma);
        signal *= params.mitochondrialFunction;
        if (signal > 0.01) {
            if (params.stimulusErase > 0.5) {
                // [Paint Energy] Eraser mode: damp existing energy within the
                // brush footprint instead of adding new energy.
                let eraseFactor = clamp(1.0 - params.stimulusActive * signal, 0.0, 1.0);
                val = val * eraseFactor;
            } else {
                val = val + params.stimulusActive * signal;
            }
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
    activityTensor[index] = clamp(val, 0.0, 1.0);
}
`;

// [Phase 7] Post-Processing Shaders


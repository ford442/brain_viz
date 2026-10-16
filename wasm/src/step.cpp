// wasm/src/step.cpp
// [Tensor Physics] §6 The step of docs/tensor-physics.md.
//
// ***This file implements the spec.*** Every numbered step below carries the
// spec section it implements, and the JavaScript reference stepper in
// ../../src/physics/tensor-field.js carries the same markers on the same steps.
// Changing one without the other breaks `npm run test:golden`.

#include "engine.h"
#include "region.h"

namespace bte {

void step(BrainTensorEngine& eng)
{
    const BrainTensorParams& p = eng.params;
    const uint32_t dim = eng.voxelDim;
    const uint32_t dim2 = dim * dim;
    const uint32_t total = eng.voxelCount;
    const float* data = eng.tensor.data();
    float* out = eng.scratch.data();
    const StencilRow& row = eng.row;

    const float voxelStep = (BRAIN_RANGE / static_cast<float>(dim)) * 0.9f;
    const bool hasFibers = eng.fibers.size() >= static_cast<size_t>(total) * FIBER_STRIDE;
    const bool synaptiX = p.synaptiXActive > 0.5f && eng.aiTensor.size() >= total;
    const int32_t frame = static_cast<int32_t>(eng.frame);

    const HypoxiaPhysics hyp = get_hypoxia_physics(p.hypoxiaStress, p.metabolicRate,
                                                   p.mitochondrialFunction);
    // §3.4 Neuromodulation: global scales here, the per-lobe term per voxel.
    const Neuromodulation nm = get_neuromodulation(p.decayRate, p.diffusionRate);
    const float isotropicMix = spread(0.7f, nm.diffusionScale);
    const float couplingMix = std::min(spread(clampf(0.45f + p.fiberCoupling * 0.35f, 0.0f, 0.92f),
                                              nm.diffusionScale), 0.92f);
    const float criticality = avalanche_criticality(p.cognitiveLoad, p.stress, p.fluidActive);
    // §6.11 Ambient drive — the low-amplitude heartbeat between stimuli.
    const float ambientWave = std::sin(p.time * p.frequency) * 0.5f + 0.5f;
    // §6.6 constants.
    const float phaseSpeed = 4.0f;
    const float waveFreq = 6.2832f;

    // ── Per-step hoists (engine.h AxisTables). Same expressions, same inputs. ──
    // §3.4 The regional retention term depends on the zone alone: 5 exp2 calls
    // per step rather than one per voxel.
    float retentionScale[5];
    for (uint32_t zone = 0; zone < 5u; ++zone) retentionScale[zone] = retention_loss_scale(zone, p.retentionBias);

    const AxisTables& axis = eng.axis;
    const float fluidTs = p.time * 2.0f;
    for (uint32_t i = 0; i < dim; ++i) {
        const float w = voxel_to_world(i, dim);
        const float np = clamp01((w / BRAIN_RANGE) * 0.5f + 0.5f);
        // §6.6 The no-tract wave reads npy only.
        axis.waveY[i] = std::sin(np * waveFreq - p.time * phaseSpeed) * 0.5f + 0.5f;
        // §6.8 Each velocity component is a product of single-axis factors.
        if (p.fluidActive > 0.0f) {
            axis.fluidSinY3[i] = std::sin(w * 3.0f + fluidTs);
            axis.fluidCosY3[i] = std::cos(w * 3.0f - fluidTs);
            axis.fluidCosZ2[i] = std::cos(w * 2.0f - fluidTs);
            axis.fluidSinZ2[i] = std::sin(w * 2.0f + fluidTs);
            axis.fluidCosX3[i] = std::cos(w * 3.0f - fluidTs);
            axis.fluidSinX2[i] = std::sin(w * 2.0f + fluidTs);
        }
    }

    for (uint32_t z = 0; z < dim; ++z) {
    const float wz = voxel_to_world(z, dim);
    const float npz = clamp01((wz / BRAIN_RANGE) * 0.5f + 0.5f);
    for (uint32_t y = 0; y < dim; ++y) {
    const float wy = voxel_to_world(y, dim);
    const float npy = clamp01((wy / BRAIN_RANGE) * 0.5f + 0.5f);

    // §6.2 Clamped 6-neighbourhood, a whole row at a time (stencil.cpp).
    stencil_row(data, dim, y, z, row);

    for (uint32_t x = 0; x < dim; ++x) {
        const uint32_t index = z * dim2 + y * dim + x;
        const float wx = voxel_to_world(x, dim);
        const float npx = clamp01((wx / BRAIN_RANGE) * 0.5f + 0.5f);

        float val = data[index];

        // §6.1 Region physics, neuromodulated (§3.4), then modulated by hypoxia.
        const RegionPhysics region = get_region_physics(wx, wy, wz, p.style);
        const float lossScale = nm.lossScale * retentionScale[region_zone(wx, wy, wz)];
        float decay = clamp01(1.0f - (1.0f - region.decay) * lossScale) * hyp.decayMod;
        float diffusion = region.diffusion * nm.diffusionScale * hyp.diffusionMod;
        const float flowBias = region.flowBias;

        const float gradX = row.gradX[x], gradY = row.gradY[x], gradZ = row.gradZ[x];
        const float gnx = row.gnx[x], gny = row.gny[x], gnz = row.gnz[x];
        const float avg = row.avg[x];

        // §6.3 Multi-direction anisotropic diffusion along fiber tracts.
        float directionalTransport = 0.0f;
        float isotropicLeak = avg;
        float crossingMix = 0.0f;
        float totalFiberWeight = 0.0f;
        float primaryX = 0.0f, primaryY = 0.0f, primaryZ = 0.0f, primaryW = 0.0f;

        if (hasFibers) {
            const size_t fb = static_cast<size_t>(index) * FIBER_STRIDE;
            primaryX = eng.fibers[fb + 0];
            primaryY = eng.fibers[fb + 1];
            primaryZ = eng.fibers[fb + 2];
            primaryW = eng.fibers[fb + 3];

            for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                const size_t b = fb + slot * 4u;
                const float weight = eng.fibers[b + 3];
                if (weight < 0.01f) continue;
                const float fx = eng.fibers[b + 0], fy = eng.fibers[b + 1], fz = eng.fibers[b + 2];

                const float alongSample = eng.sample_directional(wx, wy, wz, fx, fy, fz, voxelStep);
                const float along = std::fabs(gnx * fx + gny * fy + gnz * fz);
                directionalTransport += alongSample * weight * mixf(0.75f, 1.35f, along);
                isotropicLeak -= std::fabs(gradX * fx + gradY * fy + gradZ * fz) * diffusion * weight * 0.08f;
                crossingMix = std::max(crossingMix, weight * (1.0f - along));
                totalFiberWeight += weight;
            }
        }

        if (totalFiberWeight > 0.0f) {
            directionalTransport /= totalFiberWeight;
            const float tractBias = clamp01(totalFiberWeight * (0.7f + crossingMix * 0.55f));
            const float diffused = mixf(avg, directionalTransport, tractBias);
            val = mixf(val, diffused, couplingMix);
            val -= (avg - isotropicLeak) * clamp01(p.fiberCoupling) * 0.16f;
        } else {
            val = mixf(val, avg, isotropicMix);
        }

        // §6.4 Highway bias: sustained transport along dominant tracts.
        if (hasFibers && p.fiberCoupling > 0.0f) {
            const size_t fb = static_cast<size_t>(index) * FIBER_STRIDE;
            for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                const size_t b = fb + slot * 4u;
                const float weight = eng.fibers[b + 3];
                if (weight < 0.01f) continue;
                const float fx = eng.fibers[b + 0], fy = eng.fibers[b + 1], fz = eng.fibers[b + 2];

                const float ux = wx - fx * voxelStep, uy = wy - fy * voxelStep, uz = wz - fz * voxelStep;
                const float dx = wx + fx * voxelStep, dy = wy + fy * voxelStep, dz = wz + fz * voxelStep;
                const float upVal = eng.sample(eng.tensor, ux, uy, uz);
                const float downVal = eng.sample(eng.tensor, dx, dy, dz);
                const float centerDrive = std::max(val, std::max(upVal, downVal));
                val += std::max(upVal, downVal) * weight * p.fiberCoupling * 0.34f;
                val += centerDrive * weight * p.fiberCoupling * 0.12f;
                if (synaptiX) {
                    const float aiUp = eng.sample(eng.aiTensor, ux, uy, uz);
                    const float aiDown = eng.sample(eng.aiTensor, dx, dy, dz);
                    val += std::max(aiUp, aiDown) * weight * p.aiInfluence * p.fiberCoupling * 0.18f;
                }
            }
        }

        // §6.5 Criticality cascades. §8.2: the WGSL `step()` gate becomes a
        // narrow smoothstep so the threshold cannot flip on a 1-ulp difference.
        const float localPeak = std::max(val, row.nbrPeak[x]);
        const float avalancheThreshold = p.spikeThreshold * mixf(1.08f, 0.72f, criticality);
        const float seeded = smoothstepf(avalancheThreshold, avalancheThreshold + kCascadeGateWidth, localPeak);
        const float cascadeNoise = 0.72f + 0.28f * hash_voxel(static_cast<int32_t>(x),
                                                              static_cast<int32_t>(y),
                                                              static_cast<int32_t>(z),
                                                              frame + 0x51ed);
        float branchBias = 0.5f;
        if (primaryW > 0.01f) {
            branchBias = clamp01(0.5f + 0.5f * (gnx * primaryX + gny * primaryY + gnz * primaryZ));
        }
        const float cascade = seeded * cascadeNoise * mixf(0.18f, 1.0f, branchBias)
                            * (0.35f + criticality * 0.85f);
        // Blended by `cascade`, not gated on `cascade > 0` — see the matching
        // comment in src/physics/tensor-field.js: the gate turned a continuous
        // term into a cliff that amplified rounding into tenths of a unit.
        const float cascadeMix = clamp01(cascade);
        const float boosted = std::max(val, localPeak * 0.84f + cascade * (0.42f + localPeak * 0.5f));
        val = mixf(val, boosted, cascadeMix) + cascade * branchBias * 0.48f;
        diffusion *= mixf(1.0f, 1.32f, cascade);
        decay *= mixf(1.0f, mixf(0.94f, 0.82f, criticality), cascade);

        // §6.6 Traveling phase wave along the strongest tract (or along y,
        // from the per-step table, where there is none).
        const float travelingWave = (primaryW > 0.01f)
            ? std::sin((npx * primaryX + npy * primaryY + npz * primaryZ) * waveFreq - p.time * phaseSpeed) * 0.5f + 0.5f
            : axis.waveY[y];
        val += val * (travelingWave - 0.5f) * 0.08f;

        // §6.7 Directional flow bias (frontal lobe draws from upstream +Z).
        if (flowBias < -0.1f && z < dim - 1u) {
            val = mixf(val, data[(z + 1u) * dim2 + y * dim + x], diffusion * 0.4f);
        }

        // §6.8 Procedural fluid advection.
        if (p.fluidActive > 0.0f) {
            const float scale = 0.5f * p.fluidActive;
            const float fvx = axis.fluidSinY3[y] * axis.fluidCosZ2[z] * scale;
            const float fvy = axis.fluidCosX3[x] * axis.fluidSinZ2[z] * scale;
            const float fvz = axis.fluidSinX2[x] * axis.fluidCosY3[y] * scale;
            const float upstream = eng.sample_trilinear(eng.tensor, wx - fvx, wy - fvy, wz - fvz);
            val = mixf(val, upstream, std::min(1.0f, p.fluidActive * 0.5f));
        }

        // §6.9 Stimulus injection (paint radius + eraser).
        if (p.stimulusActive > 0.0f) {
            const float dx = wx - p.stimulusPos[0];
            const float dy = wy - p.stimulusPos[1];
            const float dz = wz - p.stimulusPos[2];
            const float d = std::sqrt(dx * dx + dy * dy + dz * dz);
            const float sigma = p.stimulusRadius > 0.0001f ? p.stimulusRadius : 0.5f;
            const float signal = gaussian_pulse(d, sigma) * p.mitochondrialFunction;
            // §8.4: WGSL early-outs at `signal > 0.01`; the CPU model applies the
            // whole Gaussian so the brush's outer ring cannot disagree by a full
            // 0.01 * intensity between implementations.
            if (p.stimulusErase > 0.5f) {
                val *= clamp01(1.0f - p.stimulusActive * signal);
            } else {
                val += p.stimulusActive * signal;
            }
        }

        // §6.10 Environmental hazards. §8.1: the electrical spike is seeded from
        // the integer voxel hash, not WGSL's sin-hash of worldPosition.xy.
        if (p.electricalActive > 0.0f) {
            if (hash_voxel(static_cast<int32_t>(x), static_cast<int32_t>(y),
                           static_cast<int32_t>(z), frame + 0x9e37) > 0.95f) {
                val += p.electricalActive * 5.0f;
            }
        }
        if (p.mercuryActive > 0.0f) {
            const float mz = wz + 1.2f;
            const float dMerc = std::sqrt(wx * wx + wy * wy + mz * mz);
            val += p.mercuryActive * gaussian_pulse(dMerc, 1.2f) * 0.5f;
            decay = std::min(decay, 0.999f);
        }
        if (p.heavyMetal > 0.0f) {
            val = std::min(val, 1.0f - p.heavyMetal * 0.8f);
            decay = std::min(decay, 0.999f - p.heavyMetal * 0.05f);
        }

        // §6.11 Ambient drive — cortically weighted.
        const float radial = std::sqrt(wx * wx + wy * wy + wz * wz) / BRAIN_RANGE;
        const float corticalBias = 1.0f - smoothstepf(0.1f, 0.95f, radial);
        val += (ambientWave - 0.5f) * p.amplitude * (0.02f + corticalBias * 0.04f);

        // §6.12 SynaptiX AI mirror.
        if (synaptiX) {
            const float aiVal = eng.sample(eng.aiTensor, wx, wy, wz);
            if (aiVal * p.aiInfluence > 0.0005f || val > 0.0005f) {
                const RegionPhysics aiRegion = get_region_physics(wx, wy, wz, 1.0f);
                const float aiDiffusionBias = clamp01(aiRegion.diffusion / 0.15f);
                const float aiGeometricDecay = mixf(1.18f, 0.86f, aiDiffusionBias);
                const float aiSparsity = smoothstepf(0.14f, 0.82f, aiVal);
                const float aiPhase = hash_voxel(static_cast<int32_t>(x), static_cast<int32_t>(y),
                                                 static_cast<int32_t>(z), frame + 0x27d4);
                const float aiSpike = smoothstepf(0.72f, 0.98f, aiPhase) * aiSparsity
                                    * (0.35f + p.aiInfluence * 0.65f);
                float processedAI = std::pow(clamp01(aiVal), aiGeometricDecay) * mixf(0.7f, 1.28f, aiSparsity);
                processedAI = clamp01(processedAI + aiSpike * 0.28f);

                float blended = mixf(val, processedAI, p.aiInfluence);
                const float diff = std::fabs(val - processedAI);
                if (diff < p.resonanceThreshold) {
                    const float resonanceSoft = 1.0f - smoothstepf(0.0f, p.resonanceThreshold, diff);
                    blended += (0.22f + 0.58f * resonanceSoft) * std::max(val, processedAI);
                }
                const float divergence = smoothstepf(p.resonanceThreshold * 1.75f,
                                                     p.resonanceThreshold * 4.0f, diff);
                val = blended * (1.0f - divergence * 0.18f);
            }
        }

        // §6.13 Decay and clamp.
        out[index] = clamp01(val * decay);
    }
    }
    }

    std::swap(eng.tensor, eng.scratch);
    eng.frame += 1u;
}

} // namespace bte

// wasm/src/region.h
// [Tensor Physics] §3 Region, hypoxia, criticality and neuromodulation physics
// of docs/tensor-physics.md.
//
// Inline for the same reason as field_math.h: get_region_physics() and
// region_zone() run once per voxel per step.
#pragma once

#include "field_math.h"

#include <algorithm>

namespace bte {

struct RegionPhysics { float decay; float diffusion; float flowBias; };

// §3.1 zone indices. 1–4 index retentionBias[] as zone - 1.
enum RegionZone : uint32_t {
    ZONE_DEFAULT = 0u, ZONE_FRONTAL = 1u, ZONE_OCCIPITAL = 2u, ZONE_TEMPORAL = 3u, ZONE_PARIETAL = 4u,
};

// §3.1 regionZone(worldPosition) — the one place the zone tests are written;
// get_region_physics() and the §3.4 regional retention both read it.
inline uint32_t region_zone(float wx, float wy, float wz)
{
    if (wz > 0.5f) return ZONE_FRONTAL;
    if (wz < -0.5f) return ZONE_OCCIPITAL;
    if (std::fabs(wx) > 0.8f) return ZONE_TEMPORAL;
    if (wy > 0.6f) return ZONE_PARIETAL;
    return ZONE_DEFAULT;
}

// §3.1 getRegionPhysics(worldPosition, style) — the 2-argument signature from
// render-shared.js. (The 4-argument neuromodulator fork that once lived in
// src/shaders/shared.js is gone; do not resurrect it here — neuromodulation is
// §3.4, applied on top of this table.)
inline RegionPhysics get_region_physics(float wx, float wy, float wz, float style)
{
    RegionPhysics r{0.96f, 0.10f, 0.0f};

    const uint32_t zone = region_zone(wx, wy, wz);
    if (zone == ZONE_FRONTAL) {             // Frontal: hyper-retention
        r.decay = 0.998f; r.diffusion = 0.15f; r.flowBias = -1.0f;
    } else if (zone == ZONE_OCCIPITAL) {    // Occipital: fast visual processing
        r.decay = 0.92f; r.diffusion = 0.04f;
    } else if (zone == ZONE_TEMPORAL) {     // Temporal: auditory / memory
        r.decay = 0.95f;
    } else if (zone == ZONE_PARIETAL) {     // Parietal: sensory integration
        r.decay = 0.94f; r.diffusion = 0.12f;
    }

    if (std::fabs(style - 1.0f) < 0.1f) {   // Cyber mode: digital signal logic
        r.diffusion = 0.05f; r.decay = 0.92f; r.flowBias = 0.0f;
    }
    return r;
}

struct HypoxiaPhysics { float decayMod; float diffusionMod; float freqBoost; };

// §3.2 getHypoxiaPhysics()
inline HypoxiaPhysics get_hypoxia_physics(float hypoxiaStress, float metabolicRate,
                                          float mitochondrialFn)
{
    HypoxiaPhysics h{};
    h.decayMod = 0.96f - hypoxiaStress * 0.08f * metabolicRate * (1.0f - mitochondrialFn);
    h.diffusionMod = std::max(0.01f, 1.0f - hypoxiaStress * 0.5f);
    h.freqBoost = hypoxiaStress * 2.0f * (1.0f - hypoxiaStress * 0.5f);
    return h;
}

// §3.3 avalancheCriticality()
inline float avalanche_criticality(float cognitiveLoad, float stress, float fluidActive)
{
    return clamp01(cognitiveLoad * 0.75f + stress * 0.9f + fluidActive * 0.35f);
}

// §3.4 Neuromodulation baselines — the renderer defaults, at which every scale
// is exactly 1. Mirror DECAY_RATE_BASELINE / DIFFUSION_RATE_BASELINE /
// RETENTION_BASELINE in src/physics/tensor-field.js.
constexpr float kDecayRateBaseline = 0.96f;
constexpr float kDiffusionRateBaseline = 0.1f;
constexpr float kRetentionBaseline[4] = {0.5f, 0.0f, 0.2f, 0.2f};

struct Neuromodulation { float lossScale; float diffusionScale; };

// §3.4 The global scales. (1 - d) / (1 - d) and d / d are exactly 1, which is
// what keeps the pre-§3.4 fixture matching at the defaults.
inline Neuromodulation get_neuromodulation(float decayRate, float diffusionRate)
{
    Neuromodulation n{};
    n.lossScale = clampf((1.0f - decayRate) / (1.0f - kDecayRateBaseline), 0.0f, 8.0f);
    n.diffusionScale = clampf(diffusionRate / kDiffusionRateBaseline, 0.0f, 4.0f);
    return n;
}

// §3.4 regionalLoss = exp2(-retention); the Default zone is never modulated.
inline float retention_loss_scale(uint32_t zone, const float retentionBias[4])
{
    if (zone == ZONE_DEFAULT) return 1.0f;
    const float retention = clampf(retentionBias[zone - 1u] - kRetentionBaseline[zone - 1u], -2.0f, 2.0f);
    return std::exp2(-retention);
}

// §3.4 spread(m, s): scales the odds of mix factor m by s; exactly m at s = 1.
inline float spread(float m, float s)
{
    return (m * s) / (1.0f + m * (s - 1.0f));
}

} // namespace bte

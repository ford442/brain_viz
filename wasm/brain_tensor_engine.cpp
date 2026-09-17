// brain_tensor_engine.cpp
// [Tensor Physics] BrainTensorEngine — C++ implementation of the Neuro-Weaver
// volumetric neural field.
//
// ***This file implements ../docs/tensor-physics.md.*** Every numbered step
// below carries the spec section it implements, and the JavaScript reference
// stepper in ../src/physics/tensor-field.js carries the same markers on the
// same steps. Changing one without the other breaks `npm run test:golden`,
// which is the point: this engine used to claim it mirrored the WGSL shader
// "step for step" while implementing a Phase 1 subset of it.
//
// Build: see ../scripts/build_wasm.sh (the authoritative command — this comment
// deliberately does not restate the em++ line, because the two used to drift).
// The same source also compiles natively with any C++17 compiler, which is how
// wasm/tests/golden_step_test.cpp validates it without Emscripten.

#include "brain_tensor_engine.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstring>
#include <vector>

// ─── §1 Constants (mirror render-shared.js CONSTANTS) ─────────────────────
static constexpr float BRAIN_RANGE = 1.6f;
static constexpr uint32_t VOXEL_DIM_DEFAULT = 32u;
static constexpr uint32_t FIBER_SLOTS = 3u;
static constexpr uint32_t FIBER_STRIDE = FIBER_SLOTS * 4u;
// §8.2 Width of the soft band replacing WGSL's hard step() cascade gate.
static constexpr float kCascadeGateWidth = 0.01f;

// ─── §2 Scalar helpers ─────────────────────────────────────────────────────

static inline float clampf(float v, float lo, float hi)
{
    return v < lo ? lo : (v > hi ? hi : v);
}

static inline float clamp01(float v) { return clampf(v, 0.0f, 1.0f); }

static inline float mixf(float a, float b, float t) { return a + (b - a) * t; }

static inline float smoothstepf(float edge0, float edge1, float x)
{
    if (edge1 == edge0) return x < edge0 ? 0.0f : 1.0f;
    const float t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3.0f - 2.0f * t);
}

static inline float gaussian_pulse(float dist, float width)
{
    const float k = 4.0f / (width * width);
    return std::exp(-k * dist * dist);
}

// §8.1 Integer voxel hash. Replaces WGSL's fract(sin(dot(p,k)) * 43758.5453),
// which cannot agree between implementations (a 1-ulp difference in sin gives a
// completely different result after the multiply-and-fract). Bit-identical to
// hashVoxel() in src/physics/tensor-field.js.
static inline float hash_voxel(int32_t x, int32_t y, int32_t z, int32_t salt)
{
    uint32_t h = static_cast<uint32_t>(x) * 0x8da6b343u ^
                 static_cast<uint32_t>(y) * 0xd8163841u ^
                 static_cast<uint32_t>(z) * 0xcb1ab31fu ^
                 static_cast<uint32_t>(salt) * 0x165667b1u;
    h ^= h >> 15;
    h *= 0x2c1b3c6du;
    h ^= h >> 12;
    h *= 0x297a2d39u;
    h ^= h >> 15;
    return static_cast<float>(h >> 8) / 16777216.0f;
}

// ─── §3 Region and hypoxia physics ─────────────────────────────────────────

struct RegionPhysics { float decay; float diffusion; float flowBias; };

// §3.1 getRegionPhysics(worldPosition, style) — the 2-argument signature from
// render-shared.js. (The 4-argument neuromodulator fork that once lived in
// src/shaders/shared.js is gone; do not resurrect it here.)
static inline RegionPhysics get_region_physics(float wx, float wy, float wz, float style)
{
    RegionPhysics r{0.96f, 0.10f, 0.0f};

    if (wz > 0.5f) {                        // Frontal: hyper-retention
        r.decay = 0.998f; r.diffusion = 0.15f; r.flowBias = -1.0f;
    } else if (wz < -0.5f) {                // Occipital: fast visual processing
        r.decay = 0.92f; r.diffusion = 0.04f;
    } else if (std::fabs(wx) > 0.8f) {      // Temporal: auditory / memory
        r.decay = 0.95f;
    } else if (wy > 0.6f) {                 // Parietal: sensory integration
        r.decay = 0.94f; r.diffusion = 0.12f;
    }

    if (std::fabs(style - 1.0f) < 0.1f) {   // Cyber mode: digital signal logic
        r.diffusion = 0.05f; r.decay = 0.92f; r.flowBias = 0.0f;
    }
    return r;
}

struct HypoxiaPhysics { float decayMod; float diffusionMod; float freqBoost; };

// §3.2 getHypoxiaPhysics()
static inline HypoxiaPhysics get_hypoxia_physics(float hypoxiaStress, float metabolicRate,
                                                 float mitochondrialFn)
{
    HypoxiaPhysics h{};
    h.decayMod = 0.96f - hypoxiaStress * 0.08f * metabolicRate * (1.0f - mitochondrialFn);
    h.diffusionMod = std::max(0.01f, 1.0f - hypoxiaStress * 0.5f);
    h.freqBoost = hypoxiaStress * 2.0f * (1.0f - hypoxiaStress * 0.5f);
    return h;
}

// §3.3 avalancheCriticality()
static inline float avalanche_criticality(float cognitiveLoad, float stress, float fluidActive)
{
    return clamp01(cognitiveLoad * 0.75f + stress * 0.9f + fluidActive * 0.35f);
}

// ─── Engine ────────────────────────────────────────────────────────────────

struct BrainTensorEngine {
    uint32_t voxelDim;
    uint32_t voxelCount;
    uint32_t frame;
    BrainTensorParams params;
    std::vector<float> tensor;    // current step
    std::vector<float> scratch;   // destination (never aliases `tensor`)
    std::vector<float> fibers;    // voxelCount * FIBER_STRIDE, empty = isotropic
    std::vector<float> aiTensor;  // voxelCount, empty = no SynaptiX partner

    explicit BrainTensorEngine(uint32_t dim)
        : voxelDim(dim)
        , voxelCount(dim * dim * dim)
        , frame(0u)
        , params{}
        , tensor(static_cast<size_t>(dim) * dim * dim, 0.0f)
        , scratch(static_cast<size_t>(dim) * dim * dim, 0.0f)
    {
        // Defaults mirror DEFAULT_FIELD_PARAMS in src/physics/tensor-field.js;
        // a zeroed struct would give a zero mitochondrialFunction and kill every
        // stimulus before the renderer's first upload.
        params.voxelDim = dim;
        params.frequency = 2.0f;
        params.amplitude = 0.5f;
        params.spikeThreshold = 0.6f;
        params.smoothing = 0.9f;
        params.metabolicRate = 1.0f;
        params.mitochondrialFunction = 1.0f;
        params.resonanceThreshold = 0.2f;
        params.fiberCoupling = 0.5f;
    }

    inline uint32_t idx(uint32_t x, uint32_t y, uint32_t z) const
    {
        return z * voxelDim * voxelDim + y * voxelDim + x;
    }

    // §4.2 Nearest-voxel world-space sample; outside the cube reads as 0.
    inline float sample(const std::vector<float>& f, float wx, float wy, float wz) const
    {
        const float nx = (wx / BRAIN_RANGE) * 0.5f + 0.5f;
        const float ny = (wy / BRAIN_RANGE) * 0.5f + 0.5f;
        const float nz = (wz / BRAIN_RANGE) * 0.5f + 0.5f;
        if (nx < 0.0f || ny < 0.0f || nz < 0.0f || nx > 1.0f || ny > 1.0f || nz > 1.0f) return 0.0f;
        const uint32_t x = std::min(voxelDim - 1u, static_cast<uint32_t>(nx * static_cast<float>(voxelDim)));
        const uint32_t y = std::min(voxelDim - 1u, static_cast<uint32_t>(ny * static_cast<float>(voxelDim)));
        const uint32_t z = std::min(voxelDim - 1u, static_cast<uint32_t>(nz * static_cast<float>(voxelDim)));
        return f[idx(x, y, z)];
    }

    // §4.4 Trilinear world-space sample — fluid advection only. See spec §8.3:
    // its coordinate comes out of sin/cos, and a nearest-voxel read would turn a
    // 1-ulp libm difference into a whole-voxel difference in the value.
    inline float sample_trilinear(const std::vector<float>& f, float wx, float wy, float wz) const
    {
        const float fdim = static_cast<float>(voxelDim);
        const float gx = ((wx / BRAIN_RANGE) * 0.5f + 0.5f) * fdim - 0.5f;
        const float gy = ((wy / BRAIN_RANGE) * 0.5f + 0.5f) * fdim - 0.5f;
        const float gz = ((wz / BRAIN_RANGE) * 0.5f + 0.5f) * fdim - 0.5f;
        const float fx0 = std::floor(gx), fy0 = std::floor(gy), fz0 = std::floor(gz);
        const float tx = gx - fx0, ty = gy - fy0, tz = gz - fz0;
        const int32_t hi = static_cast<int32_t>(voxelDim) - 1;
        auto cl = [hi](float v) { const int32_t i = static_cast<int32_t>(v); return static_cast<uint32_t>(i < 0 ? 0 : (i > hi ? hi : i)); };
        const uint32_t x0 = cl(fx0), x1 = cl(fx0 + 1.0f);
        const uint32_t y0 = cl(fy0), y1 = cl(fy0 + 1.0f);
        const uint32_t z0 = cl(fz0), z1 = cl(fz0 + 1.0f);
        const float x00 = mixf(f[idx(x0, y0, z0)], f[idx(x1, y0, z0)], tx);
        const float x10 = mixf(f[idx(x0, y1, z0)], f[idx(x1, y1, z0)], tx);
        const float x01 = mixf(f[idx(x0, y0, z1)], f[idx(x1, y0, z1)], tx);
        const float x11 = mixf(f[idx(x0, y1, z1)], f[idx(x1, y1, z1)], tx);
        return mixf(mixf(x00, x10, ty), mixf(x01, x11, ty), tz);
    }

    // §4.3 sampleDirectionalActivity() — biased 3-tap read along a unit `axis`.
    inline float sample_directional(float wx, float wy, float wz,
                                    float nx, float ny, float nz, float step) const
    {
        const float center = sample(tensor, wx, wy, wz);
        const float forward = sample(tensor, wx + nx * step, wy + ny * step, wz + nz * step);
        const float backward = sample(tensor, wx - nx * step, wy - ny * step, wz - nz * step);
        return center * 0.34f + std::max(forward, backward) * 0.46f + std::min(forward, backward) * 0.20f;
    }
};

// ─── Public API ────────────────────────────────────────────────────────────

extern "C" {

void* bte_create(uint32_t voxelDim)
{
    if (voxelDim == 0u) voxelDim = VOXEL_DIM_DEFAULT;
    return static_cast<void*>(new BrainTensorEngine(voxelDim));
}

void bte_destroy(void* engine)
{
    delete static_cast<BrainTensorEngine*>(engine);
}

uint32_t bte_params_byte_size(void)
{
    return static_cast<uint32_t>(sizeof(BrainTensorParams));
}

void bte_set_params(void* engine_ptr, const BrainTensorParams* params)
{
    if (!engine_ptr || !params) return;
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    eng->params = *params;
    // voxelDim is owned by the engine allocation, not by the caller's uniform
    // block; a mismatched value would index out of the tensor.
    eng->params.voxelDim = eng->voxelDim;
}

BrainTensorParams* bte_get_params(void* engine_ptr)
{
    return &static_cast<BrainTensorEngine*>(engine_ptr)->params;
}

// §7.1 Normalise the affinity directions once, at upload. The step reads them
// as unit vectors, so the sample coordinates derived from them are identical to
// the ones normalizeFiberAffinities() produces in
// src/physics/tensor-field.js — the op order here is the contract.
static void normalize_fiber_affinities(std::vector<float>& fibers)
{
    const float DIR_EPSILON = 1e-4f;
    for (size_t b = 0; b + 3 < fibers.size(); b += 4) {
        if (!(fibers[b + 3] >= 0.01f)) continue;
        const float lx = fibers[b + 0] + DIR_EPSILON;
        const float ly = fibers[b + 1] + DIR_EPSILON;
        const float lz = fibers[b + 2] + DIR_EPSILON;
        float len = std::sqrt(lx * lx + ly * ly + lz * lz);
        if (len == 0.0f) len = 1.0f;
        fibers[b + 0] = lx / len;
        fibers[b + 1] = ly / len;
        fibers[b + 2] = lz / len;
    }
}

void bte_set_fiber_affinities(void* engine_ptr, const float* data, uint32_t len)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t expected = eng->voxelCount * FIBER_STRIDE;
    if (!data || len == 0u) { eng->fibers.clear(); return; }
    eng->fibers.assign(expected, 0.0f);
    std::memcpy(eng->fibers.data(), data, std::min(len, expected) * sizeof(float));
    normalize_fiber_affinities(eng->fibers);
}

// §7 Reference tract field — must stay identical to
// makeReferenceFiberAffinities() in src/physics/tensor-field.js.
void bte_fill_reference_fiber_affinities(void* engine_ptr)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t dim = eng->voxelDim;
    eng->fibers.assign(static_cast<size_t>(eng->voxelCount) * FIBER_STRIDE, 0.0f);

    for (uint32_t z = 0; z < dim; ++z) {
        for (uint32_t y = 0; y < dim; ++y) {
            for (uint32_t x = 0; x < dim; ++x) {
                const uint32_t index = eng->idx(x, y, z);
                for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                    const size_t base = static_cast<size_t>(index) * FIBER_STRIDE + slot * 4u;
                    const int32_t s = static_cast<int32_t>(slot) * 7;
                    // Raw directions; normalize_fiber_affinities() below makes
                    // them unit vectors with the same op order as the JS side.
                    eng->fibers[base + 0] = hash_voxel(x, y, z, 1 + s) * 2.0f - 1.0f;
                    eng->fibers[base + 1] = hash_voxel(x, y, z, 2 + s) * 2.0f - 1.0f;
                    eng->fibers[base + 2] = hash_voxel(x, y, z, 3 + s) * 2.0f - 1.0f;
                    const float w = hash_voxel(x, y, z, 4 + s);
                    eng->fibers[base + 3] = (slot == 0u)
                        ? (w > 0.45f ? 0.08f + (w - 0.45f) * 0.30f : 0.0f)
                        : (w > 0.82f ? 0.03f + (w - 0.82f) * 0.30f : 0.0f);
                }
            }
        }
    }
    normalize_fiber_affinities(eng->fibers);
}

void bte_set_ai_tensor(void* engine_ptr, const float* data, uint32_t len)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    if (!data || len == 0u) { eng->aiTensor.clear(); return; }
    eng->aiTensor.assign(eng->voxelCount, 0.0f);
    std::memcpy(eng->aiTensor.data(), data, std::min(len, eng->voxelCount) * sizeof(float));
}

void bte_update(void* engine_ptr)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const BrainTensorParams& p = eng->params;
    const uint32_t dim = eng->voxelDim;
    const uint32_t dim2 = dim * dim;
    const uint32_t total = eng->voxelCount;
    const float* data = eng->tensor.data();
    float* out = eng->scratch.data();

    const float voxelStep = (BRAIN_RANGE / static_cast<float>(dim)) * 0.9f;
    const bool hasFibers = eng->fibers.size() >= static_cast<size_t>(total) * FIBER_STRIDE;
    const bool synaptiX = p.synaptiXActive > 0.5f && eng->aiTensor.size() >= total;
    const int32_t frame = static_cast<int32_t>(eng->frame);

    const HypoxiaPhysics hyp = get_hypoxia_physics(p.hypoxiaStress, p.metabolicRate,
                                                   p.mitochondrialFunction);
    const float criticality = avalanche_criticality(p.cognitiveLoad, p.stress, p.fluidActive);
    // §6.11 Ambient drive — the low-amplitude heartbeat between stimuli.
    const float ambientWave = std::sin(p.time * p.frequency) * 0.5f + 0.5f;

    for (uint32_t index = 0; index < total; ++index) {
        const uint32_t z = index / dim2;
        const uint32_t rem = index % dim2;
        const uint32_t y = rem / dim;
        const uint32_t x = rem % dim;

        const float wx = ((static_cast<float>(x) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wy = ((static_cast<float>(y) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wz = ((static_cast<float>(z) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float npx = clamp01((wx / BRAIN_RANGE) * 0.5f + 0.5f);
        const float npy = clamp01((wy / BRAIN_RANGE) * 0.5f + 0.5f);
        const float npz = clamp01((wz / BRAIN_RANGE) * 0.5f + 0.5f);

        float val = data[index];

        // §6.1 Region physics, modulated by hypoxia.
        const RegionPhysics region = get_region_physics(wx, wy, wz, p.style);
        float decay = region.decay * hyp.decayMod;
        float diffusion = region.diffusion * hyp.diffusionMod;
        const float flowBias = region.flowBias;

        // §6.2 Clamped 6-neighbourhood.
        const uint32_t xm = x > 0u ? x - 1u : 0u;
        const uint32_t xp = x < dim - 1u ? x + 1u : dim - 1u;
        const uint32_t ym = y > 0u ? y - 1u : 0u;
        const uint32_t yp = y < dim - 1u ? y + 1u : dim - 1u;
        const uint32_t zm = z > 0u ? z - 1u : 0u;
        const uint32_t zp = z < dim - 1u ? z + 1u : dim - 1u;

        const float valXm = data[z * dim2 + y * dim + xm];
        const float valXp = data[z * dim2 + y * dim + xp];
        const float valYm = data[z * dim2 + ym * dim + x];
        const float valYp = data[z * dim2 + yp * dim + x];
        const float valZm = data[zm * dim2 + y * dim + x];
        const float valZp = data[zp * dim2 + y * dim + x];

        const float gradX = (valXp - valXm) * 0.5f;
        const float gradY = (valYp - valYm) * 0.5f;
        const float gradZ = (valZp - valZm) * 0.5f;
        const float gx = gradX + 1e-4f, gy = gradY + 1e-4f, gz = gradZ + 1e-4f;
        float gradLen = std::sqrt(gx * gx + gy * gy + gz * gz);
        if (gradLen == 0.0f) gradLen = 1.0f;
        const float gnx = gx / gradLen, gny = gy / gradLen, gnz = gz / gradLen;

        const float avg = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0f;

        // §6.3 Multi-direction anisotropic diffusion along fiber tracts.
        float directionalTransport = 0.0f;
        float isotropicLeak = avg;
        float crossingMix = 0.0f;
        float totalFiberWeight = 0.0f;
        float primaryX = 0.0f, primaryY = 0.0f, primaryZ = 0.0f, primaryW = 0.0f;

        if (hasFibers) {
            const size_t fb = static_cast<size_t>(index) * FIBER_STRIDE;
            primaryX = eng->fibers[fb + 0];
            primaryY = eng->fibers[fb + 1];
            primaryZ = eng->fibers[fb + 2];
            primaryW = eng->fibers[fb + 3];

            for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                const size_t b = fb + slot * 4u;
                const float weight = eng->fibers[b + 3];
                if (weight < 0.01f) continue;
                const float fx = eng->fibers[b + 0], fy = eng->fibers[b + 1], fz = eng->fibers[b + 2];

                const float alongSample = eng->sample_directional(wx, wy, wz, fx, fy, fz, voxelStep);
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
            val = mixf(val, diffused, clampf(0.45f + p.fiberCoupling * 0.35f, 0.0f, 0.92f));
            val -= (avg - isotropicLeak) * clamp01(p.fiberCoupling) * 0.16f;
        } else {
            val = mixf(val, avg, 0.7f);
        }

        // §6.4 Highway bias: sustained transport along dominant tracts.
        if (hasFibers && p.fiberCoupling > 0.0f) {
            const size_t fb = static_cast<size_t>(index) * FIBER_STRIDE;
            for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                const size_t b = fb + slot * 4u;
                const float weight = eng->fibers[b + 3];
                if (weight < 0.01f) continue;
                const float fx = eng->fibers[b + 0], fy = eng->fibers[b + 1], fz = eng->fibers[b + 2];

                const float ux = wx - fx * voxelStep, uy = wy - fy * voxelStep, uz = wz - fz * voxelStep;
                const float dx = wx + fx * voxelStep, dy = wy + fy * voxelStep, dz = wz + fz * voxelStep;
                const float upVal = eng->sample(eng->tensor, ux, uy, uz);
                const float downVal = eng->sample(eng->tensor, dx, dy, dz);
                const float centerDrive = std::max(val, std::max(upVal, downVal));
                val += std::max(upVal, downVal) * weight * p.fiberCoupling * 0.34f;
                val += centerDrive * weight * p.fiberCoupling * 0.12f;
                if (synaptiX) {
                    const float aiUp = eng->sample(eng->aiTensor, ux, uy, uz);
                    const float aiDown = eng->sample(eng->aiTensor, dx, dy, dz);
                    val += std::max(aiUp, aiDown) * weight * p.aiInfluence * p.fiberCoupling * 0.18f;
                }
            }
        }

        // §6.5 Criticality cascades. §8.2: the WGSL `step()` gate becomes a
        // narrow smoothstep so the threshold cannot flip on a 1-ulp difference.
        const float localPeak = std::max(std::max(std::max(val, valXm), valXp),
                                         std::max(std::max(valYm, valYp), std::max(valZm, valZp)));
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

        // §6.6 Traveling phase wave along the strongest tract.
        const float phaseSpeed = 4.0f;
        const float waveFreq = 6.2832f;
        const float spatialPhase = (primaryW > 0.01f)
            ? (npx * primaryX + npy * primaryY + npz * primaryZ) * waveFreq
            : npy * waveFreq;
        const float travelingWave = std::sin(spatialPhase - p.time * phaseSpeed) * 0.5f + 0.5f;
        val += val * (travelingWave - 0.5f) * 0.08f;

        // §6.7 Directional flow bias (frontal lobe draws from upstream +Z).
        if (flowBias < -0.1f && z < dim - 1u) {
            val = mixf(val, data[(z + 1u) * dim2 + y * dim + x], diffusion * 0.4f);
        }

        // §6.8 Procedural fluid advection.
        if (p.fluidActive > 0.0f) {
            const float ts = p.time * 2.0f;
            const float scale = 0.5f * p.fluidActive;
            const float fvx = std::sin(wy * 3.0f + ts) * std::cos(wz * 2.0f - ts) * scale;
            const float fvy = std::cos(wx * 3.0f - ts) * std::sin(wz * 2.0f + ts) * scale;
            const float fvz = std::sin(wx * 2.0f + ts) * std::cos(wy * 3.0f - ts) * scale;
            const float upstream = eng->sample_trilinear(eng->tensor, wx - fvx, wy - fvy, wz - fvz);
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
            const float aiVal = eng->sample(eng->aiTensor, wx, wy, wz);
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

    std::swap(eng->tensor, eng->scratch);
    eng->frame += 1u;
}

void bte_inject_stimulus(void* engine_ptr,
                         float x, float y, float z,
                         float intensity, float radius, float erase,
                         float mitochondrialFn)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t dim = eng->voxelDim;
    const uint32_t dim2 = dim * dim;
    float* data = eng->tensor.data();
    const float sigma = radius > 0.0001f ? radius : 0.5f;

    for (uint32_t index = 0; index < eng->voxelCount; ++index) {
        const uint32_t iz = index / dim2;
        const uint32_t rem = index % dim2;
        const uint32_t iy = rem / dim;
        const uint32_t ix = rem % dim;

        const float wx = ((static_cast<float>(ix) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wy = ((static_cast<float>(iy) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wz = ((static_cast<float>(iz) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;

        const float dx = wx - x, dy = wy - y, dz = wz - z;
        const float dist = std::sqrt(dx * dx + dy * dy + dz * dz);
        const float signal = gaussian_pulse(dist, sigma) * mitochondrialFn;
        if (signal > 0.01f) {
            data[index] = (erase > 0.5f)
                ? data[index] * clamp01(1.0f - intensity * signal)
                : std::min(1.0f, data[index] + intensity * signal);
        }
    }
}

void bte_get_tensor_data(void* engine_ptr, float* outBuffer, uint32_t bufferLen)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    std::memcpy(outBuffer, eng->tensor.data(), std::min(bufferLen, eng->voxelCount) * sizeof(float));
}

void bte_set_tensor_data(void* engine_ptr, const float* data, uint32_t len)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    if (!data) return;
    std::fill(eng->tensor.begin(), eng->tensor.end(), 0.0f);
    std::memcpy(eng->tensor.data(), data, std::min(len, eng->voxelCount) * sizeof(float));
}

void bte_reset(void* engine_ptr)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    std::fill(eng->tensor.begin(), eng->tensor.end(), 0.0f);
    std::fill(eng->scratch.begin(), eng->scratch.end(), 0.0f);
    eng->frame = 0u;
}

uint32_t bte_get_voxel_count(void* engine_ptr)
{
    return static_cast<BrainTensorEngine*>(engine_ptr)->voxelCount;
}

uint32_t bte_get_voxel_dim(void* engine_ptr)
{
    return static_cast<BrainTensorEngine*>(engine_ptr)->voxelDim;
}

uint32_t bte_get_frame(void* engine_ptr)
{
    return static_cast<BrainTensorEngine*>(engine_ptr)->frame;
}

void bte_set_frame(void* engine_ptr, uint32_t frame)
{
    static_cast<BrainTensorEngine*>(engine_ptr)->frame = frame;
}

double bte_benchmark(void* engine_ptr, uint32_t steps, float dt)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const auto start = std::chrono::high_resolution_clock::now();
    for (uint32_t i = 0; i < steps; ++i) {
        eng->params.time = static_cast<float>(i) * dt;
        bte_update(engine_ptr);
    }
    const auto end = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(end - start).count();
}

} // extern "C"

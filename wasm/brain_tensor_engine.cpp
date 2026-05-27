// brain_tensor_engine.cpp
// [Phase 1 WASM] BrainTensorEngine — C++ implementation for Neuro-Weaver volumetric tensor simulation.
//
// Mirrors the WGSL compute shader logic (shaders.js) exactly so that the visual output is
// identical whether driven by the WebGPU compute path or the WASM path.
//
// Compile with Emscripten:
//   em++ -O2 -std=c++17 brain_tensor_engine.cpp -o brain_tensor_engine.js \
//        -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["cwrap","getValue","setValue"]' \
//        -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME='BrainTensorEngineModule'
//
// See ../../scripts/build_wasm.sh for the authoritative build command.

#include "brain_tensor_engine.h"

#include <cmath>
#include <cstring>
#include <chrono>
#include <vector>
#include <algorithm>

// ─── Constants (mirror shaders.js CONSTANTS block) ────────────────────────
static constexpr float BRAIN_RANGE  = 1.6f;
static constexpr uint32_t VOXEL_DIM_DEFAULT = 32u;

// ─── Internal helpers (mirror shaders.js HELPERS block) ───────────────────

static inline float gaussian_pulse(float dist, float width)
{
    const float k = 4.0f / (width * width);
    return std::exp(-k * dist * dist);
}

// Returns (decay, diffusion, flowBias) — mirrors getRegionPhysics in WGSL
static inline void get_region_physics(float wx, float wy, float wz,
                                      float style,
                                      float& decay, float& diffusion, float& flowBias)
{
    decay     = 0.96f;
    diffusion = 0.10f;
    flowBias  = 0.0f;

    if (wz > 0.5f) {               // Frontal lobe: high retention
        decay     = 0.998f;
        diffusion = 0.15f;
        flowBias  = -1.0f;
    } else if (wz < -0.5f) {       // Occipital lobe: fast processing
        decay     = 0.92f;
        diffusion = 0.04f;
    } else if (std::fabs(wx) > 0.8f) { // Temporal lobe: memory
        decay = 0.95f;
    } else if (wy > 0.6f) {        // Parietal lobe: sensory integration
        decay     = 0.94f;
        diffusion = 0.12f;
    }

    // Cyber mode (style == 1): sharp digital signals
    if (std::fabs(style - 1.0f) < 0.1f) {
        diffusion = 0.05f;
        decay     = 0.92f;
        flowBias  = 0.0f;
    }
}

// Returns (decayMod, diffusionMod, freqBoost) — mirrors getHypoxiaPhysics in WGSL
static inline void get_hypoxia_physics(float hypoxiaStress, float metabolicRate,
                                       float mitochondrialFn,
                                       float& decayMod, float& diffusionMod, float& freqBoost)
{
    const float decayBoost = hypoxiaStress * 0.08f * metabolicRate * (1.0f - mitochondrialFn);
    decayMod      = 0.96f - decayBoost;

    const float diffusionPenalty = hypoxiaStress * 0.5f;
    diffusionMod  = std::max(0.01f, 1.0f - diffusionPenalty);

    freqBoost = hypoxiaStress * 2.0f * (1.0f - hypoxiaStress * 0.5f);
}

// Pseudo-random hash — same integer trick used in WGSL fract(sin(...))
static inline float hash2f(float a, float b)
{
    const float magic = 43758.5453f;
    return std::fabs(std::fmod(std::sin(a * 12.9898f + b * 78.233f) * magic, 1.0f));
}

// ─── Engine struct ─────────────────────────────────────────────────────────

struct BrainTensorEngine {
    uint32_t voxelDim;
    uint32_t voxelCount;
    std::vector<float> tensor;   // current frame
    std::vector<float> scratch;  // double-buffer (avoids in-place aliasing)

    explicit BrainTensorEngine(uint32_t dim)
        : voxelDim(dim)
        , voxelCount(dim * dim * dim)
        , tensor(dim * dim * dim, 0.0f)
        , scratch(dim * dim * dim, 0.0f)
    {}

    inline uint32_t idx(uint32_t x, uint32_t y, uint32_t z) const
    {
        return z * voxelDim * voxelDim + y * voxelDim + x;
    }
};

// ─── Public API implementation ─────────────────────────────────────────────

extern "C" {

void* bte_create(uint32_t voxelDim)
{
    if (voxelDim == 0) voxelDim = VOXEL_DIM_DEFAULT;
    return static_cast<void*>(new BrainTensorEngine(voxelDim));
}

void bte_destroy(void* engine)
{
    delete static_cast<BrainTensorEngine*>(engine);
}

void bte_update(
    void*  engine_ptr,
    float  time,
    float  frequency,
    float  amplitude,
    float  smoothing,
    float  style,
    float  hypoxiaStress,
    float  metabolicRate,
    float  mitochondrialFn,
    float  fluidActive,
    float  electricalActive,
    float  mercuryActive,
    float  heavyMetal)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t dim   = eng->voxelDim;
    const uint32_t total = eng->voxelCount;
    float* data   = eng->tensor.data();
    float* scratch = eng->scratch.data();

    float globalDecayMod, globalDiffMod, freqBoost;
    get_hypoxia_physics(hypoxiaStress, metabolicRate, mitochondrialFn,
                        globalDecayMod, globalDiffMod, freqBoost);

    // Procedural base wave — mirrors compute shader implicit oscillation
    // The compute shader adds an oscillating baseline via amplitude * sin(time*frequency)
    // to give the tensor a "heartbeat" even without explicit stimuli.
    const float baseWave = amplitude * 0.04f * std::sin(time * frequency * 6.283185f);

    for (uint32_t index = 0; index < total; ++index) {
        const uint32_t z   = index / (dim * dim);
        const uint32_t rem = index % (dim * dim);
        const uint32_t y   = rem / dim;
        const uint32_t x   = rem % dim;

        // Normalise to world space (mirrors WGSL normalizedPosition → worldPosition)
        const float nx = static_cast<float>(x) / static_cast<float>(dim);
        const float ny = static_cast<float>(y) / static_cast<float>(dim);
        const float nz = static_cast<float>(z) / static_cast<float>(dim);
        const float wx = (nx * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wy = (ny * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wz = (nz * 2.0f - 1.0f) * BRAIN_RANGE;

        float val = data[index];

        // 1. Region physics
        float decay, diffusion, flowBias;
        get_region_physics(wx, wy, wz, style, decay, diffusion, flowBias);

        // 2. Apply hypoxia modulation
        decay     *= globalDecayMod;
        diffusion *= globalDiffMod;

        // 3. Laplacian diffusion (6-neighbour, mirrors WGSL)
        float neighborSum   = 0.0f;
        float neighborCount = 0.0f;

        if (x > 0u)       { neighborSum += data[eng->idx(x-1,y,z)]; neighborCount += 1.0f; }
        if (x < dim-1u)   { neighborSum += data[eng->idx(x+1,y,z)]; neighborCount += 1.0f; }
        if (y > 0u)       { neighborSum += data[eng->idx(x,y-1,z)]; neighborCount += 1.0f; }
        if (y < dim-1u)   { neighborSum += data[eng->idx(x,y+1,z)]; neighborCount += 1.0f; }
        if (z > 0u)       { neighborSum += data[eng->idx(x,y,z-1)]; neighborCount += 1.0f; }
        if (z < dim-1u)   { neighborSum += data[eng->idx(x,y,z+1)]; neighborCount += 1.0f; }

        // 4. Directional flow bias (Frontal lobe pulls from upstream Z+)
        if (flowBias < -0.1f && z < dim-1u) {
            const float upstream = data[eng->idx(x, y, z+1)];
            neighborSum   += upstream * 2.5f;
            neighborCount += 2.5f;
        }

        const float avg = neighborSum / std::max(1.0f, neighborCount);
        val = val + diffusion * (avg - val);   // equivalent to mix(val, avg, diffusion)

        // 5. Procedural fluid advection
        if (fluidActive > 0.0f) {
            const float ts = time * 2.0f;
            const float fvx = std::sin(wy * 3.0f + ts) * std::cos(wz * 2.0f - ts);
            const float fvy = std::cos(wx * 3.0f - ts) * std::sin(wz * 2.0f + ts);
            const float fvz = std::sin(wx * 2.0f + ts) * std::cos(wy * 3.0f - ts);
            const float scale = 0.5f * fluidActive;

            const float sx_world = wx - fvx * scale;
            const float sy_world = wy - fvy * scale;
            const float sz_world = wz - fvz * scale;

            // Convert to grid coords
            const float snx = (sx_world / BRAIN_RANGE) * 0.5f + 0.5f;
            const float sny = (sy_world / BRAIN_RANGE) * 0.5f + 0.5f;
            const float snz = (sz_world / BRAIN_RANGE) * 0.5f + 0.5f;

            const uint32_t sx = static_cast<uint32_t>(std::max(0.0f, std::min(static_cast<float>(dim-1u), snx * static_cast<float>(dim))));
            const uint32_t sy = static_cast<uint32_t>(std::max(0.0f, std::min(static_cast<float>(dim-1u), sny * static_cast<float>(dim))));
            const uint32_t sz = static_cast<uint32_t>(std::max(0.0f, std::min(static_cast<float>(dim-1u), snz * static_cast<float>(dim))));

            const float upstream_fluid = data[eng->idx(sx, sy, sz)];
            const float blend = std::min(1.0f, fluidActive * 0.5f);
            val = val + blend * (upstream_fluid - val);
        }

        // 6. Electrical hazard: random global spikes
        if (electricalActive > 0.0f) {
            const float noise = hash2f(wx, wy);
            if (noise > 0.95f) {
                val += electricalActive * 5.0f;
            }
        }

        // 7. Mercury / heavy-metal accumulation (posterior bias)
        if (mercuryActive > 0.0f) {
            const float dx = wx, dy = wy, dz = wz + 1.2f;
            const float d_merc = std::sqrt(dx*dx + dy*dy + dz*dz);
            val += mercuryActive * gaussian_pulse(d_merc, 1.2f) * 0.5f;
            decay = std::min(decay, 0.999f);
        }

        // 8. Structural heavy-metal damage
        if (heavyMetal > 0.0f) {
            val   = std::min(val, 1.0f - heavyMetal * 0.8f);
            decay = std::min(decay, 0.999f - heavyMetal * 0.05f);
        }

        // 9. Base oscillation / ambient activity
        val += baseWave;

        // 10. Decay + clamp
        val *= decay;
        val  = std::max(0.0f, std::min(1.0f, val));

        scratch[index] = val;
    }

    // Swap buffers
    std::swap(eng->tensor, eng->scratch);
}

void bte_inject_stimulus(void* engine_ptr,
                         float x, float y, float z,
                         float intensity, float mitochondrialFn)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t dim = eng->voxelDim;
    float* data = eng->tensor.data();

    for (uint32_t index = 0; index < eng->voxelCount; ++index) {
        const uint32_t iz  = index / (dim * dim);
        const uint32_t rem = index % (dim * dim);
        const uint32_t iy  = rem / dim;
        const uint32_t ix  = rem % dim;

        const float wx = ((static_cast<float>(ix) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wy = ((static_cast<float>(iy) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
        const float wz = ((static_cast<float>(iz) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;

        const float dx = wx - x;
        const float dy = wy - y;
        const float dz = wz - z;
        const float dist = std::sqrt(dx*dx + dy*dy + dz*dz);

        float signal = gaussian_pulse(dist, 0.5f) * mitochondrialFn;
        if (signal > 0.01f) {
            data[index] = std::min(1.0f, data[index] + intensity * signal);
        }
    }
}

void bte_get_tensor_data(void* engine_ptr, float* outBuffer, uint32_t bufferLen)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t count = std::min(bufferLen, eng->voxelCount);
    std::memcpy(outBuffer, eng->tensor.data(), count * sizeof(float));
}

void bte_reset(void* engine_ptr)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    std::fill(eng->tensor.begin(), eng->tensor.end(), 0.0f);
}

uint32_t bte_get_voxel_count(void* engine_ptr)
{
    return static_cast<BrainTensorEngine*>(engine_ptr)->voxelCount;
}

uint32_t bte_get_voxel_dim(void* engine_ptr)
{
    return static_cast<BrainTensorEngine*>(engine_ptr)->voxelDim;
}

double bte_benchmark(void* engine_ptr, uint32_t steps, float dt)
{
    auto start = std::chrono::high_resolution_clock::now();
    for (uint32_t i = 0; i < steps; ++i) {
        bte_update(engine_ptr, static_cast<float>(i) * dt,
                   2.0f, 0.5f, 0.9f, 0.0f,
                   0.0f, 1.0f, 1.0f,
                   0.0f, 0.0f, 0.0f, 0.0f);
    }
    auto end = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(end - start).count();
}

} // extern "C"

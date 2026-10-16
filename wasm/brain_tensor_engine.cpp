// brain_tensor_engine.cpp
// [Tensor Physics] BrainTensorEngine — the C ABI (brain_tensor_engine.h) over
// the C++ implementation of the Neuro-Weaver volumetric neural field.
//
// ***The engine implements ../docs/tensor-physics.md*** — not in this file but
// in src/, split by spec section (see src/engine.h for the map). Every
// numbered step there carries the spec section it implements, and the
// JavaScript reference stepper in ../src/physics/tensor-field.js carries the
// same markers on the same steps; `npm run test:golden` holds the two
// together. This file is only the boundary: handles, parameter blocks, buffer
// copies and introspection.
//
// Build: see ../scripts/wasm_flags.sh (the authoritative flags and source list
// — this comment deliberately does not restate the em++ line, because copies
// of it used to drift). The same sources also compile natively with any C++17
// compiler, which is how wasm/tests/golden_step_test.cpp validates them
// without Emscripten.

#include "brain_tensor_engine.h"

#include "src/engine.h"
#include "src/region.h"

#include <chrono>
#include <cstring>

using bte::BrainTensorEngine;

bte::BrainTensorEngine::BrainTensorEngine(uint32_t dim)
    : voxelDim(dim)
    , voxelCount(dim * dim * dim)
    , frame(0u)
    , params{}
    , tensor(static_cast<size_t>(dim) * dim * dim, 0.0f)
    , scratch(static_cast<size_t>(dim) * dim * dim, 0.0f)
    , rowStorage(static_cast<size_t>(kStencilRowFields) * dim, 0.0f)
    , axisStorage(static_cast<size_t>(kAxisTableFields) * dim, 0.0f)
{
    float* r = rowStorage.data();
    row = StencilRow{r, r + dim, r + 2u * dim, r + 3u * dim,
                     r + 4u * dim, r + 5u * dim, r + 6u * dim, r + 7u * dim};
    float* a = axisStorage.data();
    axis = AxisTables{a, a + dim, a + 2u * dim, a + 3u * dim,
                      a + 4u * dim, a + 5u * dim, a + 6u * dim};

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
    // §3.4 baselines — zero here would mean decayRate 0, i.e. a lossScale
    // of 8 and a field that dies in a few frames.
    params.decayRate = kDecayRateBaseline;
    params.diffusionRate = kDiffusionRateBaseline;
    for (int i = 0; i < 4; ++i) params.retentionBias[i] = kRetentionBaseline[i];
}

// ─── Public API ────────────────────────────────────────────────────────────

extern "C" {

void* bte_create(uint32_t voxelDim)
{
    if (voxelDim == 0u) voxelDim = bte::VOXEL_DIM_DEFAULT;
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

uint32_t bte_params_layout_hash(void)
{
    return BTE_PARAMS_LAYOUT_HASH;
}

uint32_t bte_build_features(void)
{
    uint32_t features = 0u;
#if defined(__wasm_simd128__)
    features |= BTE_FEATURE_SIMD128;
#endif
#if defined(__EMSCRIPTEN_PTHREADS__)
    features |= BTE_FEATURE_PTHREADS;
#endif
    return features;
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

void bte_set_fiber_affinities(void* engine_ptr, const float* data, uint32_t len)
{
    BrainTensorEngine* eng = static_cast<BrainTensorEngine*>(engine_ptr);
    const uint32_t expected = eng->voxelCount * bte::FIBER_STRIDE;
    if (!data || len == 0u) { eng->fibers.clear(); return; }
    eng->fibers.assign(expected, 0.0f);
    std::memcpy(eng->fibers.data(), data, std::min(len, expected) * sizeof(float));
    bte::normalize_fiber_affinities(eng->fibers);
}

void bte_fill_reference_fiber_affinities(void* engine_ptr)
{
    bte::fill_reference_fiber_affinities(*static_cast<BrainTensorEngine*>(engine_ptr));
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
    bte::step(*static_cast<BrainTensorEngine*>(engine_ptr));
}

void bte_inject_stimulus(void* engine_ptr,
                         float x, float y, float z,
                         float intensity, float radius, float erase,
                         float mitochondrialFn)
{
    bte::inject_stimulus(*static_cast<BrainTensorEngine*>(engine_ptr),
                         x, y, z, intensity, radius, erase, mitochondrialFn);
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
        bte::step(*eng);
    }
    const auto end = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(end - start).count();
}

} // extern "C"

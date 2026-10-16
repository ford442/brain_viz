// wasm/src/engine.h
// [Tensor Physics] Internal header for BrainTensorEngine: the engine state, the
// §4 samplers, and the entry points the C ABI in ../brain_tensor_engine.cpp
// calls. Nothing here is visible to JavaScript — the ABI is
// ../brain_tensor_engine.h.
//
// The engine is split along docs/tensor-physics.md:
//   field_math.h   §1 constants, §2 helpers, §4.1, §8.1 hash
//   region.h       §3 region / hypoxia / criticality / neuromodulation
//   stencil.cpp    §6.2 neighbourhood — the explicit-SIMD kernel
//   step.cpp       §6 the step
//   stimulus.cpp   §6.9 one-shot stimulus (bte_inject_stimulus)
//   affinity.cpp   §7 fiber affinities
// The golden fixture (npm run test:golden) is the acceptance test for every
// file here; a split or a kernel that moves a single ulp shows up in it.
#pragma once

#include "../brain_tensor_engine.h"
#include "field_math.h"

#include <algorithm>
#include <vector>

namespace bte {

// §6.2 Per-row stencil outputs, one float per x. Filled by stencil_row(),
// consumed by step(). Lives in the engine so the step allocates nothing.
struct StencilRow {
    float* avg;        // mean of the clamped 6-neighbourhood
    float* gradX;      // central differences
    float* gradY;
    float* gradZ;
    float* gnx;        // (grad + 1e-4) / |grad + 1e-4|
    float* gny;
    float* gnz;
    float* nbrPeak;    // max of the 6 neighbours (the cascade's localPeak, minus the centre)
};
constexpr uint32_t kStencilRowFields = 8u;

// Per-step tables of terms that depend on one axis only, filled once per step
// by step.cpp instead of once per voxel. Each entry is the exact expression the
// per-voxel code evaluated, on the exact same inputs, so hoisting it changes no
// bit of the result — it removes dim³ libm calls in favour of dim. (Measured:
// libm sin/cos/exp, not the stencil, are most of a wasm step; docs/wasm-engine.md.)
struct AxisTables {
    float* fluidSinY3;   // §6.8 sin(wy * 3 + ts)
    float* fluidCosY3;   //      cos(wy * 3 - ts)
    float* fluidCosZ2;   //      cos(wz * 2 - ts)
    float* fluidSinZ2;   //      sin(wz * 2 + ts)
    float* fluidCosX3;   //      cos(wx * 3 - ts)
    float* fluidSinX2;   //      sin(wx * 2 + ts)
    float* waveY;        // §6.6 the no-tract traveling wave, a function of y alone
};
constexpr uint32_t kAxisTableFields = 7u;

struct BrainTensorEngine {
    uint32_t voxelDim;
    uint32_t voxelCount;
    uint32_t frame;
    BrainTensorParams params;
    std::vector<float> tensor;    // current step
    std::vector<float> scratch;   // destination (never aliases `tensor`)
    std::vector<float> fibers;    // voxelCount * FIBER_STRIDE, empty = isotropic
    std::vector<float> aiTensor;  // voxelCount, empty = no SynaptiX partner
    std::vector<float> rowStorage; // kStencilRowFields * voxelDim, backs `row`
    StencilRow row;
    std::vector<float> axisStorage; // kAxisTableFields * voxelDim, backs `axis`
    AxisTables axis;

    explicit BrainTensorEngine(uint32_t dim);

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

// §6.2 Fill `out` for the row (y, z) of `data` (dim³ floats). SIMD under
// __wasm_simd128__, scalar otherwise; the two are bit-identical (see
// stencil.cpp), which is what lets the host-compiled golden test stand in for
// the SIMD build.
void stencil_row(const float* data, uint32_t dim, uint32_t y, uint32_t z, const StencilRow& out);

// §6 Advance the field one step.
void step(BrainTensorEngine& eng);

// §6.9 One-shot Gaussian stimulus applied to the current field.
void inject_stimulus(BrainTensorEngine& eng, float x, float y, float z,
                     float intensity, float radius, float erase, float mitochondrialFn);

// §7.1 Normalise affinity directions in place (once, at upload).
void normalize_fiber_affinities(std::vector<float>& fibers);

// §7.2 Fill eng.fibers with the deterministic reference tract field.
void fill_reference_fiber_affinities(BrainTensorEngine& eng);

} // namespace bte

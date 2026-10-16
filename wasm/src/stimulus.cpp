// wasm/src/stimulus.cpp
// [Tensor Physics] §6.9 One-shot stimulus of docs/tensor-physics.md — the
// immediate brush stroke behind bte_inject_stimulus(). The per-step stimulus
// term (params.stimulusActive) is applied inside step.cpp.

#include "engine.h"

namespace bte {

void inject_stimulus(BrainTensorEngine& eng, float x, float y, float z,
                     float intensity, float radius, float erase, float mitochondrialFn)
{
    const uint32_t dim = eng.voxelDim;
    const uint32_t dim2 = dim * dim;
    float* data = eng.tensor.data();
    const float sigma = radius > 0.0001f ? radius : 0.5f;

    for (uint32_t index = 0; index < eng.voxelCount; ++index) {
        const uint32_t iz = index / dim2;
        const uint32_t rem = index % dim2;
        const uint32_t iy = rem / dim;
        const uint32_t ix = rem % dim;

        const float wx = voxel_to_world(ix, dim);
        const float wy = voxel_to_world(iy, dim);
        const float wz = voxel_to_world(iz, dim);

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

} // namespace bte

// wasm/src/affinity.cpp
// [Tensor Physics] §7 Fiber affinities of docs/tensor-physics.md.

#include "engine.h"

namespace bte {

// §7.1 Normalise the affinity directions once, at upload. The step reads them
// as unit vectors, so the sample coordinates derived from them are identical to
// the ones normalizeFiberAffinities() produces in
// src/physics/tensor-field.js — the op order here is the contract.
void normalize_fiber_affinities(std::vector<float>& fibers)
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

// §7.2 Reference tract field — must stay identical to
// makeReferenceFiberAffinities() in src/physics/tensor-field.js.
void fill_reference_fiber_affinities(BrainTensorEngine& eng)
{
    const uint32_t dim = eng.voxelDim;
    eng.fibers.assign(static_cast<size_t>(eng.voxelCount) * FIBER_STRIDE, 0.0f);

    for (uint32_t z = 0; z < dim; ++z) {
        for (uint32_t y = 0; y < dim; ++y) {
            for (uint32_t x = 0; x < dim; ++x) {
                const uint32_t index = eng.idx(x, y, z);
                for (uint32_t slot = 0; slot < FIBER_SLOTS; ++slot) {
                    const size_t base = static_cast<size_t>(index) * FIBER_STRIDE + slot * 4u;
                    const int32_t s = static_cast<int32_t>(slot) * 7;
                    // Raw directions; normalize_fiber_affinities() below makes
                    // them unit vectors with the same op order as the JS side.
                    eng.fibers[base + 0] = hash_voxel(x, y, z, 1 + s) * 2.0f - 1.0f;
                    eng.fibers[base + 1] = hash_voxel(x, y, z, 2 + s) * 2.0f - 1.0f;
                    eng.fibers[base + 2] = hash_voxel(x, y, z, 3 + s) * 2.0f - 1.0f;
                    const float w = hash_voxel(x, y, z, 4 + s);
                    eng.fibers[base + 3] = (slot == 0u)
                        ? (w > 0.45f ? 0.08f + (w - 0.45f) * 0.30f : 0.0f)
                        : (w > 0.82f ? 0.03f + (w - 0.82f) * 0.30f : 0.0f);
                }
            }
        }
    }
    normalize_fiber_affinities(eng.fibers);
}

} // namespace bte

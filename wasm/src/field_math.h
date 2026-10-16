// wasm/src/field_math.h
// [Tensor Physics] §1 constants, §2 scalar helpers and the §8.1 voxel hash of
// docs/tensor-physics.md — the leaf of the engine's include graph.
//
// Everything here is inline and called per voxel. It lives in a header rather
// than a .cpp because the host golden build (scripts/test_golden.sh) has no LTO,
// and an out-of-line clampf() per voxel would make the test measure call
// overhead instead of the field.
#pragma once

#include <cmath>
#include <cstdint>

namespace bte {

// ─── §1 Constants (mirror render-shared.js CONSTANTS) ─────────────────────
constexpr float BRAIN_RANGE = 1.6f;
constexpr uint32_t VOXEL_DIM_DEFAULT = 32u;
constexpr uint32_t FIBER_SLOTS = 3u;
constexpr uint32_t FIBER_STRIDE = FIBER_SLOTS * 4u;
// §8.2 Width of the soft band replacing WGSL's hard step() cascade gate.
constexpr float kCascadeGateWidth = 0.01f;

// ─── §2 Scalar helpers ─────────────────────────────────────────────────────

inline float clampf(float v, float lo, float hi)
{
    return v < lo ? lo : (v > hi ? hi : v);
}

inline float clamp01(float v) { return clampf(v, 0.0f, 1.0f); }

inline float mixf(float a, float b, float t) { return a + (b - a) * t; }

inline float smoothstepf(float edge0, float edge1, float x)
{
    if (edge1 == edge0) return x < edge0 ? 0.0f : 1.0f;
    const float t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3.0f - 2.0f * t);
}

inline float gaussian_pulse(float dist, float width)
{
    const float k = 4.0f / (width * width);
    return std::exp(-k * dist * dist);
}

// §4.1 indexToWorld. Shared by the step and the one-shot stimulus so the two
// can never disagree about where a voxel is.
inline float voxel_to_world(uint32_t i, uint32_t dim)
{
    return ((static_cast<float>(i) / static_cast<float>(dim)) * 2.0f - 1.0f) * BRAIN_RANGE;
}

// §8.1 Integer voxel hash. Replaces WGSL's fract(sin(dot(p,k)) * 43758.5453),
// which cannot agree between implementations (a 1-ulp difference in sin gives a
// completely different result after the multiply-and-fract). Bit-identical to
// hashVoxel() in src/physics/tensor-field.js.
inline float hash_voxel(int32_t x, int32_t y, int32_t z, int32_t salt)
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

} // namespace bte

// wasm/src/stencil.cpp
// [Tensor Physics] §6.2 Neighbourhood of docs/tensor-physics.md — the clamped
// 6-neighbour stencil, its mean, central gradient and gradient direction, and
// the neighbour peak §6.5 reads. Computed a row (fixed y, z; all x) at a time.
//
// Under __wasm_simd128__ (the release build's -msimd128) the interior of each
// row runs 4 voxels per instruction; the two x-faces, and every voxel on a
// non-SIMD build, take the scalar path. `-msimd128` alone did not get this:
// the stencil sat inside the 600-line per-voxel step, between fiber gathers
// and branches, and the auto-vectoriser left all of it scalar.
//
// ***The two paths are bit-identical, by construction:***
//   - every lane does the scalar path's operations in the scalar path's order
//     (the six-way sum is left-associated in both; the mean is a division by
//     6, not a multiply by 1/6);
//   - f32x4 add/sub/mul/div/sqrt are correctly rounded, exactly as the scalar
//     ops are, and baseline simd128 has no fused multiply-add to contract into;
//   - wasm_f32x4_pmax(a, b) is `a < b ? b : a` — std::max(a, b), signed zeros
//     included. (wasm_f32x4_max is IEEE maximum and is NOT the same.)
// So the host-compiled golden test, which can only exercise the scalar path,
// still pins the SIMD build — and GOLDEN_WASM=1 npm run test:golden checks it
// directly. Do not enable -mrelaxed-simd: relaxed madd would break the first
// two bullets.

#include "engine.h"

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#endif

namespace bte {

namespace {

// Row pointers for the clamped neighbourhood of row (y, z). The y/z clamp is
// uniform across a row, so only x needs per-voxel clamping.
struct RowTaps {
    const float* c;   // (·, y, z)
    const float* ym;  // (·, clamp(y-1), z)
    const float* yp;
    const float* zm;
    const float* zp;
};

inline void stencil_point(const RowTaps& t, uint32_t dim, uint32_t x, const StencilRow& out)
{
    const uint32_t xm = x > 0u ? x - 1u : 0u;
    const uint32_t xp = x < dim - 1u ? x + 1u : dim - 1u;

    const float valXm = t.c[xm];
    const float valXp = t.c[xp];
    const float valYm = t.ym[x];
    const float valYp = t.yp[x];
    const float valZm = t.zm[x];
    const float valZp = t.zp[x];

    const float gradX = (valXp - valXm) * 0.5f;
    const float gradY = (valYp - valYm) * 0.5f;
    const float gradZ = (valZp - valZm) * 0.5f;
    const float gx = gradX + 1e-4f, gy = gradY + 1e-4f, gz = gradZ + 1e-4f;
    float gradLen = std::sqrt(gx * gx + gy * gy + gz * gz);
    if (gradLen == 0.0f) gradLen = 1.0f;

    out.avg[x] = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0f;
    out.gradX[x] = gradX;
    out.gradY[x] = gradY;
    out.gradZ[x] = gradZ;
    out.gnx[x] = gx / gradLen;
    out.gny[x] = gy / gradLen;
    out.gnz[x] = gz / gradLen;
    out.nbrPeak[x] = std::max(std::max(valXm, valXp), std::max(std::max(valYm, valYp), std::max(valZm, valZp)));
}

#if defined(__wasm_simd128__)
// Interior voxels [x, x+4) with 1 <= x and x+4 <= dim-1: every lane's x-1 and
// x+1 are in range, so the x clamp is the identity and plain unaligned loads
// at c+x-1 / c+x+1 give the x-neighbours.
inline void stencil_quad(const RowTaps& t, uint32_t x, const StencilRow& out)
{
    const v128_t half = wasm_f32x4_splat(0.5f);
    const v128_t eps = wasm_f32x4_splat(1e-4f);
    const v128_t zero = wasm_f32x4_splat(0.0f);
    const v128_t one = wasm_f32x4_splat(1.0f);
    const v128_t six = wasm_f32x4_splat(6.0f);

    const v128_t valXm = wasm_v128_load(t.c + x - 1u);
    const v128_t valXp = wasm_v128_load(t.c + x + 1u);
    const v128_t valYm = wasm_v128_load(t.ym + x);
    const v128_t valYp = wasm_v128_load(t.yp + x);
    const v128_t valZm = wasm_v128_load(t.zm + x);
    const v128_t valZp = wasm_v128_load(t.zp + x);

    const v128_t gradX = wasm_f32x4_mul(wasm_f32x4_sub(valXp, valXm), half);
    const v128_t gradY = wasm_f32x4_mul(wasm_f32x4_sub(valYp, valYm), half);
    const v128_t gradZ = wasm_f32x4_mul(wasm_f32x4_sub(valZp, valZm), half);
    const v128_t gx = wasm_f32x4_add(gradX, eps);
    const v128_t gy = wasm_f32x4_add(gradY, eps);
    const v128_t gz = wasm_f32x4_add(gradZ, eps);
    v128_t gradLen = wasm_f32x4_sqrt(wasm_f32x4_add(wasm_f32x4_add(wasm_f32x4_mul(gx, gx),
                                                                   wasm_f32x4_mul(gy, gy)),
                                                    wasm_f32x4_mul(gz, gz)));
    gradLen = wasm_v128_bitselect(one, gradLen, wasm_f32x4_eq(gradLen, zero));

    v128_t sum = wasm_f32x4_add(valXm, valXp);
    sum = wasm_f32x4_add(sum, valYm);
    sum = wasm_f32x4_add(sum, valYp);
    sum = wasm_f32x4_add(sum, valZm);
    sum = wasm_f32x4_add(sum, valZp);

    const v128_t peak = wasm_f32x4_pmax(wasm_f32x4_pmax(valXm, valXp),
                                        wasm_f32x4_pmax(wasm_f32x4_pmax(valYm, valYp),
                                                        wasm_f32x4_pmax(valZm, valZp)));

    wasm_v128_store(out.avg + x, wasm_f32x4_div(sum, six));
    wasm_v128_store(out.gradX + x, gradX);
    wasm_v128_store(out.gradY + x, gradY);
    wasm_v128_store(out.gradZ + x, gradZ);
    wasm_v128_store(out.gnx + x, wasm_f32x4_div(gx, gradLen));
    wasm_v128_store(out.gny + x, wasm_f32x4_div(gy, gradLen));
    wasm_v128_store(out.gnz + x, wasm_f32x4_div(gz, gradLen));
    wasm_v128_store(out.nbrPeak + x, peak);
}
#endif

} // namespace

void stencil_row(const float* data, uint32_t dim, uint32_t y, uint32_t z, const StencilRow& out)
{
    const uint32_t dim2 = dim * dim;
    const uint32_t ym = y > 0u ? y - 1u : 0u;
    const uint32_t yp = y < dim - 1u ? y + 1u : dim - 1u;
    const uint32_t zm = z > 0u ? z - 1u : 0u;
    const uint32_t zp = z < dim - 1u ? z + 1u : dim - 1u;
    const RowTaps t{
        data + z * dim2 + y * dim,
        data + z * dim2 + ym * dim,
        data + z * dim2 + yp * dim,
        data + zm * dim2 + y * dim,
        data + zp * dim2 + y * dim,
    };

    uint32_t x = 0u;
#if defined(__wasm_simd128__)
    if (dim >= 2u) {
        stencil_point(t, dim, 0u, out);
        for (x = 1u; x + 4u <= dim - 1u; x += 4u) stencil_quad(t, x, out);
    }
#endif
    for (; x < dim; ++x) stencil_point(t, dim, x, out);
}

} // namespace bte

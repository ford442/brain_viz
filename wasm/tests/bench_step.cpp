// wasm/tests/bench_step.cpp
// [Tensor Physics] bte_update() frame-budget benchmark.
//
//   bash scripts/bench_wasm.sh            # em++ SIMD + scalar builds under node
//   BENCH_HOST=1 bash scripts/bench_wasm.sh  # also the host compiler, for scale
//
// Runs the golden scenario's parameters (fibers on, fluid, hazards, stimulus —
// the expensive branches all taken) at each requested dim and prints the
// median ms per step. The numbers recorded in docs/wasm-engine.md come from
// this program; re-run it rather than assuming "-msimd128 is on" means fast.

#include "../brain_tensor_engine.h"

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <vector>

namespace {

void apply_bench_scenario(BrainTensorParams& p, uint32_t dim)
{
    // Mirrors apply_scenario(Baseline) in golden_step_test.cpp.
    p.voxelDim = dim;
    p.frequency = 2.0f;
    p.amplitude = 0.5f;
    p.spikeThreshold = 0.6f;
    p.fiberCoupling = 0.5f;
    p.hypoxiaStress = 0.25f;
    p.metabolicRate = 1.1f;
    p.mitochondrialFunction = 0.85f;
    p.fluidActive = 0.4f;
    p.cognitiveLoad = 0.3f;
    p.stress = 0.2f;
    p.heavyMetal = 0.1f;
    p.electricalActive = 0.02f;
    p.mercuryActive = 0.15f;
    p.stimulusPos[0] = 0.4f;
    p.stimulusPos[1] = -0.2f;
    p.stimulusPos[2] = 0.6f;
    p.stimulusActive = 0.8f;
    p.stimulusRadius = 0.45f;
    p.resonanceThreshold = 0.2f;
    p.decayRate = 0.96f;
    p.diffusionRate = 0.1f;
    p.retentionBias[0] = 0.5f;
    p.retentionBias[2] = 0.2f;
    p.retentionBias[3] = 0.2f;
}

double bench(uint32_t dim, bool fibers, uint32_t steps)
{
    void* engine = bte_create(dim);
    if (fibers) bte_fill_reference_fiber_affinities(engine);
    BrainTensorParams params{};
    apply_bench_scenario(params, dim);

    std::vector<double> samples;
    samples.reserve(steps);
    for (uint32_t i = 0; i < steps + 4u; ++i) {
        params.time = static_cast<float>(i) * 0.016f;
        bte_set_params(engine, &params);
        const auto t0 = std::chrono::steady_clock::now();
        bte_update(engine);
        const auto t1 = std::chrono::steady_clock::now();
        if (i >= 4u) samples.push_back(std::chrono::duration<double, std::milli>(t1 - t0).count());
    }
    bte_destroy(engine);
    std::sort(samples.begin(), samples.end());
    return samples[samples.size() / 2];
}

} // namespace

int main(int argc, char** argv)
{
    const char* label = argc > 1 ? argv[1] : "build";
    const uint32_t steps = argc > 2 ? static_cast<uint32_t>(std::atoi(argv[2])) : 40u;
    const uint32_t features = bte_build_features();
    std::printf("[bench] %-14s simd128=%s pthreads=%s\n", label,
                (features & BTE_FEATURE_SIMD128) ? "on " : "off",
                (features & BTE_FEATURE_PTHREADS) ? "on" : "off");
    for (uint32_t dim : {32u, 48u, 64u}) {
        const double withFibers = bench(dim, true, steps);
        const double isotropic = bench(dim, false, steps);
        std::printf("[bench]   %2u^3  fibers %8.2f ms/step   isotropic %8.2f ms/step%s\n",
                    dim, withFibers, isotropic, withFibers > 16.0 ? "   (over a 16 ms frame)" : "");
    }
    return 0;
}

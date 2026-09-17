// wasm/tests/golden_step_test.cpp
// [Tensor Physics] Cross-implementation golden test for the C++ neural field.
//
// Runs BrainTensorEngine over the scenario defined in ../../tests/golden-scenario.js
// and compares the result against ../../tests/fixtures/tensor-field-golden.bin,
// which the JavaScript reference stepper produced. If the two implementations of
// docs/tensor-physics.md have drifted, this is what catches it.
//
// Deliberately plain C++17 with no Emscripten dependency, so the contract is
// checked in CI on a machine that has only a host compiler:
//
//   bash scripts/test_golden.sh
//
// SCENARIO below mirrors GOLDEN_SCENARIO in tests/golden-scenario.js. The two
// are small and explicit on purpose: a scenario loaded from JSON would need a
// JSON parser in the test binary, and a scenario baked into the fixture would
// let a silent renaming pass.

#include "../brain_tensor_engine.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

namespace {

constexpr uint32_t kVoxelDim = 32u;
constexpr uint32_t kSteps = 24u;
constexpr float kDt = 0.016f;
constexpr float kEpsilon = 2e-3f;  // GOLDEN_EPSILON in tests/golden-scenario.js

void apply_scenario(BrainTensorParams& p)
{
    p.voxelDim = kVoxelDim;
    p.frequency = 2.0f;
    p.amplitude = 0.5f;
    p.spikeThreshold = 0.6f;
    p.style = 0.0f;
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
    p.stimulusErase = 0.0f;
    p.synaptiXActive = 0.0f;
    p.aiInfluence = 0.0f;
    p.resonanceThreshold = 0.2f;
}

std::vector<float> load_fixture(const std::string& path, uint32_t expectedCount)
{
    std::FILE* f = std::fopen(path.c_str(), "rb");
    if (!f) {
        std::fprintf(stderr, "[golden] cannot open fixture '%s'\n", path.c_str());
        std::fprintf(stderr, "[golden] regenerate it with: node scripts/gen_tensor_fixture.mjs\n");
        std::exit(2);
    }
    std::vector<float> data(expectedCount);
    const size_t read = std::fread(data.data(), sizeof(float), expectedCount, f);
    std::fclose(f);
    if (read != expectedCount) {
        std::fprintf(stderr, "[golden] fixture holds %zu floats, expected %u\n", read, expectedCount);
        std::exit(2);
    }
    return data;
}

} // namespace

int main(int argc, char** argv)
{
    const std::string fixturePath = (argc > 1)
        ? argv[1]
        : "tests/fixtures/tensor-field-golden.bin";

    // The ABI guard the JS bridge also performs at init.
    if (bte_params_byte_size() != sizeof(BrainTensorParams)) {
        std::fprintf(stderr, "[golden] BrainTensorParams size mismatch\n");
        return 1;
    }

    void* engine = bte_create(kVoxelDim);
    bte_fill_reference_fiber_affinities(engine);

    BrainTensorParams params{};
    apply_scenario(params);

    for (uint32_t step = 0; step < kSteps; ++step) {
        params.time = static_cast<float>(step) * kDt;
        bte_set_params(engine, &params);
        bte_update(engine);
    }

    const uint32_t count = bte_get_voxel_count(engine);
    std::vector<float> actual(count);
    bte_get_tensor_data(engine, actual.data(), count);
    bte_destroy(engine);

    const std::vector<float> expected = load_fixture(fixturePath, count);

    double sumAbs = 0.0;
    float maxAbs = 0.0f;
    uint32_t worstIndex = 0;
    uint32_t overCount = 0;
    for (uint32_t i = 0; i < count; ++i) {
        const float d = std::fabs(actual[i] - expected[i]);
        sumAbs += d;
        if (d > maxAbs) { maxAbs = d; worstIndex = i; }
        if (d > kEpsilon) ++overCount;
    }
    const double meanAbs = sumAbs / static_cast<double>(count);

    std::printf("[golden] voxels=%u  meanAbsDiff=%.3e  maxAbsDiff=%.3e  epsilon=%.1e\n",
                count, meanAbs, static_cast<double>(maxAbs), static_cast<double>(kEpsilon));

    if (overCount > 0) {
        std::fprintf(stderr,
            "[golden] FAIL: %u/%u voxels exceed epsilon (worst index %u: C++ %.9f vs JS %.9f).\n"
            "[golden] The C++ engine and src/physics/tensor-field.js have drifted. Both\n"
            "[golden] implement docs/tensor-physics.md — fix the one that left the spec,\n"
            "[golden] and only regenerate the fixture when the spec itself changed.\n",
            overCount, count, worstIndex,
            static_cast<double>(actual[worstIndex]), static_cast<double>(expected[worstIndex]));
        return 1;
    }

    std::printf("[golden] PASS: C++ engine matches the JS reference stepper.\n");
    return 0;
}

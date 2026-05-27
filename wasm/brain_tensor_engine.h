// brain_tensor_engine.h
// [Phase 1 WASM] BrainTensorEngine — C++ header for Neuro-Weaver volumetric tensor simulation.
// Mirrors and extends the WGSL compute shader logic from shaders.js.
// Exposes a C API via emscripten EMSCRIPTEN_KEEPALIVE for JS/WASM interop.

#pragma once

#include <cstdint>

#ifdef __cplusplus
extern "C" {
#endif

// ----- API -----

/**
 * Allocate and initialise a new BrainTensorEngine.
 * @param voxelDim  Side length of the cubic tensor grid (typically 32).
 * @return          Opaque engine handle.  Pass to all other functions.
 */
void* bte_create(uint32_t voxelDim);

/**
 * Free all resources owned by the engine.
 */
void bte_destroy(void* engine);

/**
 * Advance the simulation by one time step.
 *
 * @param engine            Handle from bte_create().
 * @param time              Absolute simulation time (seconds).
 * @param frequency         Neural oscillation frequency.
 * @param amplitude         Base signal amplitude.
 * @param smoothing         Temporal smoothing factor (0–1).
 * @param style             Render style index (0=Organic,1=Cyber,2=Connectome,3=Heatmap).
 * @param hypoxiaStress     Cellular stress from oxygen deprivation (0–1).
 * @param metabolicRate     ATP consumption multiplier.
 * @param mitochondrialFn   ATP synthesis efficiency.
 * @param fluidActive       Fluid dynamics advection intensity (0–2).
 * @param electricalActive  Electrical hazard intensity (0–1).
 * @param mercuryActive     Mercury/heavy-metal hazard intensity (0–1).
 * @param heavyMetal        Accumulated structural heavy-metal damage (0–1).
 */
void bte_update(
    void*    engine,
    float    time,
    float    frequency,
    float    amplitude,
    float    smoothing,
    float    style,
    float    hypoxiaStress,
    float    metabolicRate,
    float    mitochondrialFn,
    float    fluidActive,
    float    electricalActive,
    float    mercuryActive,
    float    heavyMetal
);

/**
 * Inject a Gaussian stimulus pulse centred at world-space (x, y, z).
 *
 * @param intensity     Peak signal strength.
 * @param mitochondrialFn  Current mitochondrial function (dampens response under hypoxia).
 */
void bte_inject_stimulus(void* engine, float x, float y, float z,
                         float intensity, float mitochondrialFn);

/**
 * Copy the current tensor data into a caller-owned Float32 buffer.
 * The buffer must be at least voxelDim³ × 4 bytes.
 */
void bte_get_tensor_data(void* engine, float* outBuffer, uint32_t bufferLen);

/**
 * Zero the entire activity tensor (instant reset).
 */
void bte_reset(void* engine);

/**
 * Return the flat voxel count (voxelDim³).
 */
uint32_t bte_get_voxel_count(void* engine);

/**
 * Return the voxel dimension (side length).
 */
uint32_t bte_get_voxel_dim(void* engine);

/**
 * Benchmark helper: run `steps` update cycles and return elapsed milliseconds.
 */
double bte_benchmark(void* engine, uint32_t steps, float dt);

#ifdef __cplusplus
} // extern "C"
#endif

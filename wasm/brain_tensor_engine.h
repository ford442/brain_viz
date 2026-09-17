// brain_tensor_engine.h
// [Tensor Physics] BrainTensorEngine — C API for the Neuro-Weaver volumetric
// neural field.
//
// The engine implements the CPU reference model specified in
// ../docs/tensor-physics.md. Its sibling implementation is the JavaScript
// stepper in ../src/physics/tensor-field.js; the two are pinned to each other
// by the golden fixture in ../tests/fixtures/ (npm run test:golden). The WGSL
// compute shader in ../src/shaders/volumetric-compute.js remains the
// authoritative *visual* path — spec §8 lists the two places the CPU model
// deliberately diverges from it.
//
// Parameters are passed as a struct, not as a positional argument list. The
// struct is generated from COMPUTE_UNIFORM_LAYOUT (the same declaration the
// WGSL uniform buffer and the JS offsets come from), so a parameter added on
// the renderer side can no longer be silently dropped on the way into C++.

#pragma once

#include <cstdint>

#include "brain_tensor_params.h"

#ifdef __cplusplus
extern "C" {
#endif

// ----- Lifecycle -----

/**
 * Allocate and initialise a new BrainTensorEngine.
 * @param voxelDim  Side length of the cubic tensor grid (typically 32).
 * @return          Opaque engine handle. Pass to all other functions.
 */
void* bte_create(uint32_t voxelDim);

/** Free all resources owned by the engine. */
void bte_destroy(void* engine);

// ----- Parameters -----

/**
 * sizeof(BrainTensorParams). The JS bridge compares this against
 * COMPUTE_UNIFORM_BYTE_SIZE at init and refuses to run against a .wasm built
 * from a stale layout, rather than reading garbage at shifted offsets.
 */
uint32_t bte_params_byte_size(void);

/**
 * Copy a full parameter block into the engine. Every field of the WGSL
 * `TensorParams` struct is present; the engine reads the ones spec §6 lists
 * and ignores the ones spec §6.14 documents as reserved.
 */
void bte_set_params(void* engine, const BrainTensorParams* params);

/**
 * Pointer to the engine's live parameter block, for callers that would rather
 * write the fields in place than stage a copy. Valid until bte_destroy().
 */
BrainTensorParams* bte_get_params(void* engine);

// ----- Field inputs -----

/**
 * Upload per-voxel fiber tract affinities: voxelDim³ × 3 slots × vec4
 * (dir.xyz, weight). Passing len == 0 clears them (isotropic diffusion).
 */
void bte_set_fiber_affinities(void* engine, const float* data, uint32_t len);

/**
 * Fill the fiber affinities with the deterministic reference tract field
 * (spec §7) — the same one makeReferenceFiberAffinities() builds in JS. Used
 * by the golden test so both implementations see identical geometry with no
 * fixture file to keep in sync.
 */
void bte_fill_reference_fiber_affinities(void* engine);

/** Upload the SynaptiX AI tensor (voxelDim³ floats). len == 0 clears it. */
void bte_set_ai_tensor(void* engine, const float* data, uint32_t len);

// ----- Simulation -----

/**
 * Advance the simulation by one step using the currently-set parameters.
 * Increments the internal frame counter that seeds the voxel hash (spec §8.1).
 */
void bte_update(void* engine);

/**
 * Inject a Gaussian stimulus pulse centred at world-space (x, y, z), applied
 * immediately to the current field. Mirrors spec §6.9, including the paint
 * brush radius and eraser mode that the old 5-argument entry point dropped.
 *
 * @param radius     Brush sigma; <= 0.0001 selects the legacy fixed 0.5.
 * @param erase      Non-zero damps energy inside the brush instead of adding.
 */
void bte_inject_stimulus(void* engine, float x, float y, float z,
                         float intensity, float radius, float erase,
                         float mitochondrialFn);

// ----- Data transfer -----

/**
 * Copy the current tensor into a caller-owned Float32 buffer.
 * The buffer must hold at least voxelDim³ floats.
 */
void bte_get_tensor_data(void* engine, float* outBuffer, uint32_t bufferLen);

/** Overwrite the current tensor (for seeding a reproducible test state). */
void bte_set_tensor_data(void* engine, const float* data, uint32_t len);

/** Zero the entire activity tensor and reset the frame counter. */
void bte_reset(void* engine);

// ----- Introspection -----

/** Flat voxel count (voxelDim³). */
uint32_t bte_get_voxel_count(void* engine);

/** Voxel dimension (side length). */
uint32_t bte_get_voxel_dim(void* engine);

/** Current frame counter (the salt for the voxel hash). */
uint32_t bte_get_frame(void* engine);

/** Set the frame counter — the golden test starts both steppers at 0. */
void bte_set_frame(void* engine, uint32_t frame);

/** Benchmark helper: run `steps` update cycles and return elapsed milliseconds. */
double bte_benchmark(void* engine, uint32_t steps, float dt);

#ifdef __cplusplus
} // extern "C"
#endif

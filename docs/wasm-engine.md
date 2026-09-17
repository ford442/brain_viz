# WASM Engine — Technical Documentation

> **Status**: the C++ engine implements the full neural-field contract in
> [`docs/tensor-physics.md`](./tensor-physics.md) and is held to it by
> `npm run test:golden`.
>
> **History note.** This page used to claim the C++ engine mirrored the WGSL
> compute shader "step for step". That was untrue from Phase 1 onwards: the
> engine implemented a subset (no `cognitiveLoad`, no `stress`, no paint radius
> or eraser, no fiber coupling, no criticality cascade, no SynaptiX), and the
> 13-float C ABI silently discarded every parameter beyond those it named.
> The physics is now specified in one document, implemented twice, and the two
> are compared by a test.

---

## Overview

Neuro-Weaver uses a **hybrid simulation architecture** introduced in Phase 1:

| Mode | Physics runs on | Description |
|------|----------------|-------------|
| **WebGPU Compute** (default) | GPU | WGSL compute shader parallelises all 32 768 voxels simultaneously. |
| **C++ WASM** (hybrid) | CPU | Emscripten-compiled `BrainTensorEngine` runs simulation in native C++, uploads result to the GPU storage buffer each frame. |

Both modes write identical data into the same `tensorBuffer` WebGPU storage buffer, so the render pipeline, visualization styles, and all downstream effects are completely unchanged.

---

## Directory Layout

```
wasm/
├── brain_tensor_engine.h      C API declarations (Emscripten-compatible)
└── brain_tensor_engine.cpp    Full simulation implementation

scripts/
└── build_wasm.sh              Emscripten build script

src/
└── wasm-engine.js             JS loader + bridge (WasmTensorEngine class)

public/wasm/                   Build output (generated — do not edit)
├── brain_tensor_engine.js     Emscripten glue JS (MODULARIZE=1)
└── brain_tensor_engine.wasm   Compiled binary
```

---

## Build

### Prerequisites

Install the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html):

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh   # (or emsdk_env.bat on Windows)
```

`.jules/setup.sh` automates these steps for agent/sandbox environments that opt into the WASM tier.

`scripts/build_wasm.sh` locates `em++` in this order, so no hardcoded path is required:

1. `em++` already on `PATH` (SDK activated in the current shell).
2. `$EMSDK` env var pointing at an emsdk checkout (`$EMSDK/emsdk_env.sh`).
3. An `emsdk/` checkout in the repo root or `$HOME` (matches `.jules/setup.sh`'s clone location).

If none of these resolve, the script exits with an error explaining how to install Emscripten — it never silently no-ops.

### Compile

```bash
# Release build (O2) — WASM engine only
npm run build:wasm

# Debug build (O0, assertions, safe-heap)
npm run build:wasm:debug

# Full production build: Vite bundle + WASM engine
npm run build:full
```

Output is placed in `public/wasm/` and served as static assets by Vite. Plain `npm run build` (used by CI) is web-only and skips this entirely; see the README's "Build tiers" section for the full breakdown.

### Vite Configuration

`vite.config.js` sets `assetsInlineLimit: 0` so the `.wasm` binary is never inlined and `assetsInclude: ['**/*.wasm']` so Vite treats it as a static asset.

---

## C++ API (`brain_tensor_engine.h`)

Parameters travel as a **struct**, not a positional argument list. Growing the
old `bte_update(...)` by one float per feature is what let the renderer send
parameters the engine never received.

```c
void*    bte_create(uint32_t voxelDim);
void     bte_destroy(void* engine);

// Parameters — BrainTensorParams is generated from COMPUTE_UNIFORM_LAYOUT.
uint32_t bte_params_byte_size(void);
void     bte_set_params(void* engine, const BrainTensorParams* params);
BrainTensorParams* bte_get_params(void* engine);

// Field inputs
void     bte_set_fiber_affinities(void* engine, const float* data, uint32_t len);
void     bte_fill_reference_fiber_affinities(void* engine);
void     bte_set_ai_tensor(void* engine, const float* data, uint32_t len);

// Simulation
void     bte_update(void* engine);
void     bte_inject_stimulus(void* engine, float x, float y, float z,
                             float intensity, float radius, float erase,
                             float mitochondrialFn);

// Data transfer / introspection
void     bte_get_tensor_data(void* engine, float* outBuffer, uint32_t bufferLen);
void     bte_set_tensor_data(void* engine, const float* data, uint32_t len);
void     bte_reset(void* engine);
uint32_t bte_get_voxel_count(void* engine);
uint32_t bte_get_voxel_dim(void* engine);
uint32_t bte_get_frame(void* engine);
void     bte_set_frame(void* engine, uint32_t frame);
double   bte_benchmark(void* engine, uint32_t steps, float dt);
```

### `wasm/brain_tensor_params.h` is generated

`scripts/gen_wasm_params.mjs` emits it from `COMPUTE_UNIFORM_LAYOUT` — the same
declaration that generates the WGSL `TensorParams` struct and the JS offsets —
with explicit `_padN` filler reproducing the WGSL alignment. It is checked in,
and `npm test` fails if it is stale.

`bte_params_byte_size()` is the runtime guard: `src/wasm-engine.js` compares it
against `COMPUTE_UNIFORM_BYTE_SIZE` at init and refuses a `.wasm` built from an
older layout, instead of reading every field at a shifted offset.

### Editor support

`wasm/compile_flags.txt` is checked in, so clangd can analyse `wasm/` with no
setup. `node scripts/gen_compile_commands.mjs` (also run by `build_wasm.sh`)
writes a `compile_commands.json` with absolute paths; it is gitignored.

---

## JavaScript API (`src/wasm-engine.js`)

```js
const wasmEngine = new WasmTensorEngine(32);

// Load and initialise (safe to call multiple times)
const ok = await wasmEngine.init();   // → true if WASM available

// Give the engine the same tract geometry the compute shader reads.
// Without it the field diffuses isotropically — a different simulation.
wasmEngine.setFiberAffinities(geometry.getFiberAffinityData());

// Advance simulation. The stimulus block travels separately from the sliders;
// both are written into one TensorParams image laid out by the shared offsets.
wasmEngine.update(time, renderer.params, renderer.stimulus);

// Inject stimulus pulse — radius and eraser mode included
wasmEngine.injectStimulus(x, y, z, intensity, { radius, erase, mitochondrialFunction });

// Read tensor data. The view is taken fresh from the module's current heap:
// ALLOW_MEMORY_GROWTH detaches the old buffer on growth, and a view cached at
// init would read as an empty array for the rest of the session.
const data = wasmEngine.getTensorData();
renderer.setVoxelData(data);

// Benchmark
const result = wasmEngine.benchmark(100);
// → { steps: 100, elapsedMs: …, stepsPerSec: … }

// Cleanup
wasmEngine.dispose();
```

---

## Integration with BrainRenderer

`brain-renderer.js` exposes:

```js
await renderer.enableWasmMode();   // load WASM, activate hybrid mode
renderer.disableWasmMode();        // revert to WebGPU compute
renderer.runWasmBenchmark(steps);  // run benchmark, log to console
```

### Render Loop Logic

```
if (tensorPlaybackMode)          → skip simulation (TensorPlayer drives buffer)
else if (wasmMode && available)  → C++ engine → writeBuffer to tensorBuffer
else                             → WebGPU compute dispatch
```

The WASM stimulus path is wired into `injectStimulus()`: when `wasmMode` is active the same call that updates the compute-shader uniforms also calls `wasmEngine.injectStimulus()`.

---

## Simulation physics

The engine implements [`docs/tensor-physics.md`](./tensor-physics.md), which is
the specification, not a summary of the code. Each step in
`brain_tensor_engine.cpp` carries the spec section it implements, and
`src/physics/tensor-field.js` carries the same markers on the same steps.

Do not describe the physics here — it would become a third account of it, which
is how this page came to claim something untrue. The short version:

- §6.1–6.2 region physics, hypoxia modulation, clamped 6-neighbourhood
- §6.3–6.4 fiber-coupled anisotropic diffusion and tract highway bias
- §6.5 criticality cascades
- §6.6–6.8 traveling phase wave, frontal flow bias, semi-Lagrangian fluid advection
- §6.9–6.10 stimulus (paint radius and eraser) and the hazard paths
- §6.11–6.13 ambient drive, SynaptiX mirror, decay and clamp

§8 lists the four places the CPU model deliberately differs from the shader, and
why each one has to.

### Verifying the engine

```bash
npm run test:golden    # C++ engine vs the JS reference stepper's fixture
npm run test:all       # the above, plus the Node test suite
```

`wasm/tests/golden_step_test.cpp` needs only a host C++17 compiler — not
Emscripten — so the contract is checkable in ordinary CI.

---

## Performance Notes

| Parameter | Typical value |
|-----------|--------------|
| Tensor size | 32³ = 32 768 voxels × 4 bytes = 128 KB |
| C++ O2 (Chromebook M1) | ~1–2 ms / step |
| WebGPU compute (RTX 3070) | < 0.1 ms / step (massively parallel) |

**Recommendation**: Use WebGPU compute for real-time rendering; switch to WASM for:
- Platforms without WebGPU (future headless / Node.js server-side simulation).
- Debugging simulation physics (C++ is much easier to inspect with conventional tools).
- Future: multi-threaded WASM with SharedArrayBuffer workers for higher-fidelity models.

---

## Fallback Behaviour

If the WASM build has not been run, or the browser fails to load the module, `WasmTensorEngine.init()` catches the error, logs a warning, and returns `false`. The renderer silently falls back to the WebGPU compute shader. **The visualisation is never broken by a missing WASM build.**

---

## Phase 2+ Roadmap

- **Phase 2**: Multi-compartment neuron models; region-specific fibre dynamics; connectome graph simulation.
- **Phase 3**: Real EEG/BCI tensor input pipelines; ONNX model hooks inside the C++ engine.
- **Phase 4**: ~~WebAssembly SIMD optimisation~~ (done: release builds use
  `-O3 -flto -msimd128`); WebWorker-based async compute; GPU ↔ WASM zero-copy
  interop via `GPUBuffer.mapAsync`.

### Build flags

`scripts/wasm_flags.sh` is the single definition, sourced by both
`build_wasm.sh` and `build_wasm_colab.sh`. Release builds use `-O3 -flto
-msimd128`; `FILESYSTEM=0` and `MALLOC=emmalloc` trim the glue; `EXPORT_ES6=1`
makes the glue a real ES module (`brain_tensor_engine.mjs`) that
`src/wasm-engine.js` imports from a URL built off `import.meta.env.BASE_URL`, so
it resolves under `base: '/brain-viz/'` instead of 404ing at the host root.

Two flags are deliberately **off**:

- `-mrelaxed-simd` would permit fused multiply-add, changing rounding enough to
  put the engine outside the golden fixture's epsilon. Enabling it means
  re-measuring `GOLDEN_EPSILON` in the same commit.
- `USE_PTHREADS` needs cross-origin isolation on every host that serves the app.
  `vite.config.js` sets COOP/COEP on the dev and preview servers; the production
  host (`deploy.py`) does not yet, and a pthreads build would simply fail to
  start there. Opt in with `WASM_PTHREADS=1` once those headers ship.

If the production host does not map `.mjs` to a JavaScript MIME type, the module
import will be rejected by the browser; `src/wasm-engine.js` falls back to
`brain_tensor_engine.js` from an older build, but the real fix is the server
mapping.

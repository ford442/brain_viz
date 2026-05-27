# WASM Engine — Phase 1 Technical Documentation

> **Status**: Phase 1 MVP — foundational C++ engine + JS bridge + hybrid render integration.

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

The CI environment uses `.jules/setup.sh` which automates these steps.

### Compile

```bash
# Release build (O2)
npm run build:wasm

# Debug build (O0, assertions, safe-heap)
npm run build:wasm:debug
```

Output is placed in `public/wasm/` and served as static assets by Vite.

### Vite Configuration

`vite.config.js` sets `assetsInlineLimit: 0` so the `.wasm` binary is never inlined and `assetsInclude: ['**/*.wasm']` so Vite treats it as a static asset.

---

## C++ API (`brain_tensor_engine.h`)

```c
void*    bte_create(uint32_t voxelDim);
void     bte_destroy(void* engine);
void     bte_update(void* engine, float time, float frequency, float amplitude,
                    float smoothing, float style,
                    float hypoxiaStress, float metabolicRate, float mitochondrialFn,
                    float fluidActive, float electricalActive,
                    float mercuryActive, float heavyMetal);
void     bte_inject_stimulus(void* engine, float x, float y, float z,
                             float intensity, float mitochondrialFn);
void     bte_get_tensor_data(void* engine, float* outBuffer, uint32_t bufferLen);
void     bte_reset(void* engine);
uint32_t bte_get_voxel_count(void* engine);
uint32_t bte_get_voxel_dim(void* engine);
double   bte_benchmark(void* engine, uint32_t steps, float dt);
```

---

## JavaScript API (`src/wasm-engine.js`)

```js
const wasmEngine = new WasmTensorEngine(32);

// Load and initialise (safe to call multiple times)
const ok = await wasmEngine.init();   // → true if WASM available

// Advance simulation
wasmEngine.update(time, rendererParams);

// Inject stimulus pulse
wasmEngine.injectStimulus(x, y, z, intensity, mitochondrialFn);

// Zero-copy read of tensor data (Float32Array view into WASM heap)
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

## Simulation Physics (mirrors WGSL compute shader)

The C++ engine replicates the WGSL compute shader **step for step**:

1. **Region physics** (`get_region_physics`) — decay and diffusion by anatomical zone (frontal, occipital, temporal, parietal, cyber).
2. **Hypoxia modulation** (`get_hypoxia_physics`) — scales decay/diffusion based on oxygen deprivation.
3. **Laplacian diffusion** — 6-neighbour finite difference on the 32³ grid.
4. **Directional flow** — frontal lobe upstream bias.
5. **Fluid advection** — procedural velocity field (CSF simulation).
6. **Hazard stimuli** — electrical (random spikes) and mercury (posterior accumulation).
7. **Heavy-metal structural damage** — clamps activity and decay.
8. **Base oscillation** — ambient `sin(time × frequency)` wave.
9. **Decay + clamp** — `val *= decay; clamp(0, 1)`.

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
- **Phase 4**: WebAssembly SIMD optimisation; WebWorker-based async compute; GPU ↔ WASM zero-copy interop via `GPUBuffer.mapAsync`.

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
├── brain_tensor_engine.h      C ABI — the only thing JavaScript sees
├── brain_tensor_engine.cpp    C ABI implementation (handles, copies, introspection)
├── brain_tensor_params.h      GENERATED from COMPUTE_UNIFORM_LAYOUT (gen_wasm_params.mjs)
├── compile_flags.txt          clangd fallback for a fresh clone (host golden flags)
├── compile_commands.json      GENERATED, gitignored (gen_compile_commands.mjs)
├── src/                       the engine, split by docs/tensor-physics.md section
│   ├── engine.h               engine state, §4 samplers, internal entry points
│   ├── field_math.h           §1 constants, §2 helpers, §4.1, §8.1 hash (inline)
│   ├── region.h               §3 region / hypoxia / criticality / neuromodulation (inline)
│   ├── stencil.cpp            §6.2 neighbourhood — explicit wasm SIMD + scalar fallback
│   ├── step.cpp               §6 the step
│   ├── stimulus.cpp           §6.9 one-shot stimulus
│   └── affinity.cpp           §7 fiber affinities
└── tests/
    ├── golden_step_test.cpp   C++ vs the JS reference's fixtures (npm run test:golden)
    └── bench_step.cpp         per-step cost at 32³/48³/64³ (npm run bench:wasm)

scripts/
├── wasm_flags.sh              THE flags and source list — everything below reads it
├── build_wasm.sh              Emscripten build (build_wasm_colab.sh: same, Colab emsdk)
├── test_golden.sh             host golden test (+ GOLDEN_WASM=1: the SIMD build under node)
├── bench_wasm.sh              SIMD vs scalar wasm (+ BENCH_HOST=1) timing
└── gen_compile_commands.mjs   host or Emscripten compile graph for clangd

src/
└── wasm-engine.js             JS loader + bridge (WasmTensorEngine class)

public/wasm/                        Build output (generated — do not edit)
├── brain_tensor_engine.mjs         Emscripten glue, an ES module (EXPORT_ES6)
├── brain_tensor_engine.wasm        Compiled binary
└── brain_tensor_engine.build.json  Build manifest {simd128, pthreads, debug}
```

`.h` files under `src/` are inline on purpose: `region_zone()`,
`get_region_physics()`, `clampf()` and the hash run per voxel, and the host
golden build has no LTO to inline them across translation units.

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
# Release build (-O3 -flto -msimd128) — WASM engine only
npm run build:wasm

# Debug build (-O0 -g, ASSERTIONS=2, SAFE_HEAP; still -msimd128, so it runs
# the same §6.2 kernel the release does)
npm run build:wasm:debug

# Full production build: Vite bundle + WASM engine
npm run build:full
```

Output is `public/wasm/brain_tensor_engine.{mjs,wasm,build.json}`, served as
static assets by Vite. The flags and the translation-unit list come from
`scripts/wasm_flags.sh` (`BTE_SRCS`); `em++` still links one `.mjs`/`.wasm`
pair however many TUs there are. Plain `npm run build` (used by CI) is web-only and skips this entirely; see the README's "Build tiers" section for the full breakdown.

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
uint32_t bte_params_layout_hash(void);   // BTE_PARAMS_LAYOUT_HASH
uint32_t bte_build_features(void);       // BTE_FEATURE_SIMD128 | BTE_FEATURE_PTHREADS
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

`bte_params_byte_size()` and `bte_params_layout_hash()` are the runtime guard:
`src/wasm-engine.js` compares them against `COMPUTE_UNIFORM_BYTE_SIZE` and
`COMPUTE_UNIFORM_LAYOUT_HASH` at init and refuses a `.wasm` built from an older
layout, instead of reading every field at a shifted offset. The size alone is
not enough: removing `cognitiveDissonance` shifted every later field by 4 bytes
and left the struct at 176, because `retentionBias`'s 16-byte alignment absorbed
the difference. A `.wasm` built before the fingerprint existed has no
`bte_params_layout_hash` export and is refused too — rebuild with
`npm run build:wasm`.

### Editor support

The engine has two compilers, so clangd can be given either graph. Both are
derived from `scripts/wasm_flags.sh`, never retyped:

| Graph | How | Flags | What the editor sees |
|---|---|---|---|
| Fresh clone | nothing — `wasm/compile_flags.txt` is checked in | `-std=c++17 -ffp-contract=off -Wall -Wextra` | host build; SIMD branch inactive |
| Host | `npm run gen:compile-commands` (no emsdk needed) | `BTE_HOST_FLAGS` — exactly `test_golden.sh`'s, `-O2 -ffp-contract=off` | host build; SIMD branch inactive |
| Emscripten | `npm run gen:compile-commands:wasm`, or any `build_wasm.sh` run | `em++ --cflags` (wasm32 target, sysroot) + `BTE_CLANG_FLAGS` + `-msimd128` | `__EMSCRIPTEN__`, `__wasm_simd128__`, `<wasm_simd128.h>` — the shipped code path |

The generated file is `wasm/compile_commands.json` (gitignored — absolute
paths). It lives in `wasm/` rather than the repo root because clangd uses the
*nearest* directory holding either a `compile_commands.json` or a
`compile_flags.txt`: a root-level database is shadowed by
`wasm/compile_flags.txt`, while one next to it takes precedence. The
Emscripten graph needs `em++` on `PATH` or `$EMSDK` set, and exits non-zero
otherwise; the host graph needs only `node` and `bash`.

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
the specification, not a summary of the code. The sources under `wasm/src/`
are split by spec section, each step carries the section it implements, and
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
npm run test:golden                  # C++ engine (host build) vs the JS reference's fixtures
GOLDEN_WASM=1 npm run test:golden    # + the em++ -O3 -flto -msimd128 build, under node
npm run test:all                     # npm test + npm run test:golden
```

`wasm/tests/golden_step_test.cpp` needs only a host C++17 compiler — not
Emscripten — so the contract is checkable in ordinary CI. The host build can
only run the scalar path of `src/stencil.cpp`; that still pins the SIMD path
because the two are **bit-identical** by construction (same operations in the
same order per lane, correctly-rounded `f32x4` arithmetic, no FMA in baseline
simd128, and `wasm_f32x4_pmax` — not `wasm_f32x4_max` — matching `std::max`).
`GOLDEN_WASM=1` checks it directly against the fixtures; when this was written
it measured `maxAbsDiff` 8.7e-05 / 5.1e-04 against the unchanged `GOLDEN_EPSILON`
of 2e-3 (host: 7.7e-05 / 5.0e-04 — the gap is Emscripten's libm, spec §8.3).
If a kernel change moves those numbers, that is a bug in the kernel, not a
reason to widen the epsilon.

---

## Performance

Measured with `npm run bench:wasm` (`wasm/tests/bench_step.cpp`): the golden
scenario's parameters — fiber coupling, fluid advection, hazards and a live
stimulus all on, i.e. every expensive branch taken — median ms per
`bte_update()`, V8 in Node 24, one core of an 8-vCPU x86-64 Linux VM. A browser
tab will be somewhat slower. The fibers column varied by about ±10% between runs
on this machine, so read it as a range.

| Build | 32³ fibers | 32³ isotropic | 48³ fibers | 64³ fibers | 64³ isotropic |
|---|---|---|---|---|---|
| Before the split (1 TU, `-O3 -flto -msimd128`, auto-vectoriser only) | 16–20 | 10 | 50–52 | 122–124 | 76–79 |
| Now, `-msimd128` off | 12–13 | 6 | 38–40 | 92–96 | 47–49 |
| **Now, release (`-O3 -flto -msimd128`)** | **10–13** | **5** | **35–39** | **85–98** | **40** |
| Host `-O2` (for scale) | 8 | 4.6 | 25 | 62 | 33 |

**64³ hybrid mode does not hold a 16 ms frame, and SIMD alone will not get it
there.** Neither did the old `-msimd128` flag: the auto-vectoriser left the
600-line per-voxel step entirely scalar. What moved the numbers:

1. **Hoisting per-axis transcendentals** (`step.cpp`, `AxisTables`): the six
   fluid `sin`/`cos` factors are each a function of one axis, the no-tract
   phase wave of `y`, and the §3.4 retention `exp2` of the zone. Computing them
   per step instead of per voxel was most of the win — wasm's libm is
   software, ~20–50 ns a call. Each table entry is the exact expression the
   per-voxel code evaluated on the same inputs, so the output is bit-identical.
2. **The explicit SIMD stencil** (`stencil.cpp`): ~17% at 64³ isotropic,
   within run-to-run noise once fiber gathers dominate.

Where the remaining 64³ time goes (ablation, release build, ~85 ms total):

| Turned off | 64³ fibers | Saves |
|---|---|---|
| fiber gathers (`fiberCoupling = 0` disables §6.4; §6.3 still runs) | 70 | ~15 ms |
| fluid advection (§6.8 trilinear read) | 71 | ~15 ms |
| fluid + stimulus + all hazards | 58 | ~28 ms |
| isotropic, fluid + stimulus + hazards off | 17 | per-voxel floor (§6.1/6.5/6.11) |

So the tracts (fibers vs isotropic is ~45 ms at 64³: five §4.2 nearest-voxel
samples per active slot, up to three slots per voxel) and advection are the
budget, not the stencil. The next levers, in expected order of
payoff: z-slab tiling across pthreads (needs cross-origin isolation, below),
then SIMD over the §4.2 gather address arithmetic. **Clipmap Phase B must not
assume "SIMD on" means a 64³ coarse field fits a frame.** Re-run
`npm run bench:wasm` before relying on any of these numbers.

The WebGPU compute shader does the same 64³ step in well under a millisecond on
a discrete GPU. WASM mode is for platforms without WebGPU compute, for
inspecting the physics with conventional tools, and for a future worker-hosted
or server-side stepper — not for speed.

---

## Threads and cross-origin isolation

`WASM_PTHREADS=1 npm run build:wasm` builds with `-pthread`. It is **off by
default and is not a supported shipping option yet**, for two reasons:

1. **The step is single-threaded.** A pthreads build today only proves the
   plumbing; it is no faster until `bte_update()` tiles z-slabs across workers.
2. **Production is not confirmed to be cross-origin isolated.** A `-pthread`
   module needs `SharedArrayBuffer`, which browsers only expose when the page
   is served with

   ```
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```

   `vite.config.js` sends both for `npm run dev` and `npm run preview`.
   `deploy.py` cannot: it uploads `dist/` files to the storage service's API,
   and response headers are the serving host's configuration, not part of the
   upload. Whether `test.1ink.us` / `go.1ink.us` send them is unverified.
   Check a deployed page with `crossOriginIsolated` in the devtools console;
   it must be `true`.

What happens if a pthreads build reaches a non-isolated page: the build writes
`brain_tensor_engine.build.json` next to the glue, and `WasmTensorEngine.init()`
reads it **before** importing the module (a pthreads module cannot be
instantiated to ask). If `pthreads` is true and `crossOriginIsolated` is false,
init resolves `false` with `unavailableReason` naming the missing headers, the
Activity tab's *Simulation Backend* status shows that reason, and the renderer
stays on WebGPU compute. A default build has `"pthreads": false` and loads on
any host; a build from before the manifest existed is treated the same way.

Making threads shippable means configuring the host, then flipping the default.
For an nginx-served host:

```nginx
location /brain-viz/ {
    add_header Cross-Origin-Opener-Policy  "same-origin"  always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    types { application/javascript mjs; application/wasm wasm; }
}
```

(Netlify / Cloudflare Pages read the same two headers from a `public/_headers`
file; the current host is neither, so none is shipped.) `require-corp` also
blocks any cross-origin subresource that sends neither CORS nor
`Cross-Origin-Resource-Policy`. Check ONNX models, fonts and CDN scripts before
turning it on.

---

## Fallback Behaviour

If the WASM build has not been run, the browser fails to load the module, the `.wasm` was built from a stale params layout, or a pthreads build meets a page that is not cross-origin isolated, `WasmTensorEngine.init()` catches the error, logs a warning, records it in `unavailableReason` (shown in the Activity tab), and returns `false`. The renderer silently falls back to the WebGPU compute shader. **The visualisation is never broken by a missing WASM build.**

---

## Phase 2+ Roadmap

- **Phase 2**: Multi-compartment neuron models; region-specific fibre dynamics; connectome graph simulation.
- **Phase 3**: Real EEG/BCI tensor input pipelines; ONNX model hooks inside the C++ engine.
- **Phase 4**: WebAssembly SIMD — the flag (`-msimd128`) and the §6.2 stencil
  kernel are done; the fiber gathers are not (see *Performance*). pthreads
  z-slab tiling once the host is isolated; WebWorker-based async compute; GPU ↔
  WASM zero-copy interop via `GPUBuffer.mapAsync`.

### Build flags

`scripts/wasm_flags.sh` is the single definition, sourced by
`build_wasm.sh`, `build_wasm_colab.sh`, `test_golden.sh`, `bench_wasm.sh` and
(through bash) `gen_compile_commands.mjs`. Release builds use `-O3 -flto
-msimd128`, and every graph, host and wasm alike, has `-ffp-contract=off`; `FILESYSTEM=0` and `MALLOC=emmalloc` trim the glue; `EXPORT_ES6=1`
makes the glue a real ES module (`brain_tensor_engine.mjs`) that
`src/wasm-engine.js` imports from a URL built off `import.meta.env.BASE_URL`, so
it resolves under `base: '/brain-viz/'` instead of 404ing at the host root.

Two flags are deliberately **off**:

- `-mrelaxed-simd` would permit fused multiply-add (`relaxed_madd`), changing
  rounding and breaking `src/stencil.cpp`'s bit-identity with its scalar
  fallback, and with it the golden fixture's epsilon. `npm test` fails if it
  is switched on.
- `-pthread` (`WASM_PTHREADS=1`) — see *Threads and cross-origin isolation*.

If the production host does not map `.mjs` to a JavaScript MIME type, the module
import will be rejected by the browser; `src/wasm-engine.js` falls back to
`brain_tensor_engine.js` from an older build, but the real fix is the server
mapping.

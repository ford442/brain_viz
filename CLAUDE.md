# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm install                    # Install dependencies
npm test                       # Headless Node assertions (uniform layout, shaders, tensor physics, renderer facade)
npm run test:golden            # C++ neural field vs the JS reference (needs a host C++ compiler)
npm run test:all               # npm test + npm run test:golden
npm run typecheck              # tsc --noEmit over the JSDoc-checked files (see §3b)
npm run check:facade           # Both renderer backends implement src/renderer-contract.js
npm run dev                    # Start dev server (http://localhost:5173)
npm run build                  # Build production bundle to dist/
npm run preview                # Preview production build locally
python3 scripts/test_run.py    # Smoke test (checks if server responds)
python3 verification/verify_suite.py  # Full visual verification suite (WebGL fallback)
```

## Project Overview

**Neuro-Weaver** is a high-performance 3D volumetric brain visualization engine built with WebGPU and WGSL, with a WebGL2 fallback/debug renderer. It renders stylized brain animations driven by tensor data, supporting five visualization styles (Organic surface, Cyber wireframe, Connectome fibers, Heatmap thermal, and SynaptiX comparative human/AI mode).

**Key tech:** Vanilla JavaScript (ES Modules, no TypeScript), WebGPU graphics API, WGSL compute/rendering shaders, Vite build tool.

## Architecture & Core Components

### Main Modules
- **`main.js`** — Application bootstrap. Initializes BrainRenderer, wires DOM controls, keyboard shortcuts, and runs the main update loop.
- **`brain-renderer.js`** — Core rendering engine. Manages WebGPU device/context, pipelines (render and compute), camera controls, uniforms, and the render loop. Methods: `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, `setVoxelData()`.
- **`brain-geometry.js`** — Procedurally generates a deformed UV sphere (mimics gyri/sulci) and a Manhattan-style internal circuit grid. Outputs vertex, index, fiber, and soma buffers.
- **`shaders.js`** — All WGSL code (vertex, fragment, compute, post-processing) as template strings for all five visualization styles.
- **`src/physics/tensor-field.js`** — CPU reference implementation of the neural field (`docs/tensor-physics.md`). Drives the WebGL2 fallback and is the standard the C++/WASM engine is tested against.
- **`brain-renderer-webgl.js`** / **`brain-renderer-factory.js`** — WebGL2 fallback/debug renderer and backend-selection bootstrap (`?renderer=webgpu` vs `?renderer=webgl`). See `docs/webgl-fallback.md`.
- **`routine-player.js`** — Orchestrates timed events (stimulus, camera movement, animations, audio, text, branching).
- **`tensor-player.js`** — Synthesizes BCI patterns and loads pre-recorded tensor series (.bin, .npy, .csv).
- **`inference-engine.js`** — ONNX Runtime integration for SqueezeNet inference (AI dreaming mode).
- **`audio-reactor.js`** — Web Audio API microphone input for real-time audio reactivity.
- **`synaptix-engine.js`** — AI tensor projection, phantom generation, frame playback, and resonance metrics for comparative mode.

### Data Flow
```
BrainGeometry (CPU) → Float32Array → GPUBuffer (Vertex/Index/Storage)
                                     ↓
                               Compute Shader (writes tensorData)
                                     ↓
                          Render Shader (reads tensorData)
                                     ↓
                              WebGPU Canvas
```

### Render Loop (Simplified)
1. CPU: Update time and camera matrix (MVP)
2. CPU→GPU: Upload uniforms and compute parameters via `writeBuffer`
3. GPU: **Compute pass** — Update tensor data buffer (signal propagation, diffusion)
4. GPU: **Render pass** — Clear, switch pipeline based on style, draw brain/fibers
5. GPU→Canvas: Present frame

## Critical Design Principles & Hotspots

### 1. Column-Major Matrix Multiplication ⚠️
**The Issue:** The codebase uses column-major memory layout (WGSL standard). In `math-utils.js`, `Mat4.multiply(A, B)` computes the mathematical operation **B × A**, not A × B.

**Example from `brain-renderer.js`:**
```javascript
const pv = Mat4.multiply(view, projection);  // result = Projection * View
const mvp = Mat4.multiply(model, pv);        // result = (P * V) * Model
```

**Action:** **DO NOT REFACTOR** the multiplication order to look "standard." It is already correct for this library.

### 2. Compute-Render Synchronization
The tensor animation relies on a Compute Shader modifying `tensorData` that is immediately read by the Vertex Shader in the same frame. WebGPU's command encoder order guarantees this works:
```
beginComputePass() → writes tensorData → end() → beginRenderPass() → reads tensorData
```

**Action:** Preserve this order. If `tensorData` is moved to a different bind group, verify both `STORAGE` and `VERTEX` (or `READ_ONLY_STORAGE`) flags are set.

### 3. WGSL Struct Alignment & Padding
**The Issue:** WGSL structs require strict alignment (`vec3`/`vec4`/`mat4x4` are
16-byte aligned), so an `f32` followed by a `vec4` gets invisible padding. Getting
this wrong on either side corrupts data silently rather than erroring.

**How it is handled:** `src/shaders/uniform-layout.js` is the single source of
truth and a *generator*. It declares `RENDER_UNIFORM_LAYOUT` and
`COMPUTE_UNIFORM_LAYOUT` once, and emits:

- `UNIFORMS_STRUCT_WGSL` / `TENSOR_PARAMS_STRUCT_WGSL` — the WGSL struct text that
  every shader in `src/shaders/*.js` interpolates
- `RENDER_UNIFORM_OFFSETS` / `COMPUTE_UNIFORM_OFFSETS` — the `Float32Array` /
  `DataView` offsets used by `src/brain-renderer/uniforms.js`
- `RENDER_UNIFORM_FLOAT_COUNT` / `*_BYTE_SIZE` — the GPU buffer sizes used by
  `src/brain-renderer/constants.js`

**Action:**
1. **Never hand-write `struct Uniforms { … }` or `struct TensorParams { … }`** in a
   shader file, and never hand-write an `OFFSET_*` number or a buffer byte count.
   `npm test` fails the build if you do.
2. To add a uniform, add one entry to the relevant layout array. Everything else
   follows automatically.
3. Do not add `padN` filler fields — padding is computed.

### 3a. One Neural Field, Three Consumers ⚠️
**The Issue:** the volumetric field has three implementations — the WGSL compute
shader (`src/shaders/volumetric-compute.js`), the CPU reference
(`src/physics/tensor-field.js`), and the C++/WASM engine
(`wasm/brain_tensor_engine.cpp`). They had drifted into three different feature
sets, and nothing could tell them apart.

**How it is handled:** `docs/tensor-physics.md` is the *specification*. Each
step in the CPU reference and the C++ engine cites its section number, and
`npm run test:golden` compares them against a committed 32³ fixture. The WebGL
fallback no longer has physics of its own — it calls the reference stepper.

**Action:**
1. **Never add a field effect to one implementation only.** Spec first, then
   `src/physics/tensor-field.js` and `wasm/brain_tensor_engine.cpp` together,
   then the WGSL unless §8 documents a divergence.
2. A parameter the field reads has to be in `COMPUTE_UNIFORM_LAYOUT`. The C ABI
   struct is generated from it (`node scripts/gen_wasm_params.mjs`); `npm test`
   fails if the checked-in header is stale.
3. After a deliberate physics change: `node scripts/gen_tensor_fixture.mjs`,
   then `npm run test:all`.

### 3b. One Renderer Facade, Two Backends
**The Issue:** `BrainRenderer` (WebGPU) and `BrainRendererWebGL` each assemble
their public methods from `applyXMethods(Target)` mixins spread across many
files (`src/brain-renderer/*.js`, `src/brain-renderer-webgl/*.js`). There is no
shared interface, so a method can exist on one backend and silently not the
other — `setCameraParams` once shipped as a no-op on one side this way, and a
missing `triggerTMS` on the WebGL side threw mid-routine.

**How it is handled:** `src/renderer-contract.js` is a JSDoc-only
`BrainRendererFacade` typedef listing the app-facing method surface
`main.js`, `RoutinePlayer`, BCI, WebXR, Double Mirror sessions, and SynaptiX
call on either backend. `scripts/check-renderer-facade.mjs` (`npm run
check:facade`, part of `npm test`) statically greps every mixin file for each
facade method name and fails if either backend is missing one — a JSDoc
`@implements` on the classes themselves doesn't work here because TypeScript
can't see prototype methods attached by a mixin in another file (see the
class-level comments in `brain-renderer.js` / `brain-renderer-webgl.js`).
`docs/webgl-fallback.md` has the human-readable capability matrix.

**Action:**
1. A new method that belongs on both backends (i.e. app code should be able
   to call it without a capability check) gets a `@property` entry in
   `BrainRendererFacade` **and** an implementation on both
   `BrainRenderer`/`BrainRendererWebGL` before it ships. `npm run
   check:facade` fails the build otherwise.
2. A backend-specific extension (WebGPU pipeline internals, WebGL debug/XR
   helpers) does not belong in the facade — document it in the "Extensions"
   block at the bottom of `renderer-contract.js` instead, and have callers
   guard it (`renderer.method?.(...)`, a `backendType` check).
3. Individual files can opt into `// @ts-check` (see `jsconfig.json`); `npm
   run typecheck` runs `tsc -p jsconfig.json --noEmit` over whichever files
   do. This project has no `.ts` files and no TypeScript syntax — checking is
   JSDoc-only, same as `RendererParams` in `src/types.js`.

### 3c. One Field Resolution, Nine Consumers
**The Issue:** the grid size was the literal `32`, retyped independently in both
renderer constructors, in WGSL as `const VOXEL_DIM: u32 = 32u`, in the C++
engine, in SynaptiX, in the BCI resampler, in the NWS1 manifest, in the
coupling model's region index lists, and in the sonification lobe stats. It
could not be changed — only retyped everywhere and hoped for — which blocked
every "more detail" ambition behind it.

**How it is handled:** `src/voxel-dim.js` is the single source of truth
(`DEFAULT_VOXEL_DIM` is still 32, so nothing about the default moved).
`renderer.setVoxelDim(dim)` is on the shared facade and implemented on both
backends; WGSL reads `uniforms.voxelDim` / `params.voxelDim` through
`voxel_dim()`. `docs/field-resolution.md` has the full picture, including what
is still 32³ and the unstarted clipmap/recursive-zoom phases.

**Action:**
1. **Never write a bare `32`, `32 ** 3`, or `32*32*32` for a grid size.** Use
   `DEFAULT_VOXEL_DIM`, `voxelCountFor()`, `tensorByteLengthFor()`,
   `fiberAffinityByteLengthFor()`, or `inferVoxelDim()` for a buffer you were
   handed. `npm test` fails the build if a shader re-declares `VOXEL_DIM`.
2. A new GPU resource whose size is a function of `voxelCount` must be created
   in `createTensorStorageBuffers()` and rebuilt by `setVoxelDim()` — and any
   bind group holding it recreated, or the pipelines read the freed buffer.
3. A dimension arriving from outside the engine (file header, UI, API) goes
   through `assertVoxelDim()` (hard boundary) or `normalizeVoxelDim()` (soft).
4. `SUPPORTED_VOXEL_DIMS` entries must satisfy `dim³ % 64 === 0` (the compute
   workgroup size) and fit the limits `deriveRequiredLimits()` asks for.

### 4. Minimal Automated Tests
`npm test` runs headless Node assertions (`tests/test_uniform_layout.js`,
`tests/test_shader.js`, `tests/test_tensor_physics.js`) — no WebGPU, no browser
— covering uniform-struct alignment/drift, fiber geometry, and the neural-field
contract. `npm run test:golden` additionally compiles the C++ engine with a host
compiler and checks it against the same fixture. CI runs them before the build.
Everything else is **manual and visual**. Verify:
- Brain renders and animates smoothly (~60 FPS)
- UI controls function correctly
- Shader changes produce expected visuals in real-time

Run `npm run dev` and test in Chrome 113+/Edge 113+ (requires WebGPU support).

### 5. SynaptiX Comparative Path
SynaptiX is enabled by `style >= 4.0` and adds:

- `aiTensorBuffer` as a second `voxelDim`³ storage buffer (32³ by default — see §3c)
- render uniforms `aiInfluence`, `resonanceThreshold`, and `aiLayer`
- built-in phantom activations from `src/synaptix-engine.js`
- default projector mapping:
  - early activations -> occipital
  - lower-mid -> temporal
  - upper-mid -> parietal
  - deep -> frontal

Routine files can drive SynaptiX through the custom `synaptix` event type. First-run demos should prefer code-native phantoms instead of external tensor assets.

## Code Style & Conventions

- **Pure JavaScript.** No TypeScript syntax (types, interfaces, generics) in `.js` files.
- **ES Modules.** Use `import`/`export`; no CommonJS.
- **Naming:** `camelCase` for functions/variables, `PascalCase` for classes (e.g., `Mat4`).
- **No frameworks.** Keep the codebase framework-free (no React, Vue, Angular).
- **Comments:** Use `// [Neuro-Weaver]` or `// [Phase N]` tags for major subsystem changes.

## Browser & Environment

- **WebGPU is the primary/authoritative renderer.** Chrome 113+, Edge 113+. A WebGL2 fallback renderer (`?renderer=webgl`) exists for debugging, automation, and headless CI/verification — it is a simplified debug/reference path, not a full-fidelity alternative. See `docs/webgl-fallback.md`.
- **No TypeScript.** Rely on JSDoc comments for type hints where useful.
- **No node_modules in git.** Run `npm install` after cloning.

## Common Tasks

### Adding a Visualization Style
1. Add shader code to `shaders.js` (vertex, fragment, compute as needed)
2. Add style constant and logic to `brain-renderer.js`
3. Add UI control to `index.html` and wire in `main.js`

### Changing the Field Resolution
1. `renderer.setVoxelDim(48)` — or the "Field Resolution" selector in the
   Activity tab. Both backends implement it; the live field is resampled, not reset.
2. To add a new supported resolution, extend `SUPPORTED_VOXEL_DIMS` in
   `src/voxel-dim.js` and check `deriveRequiredLimits()` still asks for enough.
3. Run `npm test` (`tests/test_voxel_dim.js` exercises every listed dim).

### Adding a Uniform Parameter
1. Add one entry to `RENDER_UNIFORM_LAYOUT` in `src/shaders/uniform-layout.js`
   (or `COMPUTE_UNIFORM_LAYOUT` for a compute/sim param)
2. **Do not** touch the WGSL struct, the JS offsets, or the buffer size — all three
   are generated from that array. Padding is computed; never add `padN` fields.
3. Read it in WGSL as `uniforms.<name>` / `params.<name>`, and write it in
   `src/brain-renderer/uniforms.js` via `R.<name>` / `cOff('<name>')`
4. Add UI slider to `index.html` and wire in `main.js`
5. Run `npm test`

### Adding a Brain Region Stimulus
1. Define region bounds in `brain-renderer.js` `injectStimulus()`
2. Update compute shader logic in `shaders.js` to handle the region
3. Add button to `index.html` and wire in `main.js`

### Testing Shader Changes
```bash
npm run dev
# Open http://localhost:5173 in Chrome 113+/Edge
# Verify visually in real-time
```

## Known Limitations

- **Thin automated coverage.** `npm test` covers uniform-buffer layout, fiber geometry and the neural-field fixture; `npm run test:golden` covers the C++ engine. Everything visual is manual, plus a Playwright-based `verification/` suite that runs against the WebGL2 fallback.
- **No WGSL-vs-CPU comparison.** The golden fixture pins the JS and C++ implementations to each other. Comparing the shader itself needs a software WGSL runner; see `docs/tensor-physics.md` §8 for the divergences that are intentional.
- **WebGPU-primary, strict browser requirement for full fidelity.** The WebGL2 fallback trades visual/simulation fidelity for portability and automation.
- **Memory fixed at startup.** Window resize recreates depth texture but not geometry buffers.
- **Routine branching pauses.** `choice` and `wait` events pause the routine player.
- **Large repo.** Historical node_modules and large binaries (WASM, ONNX models) increase clone size. Use `git clone --depth 1` for faster clones.

## Documentation Reference

`AGENTS.md` is the source of truth for architecture and conventions; this file, `.github/copilot-instructions.md`, and `docs/grok-agent-guide.md` are kept in sync with it. For deeper technical details, see:
- **AGENTS.md** — Comprehensive project overview and agent responsibilities (source of truth)
- **docs/ROADMAP.md** — Phase history, open items, and dream backlog
- **CONTRIBUTING.md** — "Where to look" map across all docs
- **docs/DEVELOPER_CONTEXT.md** — Complexity hotspots, dependency flows, inherent limitations
- **docs/ARCHITECTURE.md** — Detailed module breakdown
- **docs/SCIENTIFIC_ACCURACY_REPORT.md** — Physiological models verification
- **docs/tensor-physics.md** — The neural-field specification (normative; read before changing any field code)
- **docs/field-resolution.md** — How the field's grid resolution is carried and changed (`voxelDim`), and the unstarted clipmap/recursive-zoom phases
- **docs/webgl-fallback.md** / **docs/wasm-engine.md** — WebGL2 fallback and WASM hybrid engine details
- **.github/copilot-instructions.md** — Comprehensive guide for AI agents

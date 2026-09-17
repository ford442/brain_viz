# Brain Visualization Architecture

> This is the module-by-module map. For the full narrative (feature list, tech stack,
> workflows) see [`AGENTS.md`](../AGENTS.md) — the source of truth this file is kept in
> sync with. For hotspots/gotchas/dependency flows see
> [`docs/DEVELOPER_CONTEXT.md`](DEVELOPER_CONTEXT.md). For the WebGPU/WebGL2 renderer
> contract both backends implement, see [`src/renderer-contract.js`](../src/renderer-contract.js)
> and the capability matrix in [`docs/webgl-fallback.md`](webgl-fallback.md).

## Overview

Neuro-Weaver renders a stylized 3D volumetric brain driven by a real-time 32×32×32
tensor field, using WebGPU + WGSL as the primary graphics/compute path and a WebGL2
fallback for debugging, automation, and headless CI (see
[`docs/webgl-fallback.md`](webgl-fallback.md)). `src/` has grown well beyond a single
renderer file as features shipped; the groups below reflect its current shape, not
an exhaustive listing — use `Glob`/`Grep` or an Explore agent for that.

## File Structure

### Entry point & bootstrap

- **`index.html`** — Canvas, control-panel UI, error overlay for unsupported browsers.
- **`src/main.js`** and **`src/main-*.js`** (`main-dom.js`, `main-renderer-setup.js`,
  `main-update-loop.js`, `main-routine-engine.js`, `main-reactivity-integration.js`,
  `main-synaptix-integration.js`, `main-training-integration.js`,
  `main-sonification-integration.js`, `main-paint-integration.js`) — application
  bootstrap, split by concern: DOM/control wiring, renderer construction and device-loss
  recovery, the `requestAnimationFrame` update loop, and per-feature integration glue.

### Rendering core (shared by both backends)

- **`src/brain-renderer.js`** — WebGPU renderer (`BrainRenderer`). Assembles its method
  surface from `src/brain-renderer/*.js` mixins (`core-methods.js` device/lifecycle,
  `gpu-context.js` adapter/device/canvas setup, `pipelines.js` render/compute pipeline
  creation, `geometry.js`, `stimulus.js`, `uniforms.js`, `render-loop.js`,
  `synaptix-bridges.js`, `constants.js`).
- **`src/brain-renderer-webgl.js`** — WebGL2 fallback/debug renderer
  (`BrainRendererWebGL`), assembled the same way from `src/brain-renderer-webgl/*.js`
  (`geometry.js`, `immune.js`, `state.js`, `tensor-sim.js`, `dynamic-buffers.js`,
  `draw.js`, `lifecycle.js`).
- **`src/brain-renderer-factory.js`** — backend selection (`?renderer=webgpu|webgl`)
  and automatic fallback bootstrap.
- **`src/renderer-contract.js`** — JSDoc-only `BrainRendererFacade` typedef: the
  app-facing method surface both renderer classes must implement. Enforced by
  `scripts/check-renderer-facade.mjs` (`npm run check:facade`).
- **`src/pathway-renderer.js`** — connectome pathway selection/pulse/block state,
  shared via `applyPathwayMethods()` by both backends.
- **`src/brain-geometry.js`** (+ `src/geometry/`) — procedural deformed UV-sphere
  cortex, organic connectome fiber bundles (Bézier-spline white-matter tracts), and
  instanced soma placement. Assembled from mixins the same way as the renderers.
- **`src/shaders.js`** and **`src/shaders/*.js`** — WGSL template strings (vertex,
  fragment, compute, post-process, per-style variants) plus
  **`src/shaders/uniform-layout.js`**, the generator described in
  [CLAUDE.md](../CLAUDE.md) §3 that is the single source of truth for uniform struct
  layout, offsets, and buffer sizes (never hand-edit those in shader files).
- **`src/math-utils.js`** — `Mat4` (column-major; see the hotspot note in
  `DEVELOPER_CONTEXT.md`), easing curves, spline evaluation.

### Neural-field physics

- **`docs/tensor-physics.md`** — the normative specification.
- **`src/physics/tensor-field.js`** — CPU reference stepper; drives the WebGL2
  fallback and is the standard `wasm/brain_tensor_engine.cpp` is golden-tested against
  (`npm run test:golden`).
- **`src/shaders/volumetric-compute.js`** — the WGSL compute-shader implementation
  (WebGPU's authoritative path).
- **`wasm/brain_tensor_engine.{h,cpp}`** + **`src/wasm-engine.js`** — optional C++/WASM
  hybrid engine and its JS loader/bridge (`npm run build:wasm`).

### Routines, BCI, XR, reactivity

- **`src/routine-player.js`**, **`src/routine-handlers/*.js`**, **`src/routine-camera.js`**,
  **`src/routine-csv.js`**, **`src/routine-procedural.js`**, **`src/nwroutine-format.js`**,
  **`src/mini-routines/`** — the timed-event sequencer, its per-type handlers, camera
  director, CSV/fMRI import, procedural generation, and keyboard-triggered mini-routines.
- **`src/tensor-player.js`**, **`src/bci/`** — synthetic pattern generation and
  live/pre-recorded BCI tensor playback (Muse/OpenBCI adapters, DSP, recording/replay).
- **`src/webxr-manager.js`** — WebGL2-only stereo VR/AR session, navigation, controller
  stimulus injection (see the WebXR-only note in `src/renderer-contract.js`).
- **`src/audio-reactor.js`**, **`src/reactivity-router.js`** — mic input and the
  bass/energy/brightness/onset reactivity bus.
- **`src/neuromodulators.js`**, **`src/paint-controller.js`**, **`src/raycast-utils.js`**
  — neuromodulator profiles, click/drag stimulus painting, canvas raycasting.

### SynaptiX comparative mode

- **`src/synaptix-engine.js`** — AI tensor projection, phantom activations, frame
  playback, resonance metrics (see [`docs/SYNAPTIX_SPEC.md`](SYNAPTIX_SPEC.md)).
- **`src/synaptix-coupling.js`** — human/AI regional coupling state.
- **`src/inference-engine.js`** — ONNX Runtime SqueezeNet wrapper for AI "dreaming" mode.

### Double Mirror sessions

- **`src/session-recorder.js`** — 10 Hz observational capture (tensor + optional
  camera/audio), spilled to temporary IndexedDB storage.
- **`src/session-format.js`** — strict NWS1 binary codec for `.nwsession` files.
- **`src/session-player.js`** — synchronized human-tensor replay/scrubbing while
  preserving the SynaptiX partner tensor.
- **`src/session-analysis.js`** — occipital/audio descriptive analysis and CSV export.
- **`src/ui-session-panel.js`** — consent, transport, overlays, downloads.

### UI

- **`src/ui-*.js`** (panels, overlays, legend, mode selector, BCI/training/XR/timeline
  panels) and **`src/ui/templates/*.js`** — DOM construction and wiring, framework-free.
- **`src/timeline-editor.js`** — GUI routine timeline editor.

### Training & sonification

- **`src/training-engine.js`**, **`src/sonification-engine.js`** — supplementary
  feature engines wired through their respective `main-*-integration.js` module.

### Tests, scripts, verification

- **`tests/`** — headless Node assertions (`npm test`): uniform-layout drift, shader
  contract, tensor-physics fixture, and the renderer facade check.
- **`scripts/`** — build/deploy/test helpers, including `check-renderer-facade.mjs`
  (`npm run check:facade`), `gen_wasm_params.mjs`, `gen_tensor_fixture.mjs`, and the
  WASM build scripts.
- **`verification/`** — Python/Playwright visual-regression suite against the WebGL2
  fallback (`python3 verification/verify_suite.py`).
- **`jsconfig.json`** + `// @ts-check` — JSDoc typechecking for the files that opt in
  (renderer internals, `routine-player.js`, `wasm-engine.js`, `types.js`); run with
  `npm run typecheck`. See [CLAUDE.md](../CLAUDE.md) for why this project stays on
  JSDoc instead of adding `.ts` sources.

## How It Works

1. **Initialization** — request a WebGPU adapter/device (or a WebGL2 context on the
   fallback), generate brain geometry, create GPU buffers for vertices/normals/indices/
   tensor data, and build the render and compute pipelines.
2. **Animation loop** — WebGPU: a compute pass advances the neural field into the
   tensor storage buffer, then a render pass reads it to displace/color vertices, in the
   same command encoder so ordering is guaranteed (see CLAUDE.md §2). WebGL2: the CPU
   reference stepper (`src/physics/tensor-field.js`) advances the same field once per
   frame and the result is uploaded as dynamic vertex/color buffers.
3. **Tensor field** — a 32×32×32 field evolving under fiber-coupled anisotropic
   diffusion, criticality cascades, and semi-Lagrangian advection, per
   [`docs/tensor-physics.md`](tensor-physics.md) — not a simple sinusoidal wave.
   Displacement, color, and per-style effects are all driven by this field.
4. **Interactivity** — mouse drag orbits the camera, wheel zooms, click/drag paints
   stimulus into a brain region; routines, BCI streams, and SynaptiX phantoms can drive
   the same field programmatically through the renderer facade.

## Key Features

- GPU compute shaders drive tensor evolution (WebGPU) with a CPU reference fallback
  (WebGL2) that implements the same specification.
- Five visualization styles: Organic, Cyber, Connectome, Heatmap, and SynaptiX.
- Scripted routines, live BCI input, WebXR immersion, and Double Mirror session
  capture/replay, all sharing the renderer facade in `src/renderer-contract.js`.

## Browser Requirements

- **Primary renderer (WebGPU):** Chrome 113+ / Edge 113+ (or another WebGPU-capable
  browser) with hardware acceleration enabled.
- **Fallback renderer (WebGL2):** any modern WebGL2 browser, used for debugging,
  automation, and headless CI/verification — see
  [`docs/webgl-fallback.md`](webgl-fallback.md). It is a simplified debug/reference
  path, not a full-fidelity alternative to WebGPU.

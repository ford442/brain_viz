# WebGL2 Fallback Renderer

## Purpose

The WebGL2 path is a secondary renderer for:

- agent-visible visual debugging
- CI and smoke checks in environments where WebGPU is hard to inspect
- feature-port work between CPU/reference rendering and the full WGSL pipeline

WebGPU remains the authoritative renderer for final visual quality.

## Tensor physics

The fallback does **not** have a simulation of its own. It used to: a simplified
wave/coupling/paint approximation in `src/brain-renderer-webgl/tensor-sim.js`
that was never a port of the WGSL compute shader and drifted further from it
with every new effect, so CI screenshots were rendering different physics from
the app.

`updateTensorSimulation()` now calls the shared CPU reference stepper in
`src/physics/tensor-field.js`, which implements
[`docs/tensor-physics.md`](./tensor-physics.md) — the same specification the
C++/WASM engine implements. `tensor-sim.js` keeps only what is genuinely
renderer-specific: field sampling, resonance, and the per-style colour ramps.

Two consequences worth knowing:

- The fallback is slower per frame than it was — it is running the real field
  (fiber-coupled anisotropic diffusion, criticality cascades, semi-Lagrangian
  advection) at 32³ on the CPU, not a cheap approximation. Measured at roughly
  15–25 ms per step in a browser JS engine, which puts a ceiling of about
  40–60 FPS on the fallback on hardware where rasterisation is free. In the
  headless CI configuration (SwiftShader, `--disable-gpu`) rasterisation
  dominates and the step is around a tenth of the frame, so the suite's timings
  are essentially unchanged. This is a debug and automation path; matching the
  real physics is worth more here than frame rate.
- `src/shaders/volumetric-compute.js` still differs from the CPU model in four
  documented places (the voxel hash, and three points where a GPU-convenient
  discontinuity cannot be reproduced consistently on two CPUs). See
  `docs/tensor-physics.md` §8 before treating a small difference between a
  WebGPU and a WebGL screenshot as a bug.

## Selection

- `?renderer=webgpu` forces the primary WebGPU path
- `?renderer=webgl` forces the WebGL2 fallback
- the control-panel backend dropdown persists the last renderer choice in `localStorage`

If the requested backend fails during initialization, `brain-renderer-factory.js` attempts the other backend and records the fallback reason in the UI.

## Shared Contracts

Both renderers implement the same app-facing method surface, documented as a
single JSDoc contract in
[`src/renderer-contract.js`](../src/renderer-contract.js)
(`BrainRendererFacade`) — `main.js`, `RoutinePlayer`, the BCI bridge, WebXR,
Double Mirror sessions, and SynaptiX all call these without checking which
backend is active:

- `setParams()` / `setSynaptiXParams()` / `setCameraParams()`
- `injectStimulus()` / `injectElectrical()` / `injectMercury()`
- `triggerLesion()` / `triggerTMS()`
- `setVoxelData()` / `getVoxelDataSnapshot()`
- `setPartnerTensorData()` (`setAITensorData()` remains an alias)
- `setSynaptiXCoupling()` / `benchmarkSynaptiX()`
- `enableWasmMode()` / `disableWasmMode()` / `runWasmBenchmark()`
- `selectPathway()` / `setPathwayBlocked()` / `pulsePathway()` / `getPathwayState()` / `getPathwayRenderState()`
- `spawnImmuneParticles()` / `clearImmuneParticles()`
- `calmState()` / `resetActivity()` / `updateAltitudeState()`
- `start()` / `stop()` / `render()` / `initialize()`

`scripts/check-renderer-facade.mjs` (`npm run check:facade`, part of `npm
test`) enforces this list statically against both backends' source files —
see [CLAUDE.md](../CLAUDE.md) §3b for why a JSDoc `@implements` on the
classes themselves can't do this (the methods above are attached by mixins
that TypeScript can't see across a module boundary).

Both renderers also share:

- `BrainGeometry` output
- two independent 32x32x32 avatar/partner tensor buffers
- camera orbit / zoom state
- style selection and SynaptiX controls

## Capability Matrix

Backend-specific extensions — not part of the shared facade, called behind a
capability check (`renderer.method?.(...)`, `renderer.backendType`). A new PR
must add a row here (or extend an existing one) when it adds a feature to
only one backend, and say why the other doesn't need it.

| Feature | WebGPU (`BrainRenderer`) | WebGL2 (`BrainRendererWebGL`) | WASM engine |
|---|---|---|---|
| Tensor field evolution | Compute shader (`src/shaders/volumetric-compute.js`), authoritative | CPU reference stepper (`src/physics/tensor-field.js`) | Optional drop-in for either backend's stepper via `enableWasmMode()`; WebGPU only today — WebGL's `enableWasmMode()` warns and returns `false` |
| 5 visualization styles (Organic/Cyber/Connectome/Heatmap/SynaptiX) | Full WGSL pipelines | Supported, simplified shading | — |
| Post-processing (aberration, grain, DoF, fog) | Dedicated post pipeline | Not implemented | — |
| Camera controls, TMS/lesion/stimulus injection, pathways, immune particles | Full | Full (same facade methods, see above) | — |
| Device-loss recovery (`dispose()`, `reinitialize()`, `handleDeviceLost()`, `reconfigure()`) | Yes (GPU device loss is a real WebGPU event) | Not applicable — no equivalent context-loss model | — |
| Debug visualization (`setDebugOptions()`/`getDebugOptions()`: wireframe, tensor-point visibility, layer isolation) | Not implemented | Yes | — |
| WebXR (`beginXRFrame()`, `drawXRView()`) | Not implemented | Yes — `webxr-manager.js` requires the WebGL2 backend and throws if WebGPU is active | — |
| SynaptiX performance stats (`getSynaptiXPerformanceStats()`) | Frame-time based | Work-unit based (different stat shape — see `synaptixPerformance` on each class) | — |

## Differences

### WebGPU

- compute shader owns tensor evolution
- WGSL pipelines drive cortex, fibers, somas, sparks, and post
- authoritative feature path

### WebGL2

- CPU-side tensor update approximates diffusion / coupling
- dynamic vertex and color uploads drive the visible scene
- adds debug controls for wireframe, tensor-point visibility, and layer isolation
- intended as a reference/debug renderer, not a perfect match for the WGSL path

## Porting Notes

When moving a visual or scientific feature from WebGL2/reference logic back into WebGPU:

1. Prove the state contract in `main.js` first.
2. Keep geometry ownership in `BrainGeometry`.
3. Treat the WebGL2 path as an inspectable reference for:
   - tensor-to-structure mapping
   - style-specific color and visibility rules
   - SynaptiX blending behavior
4. Re-implement the final behavior in WGSL rather than trying to mirror WebGL2 buffer churn one-for-one.
5. Preserve explicit backend selection and never remove the fallback toggle during cutovers.

## Verification

Recommended smoke path:

```bash
npm run dev
```

Then check:

- `http://127.0.0.1:5173/?renderer=webgl`
- backend status shows `active: webgl`
- style changes still affect cortex/fiber/tensor output
- WebGL debug controls visibly change the scene

### Automated Verification

The Playwright-based verification suite uses the WebGL2 fallback by default (`?renderer=webgl`) because:

- **WebGPU headless is unreliable** — Chromium's SwiftShader + `--enable-unsafe-webgpu` frequently triggers `GPUDeviceLostInfo` and context-loss errors.
- **WebGL2 is deterministic** — Screenshots are stable across runs in headless mode.
- **Debug controls are scriptable** — Wireframe, tensor visibility, and layer isolation can be toggled via DOM inputs for targeted visual regression.

Run the full suite:

```bash
python verification/verify_suite.py
```

Individual checks:

```bash
python verification/verify_brain.py      # Cycles all 5 styles + wireframe/isolation debug
python verification/verify_stimulus.py   # Frontal / parietal / temporal / occipital / deep stimuli
python verification/verify_camera.py     # Camera presets and spline fly-throughs
python verification/verify_routine.py    # Mini-routines (heartbeat, respiration, electrical)
python verification/verify_synaptix.py   # SynaptiX AI↔Human resonance blending
```

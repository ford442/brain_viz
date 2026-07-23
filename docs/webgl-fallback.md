# WebGL2 Fallback Renderer

## Purpose

The WebGL2 path is a secondary renderer for:

- agent-visible visual debugging
- CI and smoke checks in environments where WebGPU is hard to inspect
- feature-port work between CPU/reference rendering and the full WGSL pipeline

WebGPU remains the authoritative renderer for compute-driven tensor physics and final visual quality.

## Selection

- `?renderer=webgpu` forces the primary WebGPU path
- `?renderer=webgl` forces the WebGL2 fallback
- the control-panel backend dropdown persists the last renderer choice in `localStorage`

If the requested backend fails during initialization, `brain-renderer-factory.js` attempts the other backend and records the fallback reason in the UI.

## Shared Contracts

Both renderers consume the same high-level app contract from `main.js`:

- `setParams()`
- `setSynaptiXParams()`
- `setCameraParams()`
- `injectStimulus()`
- `setVoxelData()`
- `setPartnerTensorData()` (`setAITensorData()` remains an alias)
- `start()` / `stop()`

Both renderers also share:

- `BrainGeometry` output
- two independent 32x32x32 avatar/partner tensor buffers
- camera orbit / zoom state
- style selection and SynaptiX controls

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

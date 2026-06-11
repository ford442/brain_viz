# Neuro-Weaver

Neuro-Weaver is a brain-visualization engine for comparative neural storytelling. Its primary renderer is WebGPU, and it now ships with a toggleable WebGL2 fallback for debugging, automation, and renderer-port work. Both paths render the same 32x32x32 tensor field as animated cortex, fibers, somas, and thermal volume, then layer routines, stimuli, audio reactivity, ONNX inference, and optional C++ WASM simulation on top.

## SynaptiX First

**SynaptiX** is the fastest way to understand the project. It mirrors a human tensor against a synthetic or AI-driven tensor and highlights:

- resonance: where the fields align
- divergence: where synthetic activation drifts from human activity
- anatomy mapping: occipital for early visual features, temporal/parietal for mid-level integration, frontal for deeper reasoning traces

Out of the box, SynaptiX ships with built-in "phantom" activations, so first-time users do not need external tensor files.

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL in Chrome or Edge with WebGPU enabled.

Renderer selection:

- `?renderer=webgpu` forces the full WebGPU pipeline.
- `?renderer=webgl` forces the WebGL2 fallback/debug renderer.
- The control-panel backend dropdown persists your last selection in `localStorage`.

Then try one of these:

1. Press `X` to run the SynaptiX showcase.
2. Open the `SynaptiX` tab and click `Run SynaptiX Showcase (X)`.
3. Load `/routines/synaptix_resonance.json` or `/routines/synaptix_hallucination.json` through the routine UI.

## What You’ll See

- `Organic`, `Cyber`, `Connectome`, and `Heatmap` are the baseline render styles.
- `SynaptiX` adds a second AI tensor buffer and comparative shader path.
- Built-in phantoms include aligned-prefrontal, hallucination-spike, visual-mismatch, and full-resonance.
- The showcase animates camera moves, bilateral stimuli, blend shifts, and resonance transitions without requiring external assets.

## Common Commands

```bash
npm run build
npm run preview
python3 scripts/test_run.py
python3 verification/verify_synaptix.py
```

## WebGL2 Fallback

Use the WebGL2 path when you need a visually inspectable reference renderer:

- easier agent and CI smoke checks
- debug helpers for wireframe, tensor points, and layer isolation
- comparison target while porting scientific 3D features back into WGSL/WebGPU

The WebGL2 path shares the same geometry generator, tensor buffers, camera state, style controls, and SynaptiX inputs. It is intentionally simpler than the WebGPU renderer: it approximates compute-driven volumetrics on the CPU so the scene remains debuggable in environments where WebGPU is hard to inspect automatically.

## SynaptiX Notes

- Human activity lives in `tensorBuffer`; AI activity lives in `aiTensorBuffer`.
- The renderer blends them visually using `aiInfluence`, `resonanceThreshold`, and `aiLayer`.
- Non-32^3 activations are projected into the brain volume by `src/synaptix-engine.js`.
- Story routines for SynaptiX are served from [`public/routines`](public/routines).

See [docs/synaptix.md](docs/synaptix.md) for the mapping table, routine vocabulary, and instructions for recording your own activations.
See [docs/webgl-fallback.md](docs/webgl-fallback.md) for backend selection, debug controls, and WebGL-to-WebGPU porting notes.

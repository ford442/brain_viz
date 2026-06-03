# Neuro-Weaver

Neuro-Weaver is a WebGPU brain-visualization engine for comparative neural storytelling. It renders a live 32x32x32 tensor field as animated cortex, fibers, somas, and thermal volume, then layers routines, stimuli, audio reactivity, ONNX inference, and optional C++ WASM simulation on top.

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
python test_run.py
python verification/verify_synaptix.py
```

## SynaptiX Notes

- Human activity lives in `tensorBuffer`; AI activity lives in `aiTensorBuffer`.
- The renderer blends them visually using `aiInfluence`, `resonanceThreshold`, and `aiLayer`.
- Non-32^3 activations are projected into the brain volume by `src/synaptix-engine.js`.
- Story routines for SynaptiX are served from [`public/routines`](public/routines).

See [docs/synaptix.md](docs/synaptix.md) for the mapping table, routine vocabulary, and instructions for recording your own activations.

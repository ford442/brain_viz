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

## Switching Modes

A segmented pill selector sits at the top of the control panel and is always visible. Click a pill, or use the keyboard:

| Key | Mode | Description |
| --- | --- | --- |
| `1` | Organic | Smooth volumetric cortical surface shell. |
| `2` | Cyber | Glowing wireframe circuit lattice. |
| `3` | Connectome | Symmetrical glowing DTI fibre tracts (see below). |
| `4` | Heatmap | Volumetric thermal activity field. |
| `5` | SynaptiX | AI ↔ Human mirror comparison (`X` still runs the full showcase). |

The active mode is highlighted with a glow and a brief mode toast. Switching only updates a uniform — no pipeline rebuild — so rapid toggling is glitch-free in both the WebGPU and WebGL2 backends. Mode hotkeys are ignored while typing in a text field or slider.

### Connectome modes

The Connectome view defaults to **anatomical tractography**: bilaterally symmetric fibre bundles coloured by local orientation (DTI-style L-R red / I-S green / A-P blue) with a luminous emissive core. Three sliders tune it (Activity tab):

- **Connectome Variant** — `0` Anatomical DTI tracts ↔ `1` abstract *Reasoning Pathways* routing for SynaptiX storytelling.
- **Fiber Symmetry** — `0` free/organic ↔ `1` mirrored hemispheres.
- **Bundle Coherence** — higher values tighten fibres within each tract for a cleaner look.

All three keep the existing real-time signal pulsing, soma scaling, and spark pipelines intact.

## Common Commands

```bash
npm install
npm run dev              # dev server, http://localhost:5173
npm run build            # web-only production build (default, no toolchain needed)
npm run build:full       # web + optional C++ WASM hybrid engine (requires Emscripten)
npm run preview
python3 scripts/test_run.py
python3 verification/verify_synaptix.py
```

### Build tiers

Neuro-Weaver's WASM engine is an optional runtime feature (`src/wasm-engine.js` falls back to the WebGPU/WebGL compute path when the module is absent), so it is never required to produce a working build:

| Tier | Command | Requires Emscripten? | Produces |
|------|---------|----------------------|----------|
| Dev | `npm run dev` | No | Vite dev server with hot reload |
| Web-only production | `npm run build` (alias: `npm run build:web`) | No | `dist/` — Vite bundle only |
| Full hybrid | `npm run build:full` | Yes | `dist/` + `public/wasm/brain_tensor_engine.{js,wasm}` |

`npm run build` runs a `prebuild` check (`scripts/check_wasm.sh`) that prints an advisory notice — never a failure — when `public/wasm/` hasn't been built. To build the WASM engine on its own (e.g. after installing Emscripten via `.jules/setup.sh`), run `npm run build:wasm`; it locates `em++` via `$EMSDK`, an `emsdk` checkout in the repo root or `$HOME`, or an already-activated shell, instead of a hardcoded path. See [docs/wasm-engine.md](docs/wasm-engine.md) for details.

## WebGL2 Fallback

Use the WebGL2 path when you need a visually inspectable reference renderer:

- easier agent and CI smoke checks
- debug helpers for wireframe, tensor points, and layer isolation
- comparison target while porting scientific 3D features back into WGSL/WebGPU

The WebGL2 path shares the same geometry generator, tensor buffers, camera state, style controls, and SynaptiX inputs. It is intentionally simpler than the WebGPU renderer: it approximates compute-driven volumetrics on the CPU so the scene remains debuggable in environments where WebGPU is hard to inspect automatically.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

1. `npm ci`
2. `npm run build` (equivalent to `npx vite build`) — frontend-only production build. CI does not provision an Emscripten SDK, so it never runs `build:full`/`build:wasm`; the WASM engine is optional at runtime (see [docs/wasm-engine.md](docs/wasm-engine.md)).
3. `python3 scripts/test_run.py` — dev server smoke test.
4. `pip install playwright` + `playwright install chromium` — sets up the Python Playwright runtime used by the verification scripts.
5. `python3 verification/verify_suite.py` — runs the Playwright-based visual verification suite against the `?renderer=webgl` fallback (WebGPU/SwiftShader is too unreliable for headless CI).

`node_modules` and the Playwright browser cache are cached between runs. On failure, any screenshots written to `verification/` are uploaded as a build artifact for debugging. The WASM build is never a CI gate — it stays a local/manual step until an Emscripten toolchain is added to the workflow.

## Custom Neuromodulator UI
In Phase 21, we introduced a live-editable neuromodulator interface. Located in the right-side control panel, you can now toggle between predefined chemical profiles (Dopamine, Serotonin, Acetylcholine, GABA) or create your own custom profile.
These parameters directly map to WebGPU compute uniforms and affect:
- **Diffusion Rate**: How fast signal spreads between voxels.
- **Decay Rate**: How long activity persists.
- **Pulse Saturation & Trail Length**: Visual properties of the signaling.
- **Regional Retention Biases**: Allow defining lobe-specific biases, mimicking specific functional states like high frontal-lobe retention during a dopamine flow state.

## SynaptiX Notes

- Human activity lives in `tensorBuffer`; AI activity lives in `aiTensorBuffer`.
- The renderer blends them visually using `aiInfluence`, `resonanceThreshold`, and `aiLayer`.
- Non-32^3 activations are projected into the brain volume by `src/synaptix-engine.js`.
- Story routines for SynaptiX are served from [`public/routines`](public/routines).

See [docs/synaptix.md](docs/synaptix.md) for the mapping table, routine vocabulary, and instructions for recording your own activations.
See [docs/webgl-fallback.md](docs/webgl-fallback.md) for backend selection, debug controls, and WebGL-to-WebGPU porting notes.

## More Documentation

See [CONTRIBUTING.md](CONTRIBUTING.md) for a full map of where to look, and [docs/ROADMAP.md](docs/ROADMAP.md) for phase history, open items, and the future-ideas backlog.

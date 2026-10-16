# Grok AI Assistant Guide for brain_viz

> Supplementary guide for Grok. For the canonical, kept-in-sync project reference, see [`AGENTS.md`](../AGENTS.md) at the repo root.

## Project Overview
**brain_viz** (Neuro-Weaver) is an animated 3D brain data visualization that uses real-time EEG/tensor data to drive beautiful WebGPU animations. It bridges neuroscience, data, and art.

- **Live Demo**: https://go.1ink.us/brain-viz
- **Core Idea**: Make brain activity visible and mesmerizing through 3D animation and WebGPU.

## Technology Stack
- Vanilla JavaScript (ES Modules) — **no TypeScript**
- WebGPU + WGSL, with a WebGL2 fallback/debug renderer (`?renderer=webgl`)
- Tensor / EEG data handling
- Native WebGPU volumetric rendering (no Three.js)

## Grok Guidelines
- **Data → Visual Mapping**: The core magic is how EEG/tensor values translate into motion, color, particles, or shape changes.
- **Scientific Accuracy + Beauty**: Balance real data fidelity with stunning visuals.
- **Performance**: EEG data can be high-frequency — optimize for smooth real-time rendering.
- **Interactivity**: Allow users to explore different brain regions, time ranges, or visualization modes.
- **Future Potential**: Multi-user, live BCI integration, or exportable art pieces.
- **One field resolution**: the grid size lives in [`src/voxel-dim.js`](../src/voxel-dim.js), not as the literal `32` in nine files. `DEFAULT_VOXEL_DIM` is still 32; `renderer.setVoxelDim(dim)` changes it at runtime on either backend, resampling the live field. Never write a bare `32`/`32 ** 3` for a grid size. See [`docs/field-resolution.md`](field-resolution.md).
- **Clipmap (WebGPU only)**: zoomed in, a 64³ fine brick nests one-way in the coarse field and a cortical patch replaces the organic mesh below a further zoom ([`src/clipmap/`](../src/clipmap/), [`src/brain-renderer/clipmap.js`](../src/brain-renderer/clipmap.js)). The §6 step body lives once in [`src/shaders/field-step.js`](../src/shaders/field-step.js) — never paste a field stage into another shader. The budget governor reads `cognitiveLoad` but never writes it. See [`docs/field-resolution.md`](field-resolution.md) §7–§8.
- **One neural field**: the volumetric physics is specified in [`docs/tensor-physics.md`](tensor-physics.md) and implemented by the WGSL compute shader, `src/physics/tensor-field.js` (CPU reference, drives the WebGL2 fallback) and the C++ engine in `wasm/src/`. Never add a field effect to one of them only — spec first, then all three, then `npm run test:all` and `npm run test:wgsl` (the shader vs the CPU reference). Never upload a parameter the field ignores (§6.14); neuromodulation is §3.4.
- **One renderer facade, two backends**: `BrainRenderer` (WebGPU) and `BrainRendererWebGL` must both implement the app-facing method contract documented in [`src/renderer-contract.js`](../src/renderer-contract.js) — `npm run check:facade` fails the build if a new method lands on only one.

## Visualization Modes & Shortcuts
A segmented pill selector at the top of the control panel switches the active render style. Keyboard shortcuts (ignored while typing in a field):

| Key | Mode | Description |
| --- | --- | --- |
| `1` | Organic | Smooth volumetric cortical surface shell. |
| `2` | Cyber | Glowing wireframe circuit lattice. |
| `3` | Connectome | Symmetrical glowing DTI fibre tracts. |
| `4` | Heatmap | Volumetric thermal activity field. |
| `5` | SynaptiX | Multi-brain mirror space (`X` runs the paired showcase). |

Connectome mode defaults to anatomical, bilaterally symmetric DTI tracts. Tune it with the **Connectome Variant** (Anatomical ↔ Reasoning Pathways), **Fiber Symmetry**, and **Bundle Coherence** sliders on the Activity tab.

## Common Tasks
- Improve data parsing and real-time streaming
- Add new visualization modes or particle systems
- Enhance 3D brain model and animations
- Add UI for controlling parameters or playback
- Optimize for different EEG hardware

This project has huge artistic and scientific potential. Let’s make the brain come alive! 🧠✨

# grok.md — Grok AI Assistant Guide for brain_viz

> Read this first.

## Project Overview
**brain_viz** is an animated 3D brain data visualization that uses real-time EEG/tensor data to drive beautiful WebGPU animations. It bridges neuroscience, data, and art.

- **Live Demo**: https://go.1ink.us/brain-viz
- **Core Idea**: Make brain activity visible and mesmerizing through 3D animation and WebGPU.

## Technology Stack
- JavaScript / TypeScript
- WebGPU + WGSL
- Tensor / EEG data handling
- 3D animation (likely Three.js or native WebGPU)

## Grok Guidelines
- **Data → Visual Mapping**: The core magic is how EEG/tensor values translate into motion, color, particles, or shape changes.
- **Scientific Accuracy + Beauty**: Balance real data fidelity with stunning visuals.
- **Performance**: EEG data can be high-frequency — optimize for smooth real-time rendering.
- **Interactivity**: Allow users to explore different brain regions, time ranges, or visualization modes.
- **Future Potential**: Multi-user, live BCI integration, or exportable art pieces.

## Visualization Modes & Shortcuts
A segmented pill selector at the top of the control panel switches the active render style. Keyboard shortcuts (ignored while typing in a field):

| Key | Mode | Description |
| --- | --- | --- |
| `1` | Organic | Smooth volumetric cortical surface shell. |
| `2` | Cyber | Glowing wireframe circuit lattice. |
| `3` | Connectome | Symmetrical glowing DTI fibre tracts. |
| `4` | Heatmap | Volumetric thermal activity field. |
| `5` | SynaptiX | AI ↔ Human mirror comparison (`X` runs the full showcase). |

Connectome mode defaults to anatomical, bilaterally symmetric DTI tracts. Tune it with the **Connectome Variant** (Anatomical ↔ Reasoning Pathways), **Fiber Symmetry**, and **Bundle Coherence** sliders on the Activity tab.

## Common Tasks
- Improve data parsing and real-time streaming
- Add new visualization modes or particle systems
- Enhance 3D brain model and animations
- Add UI for controlling parameters or playback
- Optimize for different EEG hardware

This project has huge artistic and scientific potential. Let’s make the brain come alive! 🧠✨
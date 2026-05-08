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

## Common Tasks
- Improve data parsing and real-time streaming
- Add new visualization modes or particle systems
- Enhance 3D brain model and animations
- Add UI for controlling parameters or playback
- Optimize for different EEG hardware

This project has huge artistic and scientific potential. Let’s make the brain come alive! 🧠✨
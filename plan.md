# Project Plan: Neuro-Weaver V2

## Current Status
- [x] Basic Brain Visualization (Sphere deformation)
- [x] Fiber/Circuit Mode (Connectome style)
- [x] WebGPU Setup (Renderer, Shaders, Geometry)
- [x] Volumetric Tensor Data Implementation
- [x] Interactive Stimulus
- [x] Advanced Visualization Modes (Heatmap, Somas)

## Completed Tasks

### 1. 🧬 Tensor Evolution (Data Structure)
- [x] **Volumetric Data Buffer**: Implemented flattened storage buffer (32x32x32) in `BrainRenderer` and `shaders.js`.
- [x] **Region Mapping**: `computeShader` defines Frontal, Occipital, and Temporal regions for signal decay.
- [x] **Stimulus Injection**: `triggerStimulus` method added to `BrainRenderer`.

### 2. 🎆 Visual Upgrades (Rendering)
- [x] **Activity Trails**: "Connectome Mode" shader logic updated to use `vertexIndex` and `spatialPhase` for traveling pulse effects.
- [x] **Instanced Somas**: `spherePipeline` implemented to render Icosahedrons at node intersections.
- [x] **Heatmap Mode**: Style 3.0 implemented in fragment shader with Blue-Green-Red gradient.

### 3. 🕹️ Interaction (UI)
- [x] **UI Controls**: `index.html` and `main.js` updated with Stimulus buttons and Style selector.
- [x] **Slice Control**: `clipPlane` uniform added to shaders and slider added to UI.

## Verification
- [x] Frontend verification script created (`verification/verify_brain_viz.py`).
- [x] Visual verification via screenshots confirmed UI controls and rendering modes (Connectome, Heatmap, Clipped).

## Final Polish
- [x] Refactor shader constants for better maintainability (Implemented via `CONSTANTS` template literal).
- [x] Final code submission.

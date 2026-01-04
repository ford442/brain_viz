# Project Plan

## Current Status
- [x] Basic Brain Visualization (Sphere deformation)
- [x] Fiber/Circuit Mode (Connectome style)
- [x] WebGPU Setup (Renderer, Shaders, Geometry)
- [x] Volumetric Tensor Data Implementation
- [x] Interactive Stimulus
- [x] Advanced Visualization Modes (Heatmap, Somas)

## Next Steps

### 1. 🧬 Tensor Evolution (Data Structure)
- [x] **Volumetric Data Buffer**: Create a 3D Texture or flattened storage buffer (e.g., 32x32x32) to represent brain activity volume.
- [x] **Region Mapping**: define 3D regions (Frontal, Occipital, etc.) within the volume (Partially implemented via stimulus coordinates).
- [x] **Stimulus Injection**: Implement `injectStimulus(x, y, z, intensity)` in `BrainRenderer` and update `computeShader` to propagate activity.

### 2. 🎆 Visual Upgrades (Rendering)
- [x] **Activity Trails**: Update fiber shaders to show pulses travelling along lines.
- [x] **Instanced Somas**: Add `spherePipeline` to render instanced spheres at fiber intersections.
- [x] **Heatmap Mode**: Implement Style 3 (Volumetric Heatmap) using the tensor volume data.

### 3. 🕹️ Interaction (UI)
- [x] **UI Controls**: Add buttons for "Stimulate Region" and "Switch Mode".
- [x] **Slice Control**: Add a slider for `clipPlane` to inspect internal structures.

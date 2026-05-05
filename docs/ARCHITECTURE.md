# Brain Visualization Architecture

## Overview
This project implements a 3D brain visualization with animated tensor data using WebGPU and WGSL compute shaders.

## File Structure

### `index.html`
Main HTML file containing:
- Canvas element for WebGPU rendering
- Info overlay with instructions
- Error display for non-WebGPU browsers

### `main.js`
Application entry point:
- WebGPU support detection
- Initializes BrainRenderer
- Error handling

### `brain-renderer.js`
Core rendering engine:
- WebGPU device initialization
- Render pipeline setup
- Compute pipeline for tensor animation
- Camera controls (mouse drag and scroll)
- Main render loop

### `brain-geometry.js`
Brain mesh generation:
- UV sphere as base geometry
- Brain-like surface deformations
- Vertex, normal, and index buffer generation

### `shaders.js`
WGSL shader code:
- **Vertex Shader**: Applies tensor-based displacement to vertices
- **Fragment Shader**: Lighting and color rendering
- **Compute Shader**: Animates tensor field data with wave patterns

### `math-utils.js`
Matrix mathematics:
- 4x4 matrix operations
- Perspective projection
- View matrix (lookAt)
- Rotation matrices

## How It Works

1. **Initialization**:
   - Request WebGPU adapter and device
   - Generate brain geometry (deformed sphere)
   - Create GPU buffers for vertices, normals, indices, and tensor data
   - Set up render and compute pipelines

2. **Animation Loop**:
   - **Compute Pass**: Updates tensor data using WGSL compute shader
     - Generates animated wave patterns
     - Writes to tensor data buffer
   - **Render Pass**: Draws the brain
     - Reads tensor data to displace vertices
     - Colors vertices based on tensor values
     - Applies lighting

3. **Tensor Field**:
   - Each vertex has an associated tensor value
   - Values are computed using sinusoidal wave combinations
   - Creates flowing, organic animation patterns
   - Displaces vertices along their normals
   - Determines vertex color (blue to red gradient)

4. **Interactivity**:
   - Mouse drag: Rotate camera around brain
   - Mouse wheel: Zoom in/out

## Key Features

- **GPU Compute Shaders**: Tensor data calculated on GPU for performance
- **Real-time Animation**: Smooth 60 FPS animation
- **Interactive Controls**: Intuitive camera manipulation
- **Dynamic Visualization**: Color and geometry react to tensor field
- **Brain-like Topology**: Bumpy surface mimics brain structure

## Browser Requirements

- Chrome 113+ or Edge 113+ (with WebGPU enabled)
- Other browsers with WebGPU support
- Hardware acceleration must be enabled

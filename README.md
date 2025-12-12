# brain_viz
an animated brain made of tensors

## Description
A 3D brain visualization with animated tensor data driven by WebGPU compute shaders. The brain geometry is deformed and colored in real-time based on tensor field calculations performed on the GPU.

## Features
- 3D brain model with brain-like surface topology
- Real-time tensor field animation using WGSL compute shaders
- Interactive camera controls (drag to rotate, scroll to zoom)
- GPU-accelerated rendering with WebGPU
- Dynamic lighting and gradient coloring based on tensor values

## Requirements
- A modern browser with WebGPU support (Chrome 113+, Edge 113+, or other compatible browsers)
- Enable WebGPU flags if necessary in your browser

## Usage
1. Open `index.html` in a WebGPU-compatible browser
2. Drag to rotate the brain visualization
3. Scroll to zoom in/out
4. Watch the tensor field animate the brain surface

## Technology
- **WebGPU**: Modern GPU API for rendering and compute
- **WGSL**: WebGPU Shading Language for compute and rendering shaders
- **JavaScript ES6 modules**: Modular code architecture

// shaders.js
// Verified Neuro-Weaver V2.6 Implementation
// [Neuro-Weaver] Updated with volumetric tensor logic (3D Flattened Buffer), instanced rendering, and heatmap modes.
// Refactored constants and Gaussian Pulse logic.
//
// This file is a thin barrel re-exporting the WGSL shader sources that used
// to live here directly. The implementation was split into src/shaders/*.js
// (one module per pipeline) to keep individual files under ~700 lines; see
// those files for the actual shader code.

export { vertexShader, fragmentShader } from './shaders/mesh.js';
export { fiberVertexShader, fiberFragmentShader } from './shaders/mesh-fiber.js';
export { somaVertexShader, somaFragmentShader } from './shaders/soma-render.js';
export { sparkVertexShader, sparkFragmentShader } from './shaders/spark-render.js';
export { computeShader } from './shaders/volumetric-compute.js';
export { postVertexShader, postFragmentShader } from './shaders/post-fx.js';
export { pointCloudVertexShader, pointCloudFragmentShader } from './shaders/pointcloud-render.js';

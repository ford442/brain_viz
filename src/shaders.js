// shaders.js — barrel re-export for backward compatibility
export { CONSTANTS, HELPERS } from './shaders/shared.js';
export { vertexShader, fragmentShader } from './shaders/surface.js';
export { fiberVertexShader, fiberFragmentShader } from './shaders/fiber.js';
export { somaVertexShader, somaFragmentShader } from './shaders/soma.js';
export { sparkVertexShader, sparkFragmentShader, computeShader } from './shaders/spark-compute.js';
export { postVertexShader, postFragmentShader, pointCloudVertexShader, pointCloudFragmentShader } from './shaders/post-pointcloud.js';

// @ts-check
// src/brain-renderer-webgl/types.js
// [Neuro-Weaver] JSDoc-only types for the BrainRendererWebGL mixins.
//
// Each mixin in this directory attaches its methods with
//
//     Object.assign(Klass.prototype, /** @satisfies {WebGLMixin} */ ({ ... }))
//
// which does two things tsc can check without seeing the other files:
//   - `ThisType<WebGLRendererThis>` types `this` inside every method as the
//     whole renderer (constructor fields + facade + the internals below), so
//     `this.drawMesh(...)` and `this.voxelDim` resolve, and a typo is an error.
//   - `Partial<BrainRendererFacade & WebGLRendererInternals>` gives facade
//     methods their contract signature, and rejects a method that is declared
//     in neither — so a new WebGL-only method has to be listed below first.
//
// This is not a replacement for `npm run check:facade`: tsc still can't prove
// that some mixin actually *provides* each facade method (the intersection
// below just asserts it). The grep in scripts/check-renderer-facade.mjs is
// what catches a method missing from one backend. Keep both.
//
// No runtime exports.

/**
 * WebGL2-only methods the mixins call on each other. The draw/build/update
 * internals are private to this backend; setDebugOptions, getDebugOptions,
 * resize, beginXRFrame, drawXRView and getSynaptiXPerformanceStats are the
 * WebGL2-only extensions listed at the bottom of src/renderer-contract.js.
 *
 * @typedef {Object} WebGLRendererInternals
 * @property {() => void} setupInputHandlers
 *
 * @property {() => import('../brain-geometry.js').BrainGeometry} buildGeometry
 * @property {() => void} buildAndUploadGeometry
 * @property {() => void} buildBridgeResources
 * @property {() => void} buildTensorDebugGrid
 * @property {() => void} rebuildTensorDebugGrid
 * @property {() => void} buildImmuneResources
 * @property {() => void} resize
 *
 * @property {() => void} syncAutoFrame - Attached by applyCameraFramingMethods() (src/camera-framing.js).
 * @property {() => void} updateCameraState
 * @property {() => Float32Array} updateMatrices - Returns the MVP for the current camera.
 * @property {(mvp: Float32Array, wireframe?: boolean, vao?: WebGLVertexArrayObject|null) => void} drawMesh
 * @property {(mvp: Float32Array) => void} drawBridges
 * @property {(mvp: Float32Array) => void} drawFibers
 * @property {(mvp: Float32Array, vao: WebGLVertexArrayObject|null, count: number) => void} drawPoints
 * @property {(mvp: Float32Array) => void} drawScene
 * @property {(mvp: Float32Array) => void} drawImmuneParticles
 * @property {() => Object} getSynaptiXPerformanceStats
 *
 * @property {() => void} updateDynamicBuffers
 * @property {() => void} updateBridgeBuffers
 * @property {() => void} updateImmuneParticles
 * @property {() => void} updatePathwayStateBuffer - From src/pathway-renderer.js (shared with WebGPU).
 *
 * @property {(worldPos: ArrayLike<number>, useAI?: boolean) => number} sampleField
 * @property {(humanVal: number, aiVal: number) => number} computeResonance
 * @property {(humanVal: number, aiVal: number, position: ArrayLike<number>, style: number) => number[]} getFieldColor
 * @property {() => void} prepareFiberAffinities
 * @property {() => Object} collectFieldParams
 * @property {() => void} updateTensorSimulation
 *
 * @property {() => void} _updateTms
 * @property {(timestamp: number) => void} beginXRFrame
 * @property {(mvp: Float32Array, viewport: {x: number, y: number, width: number, height: number}) => void} drawXRView
 *
 * @property {(newOptions: Object) => void} setDebugOptions
 * @property {() => Object} getDebugOptions
 */

/**
 * `this` inside a WebGL mixin method.
 *
 * @typedef {import('../brain-renderer-webgl.js').BrainRendererWebGL
 *   & import('../renderer-contract.js').BrainRendererFacade
 *   & WebGLRendererInternals} WebGLRendererThis
 */

/**
 * The `@satisfies` type for a mixin's method literal — see the file comment.
 *
 * @typedef {ThisType<WebGLRendererThis>
 *   & Partial<import('../renderer-contract.js').BrainRendererFacade & WebGLRendererInternals>} WebGLMixin
 */

/** @typedef {typeof import('../brain-renderer-webgl.js').BrainRendererWebGL} WebGLRendererClass */

export {};

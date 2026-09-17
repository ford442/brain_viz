// src/renderer-contract.js
// [Neuro-Weaver] JSDoc-only facade contract shared by BrainRenderer (WebGPU,
// brain-renderer.js) and BrainRendererWebGL (brain-renderer-webgl.js).
//
// This file has no runtime exports. It exists so both renderer classes can
// declare `@implements {import('./renderer-contract.js').BrainRendererFacade}`
// and get a real typecheck: with `// @ts-check` + `checkJs` on for a file, an
// empty-bodied or missing method on either backend is a build-time error
// instead of a `renderer.setCameraParams is not a function` discovered at
// runtime (see docs/ROADMAP.md / the "one renderer contract" hardening pass).
//
// `docs/webgl-fallback.md` "Shared Contracts" / "Capability Matrix" sections
// are the human-readable mirror of this list — keep them in sync.

/**
 * The renderer surface `main.js`, `RoutinePlayer`, the BCI bridge, WebXR,
 * Double Mirror session capture/replay, SynaptiX, and PaintController are
 * allowed to call on *either* backend without a capability check first.
 *
 * A method landing here is a promise: every new BrainRenderer feature that
 * belongs on this list needs an implementation (even a reduced one, per
 * `docs/webgl-fallback.md`) on both `BrainRenderer` and `BrainRendererWebGL`
 * before it ships. Backend-specific extensions (WebGPU pipeline internals,
 * WebGL debug/XR helpers) do not belong here — see the notes at the bottom
 * of this file instead.
 *
 * @typedef {Object} BrainRendererFacade
 * @property {HTMLCanvasElement} canvas
 * @property {boolean} isRunning
 * @property {import('./types.js').RendererParams} params
 * @property {number} voxelDim
 * @property {number} voxelCount
 * @property {boolean} wasmMode
 * @property {number} zoom
 * @property {number} targetZoom
 * @property {number} fov
 * @property {number} targetFov
 * @property {{x: number, y: number}} rotation
 * @property {{x: number, y: number}} targetRotation
 *
 * @property {() => Promise<void>} initialize - Acquire the backend context (GPU device / WebGL2 context) and build initial GPU-side resources.
 * @property {() => void} start - Begin the render loop (sets `isRunning = true`).
 * @property {() => void} stop - Stop the render loop (sets `isRunning = false`).
 * @property {() => void} render - Advance and draw one frame. Normally driven by `start()`'s internal `requestAnimationFrame` loop, not called directly by app code.
 *
 * @property {(newParams: Partial<import('./types.js').RendererParams>) => void} setParams - Merge params; flags `geometryDirty` when a geometry-affecting key changes.
 * @property {(newParams: Partial<import('./types.js').RendererParams>) => void} setSynaptiXParams - Alias of `setParams()` used by SynaptiX call sites.
 * @property {(preset?: {rotation?: {x?: number, y?: number}, zoom?: number, fov?: number}) => void} setCameraParams - Write *target* camera state; the render loop's smoothing drives the transition. Used by RoutinePlayer camera events, the reactivity router's scroll-zoom binding, and WebXR viewpoint presets.
 *
 * @property {(targetX: number, targetY: number, targetZ: number, intensity: number, duration?: number, radius?: number|null, erase?: boolean, decayHalfLife?: number) => void} injectStimulus - Inject a signal pulse at a voxel-space coordinate (paint gestures, routine stimulus events, BCI-driven region injection).
 * @property {(intensity: number) => void} injectElectrical - [Phase] Electrical shock overlay intensity.
 * @property {(intensity: number) => void} injectMercury - [Phase] Heavy-metal accumulation overlay intensity.
 * @property {(center: number[], radius: number) => void} triggerLesion - Stroke/lesion effect centered at a voxel-space coordinate.
 * @property {(center: number[], strength?: number, radius?: number, durationMs?: number) => void} triggerTMS - [Phase 17] Timed TMS pulse: sets `this.tms` and decays it once per frame, periodically re-injecting a shrinking stimulus. A routine `tms` event calls this unconditionally on whichever backend is active (`src/routine-handlers/core.js`) — it must exist on both.
 * @property {() => void} calmState - Reset the modulator/visual params to their resting defaults.
 * @property {() => void} resetActivity - Zero the cached human/AI tensor snapshots.
 * @property {() => void} updateAltitudeState - Advance the altitude/hypoxia physiology model by one frame from `params.altitude`.
 *
 * @property {(float32Array: Float32Array) => void} setVoxelData - Upload a full 32x32x32 human tensor frame (BCI/session playback/TensorPlayer).
 * @property {() => Promise<Float32Array>} getVoxelDataSnapshot - Read back the current human tensor (async on WebGPU: a GPU buffer copy; synchronous cache on WebGL).
 * @property {(float32Array: Float32Array) => boolean} setPartnerTensorData - Upload a full 32x32x32 SynaptiX partner/AI tensor frame.
 * @property {(float32Array: Float32Array) => boolean} setAITensorData - Deprecated alias of `setPartnerTensorData()`.
 * @property {(state: Object) => void} setSynaptiXCoupling - Record the latest human/AI regional coupling snapshot for resonance-driven visuals.
 * @property {(opts?: {warmupFrames?: number, sampleFrames?: number}) => Promise<{singleMedianMs: number, dualMedianMs: number, frameTimeRatio: number}>} benchmarkSynaptiX - Measure single- vs dual-avatar frame cost.
 *
 * @property {() => Promise<boolean>} enableWasmMode - Attempt to switch tensor evolution to the C++/WASM engine; resolves false (and stays on the existing backend's own stepper) when unavailable.
 * @property {() => void} disableWasmMode - Return to the backend's own tensor stepper (WebGPU compute shader / CPU reference).
 * @property {(opts?: Object) => Promise<Object>} runWasmBenchmark - Compare WASM vs the backend's own stepper.
 *
 * @property {(name: string, opts?: Object) => boolean} selectPathway - Toggle a named connectome pathway selection on/off.
 * @property {(name: string, blocked: boolean) => void} setPathwayBlocked - Mark a pathway as lesioned/blocked without changing its selection.
 * @property {(name: string, opts?: Object) => void} pulsePathway - One-shot traveling pulse along a selected pathway.
 * @property {() => Object} getPathwayState - Current pathway selection/blocked-state snapshot.
 * @property {() => Object} getPathwayRenderState - Per-frame pathway animation state consumed by routine/session code.
 *
 * @property {(target: number[]|null, intensity?: number) => number} spawnImmuneParticles - Seed a leukocyte migration surge at a site (defaults to the last stimulus site).
 * @property {() => void} clearImmuneParticles - Clear all active immune particles.
 */

/**
 * Extensions implemented by only one backend today. Calling one of these
 * without a capability check (`renderer.method?.(...)`, `renderer.backendType`,
 * or an explicit try/catch) is a bug — app code must degrade gracefully, the
 * way `main-renderer-setup.js` and `synaptix-engine.js` already do with `?.()`.
 *
 * WebGPU-only (`BrainRenderer`): dispose(), reinitialize(), handleDeviceLost(),
 * reconfigure(), getSynaptiXPerformanceStats() (WebGL implements this one too,
 * but with a different stat shape — see docs/webgl-fallback.md), and every
 * `init*`/pipeline-internal method (initComputePipeline, initSomaPipeline, …).
 *
 * WebGL2-only (`BrainRendererWebGL`): setDebugOptions(), getDebugOptions(),
 * resize(), beginXRFrame(), drawXRView() (WebXR requires the WebGL2 backend —
 * see webxr-manager.js), and the draw-/build-/update-prefixed rendering internals.
 *
 * See docs/webgl-fallback.md for the full feature by backend capability matrix.
 * @typedef {never} BrainRendererBackendExtensions
 */

export {};

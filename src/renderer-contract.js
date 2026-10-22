// src/renderer-contract.js
// [Neuro-Weaver] JSDoc-only facade contract shared by BrainRenderer (WebGPU,
// brain-renderer.js) and BrainRendererWebGL (brain-renderer-webgl.js).
//
// This file has no runtime exports. Two checks hold the backends to it:
//   - `npm run check:facade` (scripts/check-renderer-facade.mjs) greps each
//     backend's mixin files for every method name below. This is the only
//     thing that catches a method *missing* from one backend: the methods are
//     attached by applyXMethods() mixins, which tsc cannot see on the class,
//     so `@implements` on either class would prove nothing. Keep the grep.
//   - `npm run typecheck` checks a facade method's *signature* where it is
//     defined: WebGL mixin literals via `@satisfies {WebGLMixin}`
//     (src/brain-renderer-webgl/types.js), WebGPU methods that carry
//     `@type {BrainRendererFacade['name']}`.
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
 * @property {number} voxelDim - [Field Resolution] Current grid resolution; runtime, not a constant. Change it with `setVoxelDim()`.
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
 * @property {() => number} getFitZoom - [Camera] Zoom (camera distance) at which the whole brain fits the viewport at the current FOV and canvas aspect. Routine/XR presets resolve their `'fit'` zoom through it.
 * @property {() => void} frameBrain - [Camera] Re-enter auto-framing: zoom to `getFitZoom()` and keep tracking it across resizes until something else writes `targetZoom` (wheel, routine, XR, router).
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
 * @property {(float32Array: Float32Array) => void} setVoxelData - Upload a full `voxelDim`³ human tensor frame (BCI/session playback/TensorPlayer). The array length must equal `voxelCount`.
 * @property {() => Promise<Float32Array>} getVoxelDataSnapshot - Read back the current human tensor. Always returns a Promise: WebGPU awaits a GPU buffer copy; WebGL resolves immediately from its cached tensor.
 * @property {(float32Array: Float32Array) => boolean} setPartnerTensorData - Upload a full `voxelDim`³ SynaptiX partner/AI tensor frame.
 * @property {(float32Array: Float32Array) => boolean} setAITensorData - Deprecated alias of `setPartnerTensorData()`.
 * @property {(dim: number) => boolean} setVoxelDim - [Field Resolution] Change the neural field's grid resolution at runtime to a member of `SUPPORTED_VOXEL_DIMS` (src/voxel-dim.js). Rebuilds every dim-sized buffer, bind group and the geometry's fiber-affinity map, trilinearly resampling the live field so the simulation continues rather than resetting. Returns false if already at `dim`; throws on an unsupported dimension, or (WebGPU) on a device whose limits cannot hold the larger field. Both backends implement it — the WebGL2 fallback steps the field on the CPU, so the cost scales with dim³ there (see docs/webgl-fallback.md).
 * @property {() => number} getVoxelDim - [Field Resolution] The field's current grid resolution. Equivalent to reading `voxelDim`.
 * @property {(options?: {enabled?: boolean, focus?: 'auto'|'camera'|'stimulus', autoQuality?: boolean, budgetMs?: number, patch?: boolean, nudge?: number, jobBudgetMs?: number}) => boolean} setClipmapOptions - [Clipmap] Configure the fine brick (docs/field-resolution.md §7): master switch, focus policy (`auto` follows a recent stimulus, else the camera), whether GPU budget pressure may lower its quality tier, the GPU budget, the Phase C cortical-patch swap, and the coarse-coupling nudge. Throws on an invalid value on both backends. Returns whether the backend can run the brick at all — WebGPU `true` (unless the device refused it); the WebGL2 fallback records the options and returns `false` (the brick is WebGPU-only there).
 * @property {() => Object} getClipmapState - [Clipmap] Snapshot for the HUD: `supported` / `reason`, `active`, `mode` (`off`/`interpolate`/`simulate`), quality `tier`, zoom `weight`, brick `origin`/`center`, affinity-bake and cache progress, cortical-patch state, and the budget governor. WebGL2 always reports `supported: false`.
 * @property {() => Object} getFrameTimings - [Clipmap] Last measured frame cost: WebGPU reads `GPUTimer` (`renderMs` = scene + post, `computeMs` = coarse field + brick, per-pass `fieldMs`/`brickMs`/`sceneMs`/`postMs`, `null` without `timestamp-query`) plus the rAF interval and the budget governor's `pressure`/`lodLoad`; WebGL2 reports the rAF interval and its CPU field-step time, never GPU time.
 * @property {(state: Object) => void} setSynaptiXCoupling - Record the latest human/AI regional coupling snapshot for resonance-driven visuals.
 * @property {(opts?: {warmupFrames?: number, sampleFrames?: number}) => Promise<{singleMedianMs: number, dualMedianMs: number, frameTimeRatio: number}>} benchmarkSynaptiX - Measure single- vs dual-avatar frame cost.
 *
 * @property {() => Promise<boolean>} enableWasmMode - Attempt to switch tensor evolution to the C++/WASM engine; resolves false (and stays on the existing backend's own stepper) when unavailable.
 * @property {() => void} disableWasmMode - Return to the backend's own tensor stepper (WebGPU compute shader / CPU reference).
 * @property {(steps?: number) => {steps: number, elapsedMs: number, stepsPerSec: number}|null} runWasmBenchmark - Time `steps` WASM field steps (synchronous). Null when the WASM engine is not loaded — always on WebGL2, which has no WASM path.
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
 * but with a different stat shape — see docs/webgl-fallback.md),
 * readBrickSnapshot() ([Clipmap] reads the fine brick's render copy back for
 * verification — resolves null while the brick is off), and every
 * `init*`/pipeline-internal method (initComputePipeline, initSomaPipeline,
 * initClipmap, …).
 *
 * WebGL2-only (`BrainRendererWebGL`): setDebugOptions(), getDebugOptions(),
 * resize(), beginXRFrame(), drawXRView() (WebXR requires the WebGL2 backend —
 * see webxr-manager.js), and the draw-/build-/update-prefixed rendering internals.
 *
 * See docs/webgl-fallback.md for the full feature by backend capability matrix.
 * @typedef {never} BrainRendererBackendExtensions
 */

export {};

// src/types.js
// [Neuro-Weaver] Central JSDoc typedefs for the renderer/routine/uniform contracts.
// Pure documentation module — no runtime exports besides re-usable JSDoc types.
// Import via: /** @type {import('./types.js').RendererParams} */
// This project intentionally has no TypeScript compiler step; these typedefs
// exist to give editors (and // @ts-check files) real signal without one.

/**
 * The full set of tunable visual/simulation parameters on `BrainRenderer.params`
 * (see brain-renderer.js constructor) and `BrainRendererWebGL.params`
 * (see brain-renderer-webgl.js `createDefaultParams()`). Every field is a
 * plain number; boolean-ish fields are 0.0/1.0 because they are uploaded
 * directly into WGSL uniform buffers (see UniformLayout below).
 *
 * @typedef {Object} RendererParams
 * @property {number} cognitiveLoad - [Phase 9] Visual cortex fatigue / dynamic LoD (0-1).
 * @property {number} cognitiveDissonance - [Phase 2.5] Cognitive dissonance intensity (0-1).
 * @property {number} frequency - Compute shader signal frequency.
 * @property {number} amplitude - Compute shader signal amplitude.
 * @property {number} spikeThreshold - Firing threshold for activity spikes.
 * @property {number} smoothing - Temporal smoothing factor for the tensor field.
 * @property {number} style - Visualization style: 0=Organic, 1=Cyber, 2=Connectome, 3=Heatmap, >=4=SynaptiX.
 * @property {number} sliceZ - Clip-plane Z distance (starts outside the mesh bounds).
 * @property {number} flowSpeed - V2.3 signal pulse speed along fibers.
 * @property {number} colorShift - [Phase 5] Serotonin color-shift amount.
 * @property {number} decayRate - [Phase 21] Neuromodulator trail decay rate per step.
 * @property {number} diffusionRate - [Phase 21] Neuromodulator spatial diffusion rate.
 * @property {number} pulseSaturation - [Phase 21] Neuromodulator pulse color saturation.
 * @property {number} trailLength - [Phase 21] Neuromodulator trail length multiplier.
 * @property {number} retentionBiasX - [Phase 21] Regional retention bias: frontal.
 * @property {number} retentionBiasY - [Phase 21] Regional retention bias: occipital.
 * @property {number} retentionBiasZ - [Phase 21] Regional retention bias: temporal.
 * @property {number} retentionBiasW - [Phase 21] Regional retention bias: parietal.
 * @property {number} sparkle - [Phase 5] Synaptic sparkle intensity.
 * @property {number} growth - [Phase 6] Dendritic growth radius (0-1).
 * @property {number} shake - [Phase 2] Camera shake intensity (trauma/panic).
 * @property {number} aberration - [Phase 7] Chromatic aberration intensity.
 * @property {number} grain - [Phase 7] Film grain intensity.
 * @property {number} focus - [Phase 7] Depth-of-field focus distance (0-1).
 * @property {number} aperture - [Phase 7] Depth-of-field blur strength.
 * @property {number} lightDirX - [Phase 2] Directional light X.
 * @property {number} lightDirY - [Phase 2] Directional light Y.
 * @property {number} lightDirZ - [Phase 2] Directional light Z.
 * @property {number} ambientLight - [Phase 2] Ambient light intensity.
 * @property {number} dirIntensity - [Phase 2] Directional light intensity.
 * @property {number} stress - [Phase 2] Cognitive stress distortion (0-1).
 * @property {number} cortisol - [Phase 5] Cortisol structural decay (0-1).
 * @property {number} lesionActive - Lesion effect blend (0-1).
 * @property {number} lesionCenterX - Lesion center X.
 * @property {number} lesionCenterY - Lesion center Y.
 * @property {number} lesionCenterZ - Lesion center Z.
 * @property {number} lesionRadius - Lesion radius.
 * @property {number} decimation - Structural decimation amount.
 * @property {number} myelin_degradation - [V3.1] Connectome myelin loss (0-1).
 * @property {number} fluidActive - Procedural volumetric fluid dynamics blend (0-1).
 * @property {number} immuneActivity - [Phase 6] Immune cell migration activity (0-1).
 * @property {number} edgeDetection - Visual cortex edge-detection filter blend (0-1).
 * @property {number} altitude - Simulated altitude in meters (0-8000).
 * @property {number} oxygenLevel - Oxygen saturation (1.0-0.3).
 * @property {number} hypoxiaStress - Cellular stress response to hypoxia (0-1).
 * @property {number} metabolicRate - ATP consumption multiplier (0.5-2.0).
 * @property {number} mitochondrialFunction - ATP synthesis efficiency (0-1).
 * @property {number} fogDensity - Volumetric fog density.
 * @property {number} aiInfluence - [SynaptiX] AI tensor mirror influence (0-1).
 * @property {number} resonanceThreshold - [SynaptiX] Human/AI resonance detection threshold.
 * @property {number} aiLayer - [SynaptiX] Active inference-engine layer index.
 * @property {number} pointCloudDensity - Point-cloud render density multiplier.
 * @property {number} fiberCoupling - [V3.2] Fiber-to-volume coupling strength (0-1).
 * @property {number} foldScale - Procedural gyri/sulci fold scale (geometry key, triggers rebuild).
 * @property {number} foldStrength - Procedural fold displacement strength (geometry key, triggers rebuild).
 * @property {number} fissureDepth - Cortical fissure depth (geometry key, triggers rebuild).
 * @property {number} lobeFoldBias - Per-lobe fold bias (geometry key, triggers rebuild).
 * @property {number} corticalThickness - Cortical shell thickness (geometry key, triggers rebuild).
 * @property {number} networkTopology - Connectome topology blend (geometry key, triggers rebuild).
 * @property {number} fiberSymmetry - [V3.3] Bilateral connectome symmetry, 0=free 1=mirrored (geometry key, triggers rebuild).
 * @property {number} bundleCoherence - [V3.3] Tightness of fibers within a tract bundle.
 * @property {number} connectomeVariant - [V3.3] 0=Anatomical DTI tracts, 1=Reasoning pathways.
 * @property {number} [heavyMetal] - Heavy-metal toxicity distortion blend (0-1).
 * @property {number} [tmsActive] - [Phase 17] TMS pulse active flag (0/1).
 * @property {number} [tmsCenterX] - [Phase 17] TMS target center X.
 * @property {number} [tmsCenterY] - [Phase 17] TMS target center Y.
 * @property {number} [tmsCenterZ] - [Phase 17] TMS target center Z.
 * @property {number} [tmsPulse] - [Phase 17] TMS pulse strength.
 * @property {number} [tmsRadius] - [Phase 17] TMS falloff radius.
 * @property {number} [psychedelic] - Psychedelic trip visual blend (0-1).
 */

/**
 * Base shape shared by every routine timeline event consumed by
 * `RoutinePlayer.executeEvent()` (see routine-player.js and the
 * src/routine-handlers/*.js handler modules). `type` selects the handler;
 * everything past `type`/`time` is handler-specific — see the per-type
 * typedefs below for the handful of structurally distinct shapes.
 *
 * @typedef {Object} RoutineEvent
 * @property {string} type - Handler key, e.g. 'stimulus', 'param', 'lerp', 'text', 'choice', 'wait', 'branch'.
 * @property {number} [time] - Scheduled offset in seconds from routine start. Required on top-level events; omitted on events synthesized at runtime (e.g. re-dispatched 'text' events).
 * @property {string|number[]} [target] - Region name (looked up in `player.regions`) or an explicit [x, y, z] coordinate.
 * @property {number} [intensity] - Effect strength, handler-defined range (usually 0-1 or 0-2).
 * @property {number} [duration] - Effect/transition duration in seconds.
 * @property {string} [ease] - Easing curve name from `Easing` in math-utils.js (e.g. 'sineInOut', 'quadOut').
 * @property {string} [message] - Narrative text, forwarded to a synthesized 'text' event.
 * @property {string} [key] - Target `renderer.params` key ('param' events) or `player.state` key ('state' events).
 * @property {*} [value] - New value for 'param'/'state'/'lerp' events.
 */

/**
 * `{ type: 'stimulus', target, intensity, duration }` — injects a signal
 * pulse into a brain region via `renderer.injectStimulus()`.
 * @typedef {RoutineEvent} StimulusRoutineEvent
 * @property {string|number[]} target
 * @property {number} [intensity]
 * @property {number} [duration]
 */

/**
 * `{ type: 'param', key, value }` — one-shot `renderer.setParams({[key]: value})`.
 * @typedef {RoutineEvent} ParamRoutineEvent
 * @property {string} key
 * @property {*} value
 */

/**
 * `{ type: 'lerp', key, value, duration, ease }` — animated transition of a
 * single `renderer.params` field, driven by `RoutinePlayer.startLerp()`.
 * @typedef {RoutineEvent} LerpRoutineEvent
 * @property {string} key
 * @property {number} value
 * @property {number} [duration]
 * @property {string} [ease]
 * @property {number[]} [path] - Optional multi-point spline path (see `evaluateSpline` in math-utils.js).
 */

/**
 * `{ type: 'choice', choices }` / `{ type: 'wait', signal }` / `{ type: 'branch', condition, trueBranch, falseBranch }` —
 * the three branching event types called out in CLAUDE.md's "Routine branching pauses" limitation.
 * @typedef {RoutineEvent} BranchingRoutineEvent
 * @property {Array<{label: string, next?: string}>} [choices] - 'choice' events: options rendered by the UI.
 * @property {string} [signal] - 'wait'/'signal' events: signal name to block on / fire.
 * @property {string|((...args: *) => boolean)} [condition] - 'branch' events: predicate, or a JSON-safe string like 'state.someFlag'.
 * @property {string} [trueBranch] - 'branch' events: sub-routine name to jump to when `condition` is truthy.
 * @property {string} [falseBranch] - 'branch' events: sub-routine name to jump to when `condition` is falsy.
 */

/**
 * A neuromodulator diffusion/decay profile, as defined in
 * `DEFAULT_PROFILES` (neuromodulators.js) and the localStorage-backed
 * custom profile from `getCustomProfile()`/`saveCustomProfile()`.
 *
 * @typedef {Object} NeuromodulatorProfile
 * @property {string} name - Display name, e.g. 'Dopamine'.
 * @property {string} color - CSS hex color used by the UI legend/panel.
 * @property {number} diffusionRate - Maps to `renderer.params.diffusionRate`.
 * @property {number} decayRate - Maps to `renderer.params.decayRate`.
 * @property {number} pulseSaturation - Maps to `renderer.params.pulseSaturation`.
 * @property {number} trailLength - Maps to `renderer.params.trailLength`.
 * @property {{frontal: number, occipital: number, temporal: number, parietal: number}} retentionBias - Maps to `retentionBiasX/Y/Z/W`.
 */

/**
 * One scalar/vector/matrix field of a WGSL `uniform` struct, in declaration
 * order. Used by `src/shaders/uniform-layout.js` to compute the canonical
 * byte/float offsets for the render `Uniforms` struct shared by every
 * WebGPU pipeline (surface, fiber, soma, spark, point-cloud, post) — see
 * CLAUDE.md's "WGSL Struct Alignment & Padding" hotspot.
 *
 * @typedef {Object} UniformLayoutField
 * @property {string} name - Field name, matching the WGSL struct member and (for render uniforms) the OFFSET_* constant / `this.params` key in brain-renderer/uniforms.js.
 * @property {'f32'|'vec3'|'vec4'|'mat4x4'} type - WGSL scalar/vector/matrix type; determines WGSL uniform-address-space alignment (f32=4, vec3=16, vec4=16, mat4x4=16) and size in bytes.
 */

/**
 * Result of `computeStructOffsets()`: the resolved float-index offset of
 * every field plus the struct's total size, both already aligned per WGSL
 * uniform-address-space layout rules.
 *
 * @typedef {Object} UniformLayout
 * @property {Object<string, number>} offsets - Field name -> offset measured in `Float32Array` indices (bytes / 4).
 * @property {number} totalFloats - Total struct size measured in `Float32Array` indices, rounded up to the struct's max member alignment.
 */

export {};

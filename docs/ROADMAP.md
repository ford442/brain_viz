# Neuro-Weaver Roadmap

This is the single, current source of truth for project phases and future ideas. It supersedes and deduplicates the historical planning logs previously scattered across `agent_plan.md`, `docs/plans/agent_plan.md`, `docs/plans/weekly_plan.md`, and `plan.md` — those raw logs are preserved for history in [`docs/archive/`](archive/) but should no longer be edited or treated as authoritative.

**Status:** Active development. **Velocity:** roughly one feature per cycle (see git history for exact dates — the archived logs contain a dated changelog if you need it).

For the current architecture and module responsibilities, see [`AGENTS.md`](../AGENTS.md), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), and [`docs/DEVELOPER_CONTEXT.md`](DEVELOPER_CONTEXT.md).

---

## Completed Phases

| Phase | Theme | Highlights |
|---|---|---|
| 1 | Sequencing Core | `RoutinePlayer` engine, main.js integration, "Deep Thought" demo script, transport UI (play/stop/loop) |
| 2 | Advanced Choreography | Easing/splines, camera director + presets, pathfinding camera, JSON loader, sub-routines, wait/signal, branching, choice-driven storytelling, CSS filters, Markdown subtitles, haptics, sound/binaural events, GUI timeline editor, visualizer API |
| 2.5 | Dream Implementations | Binding kinetics, psychedelic visuals, stroke lesion, flow-state sync, dynamic weather, GSR sync, immune-cell migration, neurotransmitter-depletion decimation, cognitive dissonance turbulence, pupillary dilation |
| 3 | "Brain DJ" Mode | Keyboard-triggered mini-routines, `AudioReactor` mic input, central reactivity bus (bass/energy/brightness/onset), continuous respiration, procedural routine generation |
| 4 | Narrative & Immersion | Narrative text overlay synced to routine events |
| 5 | Neuro-Biochemistry | Acetylcholine, noradrenaline, GABA, melatonin, cortisol, serotonin color shift, synaptic sparkle, ATP depletion, heavy-metal accumulation |
| 6 | Structural Dynamics | Dendritic growth uniform, procedural volumetric fluid dynamics |
| 7 | Cinematic Post-Processing | Chromatic aberration, film grain, depth of field, neuronal glitch |
| 8 | Data Integration | CSV/fMRI time-series and event-list import into `RoutinePlayer` |
| 9 | Engine Evolution & Polish | Procedural cellular advection, cognitive-load-driven dynamic LoD |
| 10 | Neuroplasticity & Future Concepts | Real-time neuroplasticity growth and decay, auditory hallucination flashes |
| 11 | Robust Expression & Hardening | Timeline catch-up/drift compensation, graceful WebGPU device-lost recovery with telemetry |
| 12 | Interactive Volumetric Polish | Clip-plane internal reveal |
| 13 | Neuromodulation Interface | Click/scripted region injection API with easing, continuous drag/paint gesture |
| 14 | Emergent Neural Behaviors | Synchronized firing bursts, dynamic fiber topology under sustained sync |
| 15 | Synaptic Plasticity Animation | Dendritic growth visualization (see also Phase 10) |
| 16 | Cinematic Polish | Interpolation and camera-map refinements |
| 17 | Advanced Routine Control | `clearLerps()` cancellation, TMS spatial distortion events |
| 18 | Routine Logic Refinement | Scheduler hardening, procedural serotonin fluid simulation |
| 19 | Cognitive Phenomena Animation | Memory-formation animation (sparkle + growth + flow speed) |
| 20 | Render Pipeline Innovations | Visual-cortex edge-detection post filter |
| 21 | Custom Neuromodulator UI | `src/neuromodulators.js` profiles (Dopamine/Serotonin/Acetylcholine/GABA/Custom), UI panel, compute-shader integration, routine/marker hooks, `localStorage` persistence |
| 22 | Advanced Interpolation & Extensibility | Cubic/sine easing curves, runtime-added camera regions |
| 23 | Biofeedback Synchronization | HRV-driven glitch sync (`hrv_sync`) |
| 24 | Neurofeedback Training Mode | `TrainingEngine`, simulated metric sampling, gamified hold-in-band objectives with streak/drift scoring and stars, `training_start`/`training_checkpoint`/`training_end` routine events with auto-branching, Training tab UI with session history, keyboard demo-baseline courses |
| 25 | Live EEG / BCI Devices | Muse Classic/Athena Web Bluetooth, OpenBCI UDP/WebSocket bridge, calibrated band-power projection into the human 32³ tensor, editable channel mapping, `.nwbci` recording/replay, and BCI routine events |
| 26 | WebXR Immersive Mode | WebGL2 stereo VR, routine-driven XR rig, controller/hand energy painting, lobe viewpoints, and optional tabletop AR |
| 27 | Double Mirror Multimodal Sessions | Local-only synchronized 32³ tensor, webcam-thumbnail, microphone-feature, and note capture; strict `.nwsession` replay/scrubbing; descriptive occipital/audio correlation heatmap; aligned CSV export |
| 28 | Cognitive Phenomenon | DMN to task-positive network (TPN) handoff transition |
| 29 | Cortical Dynamics | Cortical thickness atrophy and swelling visualization |
| 30 | Neural Field Physics Contract | `docs/tensor-physics.md` as the normative spec; `src/physics/tensor-field.js` CPU reference driving the WebGL2 fallback; C++ engine ported to the full model behind a generated `BrainTensorParams` ABI; golden 32³ fixture + `npm run test:golden`; SIMD/LTO/ESM WASM build |
| 31 | Live Input Bus | `LiveInputBus`: one shared, user-editable mapping table (source/feature -> renderer-param sink, with scale + attack/release smoothing) driving mic, BCI band-power, and Training Mode metrics without a new per-source integration file; "Live" tab mapping matrix UI with JSON import/export; `if: "live.…"` routine condition sugar |
| 32 | Neuro-Script Exchange & Multi-Brain | `.nwroutine` import/export with the untrusted-file sandbox (`bci_connect` / `drug_delivery` need "I trust this file"), a Routine-tab gallery of the built-in routines as packages, fork lineage via `manifest.id` / `parentId` ([`nwroutine.md`](nwroutine.md)); the two-cortex SynaptiX layout centralised in `src/multi-brain-layout.js` for both backends, a `multi_brain` routine event and toggle, and the mirror-neuron "I reach, you move" demo ([`synaptix.md`](synaptix.md) → *Multi-Brain*); collaborative rooms (local WebSocket host `scripts/nw_room_bridge.mjs`, stimulus relay via `LiveInputBus`) |
| 33 | Dream Implementations | Dopamine reward interaction; template-based, LLM-ready AI narrative routine generator; neuro-inflammation; cognitive load; Eureka gamma synchronisation; adaptive routines (webcam-emotion branching via `if: "live.…"`); Neuromodulation External API (`scripts/external_ws_bridge.mjs`, `?external=`); spatial-audio hemisphere mapping; web-traffic activity; cellular memory resonance; long-term potentiation; neurogenesis; environmental turbulence; memory fragmentation; endorphin, oxytocin, cortisol, melatonin, cellular senescence; procedural binaural generation with easing; sleep spindles |

## Open Items

- ~~**Advanced Trigger System**~~ (Phase 3) — done: multi-key combinations trigger routines.
- ~~**WGSL-vs-CPU field comparison**~~ (Phase 30 follow-up) — done: `npm run test:wgsl` runs the production compute shader on SwiftShader against the CPU reference (`docs/tensor-physics.md` §9.2); §8 records the intentional divergences.
- ~~**Reserved field parameters**~~ — done: `decayRate`, `diffusionRate` and `retentionBias` are specified (`docs/tensor-physics.md` §3.4) and read by all three steppers; `cognitiveDissonance` was removed from the layout (§6.14). The WGSL path is now validated by naga in `npm test` and compared with the CPU reference by `npm run test:wgsl` (§9).
- **GPU tract normalisation** — the WGSL step re-normalises tract directions every step instead of once at upload (`docs/tensor-physics.md` §8.6). Closing it needs the WebGPU upload and the clipmap affinity bake to emit unit directions.
- ~~**`pulseSaturation`**~~ — done: wired `pulseSaturation` to scale soma emissive core and sparkle intensity in `soma-render.js`, completing the Neuro-Script Implementation Cycle item.
- **WASM pthreads** (Phase 30 follow-up) — off until the production host is confirmed to send COOP/COEP (`crossOriginIsolated === true` on the deployed page); `WASM_PTHREADS=1` opts in, and the loader refuses a pthreads build on a non-isolated page. The step is single-threaded either way: threads only pay once `bte_update()` tiles z-slabs, which with SIMD fiber gathers is what a 64³ hybrid frame needs (measured ~85–98 ms today, `docs/wasm-engine.md` → *Performance*).

- ~~**Collaborative rooms**~~ (Phase 32 follow-up, [#405](https://github.com/ford442/brain_viz/issues/405)). A local WebSocket room: one host sim, clients send stimulus and paint, plus an optional partner tensor. No cloud and no accounts. (Completed: implemented local host bridge and stimulus relay.)
  - Host: `scripts/nw_room_bridge.mjs`, following the `openbci_ws_bridge.mjs` pattern with the existing `ws` dependency.
  - Protocol: `{ type: 'stimulus'|'tensor'|'note', voxelDim, payload }`. A mismatched `voxelDim` is rejected. Resampling happens only when the client sets an explicit flag, and then only through the existing `resampleField`.
  - Clients: `LiveInputBus.registerSource('room', …)` for remote features, and `renderer.injectStimulus` for remote paint. On stimulus, the last writer wins; no CRDTs.
  - Privacy: opt-in. Rooms share tensors and stimuli only: no webcam thumbnails, no mic PCM, and Double Mirror stays local-only. Document this next to Double Mirror's boundary in [`session-format.md`](session-format.md).
  - Rooms at 64³ want the clipmap's camera-local fine brick, and dual SynaptiX clipmaps are its Phase D. At 32³ they don't need it.

## Dream Backlog (Not Yet Implemented)

Open ideas only, each once. When one ships, move it into the phase table above
and delete it here (and from the root `agent_plan.md` inbox).

- **Phantom Sensations** — visual-cortex phantom sensations as localized fractal anomalies.
- **SSRI Reuptake Inhibition** — reuptake inhibition as lingering, extended colour shifts and slower particle decay.
- **Eye-Tracking Focus Mapping** — map eye-tracking data to specific pathway activation for focus analysis.
- **Procedural Poetry** — an LLM writes poetry from live brain activity in real time.
- **LLM-backed Narrative Generation** — the Phase 33 generator is template-based and LLM-ready; wiring a model to it is open. Related: [`docs/DOUBLE_MIRROR_VISION.md`](DOUBLE_MIRROR_VISION.md).
- **Exchange-tab Timeline Editor** — build routines with the timeline editor directly in the Exchange tab.
- **Neuro-Script Exchange, hosted gallery** — the local-first part is done (Phase 32, [`nwroutine.md`](nwroutine.md)). A hosted gallery stays out of scope; a static one in the repo or on GitHub Pages is enough.
- **Multi-Brain, beyond two** — two cortices are done (Phase 32, [`synaptix.md`](synaptix.md) → *Multi-Brain*). Open: N > 2 brains, split or over-the-shoulder camera presets, WebXR.
- **Fractal Recursive Zoom, Phase D** — Phases A–C are done on WebGPU ([`docs/field-resolution.md`](field-resolution.md) §7–§8). Next: WASM SIMD kernels, a 128³ brick, dual SynaptiX clipmaps, a fine NWS1 chunk.

## Related Specs & Vision Docs

- [`docs/live-input-bus.md`](live-input-bus.md) — Live Input Bus: source/sink mapping table, built-in sources, routine `if:` condition sugar
- [`docs/training-mode.md`](training-mode.md) — Neurofeedback Training Mode (courses, metrics, scoring, routine events)
- [`docs/bci-device.md`](bci-device.md) — Muse/OpenBCI setup, live tensor mapping, recording, and routine events
- [`docs/webxr.md`](webxr.md) — immersive VR/AR setup, controls, routine integration, and verification
- [`docs/synaptix.md`](synaptix.md) / [`SYNAPTIX_SPEC.md`](SYNAPTIX_SPEC.md) — SynaptiX comparative mode
- [`docs/tensor-physics.md`](tensor-physics.md) — the neural-field specification (normative)
- [`docs/webgl-fallback.md`](webgl-fallback.md) — WebGL2 fallback/debug renderer
- [`docs/wasm-engine.md`](wasm-engine.md) — C++/WASM hybrid simulation engine
- [`docs/SCIENTIFIC_ACCURACY_REPORT.md`](SCIENTIFIC_ACCURACY_REPORT.md) — physiological model verification
- [`docs/session-format.md`](session-format.md) — shipped Double Mirror capture, NWS1 format, replay, analysis, privacy, and scientific limits
- [`docs/DOUBLE_MIRROR_VISION.md`](DOUBLE_MIRROR_VISION.md) — shipped V1 boundary and longer-term multimodal ideas
- ~~**Neuro-Visual Endorphin Release Simulation**~~ — completed: temporary suppression of stress parameters and an increase in harmonic wave synchronization.

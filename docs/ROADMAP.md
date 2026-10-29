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
| 33 | Dream Implementations | **Reward Interaction**: Implement dopamine reward visualization. **AI Narrative Generation**: Implement a template-based and LLM-ready generator for dynamic routine scripts from themes. **Neuro-Script Exchange**: Implement local-first MVP. |

## Open Items

- **Advanced Trigger System** (Phase 3) — allow complex multi-key combinations to trigger routines, instead of single-key bindings only. Implemented.
- **WGSL-vs-CPU field comparison** (Phase 30 follow-up) — the golden fixture pins the JS and C++ implementations to each other; comparing the compute shader itself needs a software WGSL runner. `docs/tensor-physics.md` §8 records the intentional divergences in the meantime.
- ~~**Reserved field parameters**~~ — done: `decayRate`, `diffusionRate` and `retentionBias` are specified (`docs/tensor-physics.md` §3.4) and read by all three steppers; `cognitiveDissonance` was removed from the layout (§6.14). The WGSL path is now validated by naga in `npm test` and compared with the CPU reference by `npm run test:wgsl` (§9).
- **GPU tract normalisation** — the WGSL step re-normalises tract directions every step instead of once at upload (`docs/tensor-physics.md` §8.6). Closing it needs the WebGPU upload and the clipmap affinity bake to emit unit directions.
- **`pulseSaturation`** — a neuromodulator profile field and Live Input Bus sink that no shader or stepper reads (§6.14); the panel labels it "not wired". Give it a render meaning or retire it.
- **WASM pthreads** (Phase 30 follow-up) — off until the production host is confirmed to send COOP/COEP (`crossOriginIsolated === true` on the deployed page); `WASM_PTHREADS=1` opts in, and the loader refuses a pthreads build on a non-isolated page. The step is single-threaded either way: threads only pay once `bte_update()` tiles z-slabs, which with SIMD fiber gathers is what a 64³ hybrid frame needs (measured ~85–98 ms today, `docs/wasm-engine.md` → *Performance*).

## Dream Backlog (Not Yet Implemented)

Deduplicated from the historical "Dream Log" entries across the archived plans — ideas confirmed already shipped (see phases above) have been dropped.

- **Multi-Brain Mode** — visualize two brains interacting (mirror-neuron storytelling).
- **Fractal Recursive Zoom** — procedurally generate infinite detail when zooming into a soma or fiber. *Phases A (runtime `voxelDim`), B (clipmap field: a 64³ fine brick nested in the coarse field) and C (cortical patch with laminar somas below the zoom threshold) are done on WebGPU — see [`docs/field-resolution.md`](field-resolution.md) §7–§8. Phase D (WASM SIMD kernels, a 128³ brick, dual SynaptiX clipmaps, a fine NWS1 chunk) is next.*
- **Custom Audio-Feature Mapping Matrix** — *done, generalized past audio — see Phase 31 and [`docs/live-input-bus.md`](live-input-bus.md). The audio-only `ReactivityRouter` "Brain DJ" panel (Phase 3) remains as its own preset-driven panel.*

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
- **Neuro-Visual Endorphin Release Simulation** — What if we visualized the effects of endorphins as a temporary suppression of stress parameters and an increase in harmonic wave synchronization?
- **Neuro-Inflammation Simulation** — What if we visualize neuro-inflammation as localized redness and swelling?

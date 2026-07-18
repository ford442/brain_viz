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
| 10 | Neuroplasticity & Future Concepts | Real-time neuroplasticity growth, auditory hallucination flashes |
| 11 | Robust Expression & Hardening | Timeline catch-up/drift compensation, graceful WebGPU device-lost recovery with telemetry |
| 12 | Interactive Volumetric Polish | Clip-plane internal reveal |
| 13 | Neuromodulation Interface | Click/scripted region injection API with easing |
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

## Open Items

- **Advanced Trigger System** (Phase 3) — allow complex multi-key combinations to trigger routines, instead of single-key bindings only. Not yet implemented.

## Dream Backlog (Not Yet Implemented)

Deduplicated from the historical "Dream Log" entries across the archived plans — ideas confirmed already shipped (see phases above) have been dropped.

- **Neuro-Script Exchange** — a shared platform to publish, fork, and remix visualization routines.
- **Multi-Brain Mode** — visualize two brains interacting (mirror-neuron storytelling).
- **VR/XR Mode** — WebXR integration for immersive brain walkthroughs.
- **EEG Hardware Integration** — connect to Muse/OpenBCI headsets via WebBluetooth to drive visualization with real brainwaves.
- **AI Narrative Generation** — use an LLM to generate routine scripts from themes (e.g. "Anxiety Spike", "Eureka Moment"); related to the multimodal ideas in [`docs/DOUBLE_MIRROR_VISION.md`](DOUBLE_MIRROR_VISION.md).
- **Fractal Recursive Zoom** — procedurally generate infinite detail when zooming into a soma or fiber.
- **Collaborative Brain Storming** — multi-user session injecting stimuli into a shared visualization via WebSockets.
- **Adaptive Routines** — routines that adapt based on real-time emotion detection via webcam.
- **Neuromodulation External API** — connect external live data feeds to drive neuromodulator profiles directly.
- **Custom Audio-Feature Mapping Matrix** — a GUI for users to map arbitrary audio features to arbitrary visual parameters.
- **Region-Injection Paint Gesture** — extend the click-based Region Injection API (Phase 13) to a continuous drag/paint gesture.
- **Procedural Binaural Generation** — automatically generate binaural beat frequencies for a desired brainwave target instead of manual frequency entry.
- **Biofeedback Adaptive Audio** — modulate generative audio pitch/volume/tempo from heart-rate or other biofeedback metrics.
- **External Data Sonification** — map external real-time feeds (e.g. stock market data, social-media sentiment) to connectome signal pulses, as a novelty/art mode.
- **Neuroplasticity Decay** — visualize reduced neuroplasticity in simulated aging brains.

## Related Specs & Vision Docs

- [`docs/training-mode.md`](training-mode.md) — Neurofeedback Training Mode (courses, metrics, scoring, routine events)
- [`docs/synaptix.md`](synaptix.md) / [`SYNAPTIX_SPEC.md`](SYNAPTIX_SPEC.md) — SynaptiX comparative mode
- [`docs/webgl-fallback.md`](webgl-fallback.md) — WebGL2 fallback/debug renderer
- [`docs/wasm-engine.md`](wasm-engine.md) — C++/WASM hybrid simulation engine
- [`docs/SCIENTIFIC_ACCURACY_REPORT.md`](SCIENTIFIC_ACCURACY_REPORT.md) — physiological model verification
- [`docs/DOUBLE_MIRROR_VISION.md`](DOUBLE_MIRROR_VISION.md) — speculative, larger-scope multimodal vision (separate from this roadmap)

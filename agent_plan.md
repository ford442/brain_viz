# Brain Viz: Cognitive Routine Engine Plan
**Goal:** Transform `brain_viz` from a static WebGPU demo into a scriptable "Neuro-Cinematic" engine capable of playing back complex cognitive sequences (e.g., "Deep Focus", "Panic Attack", "Flow State").
**Status:** Active Development
**Velocity:** 1 Feature per Cycle
---
## 🧠 Strategic Roadmap
**Neuro-Script Implementation Cycle — Round 2**
### Phase 1: The Sequencing Core (Routine Engine)
* [2026-08-19] - Completed Neuro-Script Implementation Cycle. Verified routine logic, event handling, and safety.

- [x] **Routine Player Module:** Implement `routine-player.js` to handle time-based event execution (Stimulus, Style Change, Parameter Tweaks). [x] RoutinePlayer + main.js integration (already existed and was enhanced in prior work)
- [x] **Main Integration:** Refactor `main.js` to initialize `RoutinePlayer` and expose it to the UI.
- [x] **"Deep Thought" Script:** Hardcode the demo routine (Organic -> Visual Input -> Connectome Processing -> Heatmap Aftermath).
- [x] **Playback UI:** Add a "Run Sequence" button and a transport clock (Play/Stop/Loop) to the DOM.
### Phase 2: Advanced Choreography
- [x] **Routine Logic & Extensibility Refactor:** Ensure `tick()` loop uses `performance.now()`, `executeEvent` is extensible, and WebGPU context gracefully degrades.

- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Dynamic FOV Interpolation:** Smoothly interpolate the actual camera FOV during rapid movements to increase cinematic speed feel.
- [x] **Camera Coordinates Map:** Define explicit spline regions for complex camera angles.
- [x] **Parameter Interpolation/Easing:** Enhance routines with advanced smooth interpolation logic.
- [x] **Camera Collision Detection Improvements:** Enhance pathfinding camera transitions to avoid mesh intersections during large field of view shifts.
- [x] **Routine Logic & Extensibility Refactor:** Ensure `tick()` loop uses `performance.now()`, `executeEvent` is extensible, and WebGPU context gracefully degrades.
- [x] **Memory Fragmentation:** Implement memory fragmentation event and routine.
- [x] **Parameter Interpolation/Easing:** Added parameter interpolation.
- [x] **Sleep Deprivation Simulation:** Implement progressive desaturation, blurring, and increased glitch frequency to simulate sleep deprivation.
- [x] **Sensory Overload Simulation:** Implement sensory overload event and routine.
- [x] **Parameter Interpolation/Easing:** Enhance routines with advanced smooth interpolation logic.
- [x] **Camera Coordinates Map:** Define explicit spline regions for complex camera angles.
- [x] **Environmental Hazards:** Implement electrical and mercury event handlers.
- [x] **Serotonin Color Shift:** Implement `serotonin` event handler in `routine-player.js` to simulate serotonin flood via `colorShift` and `flowSpeed`.
- [x] **Default Mode Network (DMN) Routine:** Visualize the Default Mode Network as a low-frequency hum during idle states.
- [x] **Oxytocin Burst Routine:** Visualizing trust and bonding as synchronized pulses across both hemispheres.
- [x] **Adrenaline Surge Routine:** Implement adrenaline event handler in `routine-player.js` to simulate global illumination flashes and increased flow speed.
- [x] **Cognitive Stress Distortion:** Implement `stress` uniform to visualize cognitive load/stress via high-frequency surface vertex displacement.
- [x] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.
- [x] **Dynamic Time Dilation:** Modulate playback speed.
- [x] **Parameter Interpolation/Easing:** Enhance routines with smooth interpolation.
- [x] **Routine Logic & Extensibility Refactor:** Verified tick() loop uses performance.now(), executeEvent is extensible, and WebGPU context gracefully degrades.
- [x] **Interactive Visual Overlays:** Support HTML/Markdown overlays that can pause execution until user interacts.
- [x] **Branching/Conditional Routines:** Allow routines to branch dynamically based on user interaction or internal state variables.
- [x] **Routine Variables/Math:** Support variables and basic arithmetic in routine events.
- [x] **Dynamic Time Dilation:** Allow routines to modulate their own playback speed (`speed` event) to simulate bullet-time or fast-forward natively.
- [x] **Parameter Interpolation/Easing:** Add parameter interpolation to routines.
- [x] **Parameter Interpolation/Easing (Spline):** Enhance interpolation with spline paths for complex transitions.
- [x] **Spline Camera Coordinates:** Use splines for complex camera fly-throughs.
- [x] **Pathfinding Camera:** Enhance camera transitions with collision avoidance to prevent clipping through the brain mesh during large rotations.
- [x] **Easing & Transitions:** Upgrade `RoutinePlayer` to support linear interpolation (Lerp) for parameters (e.g., slowly ramp `flowSpeed` from 1.0 to 10.0 over 3 seconds).
- [x] **Dynamic Lighting Control:** Add support for routines to animate directional and ambient lighting attributes.
- [x] **Camera Director:** Add a `camera` event type to the routine player to orbit/zoom the camera to specific regions of interest during playback.
- [x] **JSON Loader:** Allow loading routines from external `.json` files instead of hardcoded arrays.
- [x] **Sub-Routine System:** Allow routines to 'call' other named routines (nesting/expansion).
- [x] **Event Synchronization (Wait/Signal):** Implement `wait` event type to pause routines until an external `signal` is provided.
- [x] **Interactive Neuro-Storytelling:** Implement `choice` event handler to create a choose-your-own-adventure mode driven by branches and user interaction.
- [x] **CSS Filters:** Implement `cssFilter` event type in `routine-player.js` to enable fast cinematic effects via CSS filter string.
- [x] **Scriptable Sub-titles overlay supporting Markdown:** Update the `text` event handler in `main.js` to parse simple Markdown (bold, italic, links).
- [x] **UI-Layer Separation for Filters:** Move CSS filter logic to a dedicated UI overlay module.
- [x] **Global Time Dilation:** Add playback speed control (0.1x - 5.0x) to allow slow-motion or fast-forward execution of routines.
- [x] **Cinematic Camera:** Add `duration` support to `camera` events for smooth, timed transitions.
- [x] **Non-Linear Easing:** Support quadratic/cubic/sine easing for `lerp` and `camera` events.
- [x] **Director Tools:** Implement a UI overlay to display real-time camera coordinates (Rotation/Zoom) and a "Log State" button to facilitate creating new routines.
- [x] **Extensible Event System:** Refactor `RoutinePlayer` to support dynamic custom event handlers, enabling "Brain DJ" features.
- [x] **Camera Shake:** Add a 'shake' event type for trauma/panic simulation.
- [x] **Expanded Camera Presets:** Add 'top', 'bottom', 'isometric' presets and a runtime API for adding custom presets.
- [x] **Neuronal Glitch:** Add a `glitch` event type to `RoutinePlayer` that simulates data corruption (modifying aberration, grain, shake, and style).
- [x] **Haptic Feedback API:** Allow scripts to trigger external events like physical device vibration.
- [x] **Memory Fragment Flashbacks:** Add a flashback event type for simulating traumatic recall with rapid stimuli and glitching.
- [x] **Neuro-Sonification (Audio Events):** Add a `sound` event type to generate synthesized tones (sine, square, sawtooth) with configurable frequency, volume, and duration, allowing routines to play sound effects synced with neural events.
- [x] **Custom Audio File Support:** Allow the `sound` event handler to play external `.mp3` or `.wav` files via a URL parameter instead of just synthesized tones.
- [x] **Binaural Beats (Neuro-Sonification):** Implement `binaural` event type in `routine-player.js` using the Web Audio API and StereoPannerNode to induce brainwave entrainment.
- [x] **Dopamine Burst Routine:** Visualized Dopamine levels as structural pulse waves.
- [x] **Endorphin Rush Routine:** Visualizing temporary immunity to stress/shake events by suppressing distortion parameters.
- [x] **Histamine Inflammatory Response:** Implement `histamine` event handler to simulate localized inflammatory response via color shift and swelling.
- [x] **Glial Cell Cleanup:** Implement `glial_cleanup` event handler to simulate glial cells repairing structural tissue after inflammation, utilizing cool color shift and reducing swelling parameters.
- [x] **Endocannabinoid State Routine:** Implement endocannabinoid event handler to visualize enhanced flow and appetite.
- [x] **GUI Timeline Editor:** Create a visual timeline editor for creating custom routines interactively.
- [x] **Myelin Degradation:** Implement `myelin_degradation` event handler to simulate neurodegenerative conditions.
- [x] **Neuroplasticity Sprouting:** Implement an event type that dynamically increases connection density over time.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Heartbeat Simulation:** Implement a heartbeat event type that triggers rhythmic cardiovascular pulses.
- [x] **Respiration Simulation:** Implement a respiration event type that links to heartbeat and modulates flow speed and overall scene intensity.
- [x] **Interactive Timeline Editor:** Created a visual, drag-and-drop timeline editor for sequence building instead of writing JSON directly.
- [x] **Routine Markers:** Add a 'marker' event type to log specific points in the timeline for external syncing.
- [x] **Dynamic Particle Speed Modulation:** Add support for routines to dynamically control individual particle traversal speed in addition to global flow speed.
### Phase 3: "Brain DJ" Mode (Live Performance)
- [x] **Dynamic Environment Reactions:** Allow respiration rate to dynamically react to visual stimuli or events.
- [x] **Keyboard Triggers:** Bind number keys (1-9) to specific mini-routines (e.g., Press '1' for "Sudden Surprise", '2' for "Calm Down").
- [x] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.
- [x] **Central Reactivity Bus:** Implement normalized and smoothed properties for `bass`, `energy`, `brightness`, and `onset`.
- [x] **Dynamic Continuous Respiration:** Make respiration a continuous loop driven by audio energy instead of a one-shot event.
- [x] **Music-Reactive Visual Parameters:** Map audio features to visual elements (e.g., energy -> zoom, bass -> colorShift, onset -> sparkle).
- [x] **Procedural Routine Generation:** Add a button to generate infinite random routines on the fly for continuous playback.
- [x] **Interactive Synthesis Control Layout:** Implement live performance mode mapping computer keyboard to dynamic frequencies in AudioReactor.
### Phase 3 Extension: Brain DJ Mode (New)
- [x] **Central Reactivity Bus:** Create a single ReactivityEngine (or expand AudioReactor) that computes normalized audio features (bass, energy, brightness, onset) and broadcasts them to all visual systems.
- [x] **Dynamic Respiration (continued):** Finish the respiration rate system: central `respirationRate` state driven primarily by audio, with temporary boosts from strong visual stimuli. Make the respiration loop continuous.
- [x] **Music-Reactive Visual Parameters:** Wire audio features to multiple visual parameters simultaneously (e.g., camera zoom / FOV breathing with bass, global hue / saturation shifts with energy).

### Phase 4: Narrative & Immersion
- [x] **Narrative Overlay:** Display text captions synced with routine events (e.g., "Subject enters REM sleep").
### Phase 5: Neuro-Biochemistry (New)
- [x] **Acetylcholine Memory Consolidation:** Implement `acetylcholine` event handler to simulate memory consolidation by interpolating `sparkle` and `flowSpeed`.
- [x] **Noradrenaline Spike:** Implement `noradrenaline` event handler to visualize Noradrenaline as a sudden spike in connectome frequency and global alertness.
- [x] **GABA Deceleration:** Implement `gaba` event handler to visualize GABA as a global deceleration of neural pulses.
- [x] **Melatonin Sleep Onset:** Implement `melatonin` event handler to visualize sleep onset as temporal blurring and slow desaturation.
- [x] **Cortisol Structural Decay:** Implement `cortisol` uniform to visualize structural decay.
- [x] **Serotonin Color Shift:** Implement `colorShift` uniform to modulate palette (Blue -> Gold/Red) for visualizing chemical changes.
- [x] **Synaptic Sparkles:** Implement `sparkle` uniform for visual bursts of insight (high-frequency flicker/glow).
- [x] **Cortisol Decay:** Implement Cortisol levels as structural decay to simulate stress.
- [x] **ATP Energy Depletion:** Implement `atp_depletion` event handler to simulate energy loss via slow playback and desaturation.
- [x] **Heavy Metal Accumulation:** Implement `heavyMetal` parameter to visualize permanent structural alterations from long-term heavy metal accumulation.
### Phase 6: Structural Dynamics
- [x] **Dendritic Growth Animation:** Implement `growth` uniform to control the maximum render radius of the brain structure, simulating organic growth.
- [x] **Procedural Volumetric Fluid Dynamics:** Simulate neurotransmitter diffusion using volumetric rendering.
### Phase 7: Cinematic Post-Processing
- [x] **Chromatic Aberration & Film Grain:** Implement a post-processing pipeline for cinematic effects (RGB split, noise).
- [x] **Depth of Field:** Implement post-processing focus blur using depth buffer.
- [x] **Neuronal Glitch:** Simulate data corruption/packet loss in the neural stream (blocky noise, scanlines).
### Phase 8: Data Integration
- [x] **CSV/fMRI Import:** Implement `RoutinePlayer` support for parsing CSV data (Time Series & Event Lists) to drive brain visualization from external datasets.
### Phase 9: Engine Evolution & Polish


- [x] **Procedural Cellular Advection:** Expand fluid dynamics to push and advect individual soma particles or fibers based on the fluid velocity field.
- [x] **Cognitive Load Resolution (Dynamic LoD):** Implement variable rendering resolution scaled dynamically based on a `cognitiveLoad` or `fatigue` parameter to simulate visual cortex fatigue.
### Phase 10: Neuroplasticity & Future Concepts
- [x] **Dendritic Growth / Neuroplasticity:** Implement `neuroplasticity` event handler to simulate real-time growth of new connections by modulating the `growth` uniform over time. Bound to a routine.
- [x] **Auditory Hallucinations:** Implement `auditory_hallucination` event handler in `routine-player.js` to simulate rapid localized cortex flashes via rapid `stimulus` events.
---
### Phase 11: Robust Expression & Hardening
- [x] **Timeline Compensation + Catch-Up Logic:** Implement catch-up logic in the scheduler. When a long frame or async operation causes drift, intelligently compensate while preserving intent.
- [x] **Graceful WebGPU Degradation + Recovery Telemetry:** When context is lost/recovered, automatically log the event with timing data, and offer a reconnect that restores the timeline position.

---

### Phase 18: Routine Logic Refinement
- [x] **Routine Logic & Extensibility Refactor:** Ensure `tick()` loop uses `performance.now()`, `executeEvent` is extensible, and WebGPU context gracefully degrades.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Procedural Serotonin Fluid Sim:** Enhance Serotonin visualizing not just with color shift but with volumetric fluid dynamics.

### Phase 19: Cognitive Phenomena Animation
- [x] **Memory Formation Animation:** Implement `memory_formation` event handler in `routine-handlers.js` to simulate memory formation via `sparkle`, `growth`, and `flowSpeed`. Bound to 'K' key in `mini-routines.js`.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.


### Phase 20: Render Pipeline Innovations
- [x] **Visual Cortex Edge Detection Filter:** Simulate visual cortex processing by simulating progressive edge-detection filters directly on the render pipeline.


### Phase 21: Custom Neuromodulator UI
- [x] **Data Model & Profile Definitions:** Create `src/neuromodulators.js` and define 5 built-in profiles (Dopamine, Serotonin, Acetylcholine, GABA, Custom).
- [x] **UI Panel Extension:** Add a new "Neuromodulator" tab in `ui-panels.js` with sliders for key parameters and "Save as Custom" support.
- [x] **Compute Shader Integration:** Expose the active profile via a uniform/storage buffer and modify the diffusion/decay compute pass.
- [x] **Routine / Marker Event Integration:** Extend the `neuromodulator` event system so routines can change profiles dynamically. Update demo routines.
- [x] **Visual Feedback:** Subtle UI accent color matching the profile's signature color.
- [x] **Persistence & Export:** Save profile state in `localStorage`.
- [x] **Documentation & Legend Update:** Update `README.md`, in-app help, and add tooltips to parameters.
### Phase 2.5: Dream Implementations
- [x] **Binding Kinetics:** Implemented a visual effect simulating neurotransmitter binding kinetics using particle physics parameters on the synapses.

### Phase 2.5 Extension: New Visualizations
- [x] **Psychedelic Visuals:** Visualized psychedelic experiences as morphing geometric structures and hue shifts.
- [x] **Stroke Lesion Simulation:** Visualized localized brain damage by suppressing connectome pulses and structural decay in specific coordinates.
- [x] **Flow State Synchronization:** Visualized neural synchronization during flow states as glowing harmonic waves using `flow_state` event.
- [x] **Dynamic Weather Systems:** Mapped weather simulation to global illumination and fog density using `dynamic_weather` event.
- [x] **Galvanic Skin Response Sync:** Implement `gsr_sync` event mapping GSR to mesh structural noise via the `stress` parameter.

### Phase 21: Routine Engine Extensibility
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.

### Phase 22: Advanced Interpolation and Extensibility
- [x] **Interpolation Easing Curves:** Implement cubic/sine easing curves for spline interpolation.
- [x] **Dynamic Camera Coordinate Region Mapping:** Allow runtime addition of named camera regions.

### Phase 23: Biofeedback Synchronization
- [x] **HRV Glitch Sync:** Implement `hrv_sync` event mapping heart rate variability to visual distortions (aberration, grain, shake).

### Phase 24: Cellular Processes
- [x] **Cellular Apoptosis:** Implement a visualization for programmed cell death.

### Phase 2.5 Extension: Psychedelic Visuals Offset Fix
- [x] **Psychedelic Visuals Offset Fix:** Corrected uniform offset issues in `src/brain-renderer.js` to include missing uniforms like `psychedelic` and restored `dopamineTrails` struct alignment as demanded by the updated WGSL structural layout, restoring the `psychedelic_trip` functionality.

## 🧪 "Dream" Log (Future Concepts)
* *Idea:* "What if we mapped real-time geographic data (like population density or traffic) to localized structural density and glow intensity in the tensor volume?"
* [x] "What if we visualize immune cell migration as particle streams during an inflammatory response?"
* *Idea:* "What if we visualize psychedelic experiences as morphing geometric structures in the tensor volume?" (Implemented as Phase 2.5 Extension - Psychedelic Visuals)"
*Idea:* "What if we mapped real-time galvanic skin response to mesh structural noise?"
* *Idea:* "What if we allowed users to configure a custom neuromodulator in the UI?"
* *Idea:* "What if prolonged synchronized bursts triggered long-term structural plasticity, permanently altering the connectome layout?"
* *Idea:* "What if we visualized glial scarring around lesion sites as dense, bright clusters of non-conductive tissue?"
* *Idea:* "What if we visualized neurotransmitter binding kinetics using particle physics on the synapses?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we visualized visual cortex processing by simulating progressive edge-detection filters directly on the render pipeline?
* *Idea:* "A shared Neuro-Script Exchange where people can publish, fork, and remix visualization routines. The player becomes both a performance instrument and a collaborative canvas."
* *Idea:* "What if we mapped real-time stock market data to connectome signal pulses?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we visualized auditory hallucinations as rapid localized cortex flashes?"
* *Idea:* "What if we visualized breathing rate as a subtle global illumination pulsing effect?"
* *Idea:* "Visualizing breathing rate as a slow sine wave modulating the alpha channel of the background."
* *Idea:* "What if we visualized localized brain damage (e.g., stroke) by selectively disabling connectome pulses in specific coordinates?"
* *Idea:* "What if we visualized sleep deprivation as progressive desaturation and increased glitch frequency?"
*Idea:* "What if we visualized neuroplasticity as real-time growth of new connections?"
* *Idea:* "What if we visualized neural synchronization during flow states as glowing harmonic waves?"
* *Idea:* "What if we visualized myelin sheath degradation in neurodegenerative conditions?"
* *Idea:* "Brain-Computer Interface (BCI) Training Mode" - A gamified mode where users try to maintain specific brain states (e.g., keeping the `stress` level below a threshold) to complete objectives.
* *Idea:* "What if we visualized localized brain damage (e.g., stroke) by selectively disabling connectome pulses in specific coordinates?"
* *Idea:* "What if we visualized Endocannabinoids as an enhanced state of flow and appetite?"
* *Idea:* "Dynamic Weather Systems" - Allow routines to control global environmental weather effects like rain/fog inside the brain.
* *Idea:* "Narrative Mode" - Display text overlays synced with brain states (e.g., "Subject recognizes face" -> Temporal Lobe lights up).
* *Idea:* "Multi-Brain" - Visualize two brains interacting (Mirror Neurons).
* *Idea:* "VR/XR Mode" - WebXR integration for immersive brain walkthrough.
* *Idea:* "fMRI Import" - Parse CSV data to playback real recorded brain activity.
* *Idea:* "Synaptic Sparkles" - Particle system bursts at intersection points when signal intensity spikes.
* *Idea:* "Chromatic Aberration Shader" - Add post-processing for cinematic distortion.
* *Idea:* "Neuro-Sonification" - Generate ambient music/soundscapes based on brain activity state (Inverse of Audio Reactivity).
* *Idea:* "EEG Hardware Integration" - Connect to Muse or OpenBCI headsets via WebBluetooth to drive visualization with real brainwaves.
* *Idea:* "AI Narrative Generation" - Use LLM to generate routine scripts based on themes (e.g., "Anxiety Spike", "Eureka Moment").
* *Idea:* "Procedural Routine Generation" - Generate routines algorithmically using noise or music analysis.
* *Idea:* "Fractal Recursive Zoom" - Procedurally generate infinite detail when zooming into a soma or fiber.
* *Idea:* "Dendritic Growth Animation" - Visualizing the growth of new connections over time (neuroplasticity).
* *Idea:* "Chromatic Aberration Shader" - Add post-processing for cinematic distortion.
* *Idea:* "Collaborative Brain Storming" - Multi-user session where multiple people can inject stimuli into the same visualization via WebSockets.
* *Idea:* "What if we visualized Acetylcholine levels as memory consolidation?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we allowed scripts to trigger external events like Haptic Feedback API?"
* *Idea:* "Multimodal Embeddings" - Connect an ML backend to translate input text (e.g., from an LLM) into corresponding brain state routines automatically.
* *Idea:* "What if we visualized ATP energy depletion as slow frame rates and desaturation?"
* *Idea:* "What if we visualize neuroplasticity decay in aging brains?"
* *Idea:* "Endorphin Rush" - Visualizing temporary immunity to stress/shake events by suppressing distortion parameters.
* *Idea:* "Hormonal Flow Physics" - What if we visualize hormonal flows like Oxytocin as a slow, warm wave using procedural volumetric fluid dynamics rather than just parameter shifts?
* *Idea:* "Procedural Cellular Advection" - Expand fluid dynamics to push and advect individual soma particles or fibers based on the fluid velocity field.
* [x] "What if we visualized environmental noise as background ambient lighting shifts?"
* [x] "What if we visualize immune cell migration as particle streams during an inflammatory response?"
* [2026-07-21] - Completed Phase 2.5 Extension (Signal Trails). Added `trailLength` uniform to shaders, `signal_trails` event handler to `narrative-flow.js`, and `^` mini-routine.
* *Idea:* "Neuron Pulse Trail Length: Add a parameter to control the decay tail length of connectome pulses to simulate different signal speeds." (Implemented as Phase 2.5 Extension - Signal Trails)
* *Idea:* "Procedural Binaural Generation" - Automatically generate binaural beat frequencies based on desired brain wave targets.
* *Idea:* "What if we visualized Cortisol levels as structural decay?"
* *Idea:* "Wait/Signal Events" - Allow the routine to pause execution until an external signal is received. (Useful for Interactive Neuro-Storytelling).
* *Idea:* "Dynamic Biofeedback Adaptation" - What if the brain's baseline shake and glitch intensity mapped directly to a user's real-time heart rate variability?
* *Idea:* "What if we mapped real-time stock market data to connectome signal pulses?"
* *Idea:* "Social Media Sentiment" - What if we visualize real-time social media sentiment as brain activity?
* *Idea:* "Biofeedback Adaptive Audio" - Connect biofeedback metrics (e.g., heart rate) to modulate the pitch, volume, or tempo of the generative audio, creating a sonification of the user's physiological state.
* *Idea:* "Neuro-feedback loops" - Dynamically adjust playback speed based on user interaction or biofeedback.
* *Idea:* "Scriptable Sub-titles overlay supporting Markdown" - Allow `text` events to render formatted markdown.
* *Idea:* "Interactive Brain Regions" - Allow users to click on specific brain regions during a routine to branch or alter the sequence dynamically.
* *Idea:* "Interactive Neuro-Storytelling" - A choose-your-own-adventure mode driven by branches and user interaction.
* *Idea:* "Simulate neurotransmitter diffusion as volumetric fluid dynamics."
* *Idea:* "What if we visualized Melatonin levels as a slow desaturation and temporal blurring effect?"
* *Idea:* "What if we visualized GABA as a global deceleration of neural pulses?"
* *Idea:* "What if we visualized Acetylcholine levels as memory consolidation?"
* *Idea:* "What if we visualized the Default Mode Network as a low-frequency hum during idle states?"
* *Idea:* "What if we visualized Histamine release as a localized inflammatory response/color shift?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* [2026-05-04] - Completed Phase 5 (Acetylcholine Memory Consolidation). Implemented `acetylcholine` event handler in `routine-player.js` to simulate memory consolidation via `sparkle` and `flowSpeed`. Bound to 'r' key in `main.js`. Added immune cell migration idea to Dream Log.
* [2026-04-13] - Completed Phase 5 (Noradrenaline Spike). Implemented `noradrenaline` event handler in `routine-player.js` to simulate global alertness via connectome frequency and flow speed. Bound to 'u' key in `main.js`. Added Histamine idea to Dream Log.
* [2026-04-12] - Completed "Architecture & Innovation" step. Marked parameter interpolation and camera coordinate map tasks as complete. Added Default Mode Network idea to Dream Log.
* [2026-05-03] - Completed Phase 5 (GABA Deceleration). Implemented `gaba` event handler in `routine-player.js` to simulate global deceleration of neural pulses and playback speed. Bound to 'h' key in `main.js`. Added Acetylcholine idea to Dream Log.
* [2026-04-07] - Completed Phase 5 (Melatonin Sleep Onset). Implemented `melatonin` event handler in `routine-player.js` to simulate sleep onset via blurring and desaturation. Bound to 'j' key in `main.js`. Added Noradrenaline idea to Dream Log.
* [2026-05-02] - Completed Phase 2 (Endorphin Rush). Implemented `endorphin` event handler in `routine-player.js` to temporarily suppress stress/shake parameters. Bound to 'e' key in `main.js`. Added GABA idea to Dream Log.
* [2026-05-01] - Added Adrenaline Surge event (`adrenaline`) to `routine-player.js`. Bound routine to 'a' key in `main.js` and updated legend. Added "Hormonal Flow Physics" idea to Dream Log.
* [2026-03-30] - Completed Phase 5 (Cortisol Decay). Implemented `cortisol` uniform in shaders for structural decay and vertex displacement towards center. Added event handler in `routine-player.js` and updated UI/Demo Routine 'k' in `main.js`. Added Melatonin idea to Dream Log.
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* [2026-04-10] - Updated routine-player.js to ensure performance.now() is used in tick(), executeEvent is fully extensible with registerHandler, and WebGPU degradation safety is implemented. Added parameter interpolation tasks and new Dream Log idea.
* [2026-04-15] - Completed Phase 2 (Binaural Beats). Implemented `binaural` event type in `routine-player.js` using Web Audio API StereoPanner. Added 'k' mini-routine to `main.js`. Added "Procedural Binaural Generation" to Dream Log.
* [2026-03-29] - Completed Phase 2 (CSS Filters & Markdown Subtitles). Added `cssFilter` event type and updated `text` event to parse Markdown. Added new routine to `main.js`. Added Cortisol idea to Dream Log.
* [2026-03-28] - Completed Phase 2 (Cognitive Stress Distortion). Implemented `stress` uniform in shaders for high-frequency vertex displacement. Added event handler in `routine-player.js` and updated UI/Panic Routine in `main.js`. Added Dream Log idea.
* [2026-03-14] - Completed Phase 2 (Interactive Neuro-Storytelling). Implemented `choice` event type in `routine-player.js` to pause execution and render interactive UI branching paths. Added 'q' mini-routine to demonstrate it. Added biofeedback idea to Dream Log.
* [2026-03-13] - Completed Phase 2 (Event Synchronization). Implemented `wait` and `signal` event types in `routine-player.js`. Added mini-routine 's' to `main.js` using Spacebar to trigger signal. Added idea to Dream Log.
* [2026-03-12] - Completed Phase 2 (Routine Variables/Math). Implemented `math` event type and string interpolation for state variables in `routine-player.js`. Added mini-routine 'w' to `main.js`.
* [2026-03-11] - Completed Phase 2 (Branching/Conditional Routines). Implemented branch event type and internal state. Added mini-routine 'b' to main.js.
* [2026-03-09] - Completed Phase 2 (Spline Camera Coordinates). Modified `camera` event handler in `routine-player.js` to support spline interpolation across multiple targets. Added new mini-routine 'v' to `main.js`. Added "Interactive Brain Regions" to Dream Log.
* *Idea:* "Visualize specific neurotransmitter pathways:" E.g., showing the Dopamine pathway from the VTA to the Nucleus Accumbens.
* *Idea:* "Oxytocin Burst" - Visualizing trust and bonding as synchronized pulses across both hemispheres.
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "Adaptive Routines" - What if routines could adapt based on real-time emotion detection via webcam?
* [2026-03-28] - Completed Phase 2 (Cognitive Stress Distortion). Implemented `stress` uniform in shaders for high-frequency vertex displacement. Added event handler in `routine-player.js` and updated UI/Panic Routine in `main.js`. Added Dream Log idea.
* [2026-03-10] - Completed Phase 2 (Interactive Visual Overlays). Implemented `overlay` event type in `routine-player.js` and `main.js` supporting HTML content and interactive pause/resume logic. Added "Branching/Conditional Routines" to roadmap and emotion detection to Dream Log.
* [2026-03-09] - Completed Phase 2 (Spline Camera Coordinates). Implemented spline path evaluation in `camera` lerp events within `routine-player.js`. Added "Fly-Through" mini-routine to `main.js`.
* [2026-03-08] - Completed Phase 2 (Custom Audio File Support). Modified `sound` event handler in `routine-player.js` to support playing external audio files via URL. Added new mini-routine 'c' to `main.js` to demonstrate feature. Added "Neuro-feedback loops" to Dream Log.
* [2026-03-07] - Completed Phase 2 (Neuro-Sonification). Implemented `sound` event handler in `routine-player.js` using the Web Audio API to generate synthesized tones. Added `sound` events to existing mini-routines in `main.js`. Added ideas for "Custom Audio File Support" and "Biofeedback Adaptive Audio" to Dream Log.
* [2026-03-06] - Completed Phase 2 (Haptic Feedback & Flashbacks). Added `haptic` and `flashback` events to `RoutinePlayer`. Implemented "Memory Flashback" routine in `main.js`. Added "Multimodal Embeddings" to Dream Log.
* [2026-03-05] - Completed Phase 7 (Neuronal Glitch). Implemented `glitch` event handler in `RoutinePlayer`, mapping it to cinematic post-processing parameters. Added "Glitch Storm" mini-routine to `main.js`. Added "Memory Fragment Flashbacks" to Dream Log.
* *Idea:* "Memory Fragmentation: Visualize memory loss as mesh decoupling."
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "Neuromodulation Interface" - What if we allowed users to connect external API data to drive these neuromodulators directly?
* *Idea:* "What if we visualized Dopamine pathways as glowing trails?"
* *Idea:* "Region Injection API - Enable scripted or click-based localized energy injection at specific anatomical coordinates within the tensor volume."
* *Idea:* "What if we allowed users to 'paint' energy directly onto the tensor volume using a continuous drag gesture?"
* *Idea:* "What if we visualized marker events as floating text particles within the tensor volume?"

* [x] "What if we visualize targeted drug delivery as micro-capsules bursting and diffusing color through localized regions?"

### Phase 2.5 Extension: Targeted Drug Delivery
- [x] **Targeted Drug Delivery:** Visualized targeted drug delivery as micro-capsules bursting and diffusing color through localized regions, controlled via `drug_delivery` event.

### Phase 2.5 Extension: ATP Energy Depletion Cascade
- [x] **ATP Energy Depletion Cascade:** Visualized ATP energy depletion as a cascading shutdown of regional activity, culminating in a global slow-motion effect, controlled via `atp_depletion` event.

### Phase 2.5 Extension: Neurotransmitter Depletion
- [x] **Gradual Mesh Decimation:** Visualized neurotransmitter depletion as gradual mesh decimation in the tensor volume using a noise function, controlled via `neurotransmitter_depletion` event.

### Phase 2.5 Extension: New Visualizations 2
- [x] **Cognitive Dissonance Simulation:** Visualized cognitive dissonance as conflicting directional flows in the tensor volume causing localized turbulence, controlled via `cognitive_dissonance` event.

### Phase 2.5 Extension: New Visualizations 3
- [x] **Pupillary Dilation Simulation:** Visualized pupillary dilation as dynamic camera field of view shifts, controlled via `pupillary_dilation` event.

### Phase 2.5 Extension: Immune Cell Migration
- [x] **Immune Cell Migration:** Visualized immune cell migration as particle streams during an inflammatory response, controlled via `immune_migration` event.

### Phase 2.5 Extension: Hypothermia Simulation
- [x] **Hypothermia Simulation:** Visualized hypothermia as reduced metabolic rate and frosty hues, controlled via `hypothermia` event.

### Phase 2.5 Extension: Environmental Noise
- [x] **Environmental Noise:** Visualized environmental noise as background ambient lighting shifts and minor shaking, controlled via `environmental_noise` event.

## 📜 Changelog
* [2026-06-25] - Completed Phase 19 (Dopamine Pathways Overlay). Implemented `dopamineTrails` parameter and shader support for glowing dopamine pathways, integrated with the routine engine and 'dopamine' event handler.
* [2026-06-22] - Completed Phase 17 (Advanced Routine Control). Verified `clearLerps()` functionality and implemented Transcranial Magnetic Stimulation (TMS) spatial distortions via `tmsActive` uniform and `tms_distortion` events.
* [2026-06-12] - Completed Phase 13 (Region Injection API). Implemented `injectRegion` on visualizer API and wired click-based energy injection in `main.js`. Added 'paint energy drag gesture' idea to Dream Log.
* [2026-06-10] - Completed Phase 12 (Clip Plane + Internal Reveal). Implemented `clip` event handler in `routine-handlers.js` and added routine 'Z'. Added Region Injection API idea to Dream Log.
* [2026-06-08] - Completed Phase 11 (Graceful WebGPU Degradation + Recovery Telemetry). Implemented robust WebGPU device.lost handling, telemetry logging, and UI for timeline-restoring recovery in `main.js`. Added 'Visual Cortex Filter' idea to Dream Log.
* [2026-05-31] - Completed Routine Logic Refactor. Ensured `tick()` uses `performance.now()`, `executeEvent` uses switch, and WebGPU degrades safely. Added tasks for Interpolation and Camera Maps, and Serotonin to Dream Log.
* [2026-05-30] - Completed Phase 10 (Auditory Hallucinations). Implemented `auditory_hallucination` event handler in `routine-handlers.js` to simulate rapid flashes via generated stimulus events. Added mini-routine 'A' to `mini-routines.js`. Added neural synchronization idea to Dream Log.
* [2026-05-28] - Completed Phase 2 (Memory Fragmentation). Implemented `memory_fragmentation` event and updated `agent_plan.md` as per neuro-script cycle. Added auditory hallucination idea to Dream Log.
* [2026-05-21] - Created Phase 10 (Neuroplasticity & Future Concepts) and added Dendritic Growth task based on Dream Log.
* [2026-05-15] - Completed Phase 2 (Camera Coordinates Map). Added explicit camera regions in `main.js` and created a 'Lobe Tour' mini-routine to demonstrate a smooth fly-through. Added new idea to Dream Log.
* [2026-05-07] - Completed Phase 5 (Heavy Metal Accumulation). Implemented `heavyMetal` parameter in `brain-renderer.js` and updated shaders to permanently alter mesh structure based on heavy metal accumulation. Bound to 'P' key in `main.js`. Added neural synchronization idea to Dream Log.
* [2026-05-12] - Completed Phase 2 (Myelin Degradation). Implemented `myelin_degradation` event handler in `routine-player.js` to simulate neurodegenerative conditions. Bound to 'N' key in `main.js`. Added localized brain damage idea to Dream Log.
* [2026-05-05] - Completed Phase 2 (Glial Cell Cleanup). Implemented `glial_cleanup` event handler in `routine-player.js` to simulate post-inflammatory structural repair. Bound to 'C' key in `main.js`. Added myelin degradation idea to Dream Log.
* [2026-05-06] - Completed "Volumetric Fog" Dream Log idea. Added `fogDensity` uniform with correct alignment in shaders, bound it to UI and renderer, and added 'g' shortcut in `main.js`. Added "Neuron Pulse Trail Length" idea to Dream Log.
* [2026-04-18] - Completed Phase 2 (Default Mode Network). Implemented `dmn` event handler in `routine-player.js` to simulate the DMN via `frequency`, `amplitude`, and `flowSpeed`. Bound to 'z' key in `main.js`. Added Neuromodulation Interface idea to Dream Log.
* [2026-03-28] - Completed Phase 2 (Cognitive Stress Distortion). Implemented `stress` uniform in shaders for high-frequency vertex displacement. Added event handler in `routine-player.js` and updated UI/Panic Routine in `main.js`. Added Dream Log idea.
* [2026-03-24] - Completed Phase 2 (Pathfinding Camera). Enhanced `camera` event handler in `routine-player.js` to support collision avoidance via generated spline paths for large rotations. Added 'Orbit Avoid' mini-routine to `main.js` using 'o'.
* [2026-03-04] - Completed Phase 2 (Neuronal Glitch). Implemented `glitch` event handler in `RoutinePlayer` to simulate data corruption via cinematic params and style toggles. Added "Memory Fragmentation" idea to Dream Log.
* [2026-03-03] - Completed Phase 2 (Dynamic Lighting Control). Implemented `light` event handler in `RoutinePlayer`, added lighting uniform mapping to `BrainRenderer` and updated shaders. Added "Dynamic Weather Systems" idea to Dream Log.
* [2026-02-24] - Completed Phase 2 (Parameter Interpolation/Easing). Created a "Deep Breathing" routine in `main.js` that linearly interpolates `growth`, `flowSpeed`, and `amplitude` for a calming visual effect. Added "Haptic Feedback API" idea to Dream Log.
* [2026-02-24] - **Bug Fix:** Resolved syntax errors in `shaders.js` that prevented the application from building.
* [2025-02-22] - Completed Phase 2 (Camera Shake). Implemented `shake` parameter in `BrainRenderer` and event handler in `RoutinePlayer`. Added "Panic Attack" routine and UI controls.
* [2025-02-22] - Completed Phase 2 (Non-Linear Easing). Implemented `Easing` utilities in `math-utils.js` and integrated them into `RoutinePlayer` for cinematic camera/parameter transitions.
* [2025-02-21] - Completed Phase 5 (Synaptic Sparkles). Implemented `sparkle` uniform for visual bursts, added "Epiphany" routine, and updated UI controls.
* [2025-02-20] - Completed Phase 2 (Global Time Dilation). Implemented playback speed control (0.1x - 5.0x) in `RoutinePlayer` and added UI slider to `main.js`.
* [2025-02-19] - Refined Phase 1 (Playback UI). Implemented full transport controls (Play/Pause/Stop/Loop) and Time Display in `main.js` and `routine-player.js`. Added `pause()`/`resume()` support to `RoutinePlayer`.
* [2025-02-18] - Completed Phase 5 (Serotonin Color Shift). Implemented `colorShift` uniform to modulate palette in Connectome and Heatmap modes, added UI slider and "Serotonin Surge" routine.
* [2025-02-09] - Completed Phase 3 (Audio Reactivity). Implemented `audio-reactor.js` for microphone analysis and real-time visualization mapping (Bass->Amplitude, Treble->Sparks). Removed "Web Audio Reactivity" from Dream Log.
* [2025-02-08] - Completed Phase 3 (Keyboard Triggers). Implemented number key bindings for mini-routines (Surprise, Calm, Scan). Added "EEG Hardware Integration" to Dream Log.
* [2025-02-07] - Completed Phase 2 (JSON Loader). Implemented JSON routine loading and file upload support. Added "Web Audio Reactivity" to Dream Log.
* [2025-02-06] - Completed Phase 2 (Camera Director). Implemented smooth zoom and camera event handling. Added "Synaptic Sparkles" to Dream Log.
* [2025-02-05] - Completed Phase 1 (Routine Engine) and Phase 2 (Easing/Transitions). Added Serotonin Color Shift to Dream Log.
* [Date] - Plan initialized.
* *Idea:* "What if we visualized Adrenaline surges as sudden global illumination flashes?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we mapped real-time weather data to global illumination and fog density?"
* [2026-05-20] - Completed Phase 3 (Dynamic Environment Reactions). Integrated stateful respiration rate driven by visual stimuli and AudioReactor to simulate excitement.
* *Idea:* "What if we visualized breathing rate visually using volumetric particle condensation near the olfactory bulb?"
* *Idea:* "What if we allowed users to map their own custom audio features to arbitrary parameters via a GUI matrix?"
* *Idea:* "What if we visualized neurotransmitter depletion as gradual mesh decimation?"
* *Idea:* "What if we visualize targeted neuro-stimulation (like TMS) as persistent magnetic field distortions?"
* *Idea:* "What if we visualized cellular apoptosis (programmed cell death) as a slow fading and shrinking of individual soma instances?"
* *Idea:* "What if we visualize Serotonin levels as dynamic color shifts in combination with procedural volumetric fluid dynamics across the tensor volume?"

### Phase 12: Interactive Volumetric Polish
- [x] **Clip Plane + Internal Reveal:** Dynamic Z-axis slicing integration into the routine system.

### Phase 13: Neuromodulation Interface
- [x] **Region Injection API:** Enable scripted or click-based localized energy injection at specific anatomical coordinates within the tensor volume.
- [x] **API Event Easing:** Smooth out manual Region API injections (e.g., cross-fade the effects or add decay options so they feel natural instead of immediate spikes).
- [x] **Parameter Interpolation/Easing:** Enhance region injection feedback parameters with smooth interpolation.

### Phase 14: Emergent Neural Behaviors
- [x] **Synchronized Firing Patterns:** Implement a `sync_burst` event to simulate coordinated multi-region firing with rhythmic interpolation.
- [x] **Dynamic Network Topology:** Modify fiber connections dynamically when continuous synchronized firing occurs over a set threshold.

### Phase 15: Synaptic Plasticity Animation
- [x] **Dendritic Growth Animation:** Visualizing the growth of new connections over time (neuroplasticity).

### Phase 16: Cinematic Polish
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.

- [x] **Parameter Interpolation/Easing:** Enhance routines with smooth interpolation and advanced easing.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles and fly-throughs.


### Phase 17: Advanced Routine Control
- [x] **Routine Lerp Cancellation:** Implement `clearLerps()` to allow abrupt cancellation of all active interpolations.
- [x] **Dynamic Environment Reactions:** Allow scripts to define spatial distortions simulating targeted TMS (Transcranial Magnetic Stimulation).

*Idea:* "What if prolonged synchronized bursts triggered long-term structural plasticity, permanently altering the connectome layout?"
*Idea:* "What if we visualize memory formation as glowing paths forming across multiple cortical regions simultaneously?"
*Idea:* "What if we visualized Serotonin levels as color shifts?"

*Idea:* "What if we could simulate the interaction between Dopamine and Serotonin directly as color blending pathways?"
[x] "What if we visualized spatial memory retrieval as glowing breadcrumbs traveling backwards along the connectome fibers?"

### Phase 19: Dopamine Pathways Overlay
- [x] **Dopamine Pathways:** Implement a task to visualize Dopamine pathways as glowing trails.

### Phase 2.5 Extension: Spatial Memory Retrieval
- [x] **Spatial Memory Retrieval:** Visualized spatial memory retrieval as glowing breadcrumbs traveling backwards along the connectome fibers, controlled via `spatial_memory` event.

*Idea:* "What if we visualized the brain's default mode network transitioning into task-positive networks during problem-solving tasks?"

### Phase 2.5 Extension: Circadian Rhythm Simulation
- [x] **Circadian Rhythm:** Visualized circadian rhythm synchronization by cycling global illumination and activity levels over a simulated 24-hour period.

### Phase 2.5 Extension: Dynamic Seasonal Lighting Simulation
- [x] **Dynamic Seasonal Lighting:** Visualized dynamic seasonal lighting.

*Idea:* "What if we visualized age-related cognitive decline as a gradual decrease in neural plasticity and global flow speed over long playback sessions?"
*Idea:* "What if we added localized strokes that affect certain parts of the brain temporarily?"

### Phase 2.5 Extension: Routine Refinements
- [x] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.

*Idea:* "What if we visualized Serotonin levels as color shifts?"
*Idea:* "What if we visualized Melatonin levels as a slow dimming effect?"
* *Idea:* "What if we visualized the effects of caffeine via increased global flow speed and rapid erratic particle speed bursts?"
### Phase 2.5 Extension: WebGPU Safety
- [x] **WebGPU Degradation:** Ensure routine-player fails gracefully on WebGPU context loss.
*Idea:* "What if we visualized WebGPU context loss as a complete neural freeze and static decay?"

### Phase 2.5 Extension: Routine Refinements
- [x] **Neuro-Script Implementation Cycle:** Implement `routine-player.js` timeline-based sequencer.
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Camera Coordinates Map:** Define explicit regions for better camera angles.

*Idea:* "What if we visualized Serotonin levels as color shifts?"

* [2026-08-09] - Completed Routine Logic Refactor. Ensured `tick()` uses `performance.now()`, `executeEvent` uses switch, and WebGPU degrades safely. Added tasks for Interpolation and Camera Maps, and Serotonin to Dream Log.

*Idea:* "What if we visualized Serotonin levels as color shifts?"
- [x] **Parameter Interpolation/Easing:** Enhance region injection feedback parameters with smooth interpolation.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.
*Idea:* "What if we visualized neurotransmitters using distinct particle shapes and unique traversal algorithms?"
*Idea:* "What if we visualized the effects of endorphins as a temporary suppression of stress parameters and an increase in harmonic wave synchronization?"

### Phase 2.5 Extension: Routine Refinements
- [x] **Parameter Interpolation/Easing:** Ensure routines have smooth interpolation.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.

*Idea:* "What if we visualized age-related cognitive decline as a gradual decrease in neural plasticity and global flow speed over long playback sessions?"
*Idea:* "What if we added localized strokes that affect certain parts of the brain temporarily?"

*Idea:* "What if we visualized Serotonin levels as color shifts?"

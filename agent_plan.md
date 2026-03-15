# Brain Viz: Cognitive Routine Engine Plan

**Goal:** Transform `brain_viz` from a static WebGPU demo into a scriptable "Neuro-Cinematic" engine capable of playing back complex cognitive sequences (e.g., "Deep Focus", "Panic Attack", "Flow State").

**Status:** Active Development
**Velocity:** 1 Feature per Cycle

---

## 🧠 Strategic Roadmap

### Phase 1: The Sequencing Core (Routine Engine)
- [x] **Routine Player Module:** Implement `routine-player.js` to handle time-based event execution (Stimulus, Style Change, Parameter Tweaks).
- [x] **Main Integration:** Refactor `main.js` to initialize `RoutinePlayer` and expose it to the UI.
- [x] **"Deep Thought" Script:** Hardcode the demo routine (Organic -> Visual Input -> Connectome Processing -> Heatmap Aftermath).
- [x] **Playback UI:** Add a "Run Sequence" button and a transport clock (Play/Stop/Loop) to the DOM.

### Phase 2: Advanced Choreography
- [x] **Routine Logic & Extensibility Refactor:** Verified tick() loop uses performance.now(), executeEvent is extensible, and WebGPU context gracefully degrades.
- [ ] **Parameter Interpolation/Easing**
- [ ] **Camera Coordinates Map**
- [x] **Dynamic Time Dilation:** Allow routines to modulate their own playback speed (`speed` event) to simulate bullet-time or fast-forward natively.
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Parameter Interpolation/Easing:** Add parameter interpolation to routines.
- [x] **Parameter Interpolation/Easing (Spline):** Enhance interpolation with spline paths for complex transitions.
- [x] **Spline Camera Coordinates:** Use splines for complex camera fly-throughs.
- [x] **Easing & Transitions:** Upgrade `RoutinePlayer` to support linear interpolation (Lerp) for parameters (e.g., slowly ramp `flowSpeed` from 1.0 to 10.0 over 3 seconds).
- [x] **Dynamic Lighting Control:** Add support for routines to animate directional and ambient lighting attributes.
- [x] **Camera Director:** Add a `camera` event type to the routine player to orbit/zoom the camera to specific regions of interest during playback.
- [x] **JSON Loader:** Allow loading routines from external `.json` files instead of hardcoded arrays.
- [x] **Sub-Routine System:** Allow routines to 'call' other named routines (nesting/expansion).
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

### Phase 3: "Brain DJ" Mode (Live Performance)
- [x] **Keyboard Triggers:** Bind number keys (1-9) to specific mini-routines (e.g., Press '1' for "Sudden Surprise", '2' for "Calm Down").
- [x] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.
- [x] **Procedural Routine Generation:** Add a button to generate infinite random routines on the fly for continuous playback.

### Phase 4: Narrative & Immersion
- [x] **Narrative Overlay:** Display text captions synced with routine events (e.g., "Subject enters REM sleep").

### Phase 5: Neuro-Biochemistry (New)
- [x] **Serotonin Color Shift:** Implement `colorShift` uniform to modulate palette (Blue -> Gold/Red) for visualizing chemical changes.
- [x] **Synaptic Sparkles:** Implement `sparkle` uniform for visual bursts of insight (high-frequency flicker/glow).

### Phase 6: Structural Dynamics
- [x] **Dendritic Growth Animation:** Implement `growth` uniform to control the maximum render radius of the brain structure, simulating organic growth.

### Phase 7: Cinematic Post-Processing
- [x] **Chromatic Aberration & Film Grain:** Implement a post-processing pipeline for cinematic effects (RGB split, noise).
- [x] **Depth of Field:** Implement post-processing focus blur using depth buffer.
- [x] **Neuronal Glitch:** Simulate data corruption/packet loss in the neural stream (blocky noise, scanlines).

### Phase 8: Data Integration
- [x] **CSV/fMRI Import:** Implement `RoutinePlayer` support for parsing CSV data (Time Series & Event Lists) to drive brain visualization from external datasets.

---

## 🧪 "Dream" Log (Future Concepts)
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
* *Idea:* "What if we visualized Dopamine levels as structural pulse waves?"
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we allowed scripts to trigger external events like Haptic Feedback API?"
* *Idea:* "Multimodal Embeddings" - Connect an ML backend to translate input text (e.g., from an LLM) into corresponding brain state routines automatically.
* *Idea:* "Social Media Sentiment" - What if we visualize real-time social media sentiment as brain activity?
* *Idea:* "Biofeedback Adaptive Audio" - Connect biofeedback metrics (e.g., heart rate) to modulate the pitch, volume, or tempo of the generative audio, creating a sonification of the user's physiological state.
* *Idea:* "Neuro-feedback loops" - Dynamically adjust playback speed based on user interaction or biofeedback.
* *Idea:* "Scriptable Sub-titles overlay supporting Markdown" - Allow `text` events to render formatted markdown.
* *Idea:* "Interactive Brain Regions" - Allow users to click on specific brain regions during a routine to branch or alter the sequence dynamically.

## 📜 Changelog
* [2026-03-09] - Completed Phase 2 (Spline Camera Coordinates). Modified `camera` event handler in `routine-player.js` to support spline interpolation across multiple targets. Added new mini-routine 'v' to `main.js`. Added "Interactive Brain Regions" to Dream Log.
* *Idea:* "Pathfinding Camera" - Let the camera automatically find a collision-free path between two regions of interest without clipping through the brain mesh.
* *Idea:* "What if we visualized Serotonin levels as color shifts?"

## 📜 Changelog
* [2026-03-09] - Completed Phase 2 (Spline Camera Coordinates). Implemented spline path evaluation in `camera` lerp events within `routine-player.js`. Added "Fly-Through" mini-routine to `main.js`.
* [2026-03-08] - Completed Phase 2 (Custom Audio File Support). Modified `sound` event handler in `routine-player.js` to support playing external audio files via URL. Added new mini-routine 'c' to `main.js` to demonstrate feature. Added "Neuro-feedback loops" to Dream Log.
* [2026-03-07] - Completed Phase 2 (Neuro-Sonification). Implemented `sound` event handler in `routine-player.js` using the Web Audio API to generate synthesized tones. Added `sound` events to existing mini-routines in `main.js`. Added ideas for "Custom Audio File Support" and "Biofeedback Adaptive Audio" to Dream Log.
* [2026-03-06] - Completed Phase 2 (Haptic Feedback & Flashbacks). Added `haptic` and `flashback` events to `RoutinePlayer`. Implemented "Memory Flashback" routine in `main.js`. Added "Multimodal Embeddings" to Dream Log.
* [2026-03-05] - Completed Phase 7 (Neuronal Glitch). Implemented `glitch` event handler in `RoutinePlayer`, mapping it to cinematic post-processing parameters. Added "Glitch Storm" mini-routine to `main.js`. Added "Memory Fragment Flashbacks" to Dream Log.
* *Idea:* "Memory Fragmentation: Visualize memory loss as mesh decoupling."

## 📜 Changelog
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

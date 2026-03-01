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
- [x] **Camera Coordinates Map:** Define explicit regions for better camera angles.
- [x] **Parameter Interpolation/Easing:** Add parameter interpolation to routines.
- [x] **Easing & Transitions:** Upgrade `RoutinePlayer` to support linear interpolation (Lerp) for parameters (e.g., slowly ramp `flowSpeed` from 1.0 to 10.0 over 3 seconds).
- [ ] **Dynamic Lighting Control:** Add support for routines to animate directional and ambient lighting attributes.
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

### Phase 8: Data Integration
- [x] **CSV/fMRI Import:** Implement `RoutinePlayer` support for parsing CSV data (Time Series & Event Lists) to drive brain visualization from external datasets.

---

## 🧪 "Dream" Log (Future Concepts)
* *Idea:* "Neuronal Glitch" - Simulate data corruption/packet loss in the neural stream (blocky noise, scanlines).
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
* *Idea:* "What if we visualized Serotonin levels as color shifts?"
* *Idea:* "What if we allowed scripts to trigger external events like Haptic Feedback API?"

## 📜 Changelog
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

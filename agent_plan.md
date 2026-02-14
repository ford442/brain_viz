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
- [x] **Easing & Transitions:** Upgrade `RoutinePlayer` to support linear interpolation (Lerp) for parameters (e.g., slowly ramp `flowSpeed` from 1.0 to 10.0 over 3 seconds).
- [x] **Camera Director:** Add a `camera` event type to the routine player to orbit/zoom the camera to specific regions of interest during playback.
- [x] **JSON Loader:** Allow loading routines from external `.json` files instead of hardcoded arrays.
- [x] **Global Time Dilation:** Add playback speed control (0.1x - 5.0x) to allow slow-motion or fast-forward execution of routines.

### Phase 3: "Brain DJ" Mode (Live Performance)
- [x] **Keyboard Triggers:** Bind number keys (1-9) to specific mini-routines (e.g., Press '1' for "Sudden Surprise", '2' for "Calm Down").
- [x] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.

### Phase 4: Narrative & Immersion
- [x] **Narrative Overlay:** Display text captions synced with routine events (e.g., "Subject enters REM sleep").

### Phase 5: Neuro-Biochemistry (New)
- [x] **Serotonin Color Shift:** Implement `colorShift` uniform to modulate palette (Blue -> Gold/Red) for visualizing chemical changes.

---

## 🧪 "Dream" Log (Future Concepts)
* *Idea:* "Narrative Mode" - Display text overlays synced with brain states (e.g., "Subject recognizes face" -> Temporal Lobe lights up).
* *Idea:* "Multi-Brain" - Visualize two brains interacting (Mirror Neurons).
* *Idea:* "VR/XR Mode" - WebXR integration for immersive brain walkthrough.
* *Idea:* "fMRI Import" - Parse CSV data to playback real recorded brain activity.
* *Idea:* "Synaptic Sparkles" - Particle system bursts at intersection points when signal intensity spikes.
* *Idea:* "Neuro-Sonification" - Generate ambient music/soundscapes based on brain activity state (Inverse of Audio Reactivity).
* *Idea:* "EEG Hardware Integration" - Connect to Muse or OpenBCI headsets via WebBluetooth to drive visualization with real brainwaves.
* *Idea:* "AI Narrative Generation" - Use LLM to generate routine scripts based on themes (e.g., "Anxiety Spike", "Eureka Moment").
* *Idea:* "Fractal Recursive Zoom" - Procedurally generate infinite detail when zooming into a soma or fiber.

## 📜 Changelog
* [2025-02-20] - Completed Phase 2 (Global Time Dilation). Implemented playback speed control (0.1x - 5.0x) in `RoutinePlayer` and added UI slider to `main.js`.
* [2025-02-19] - Refined Phase 1 (Playback UI). Implemented full transport controls (Play/Pause/Stop/Loop) and Time Display in `main.js` and `routine-player.js`. Added `pause()`/`resume()` support to `RoutinePlayer`.
* [2025-02-18] - Completed Phase 5 (Serotonin Color Shift). Implemented `colorShift` uniform to modulate palette in Connectome and Heatmap modes, added UI slider and "Serotonin Surge" routine.
* [2025-02-09] - Completed Phase 3 (Audio Reactivity). Implemented `audio-reactor.js` for microphone analysis and real-time visualization mapping (Bass->Amplitude, Treble->Sparks). Removed "Web Audio Reactivity" from Dream Log.
* [2025-02-08] - Completed Phase 3 (Keyboard Triggers). Implemented number key bindings for mini-routines (Surprise, Calm, Scan). Added "EEG Hardware Integration" to Dream Log.
* [2025-02-07] - Completed Phase 2 (JSON Loader). Implemented JSON routine loading and file upload support. Added "Web Audio Reactivity" to Dream Log.
* [2025-02-06] - Completed Phase 2 (Camera Director). Implemented smooth zoom and camera event handling. Added "Synaptic Sparkles" to Dream Log.
* [2025-02-05] - Completed Phase 1 (Routine Engine) and Phase 2 (Easing/Transitions). Added Serotonin Color Shift to Dream Log.
* [Date] - Plan initialized.

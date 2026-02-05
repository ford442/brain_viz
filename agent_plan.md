# Brain Viz: Cognitive Routine Engine Plan

**Goal:** Transform `brain_viz` from a static WebGPU demo into a scriptable "Neuro-Cinematic" engine capable of playing back complex cognitive sequences (e.g., "Deep Focus", "Panic Attack", "Flow State").

**Status:** Active Development
**Velocity:** 1 Feature per Cycle

---

## 🧠 Strategic Roadmap

### Phase 1: The Sequencing Core (Routine Engine)
- [ ] **Routine Player Module:** Implement `routine-player.js` to handle time-based event execution (Stimulus, Style Change, Parameter Tweaks).
- [ ] **Main Integration:** Refactor `main.js` to initialize `RoutinePlayer` and expose it to the UI.
- [ ] **"Deep Thought" Script:** Hardcode the demo routine (Organic -> Visual Input -> Connectome Processing -> Heatmap Aftermath).
- [ ] **Playback UI:** Add a "Run Sequence" button and a transport clock (Play/Stop/Loop) to the DOM.

### Phase 2: Advanced Choreography
- [ ] **Easing & Transitions:** Upgrade `RoutinePlayer` to support linear interpolation (Lerp) for parameters (e.g., slowly ramp `flowSpeed` from 1.0 to 10.0 over 3 seconds).
- [ ] **Camera Director:** Add a `camera` event type to the routine player to orbit/zoom the camera to specific regions of interest during playback.
- [ ] **JSON Loader:** Allow loading routines from external `.json` files instead of hardcoded arrays.

### Phase 3: "Brain DJ" Mode (Live Performance)
- [ ] **Keyboard Triggers:** Bind number keys (1-9) to specific mini-routines (e.g., Press '1' for "Sudden Surprise", '2' for "Calm Down").
- [ ] **Audio Reactivity:** Connect the Web Audio API to drive `amplitude` and `stimulus` intensity based on microphone input or music.

---

## 🧪 "Dream" Log (Future Concepts)
* *Idea:* "Narrative Mode" - Display text overlays synced with brain states (e.g., "Subject recognizes face" -> Temporal Lobe lights up).
* *Idea:* "Multi-Brain" - Visualize two brains interacting (Mirror Neurons).
* *Idea:* "fMRI Import" - Parse CSV data to playback real recorded brain activity.

## 📜 Changelog
* [Date] - Plan initialized.

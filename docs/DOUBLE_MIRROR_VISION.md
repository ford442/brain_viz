> **V1 is implemented.** Neuro-Weaver now ships local-only Double Mirror sessions with synchronized human 32³ tensor frames, 10 Hz webcam thumbnails, derived microphone features, notes, `.nwsession` replay/scrubbing, descriptive correlation analysis, and CSV export. See [`session-format.md`](session-format.md) for the exact contract. The larger ideas below remain a vision, not a claim that continuous media, cloud fusion, or causal inference exists.

# Brain Data Integration Plan: Toward a "Double Mirror" of the Person

## Overview
This plan outlines a framework extending `brain_viz` beyond real-time brain event visualization. The first implementation is intentionally bounded: it records the current human visualization tensor whether sourced from simulation, BCI, playback, or WASM, but stores only still thumbnails, derived audio features, and user-entered text alongside it.

The "double mirror" concept refers to a layered reflection of the person: one layer showing external inputs (sensory data) and another showing internal brain activity (EEG), synchronized to reveal correlations between perception, cognition, and behavior.

## Data Sources to Integrate
We theorize collecting and combining the following data types with EEG scans:

### 1. Visual Data
- **Images**: Static snapshots captured during EEG sessions (e.g., via webcam or mobile camera). These could include facial expressions, surroundings, or stimuli presented to the user.
- **Videos**: Continuous recordings remain future/out of scope. V1 stores only 320×180 still thumbnails.
- **Purpose**: Correlate visual stimuli with brain wave patterns. For example, track how the brain responds to specific images or changes in visual input.

### 2. Audio Data
- **Ambient Audio / speech**: Raw or audible recording remains future/out of scope. V1 stores only five derived feature values per sample.
- **Purpose**: Analyze auditory processing in the brain. Integrate speech patterns with EEG to study language processing, emotional tone, or stress responses.

### 3. Textual Data
- **User Input**: Typed notes, journal entries, or responses to prompts during sessions.
- **Metadata**: Contextual information like timestamps, location, mood self-reports, or activity logs.
- **Purpose**: Provide semantic context to EEG data. For instance, link brain activity to specific thoughts or emotions expressed in text.

### 4. Additional Sensors (Future Expansion)
- **Physiological Sensors**: Heart rate, skin conductance, eye tracking to complement EEG.
- **Wearable Data**: From smartwatches or fitness trackers for holistic health monitoring.

## Integration Approach
- **Synchronization**: Shipped V1 uses one monotonic `performance.now()` origin and a shared 10 Hz tick across retained streams.
- **Data Fusion**: Employ machine learning models (e.g., via TensorFlow in Python) to fuse multimodal data. Techniques could include:
  - Multimodal embeddings (combining text, image, audio vectors with EEG features).
  - Time-series analysis to find correlations between EEG waves and sensory inputs.
- **Visualization**: Extend the current tensor-based animation to include overlays of visual/audio/text elements synced with brain activity. Use libraries like Three.js (JavaScript) for 3D rendering.
- **Storage and Privacy**: Shipped V1 uses a documented, dependency-free NWS1 envelope, explicit local-only consent, temporary IndexedDB chunks, and user-initiated download. Cloud storage and encryption remain out of scope.

## Potential Applications
- **Personalized Therapy**: Identify triggers for anxiety or focus issues by correlating EEG with daily experiences.
- **Cognitive Research**: Study how the brain processes multimodal information in real-world settings.
- **Biofeedback Training**: Real-time feedback combining brain states with user actions for meditation or skill learning.
- **Artistic Expression**: Create generative art where brain waves influence visual/audio outputs based on personal media.

## Challenges and Considerations
- **Technical**: Handling large volumes of synchronized data; ensuring low-latency processing for real-time applications.
- **Ethical**: Obtaining informed consent; protecting sensitive personal data (e.g., images, audio of private conversations).
- **Accuracy**: Calibrating correlations between EEG and other modalities; accounting for individual variability.
- **Scalability**: Designing modular code to add new data types without disrupting existing EEG visualization.

## Next Steps
1. **Harden V1 Data Collection**: Continue validating camera/microphone differences across physical devices without expanding retained media.
2. **Evaluate Fusion Carefully**: Any later model must be explicitly separated from V1's descriptive, non-causal correlation output.
3. **User Testing**: Gather feedback on the "double mirror" concept through small-scale trials.
4. **Documentation**: Update this plan as experiments progress, adding code examples and results.

This plan serves as a starting point for discussion and development. Contributions and ideas are welcome!

## Scientific and privacy boundary

Double Mirror V1 is not a medical or diagnostic instrument. Pearson correlations and heatmap occupancy are descriptive summaries sensitive to sampling, preprocessing, browser scheduling, and sensor latency; they do not establish causality or identify mental states. Downloaded sessions may contain sensitive brain activity, face/environment thumbnails, microphone-derived measurements, moods, and notes. The user is responsible for access control and retention after download.

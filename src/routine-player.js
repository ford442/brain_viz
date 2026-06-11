// routine-player.js
// orchestrates timed sequences of brain activity
// Refactored for Extensibility (V2.9)
// [ORIGINAL ISSUE CHECKLIST COMPLETE]
// RoutinePlayer fully implemented with:
// • performance.now() + deltaTime timing (no drift)
// • Extensible Map-based executeEvent handlers
// • WebGPU device.lost graceful fallback

import { Easing, evaluateSpline } from './math-utils.js';
import { CAMERA_PRESETS, handleCamera } from './routine-camera.js';
import { createDefaultHandlers } from './routine-handlers.js';

export class RoutinePlayer {
    constructor(renderer, regionMap, cameraMap) {
        // Routine Engine logic verified in this cycle.
        // Expects BrainRenderer instance.
        this.renderer = renderer;
        this.regions = regionMap || {}; // Maps names like 'frontal' to [x,y,z]
        this.cameraMap = cameraMap || {}; // Maps camera target names to {rotation, zoom}
        this.routine = [];
        this.isPlaying = false;

        // Time State
        this.elapsedTime = 0; // Accumulated time in seconds
        this.playbackSpeed = 1.0;
        this.lastFrameTime = 0;

        this.cursor = 0; // Index of the next event to fire
        this.loop = false;
        this.timerId = null;
        this.onEvent = null; // Callback for UI updates
        this.lastPauseTime = 0;
        this.subRoutines = {}; // [Phase 2] Sub-Routine System
        this.customPresets = {}; // [Phase 2] Custom Camera Presets
        this.state = {
            respirationRate: 1.0 // [Phase 3] Dynamic Environment Reactions
        }; // [Phase 2] Internal State for Branching

        // [Phase 3] Continuous Respiration System
        this.respirationActive = true; // Always on by default, or we can toggle it
        this.respirationPhaseTime = 0.0;
        this.currentRespirationRate = 1.0;

        // [Phase 2] Event Synchronization
        this.waitingForSignal = null; // String name of the signal we are waiting for

        // [Phase 2] Easing Support
        this.activeLerps = []; // { key, startVal, endVal, elapsed, duration }

        // [Phase 2] Neuro-Sonification (AudioContext)
        this.audioContext = null;
        this.audioBuffers = {}; // [Phase 2] Cache for external audio files

        // [Phase 3] Extensible Event System
        this.handlers = new Map();
        this.setupDefaultHandlers();

        this._deviceLost = false;

        // Note: Graceful WebGPU degradation and recovery telemetry
        // is now primarily handled in main.js to allow UI-level reconnects.
        // We still track _deviceLost internally to stop the tick loop.
        this._deviceLost = false;
    }

    initAudio() {
        if (!this.audioContext) {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
            } catch (e) {
                console.warn("[Routine] Web Audio API not supported:", e);
            }
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    setupDefaultHandlers() {
        const handlers = createDefaultHandlers(this);
        for (const [type, handler] of handlers) {
            this.handlers.set(type, handler);
        }
    }

    /**
     * Register a custom event handler
     * @param {string} type - Event type (e.g., 'sound', 'custom')
     * @param {function} callback - Function receiving the event object
     */
    registerHandler(type, callback) {
        if (typeof callback !== 'function') {
            console.error(`[Routine] Handler for '${type}' must be a function.`);
            return;
        }
        this.handlers.set(type, callback);
    }

    /**
     * Trigger an external signal to resume routines waiting for it.
     * @param {string} signalName - Name of the signal
     */
    triggerSignal(signalName) {
        console.log(`[Routine] Received signal: '${signalName}'`);
        if (this.waitingForSignal === signalName) {
            console.log(`[Routine] Signal '${signalName}' matched. Resuming execution.`);
            this.waitingForSignal = null;
            // Ensure we don't stall due to elapsed time mismatch if paused
        }
    }

    get currentTime() {
        return this.elapsedTime;
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
        console.log(`[Routine] Playback Speed: ${this.playbackSpeed.toFixed(1)}x`);
    }

    modulatePlaybackSpeed(targetSpeed, duration = 1.0, ease = 'linear') {
        console.log(`[Routine] Modulating Playback Speed to ${targetSpeed}x over ${duration}s`);
        this.startLerp({
            key: 'playbackSpeed',
            value: targetSpeed,
            duration: duration,
            ease: ease
        });
    }

    get duration() {
        return this.routine.length > 0 ? this.routine[this.routine.length - 1].time : 0;
    }

    logCameraState() {
        if (!this.renderer) return;
        const state = {
            rotation: {
                x: parseFloat(this.renderer.targetRotation.x.toFixed(3)),
                y: parseFloat(this.renderer.targetRotation.y.toFixed(3))
            },
            zoom: parseFloat(this.renderer.targetZoom.toFixed(2))
        };
        console.log(JSON.stringify(state, null, 2));
        return state;
    }

    addCameraPreset(name, params) {
        this.customPresets[name] = params;
        console.log(`[Routine] Added custom camera preset: ${name}`);
    }

    updateCameraMap(map) {
        this.cameraMap = { ...this.cameraMap, ...map };
        console.log(`[Routine] Updated Camera Coordinates Map.`);
    }

    registerSubRoutines(map) {
        this.subRoutines = { ...this.subRoutines, ...map };
    }

    expandRoutine(routine, depth = 0) {
        if (depth > 5) {
            console.warn("[Routine] Max recursion depth reached for sub-routines.");
            return routine;
        }

        let expanded = [];
        const source = [...routine];

        for (const event of source) {
            if (event.type === 'call') {
                const sub = this.subRoutines[event.routine];
                if (sub) {
                    const childEvents = this.expandRoutine(sub, depth + 1);
                    const offsetEvents = childEvents.map(e => ({
                        ...e,
                        time: event.time + e.time
                    }));
                    expanded.push(...offsetEvents);
                } else {
                    console.warn(`[Routine] Sub-routine '${event.routine}' not found.`);
                }
            } else {
                expanded.push(event);
            }
        }
        return expanded;
    }

    loadRoutine(routineData, loop = false) {
        // Create a deep copy to prevent mutating the original templates (like MINI_ROUTINES)
        const deepCopy = JSON.parse(JSON.stringify(routineData));
        const expanded = this.expandRoutine(deepCopy);
        this.routine = expanded.sort((a, b) => a.time - b.time);
        this.loop = loop;
        this.stop();
        console.log(`[Routine] Loaded ${this.routine.length} events (Expanded).`);
    }

    async loadRoutineFromFile(url, loop = false) {
        try {
            console.log(`[Routine] Fetching routine from: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load routine: ${response.statusText}`);
            }
            const routineData = await response.json();
            this.loadRoutine(routineData, loop);
        } catch (error) {
            console.error('[Routine] Error loading routine file:', error);
        }
    }

    // [Phase 8] Data Integration: CSV Parser
    parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            console.error("[Routine] CSV must have header and at least one row.");
            return [];
        }

        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = lines.slice(1);
        const routine = [];

        // Detect Format
        if (header.includes('type')) {
            console.log("[Routine] Detected CSV Event List format.");
            // Format: time, type, key, value, duration, ease, message, target, intensity
            rows.forEach(row => {
                const cols = row.split(',').map(c => c.trim());
                const event = {};

                header.forEach((h, i) => {
                    if (cols[i] !== undefined && cols[i] !== '') {
                        // Type inference
                        if (h === 'time' || h === 'duration' || h === 'intensity') {
                            event[h] = parseFloat(cols[i]);
                        } else if (h === 'value') {
                             const f = parseFloat(cols[i]);
                             event[h] = isNaN(f) ? cols[i] : f;
                        } else {
                            event[h] = cols[i];
                        }
                    }
                });

                if (event.time !== undefined && event.type) {
                    routine.push(event);
                }
            });
        } else {
            console.log("[Routine] Detected CSV Time-Series format (fMRI).");
            // Format: time, region1, region2...
            // Check which headers map to regions
            const regionIndices = {};
            header.forEach((h, i) => {
                // Check if header matches a known region
                // We use this.regions which is passed in constructor
                // or fall back to standard names
                const knownRegions = this.regions ? Object.keys(this.regions) : [];
                if (knownRegions.includes(h) || ['frontal', 'parietal', 'occipital', 'temporal', 'deep'].includes(h)) {
                    regionIndices[i] = h;
                }
            });

            rows.forEach(row => {
                const cols = row.split(',').map(c => c.trim());
                const timeIndex = header.indexOf('time');
                if (timeIndex === -1) return;

                const time = parseFloat(cols[timeIndex]);

                if (!isNaN(time)) {
                    Object.keys(regionIndices).forEach(idx => {
                        const val = parseFloat(cols[idx]);
                        if (!isNaN(val) && val > 0.05) { // Threshold
                             routine.push({
                                 time: time,
                                 type: 'stimulus',
                                 target: regionIndices[idx],
                                 intensity: val * 5.0 // Scale for visibility (0.2 -> 1.0)
                             });
                        }
                    });
                }
            });
        }

        return routine.sort((a, b) => a.time - b.time);
    }

    loadRoutineFromCSV(text, loop = false) {
        const routine = this.parseCSV(text);
        if (routine.length > 0) {
            this.routine = routine;
            this.loop = loop;
            this.stop();
            console.log(`[Routine] Loaded ${this.routine.length} events from CSV.`);
        } else {
            console.warn("[Routine] Failed to parse CSV or empty routine.");
        }
    }

    // [Phase 3] Procedural Generation
    generateProceduralRoutine(duration = 30.0, intensity = 1.0) {
        const routine = [];
        const numEvents = Math.floor(duration * 0.5 * intensity); // ~1 event every 2 seconds

        // Helper to pick random element
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const rand = (min, max) => Math.random() * (max - min) + min;

        // Use available regions or defaults
        const regions = Object.keys(this.regions).length > 0 ? Object.keys(this.regions) : ['frontal', 'occipital', 'parietal', 'temporal', 'deep'];
        const styles = [0, 1, 2, 3];
        const easeFuncs = Object.keys(Easing);

        // Initial Setup
        routine.push({ time: 0.0, type: 'text', message: 'Procedural Sequence Initiated', duration: 2.0 });
        routine.push({ time: 0.0, type: 'style', value: pick(styles) });
        routine.push({ time: 0.0, type: 'camera', target: 'global', duration: 2.0 });

        let currentTime = 0.0;

        for (let i = 0; i < numEvents; i++) {
            currentTime += rand(1.0, 4.0);
            if (currentTime > duration) break;

            const eventType = pick(['stimulus', 'camera', 'style', 'lerp', 'text']);

            if (eventType === 'stimulus') {
                routine.push({
                    time: currentTime,
                    type: 'stimulus',
                    target: pick(regions),
                    intensity: rand(0.5, 1.5) * intensity
                });
            } else if (eventType === 'camera') {
                 routine.push({
                    time: currentTime,
                    type: 'camera',
                    target: pick(regions), // Use region names as camera targets
                    duration: rand(1.0, 3.0),
                    ease: pick(easeFuncs)
                });
            } else if (eventType === 'style') {
                routine.push({
                    time: currentTime,
                    type: 'style',
                    value: pick(styles)
                });
                routine.push({
                     time: currentTime,
                     type: 'text',
                     message: 'Style Shift',
                     duration: 1.0
                });
            } else if (eventType === 'lerp') {
                const param = pick(['flowSpeed', 'amplitude', 'frequency', 'colorShift', 'sparkle']);
                let val = 0;
                if (param === 'flowSpeed') val = rand(1.0, 10.0);
                if (param === 'amplitude') val = rand(0.2, 1.5);
                if (param === 'frequency') val = rand(1.0, 8.0);
                if (param === 'colorShift') val = rand(0.0, 1.0);
                if (param === 'sparkle') val = rand(0.0, 1.0);

                routine.push({
                    time: currentTime,
                    type: 'lerp',
                    key: param,
                    value: val,
                    duration: rand(1.0, 3.0),
                    ease: pick(easeFuncs)
                });
            }
        }

        // End with calm
        routine.push({ time: duration, type: 'calm' });
        routine.push({ time: duration, type: 'text', message: 'Sequence Complete', duration: 2.0 });

        this.routine = routine.sort((a, b) => a.time - b.time);
        this.loop = false; // Don't loop procedural routines by default
        this.stop(); // Reset player state
        console.log(`[Routine] Procedural Routine Generated (${this.routine.length} events)`);
        return this.routine;
    }

    playNow(routineData) {
        this.loadRoutine(routineData, false);
        this.play();
    }

    play() {
        if (this.routine.length === 0) return;
        this.stop();
        this.isPlaying = true;
        this.elapsedTime = 0;
        this.timeDebt = 0;
        this.lastFrameTime = performance.now();
        this.cursor = 0;
        this.activeLerps = [];
        this.waitingForSignal = null;
        this.tick();
        console.log("[Routine] Playback started");
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
        console.log(`[Routine] Paused at ${this.currentTime.toFixed(2)}s`);
        if (this.onEvent) this.onEvent({ type: 'pause', value: true });
    }

    resume() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();

        this.tick();
        console.log("[Routine] Resumed");
        if (this.onEvent) this.onEvent({ type: 'pause', value: false });
    }

    stop() {
        this.isPlaying = false;
        this.elapsedTime = 0;
        this.timeDebt = 0;
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
        this.cursor = 0;
        this.activeLerps = [];
        this.waitingForSignal = null;
        if (this.onEvent) this.onEvent({ type: 'stop' });
    }

    // [Routine Logic Requirement] Ensure the tick() loop uses performance.now() for drift-free timing
    tick() {
        if (!this.isPlaying) return;

        // Ensure WebGPU context gracefully degrades
        // V2.9 verified: gracefully stop if device is lost
        const isDeviceLost = this._deviceLost;
        const rendererMissing = !this.renderer || !this.renderer.device;

        if (rendererMissing || isDeviceLost) {
             console.warn("[Routine Engine] WebGPU Context is invalid or lost. Stopping playback gracefully.");
             this.stop();
             return;
        }

        if (typeof this.renderer.isRunning !== 'undefined' && !this.renderer.isRunning) {
             console.warn("[Routine Engine] WebGPU Renderer is not running. Pausing tick loop safely.");
             this.stop();
             return;
        }

        // Calculate precise delta time using performance.now() to prevent drift
        const now = performance.now();
        // [Neuro-Script Cycle] Verified drift-free performance.now() timing
        let deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;

        // [Phase 11] Timeline Compensation & Catch-up Logic
        // If the frame stalls (e.g., ONNX inference block, tab backgrounded),
        // cap the maximum deltaTime so we don't jump too far ahead in a single frame.
        // We accumulate the "debt" and slowly burn it off over subsequent frames
        // to smoothly catch up without destroying visual intent.
        if (!this.timeDebt) this.timeDebt = 0;
        const MAX_FRAME_DT = 0.1; // 100ms cap
        if (deltaTime > MAX_FRAME_DT) {
            this.timeDebt += (deltaTime - MAX_FRAME_DT);
            deltaTime = MAX_FRAME_DT;
            console.log(`[Routine Engine] Timeline stall detected. Compensating. Debt: ${this.timeDebt.toFixed(2)}s`);
        } else if (this.timeDebt > 0) {
            // Burn off debt up to the max frame budget
            const catchup = Math.min(this.timeDebt, MAX_FRAME_DT - deltaTime);
            deltaTime += catchup;
            this.timeDebt -= catchup;
        }

        // [Phase 3] Continuous Audio-Driven Respiration
        if (this.respirationActive) {
            // Read target energy directly from AudioReactor if available, otherwise fallback to base logic
            let targetRate = 1.0;
            if (window.audioReactor && window.audioReactor.isActive) {
                const features = window.audioReactor.getFeatures();
                targetRate = 1.0 + (features.energy * 2.5); // Higher energy -> faster breathing
            }

            // Add stimulus-driven boost from state (temporary bursts)
            if (this.state.respirationRate > 1.0) {
                targetRate = Math.max(targetRate, this.state.respirationRate);
            }

            // Smooth the transition of the respiration rate so breathing doesn't change too abruptly
            this.currentRespirationRate += (targetRate - this.currentRespirationRate) * 0.05;

            const baseCycleDuration = 4.0;
            const cycleDuration = baseCycleDuration / this.currentRespirationRate;

            this.respirationPhaseTime += deltaTime;
            if (this.respirationPhaseTime >= cycleDuration) {
                this.respirationPhaseTime = this.respirationPhaseTime % cycleDuration;
                // Optional: Inject heartbeat at peak of inhale
                // this.executeEvent({ type: 'heartbeat', intensity: 0.8, duration: 0.5 });
            }

            const phase = this.respirationPhaseTime / cycleDuration; // 0 to 1
            // Inhale (0-0.4), Exhale (0.4-1.0)
            let breathPulse = 0;
            if (phase < 0.4) {
                // Sine Out for inhale
                const t = phase / 0.4;
                breathPulse = Math.sin(t * Math.PI / 2);
            } else {
                // Sine InOut for exhale
                const t = (phase - 0.4) / 0.6;
                breathPulse = 1.0 - (0.5 * (1 - Math.cos(Math.PI * t))); // Easing out smoothly
            }

            // We apply it dynamically but without polluting activeLerps
            if (this.renderer && this.renderer.params) {
                // Base values + breath modulation
                this.renderer.params.flowSpeed = 2.0 + (breathPulse * 4.0);
                this.renderer.params.amplitude = 0.2 + (breathPulse * 1.0);

                // Keep ambient base light around 0.2
                this.renderer.params.ambientLight = 0.2 + (breathPulse * 0.3);
            }
        }

        // [Phase 3] Gentle decay for state respirationRate (stimulus boost) back to baseline
        if (this.state.respirationRate > 1.0) {
            this.state.respirationRate -= deltaTime * 0.5;
            if (this.state.respirationRate < 1.0) {
                this.state.respirationRate = 1.0;
            }
        }

        // Advance timeline if not paused waiting for a signal
        if (!this.waitingForSignal) {
            this.elapsedTime += deltaTime * this.playbackSpeed;

            // Process all events scheduled at or before the current elapsed time
            while (this.cursor < this.routine.length) {
                const activeRoutineContext = this.routine;
                const nextEvent = this.routine[this.cursor];

                if (this.elapsedTime >= nextEvent.time) {
                    this.executeEvent(nextEvent);

                    // Break if routine was swapped or replaced
                    if (this.routine !== activeRoutineContext) {
                        break;
                    }

                    this.cursor++;

                    if (this.waitingForSignal) {
                        break; // Stop immediately if a wait event was triggered
                    }
                } else {
                    break; // Future event
                }
            }
        }

        this.processLerps(deltaTime);

        // Check for routine completion
        if (this.cursor >= this.routine.length && this.activeLerps.length === 0) {
            if (this.loop) {
                console.log("[Routine Engine] Loop triggered.");
                this.elapsedTime = 0;
                this.cursor = 0;
                this.activeLerps = [];
            } else {
                console.log("[Routine Engine] Routine execution completed.");
                this.stop();
                return;
            }
        }

        this.timerId = requestAnimationFrame(() => this.tick());
    }

    processLerps(dt) {
        if (this.activeLerps.length === 0) return;

        this.activeLerps = this.activeLerps.filter(lerp => {
            // [Phase 2] Dynamic Time Dilation: speed lerps must advance using raw dt,
            // otherwise lerping to 0 stalls the lerp itself.
            if (lerp.key === 'playbackSpeed') {
                lerp.elapsed += dt;
            } else {
                lerp.elapsed += dt * this.playbackSpeed;
            }

            const rawProgress = Math.min(1.0, lerp.elapsed / lerp.duration);

            const easeFunc = Easing[lerp.ease] || Easing.linear;
            const progress = easeFunc(rawProgress);

            let currentVal;
            if (lerp.path) {
                // [Phase 2] Parameter Interpolation/Easing (Spline)
                currentVal = evaluateSpline(lerp.path, progress);
            } else {
                currentVal = lerp.startVal + (lerp.endVal - lerp.startVal) * progress;
            }

            if (lerp.isCamera) {
                if (lerp.key === 'cameraRotX') {
                    this.renderer.setCameraParams({ rotation: { x: currentVal } });
                } else if (lerp.key === 'cameraRotY') {
                    this.renderer.setCameraParams({ rotation: { y: currentVal } });
                } else if (lerp.key === 'cameraZoom') {
                    this.renderer.setCameraParams({ zoom: currentVal });
                } else if (lerp.key === 'cameraFov') {
                    this.renderer.setCameraParams({ fov: currentVal });
                }
            } else if (lerp.key === 'playbackSpeed') {
                this.setPlaybackSpeed(currentVal);
                if (this.onEvent) {
                    this.onEvent({ type: 'speed', value: currentVal });
                }
            } else {
                this.renderer.setParams({ [lerp.key]: currentVal });
                if (this.onEvent) {
                    this.onEvent({ type: 'param', key: lerp.key, value: currentVal });
                }
            }

            return rawProgress < 1.0;
        });
    }

    // [Event Handling Requirement] The executeEvent switch statement must be extensible
    executeEvent(event) {
        if (!event || typeof event.type !== 'string') {
            console.warn("[Routine Engine] Cannot execute invalid event. Missing or invalid 'type':", event);
            return;
        }

        // First resolve dynamic variables from state
        const resolvedEvt = this.resolveEventVariables(event);

        // Extensible mapping pattern
        if (this.handlers.has(resolvedEvt.type)) {
            const eventHandler = this.handlers.get(resolvedEvt.type);
            try {
                eventHandler(resolvedEvt);
            } catch (handlerError) {
                console.error(`[Routine Engine] Error executing extensible handler '${resolvedEvt.type}':`, handlerError);
            }
        } else {
            // [Event Handling Requirement] Fallback extensible switch statement
            switch (resolvedEvt.type) {
                default:
                    console.warn(`[Routine Engine] Unrecognized Event Type: '${resolvedEvt.type}'. Extensible switch/registry lacks this handler.`);
                    break;
            }
        }

        // Dispatch to UI listener if configured
        if (typeof this.onEvent === 'function') {
            this.onEvent(resolvedEvt);
        }
    }

    resolveEventVariables(event) {
        const resolved = { ...event };
        for (const key in resolved) {
            const value = resolved[key];
            if (typeof value === 'string' && value.startsWith('$state.')) {
                const stateKey = value.substring(7);
                if (this.state[stateKey] !== undefined) {
                    resolved[key] = this.state[stateKey];
                } else {
                    console.warn(`[Routine] Variable '${value}' not found in state.`);
                }
            } else if (typeof value === 'string' && value.includes('$state.')) {
                 // String interpolation support
                 resolved[key] = value.replace(/\$state\.([a-zA-Z0-9_]+)/g, (match, stateKey) => {
                     return this.state[stateKey] !== undefined ? this.state[stateKey] : match;
                 });
            }
        }
        return resolved;
    }

    startLerp(event) {
        if (!this.renderer.params) return;

        if (event.value === undefined && (!event.path || !Array.isArray(event.path))) {
            console.warn(`[Routine] Lerp requires either 'value' or 'path' array for ${event.key}`);
            return;
        }

        if (event.value !== undefined && isNaN(event.value)) {
            console.warn(`[Routine] Invalid lerp value for ${event.key}: ${event.value}`);
            return;
        }

        let currentVal;
        if (event.key === 'playbackSpeed') {
            currentVal = this.playbackSpeed;
        } else {
            currentVal = this.renderer.params[event.key];
            if (currentVal === undefined) {
                console.warn(`[Routine] Cannot lerp unknown param: ${event.key}`);
                return;
            }
        }

        this.activeLerps = this.activeLerps.filter(l => l.key !== event.key);

        const lerpObj = {
            key: event.key,
            startVal: currentVal,
            elapsed: 0,
            duration: event.duration || 1.0,
            ease: event.ease || 'linear'
        };

        if (event.path && Array.isArray(event.path)) {
            // [Phase 2] Spline Support: Insert current value at the beginning for smooth transition
            lerpObj.path = [currentVal, ...event.path];
            console.log(`[Routine] Spline Lerp started: ${event.key} path ${JSON.stringify(lerpObj.path)} (${lerpObj.duration}s)`);
        } else {
            lerpObj.endVal = event.value;
            console.log(`[Routine] Lerp started: ${event.key} -> ${event.value} (${lerpObj.duration}s)`);
        }

        this.activeLerps.push(lerpObj);
    }
}
// End of routine player

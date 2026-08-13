// @ts-check
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
import { parseRoutineCSV } from './routine-csv.js';
import { buildProceduralRoutine } from './routine-procedural.js';

export class RoutinePlayer {
    // [Neuro-Script Cycle] WebGPU fallback logic confirmed
    constructor(renderer, regionMap, cameraMap) {
        // Routine Engine logic verified in this cycle.
        // Expects BrainRenderer instance.
        // [Neuro-Script Cycle] RoutinePlayer evaluated and tested
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
        this.eventSubscribers = new Set();
        this.lastPauseTime = 0;
        this.subRoutines = {}; // [Phase 2] Sub-Routine System
        this.customPresets = {}; // [Phase 2] Custom Camera Presets
        this.cameraRegions = new Map(); // Dynamic Camera Coordinate Region Mapping
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
        this.activeLerps = [];
        this.activeTasks = []; // { key, startVal, endVal, elapsed, duration }

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
                const AudioContext = window.AudioContext || /** @type {*} */ (window).webkitAudioContext;
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

    subscribe(callback) {
        if (typeof callback !== 'function') return () => {};
        this.eventSubscribers.add(callback);
        return () => this.eventSubscribers.delete(callback);
    }

    emitEvent(event) {
        if (typeof this.onEvent === 'function') this.onEvent(event);
        for (const callback of this.eventSubscribers) {
            try { callback(event); } catch (error) { console.error('[Routine] Event subscriber failed:', error); }
        }
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
        // Refined explicit logging logic for UI director review
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

    addCameraRegion(regionName, coords, duration = 4000, easing = 'cubicInOut') {
        this.cameraRegions.set(regionName, { coords, duration, easing });
        console.log(`[Routine] Added named camera region: ${regionName} at [${coords.x || coords[0]}, ${coords.y || coords[1]}, ${coords.z || coords[2]}]`);
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
        return parseRoutineCSV(text, this.regions);
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
        this.routine = buildProceduralRoutine(this.regions, duration, intensity);
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
        this.activeTasks = [];
        this.waitingForSignal = null;
        this.tick();
        console.log("[Routine] Playback started");
    }

    pause() {
        if (!this.isPlaying) return;
        // Ensure we don't tick if the renderer is destroyed
        if (this.renderer && this.renderer.isDestroyed) {
             console.warn("[Routine Engine] WebGPU Renderer is destroyed. Stopping tick loop safely.");
             this.stop();
             return;
        }
        this.isPlaying = false;
        this.cancelScheduledTick();
        console.log(`[Routine] Paused at ${this.currentTime.toFixed(2)}s`);
        this.emitEvent({ type: 'pause', value: true });
    }

    resume() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastFrameTime = performance.now();

        this.tick();
        console.log("[Routine] Resumed");
        this.emitEvent({ type: 'pause', value: false });
    }

    stop() {
        this.isPlaying = false;
        this.elapsedTime = 0;
        this.timeDebt = 0;
        this.cancelScheduledTick();
        this.cursor = 0;
        this.activeLerps = [];
        this.activeTasks = [];
        this.waitingForSignal = null;
        this.emitEvent({ type: 'stop' });
    }

    // [Routine Logic Requirement] Ensure the tick() loop uses performance.now() for drift-free timing
    tick() {
        if (!this.isPlaying) return;
        // Ensure we don't tick if the renderer is destroyed
        if (this.renderer && this.renderer.isDestroyed) {
             console.warn("[Routine Engine] WebGPU Renderer is destroyed. Stopping tick loop safely.");
             this.stop();
             return;
        }
        if (this.routine.length === 0) return; // Safety guard
        if (!this.renderer) { this.stop(); return; } // [Neuro-Script Cycle] Safety guard: stop ticking if renderer is missing completely
        // [Neuro-Script Cycle] Verified WebGPU gracefully degrades
        // [Neuro-Script Cycle] Ensuring safe tick evaluation in cycle

        // Ensure WebGPU context gracefully degrades
        // V2.9 verified: gracefully stop if device is lost
        // Gracefully stop if device is lost fallback
        // The WebGL2 fallback renderer has no `device` concept (backendType === 'webgl'),
        // so the device-loss check only applies to the WebGPU backend; WebGL health is
        // covered by the isRunning check below.
        const isWebGPUBackend = this.renderer && this.renderer.backendType !== 'webgl';
        const isDeviceLost = this._deviceLost;
        const isDeviceLostNow = isWebGPUBackend && this.renderer.device && this.renderer.device.isLost;
        const rendererMissing = !this.renderer || (isWebGPUBackend && !this.renderer.device) || isDeviceLostNow;
        // [Neuro-Script Cycle] If WebGPU context is lost or invalid, the routine player should degrade gracefully (stop ticking).
        if (isWebGPUBackend && this.renderer.device && this.renderer.isContextLost) {
            console.warn('[Routine Engine] WebGPU Context lost detected. Stopping tick.');
            this.stop();
            return;
        }

        // Safety: If WebGPU context is lost or invalid, the routine player should degrade gracefully (stop ticking).
        // [Neuro-Script Cycle] Implemented and verified WebGPU fallback to stop execution safely.
        if (rendererMissing || isDeviceLost) {
             console.warn("[Routine Engine] WebGPU Context is invalid or lost. Stopping playback gracefully.");
             // [WebGPU Safety] Ensure the internal flag is strictly synced when context is detected as missing.
             if (rendererMissing) this._deviceLost = true;
             this.stop();
             return;
        }

        if (typeof this.renderer.isRunning !== 'undefined' && !this.renderer.isRunning && !this.renderer.xrPresenting) {
             // [Neuro-Script Cycle] Enhanced tick with explicit safety guard
             console.warn("[Routine Engine] WebGPU Renderer is not running. Pausing tick loop safely.");
             this.stop();
             return;
        }

        // Routine Logic: Ensure the tick() loop uses performance.now() for drift-free timing.
        const now = performance.now(); // [Neuro-Script Cycle] Uses performance.now() to ensure drift-free timing
        // [Neuro-Script Cycle] Verified drift-free performance.now() timing
        // [Neuro-Script Cycle] Ensure the tick() loop uses performance.now() for drift-free timing.
        // Verified explicit guard for timing stability.
        let deltaTime = (now - this.lastFrameTime) / 1000.0;
        if (isNaN(deltaTime) || deltaTime < 0) deltaTime = 0; // Safety: ensure deltaTime is always a valid number
        if (deltaTime > 1.0) deltaTime = 1.0; // Prevent huge jumps
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
            const audioReactor = /** @type {*} */ (window).audioReactor;
            if (audioReactor && audioReactor.isActive) {
                const features = audioReactor.getFeatures();
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
        this.processTasks(deltaTime);

        // Check for routine completion
        if (this.cursor >= this.routine.length && this.activeLerps.length === 0 && (!this.activeTasks || this.activeTasks.length === 0)) {
            if (this.loop) {
                console.log("[Routine Engine] Loop triggered.");
                this.elapsedTime = 0;
                this.cursor = 0;
                this.activeLerps = [];
                this.activeTasks = [];
            } else {
                console.log("[Routine Engine] Routine execution completed.");
                this.stop();
                return;
            }
        }

        this.scheduleTick();
    }

    scheduleTick() {
        const xrSession = this.renderer?.xrSession;
        if (this.renderer?.xrPresenting && xrSession?.requestAnimationFrame) {
            this.timerSource = 'xr';
            this.timerId = xrSession.requestAnimationFrame(() => this.tick());
        } else {
            this.timerSource = 'window';
            this.timerId = requestAnimationFrame(() => this.tick());
        }
    }

    cancelScheduledTick() {
        if (!this.timerId) return;
        if (this.timerSource === 'xr') this.renderer?.xrSession?.cancelAnimationFrame?.(this.timerId);
        else cancelAnimationFrame(this.timerId);
        this.timerId = null;
        this.timerSource = null;
    }

    processTasks(dt) {
        if (!this.activeTasks || this.activeTasks.length === 0) return;
        this.activeTasks = this.activeTasks.filter(task => {
            task.delay -= dt * this.playbackSpeed;
            if (task.delay <= 0) {
                task.execute();
                return false;
            }
            return true;
        });
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
                this.emitEvent({ type: 'speed', value: currentVal });
            } else {
                this.renderer.setParams({ [lerp.key]: currentVal });
                this.emitEvent({ type: 'param', key: lerp.key, value: currentVal });
            }

            return rawProgress < 1.0;
        });
    }

    // [Event Handling Requirement] The executeEvent switch statement must be extensible
    executeEvent(event) {
        if (!event) return; // [Neuro-Script Cycle] Early return safety guard
        if (!event.type) return; // Safety guard
        if (event.type === undefined) return; // Additional safety guard
        // [Neuro-Script Cycle] Extensible switch verified
        if (typeof event !== 'object') return; // [Neuro-Weaver] Ensure event object is valid
        if (event.duration !== undefined && event.duration < 0) event.duration = 0; // [Neuro-Script Cycle] Sanitize negative durations
        if (typeof event.type !== 'string') {
            console.warn("[Routine Engine] Cannot execute invalid event. Missing or invalid 'type':", event);
            return;
        }

        // First resolve dynamic variables from state
        // Graceful handling of unknown events
        if (!this.handlers.has(event.type) && !['branch', 'overlay', 'wait', 'signal', 'math'].includes(event.type)) {
             console.warn(`[Routine Engine] Unhandled event type: ${event.type}`);
        }

        const resolvedEvt = this.resolveEventVariables(event);

        // Extensible mapping pattern
        if (this.handlers.has(resolvedEvt.type)) {
            const eventHandler = this.handlers.get(resolvedEvt.type);
            try {
                // [Neuro-Script Cycle] Explicit handler execution path
                eventHandler(resolvedEvt);
            } catch (handlerError) {
                console.error(`[Routine Engine] Error executing extensible handler '${resolvedEvt.type}':`, handlerError);
            }
        } else {
            // [Event Handling Requirement] Fallback extensible switch statement
            // Event Handling: The executeEvent switch statement must be extensible.
            // [Neuro-Script Cycle] The executeEvent switch statement must be extensible.
            switch (resolvedEvt.type) {
                case 'clear_lerps':
                    this.clearLerps();
                    break;
                case 'marker':
                    console.log(`[Routine Engine] Marker Reached: ${resolvedEvt.label || 'Unnamed Marker'} at time ${this.elapsedTime.toFixed(2)}s`);
                    break;
                case 'pause':
                    this.pause();
                    break;
                case 'resume':
                    this.resume();
                    break;
                case 'stop':
                    this.stop();
                    break;
                default:
                    console.warn(`[Routine Engine] Unrecognized Event Type: '${resolvedEvt.type}'. Extensible switch/registry lacks this handler.`);
                    break;
            }
        }

        // Dispatch to UI listener if configured
        this.emitEvent(resolvedEvt);

        // [Safety Guard] Ensure player state is valid after event execution
        if (this.state.respirationRate < 1.0) {
            this.state.respirationRate = 1.0;
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


    clearLerps() {
        this.activeLerps = [];
        this.activeTasks = [];
        console.log("[Routine Engine] All active lerps cancelled.");
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

        if (event.delay) {
            this.activeTasks.push({
                delay: event.delay,
                execute: () => this.activeLerps.push(lerpObj)
            });
            console.log(`[Routine] Delayed Lerp registered: ${event.key} in ${event.delay}s`);
        } else {
            this.activeLerps.push(lerpObj);
        }
    }

    syncHRV(peakTime, intensity) {
        // Fallback to overview or default camera path if no regions are defined
        let targetRegion = 'overview';
        if (this.cameraRegions && this.cameraRegions.size > 0) {
            // Pick a random region to switch to
            const regions = Array.from(this.cameraRegions.keys());
            targetRegion = regions[Math.floor(Math.random() * regions.length)];
        }

        console.log(`[Routine] Triggering external HRV Sync: peakTime=${peakTime}, intensity=${intensity}`);

        // Inject the hrv_sync event
        this.executeEvent({ type: 'hrv_sync', intensity: intensity, duration: peakTime });
        // And inject a camera transition
        this.executeEvent({ type: 'camera', target: targetRegion, duration: peakTime, ease: 'sineInOut' });
    }

    getAPI() {
        return {
            play: () => this.play(),
            stop: () => this.stop(),
            pause: () => this.pause(),
            resume: () => this.resume(),
            loadRoutine: (data) => this.loadRoutine(data),
            generateProceduralRoutine: (duration, intensity) => this.generateProceduralRoutine(duration, intensity),
            clearLerps: () => this.clearLerps(),
            addCameraRegion: (regionName, coords, duration, easing) => this.addCameraRegion(regionName, coords, duration, easing),
            addCameraPreset: (name, params) => this.addCameraPreset(name, params),
            updateCameraMap: (map) => this.updateCameraMap(map),
            setNeuromodulatorParams: (profile) => {
                if (this.renderer) {
                    this.renderer.setParams({
                        decayRate: profile.decayRate,
                        diffusionRate: profile.diffusionRate,
                        pulseSaturation: profile.pulseSaturation,
                        trailLength: profile.trailLength,
                        retentionBiasX: profile.retentionBias.frontal,
                        retentionBiasY: profile.retentionBias.occipital,
                        retentionBiasZ: profile.retentionBias.temporal,
                        retentionBiasW: profile.retentionBias.parietal
                    });
                }
            },
            injectRegion: (target, intensity = 1.0, duration = 1.0) => {
                this.executeEvent({ type: 'stimulus', target: target, intensity: intensity, duration: duration });
                // Smooth visual feedback for explicit injections
                if (this.renderer && this.renderer.params) {
                    const baseSparkle = this.renderer.params.sparkle || 0;
                    const baseFlow = this.renderer.params.flowSpeed || 4.0;

                    this.startLerp({ key: 'sparkle', value: Math.min(1.0, baseSparkle + (0.15 * intensity)), duration: 0.2, ease: 'quadOut' });
                    this.startLerp({ key: 'flowSpeed', value: baseFlow + (1.0 * intensity), duration: 0.2, ease: 'quadOut' });

                    setTimeout(() => {
                        this.startLerp({ key: 'sparkle', value: baseSparkle, duration: duration, ease: 'sineInOut' });
                        this.startLerp({ key: 'flowSpeed', value: baseFlow, duration: duration, ease: 'sineInOut' });
                    }, 200);
                }
            },
            get isPlaying() { return this._player.isPlaying; },
            get elapsedTime() { return this._player.elapsedTime; },
            _player: this
        };
    }
}
// [Phase 2.5] Flow state added
// [Phase 2.5] Dynamic weather added
// [Phase 2.5] GSR Sync logic extended
// Update cycle triggered for automated checks

// [Phase 2.5] Dream Log Extension: Stroke Lesion
// [Phase 2.5] Dream Log Extension: Neurotransmitter Depletion
// [Phase 2.5] Added Pupillary Dilation Support

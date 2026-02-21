// routine-player.js
// orchestrates timed sequences of brain activity
// Refactored for Extensibility (V2.9)
import { Easing } from './math-utils.js';

const CAMERA_PRESETS = {
    'frontal': { rotation: { x: 0.1, y: 0 }, zoom: 3.0 },     // Face on
    'occipital': { rotation: { x: 0.2, y: Math.PI }, zoom: 3.0 }, // Back
    'temporal': { rotation: { x: 0, y: -Math.PI / 2 }, zoom: 3.5 }, // Right Side
    'parietal': { rotation: { x: 1.0, y: 0 }, zoom: 3.5 },    // Top-ish
    'deep': { rotation: { x: 0.3, y: 0.3 }, zoom: 2.5 },      // Close up angle
    'global': { rotation: { x: 0.3, y: 0 }, zoom: 3.5 }       // Standard view
};

export class RoutinePlayer {
    constructor(renderer, regionMap) {
        this.renderer = renderer;
        this.regions = regionMap || {}; // Maps names like 'frontal' to [x,y,z]
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

        // [Phase 2] Easing Support
        this.activeLerps = []; // { key, startVal, endVal, elapsed, duration }

        // [Phase 3] Extensible Event System
        this.handlers = new Map();
        this.setupDefaultHandlers();
    }

    setupDefaultHandlers() {
        // Stimulus Injection
        this.registerHandler('stimulus', (evt) => {
            let coords = [0,0,0];
            if (typeof evt.target === 'string' && this.regions[evt.target]) {
                coords = this.regions[evt.target];
            } else if (Array.isArray(evt.target)) {
                coords = evt.target;
            }
            this.renderer.injectStimulus(coords[0], coords[1], coords[2], evt.intensity || 1.0);
        });

        // Style Change
        this.registerHandler('style', (evt) => {
            this.renderer.setParams({ style: evt.value });
        });

        // Parameter Update
        this.registerHandler('param', (evt) => {
            this.renderer.setParams({ [evt.key]: evt.value });
        });

        // Lerp Transition
        this.registerHandler('lerp', (evt) => {
            this.startLerp(evt);
        });

        // Calm State
        this.registerHandler('calm', () => {
            this.renderer.calmState();
        });

        // Reset Activity
        this.registerHandler('reset', () => {
            this.renderer.resetActivity();
        });

        // Camera Control
        this.registerHandler('camera', (evt) => {
            this.handleCamera(evt);
        });

        // Text (No-op in engine, handled by UI listener)
        this.registerHandler('text', () => {});

        // Call (Sub-routine expansion happens at load time, runtime calls are warnings)
        this.registerHandler('call', (evt) => {
            console.warn("[Routine] Unexpanded 'call' event encountered at runtime:", evt);
        });
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

    get currentTime() {
        return this.elapsedTime;
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
        console.log(`[Routine] Playback Speed: ${this.playbackSpeed.toFixed(1)}x`);
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
        const expanded = this.expandRoutine(routineData);
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
        this.lastFrameTime = performance.now();
        this.cursor = 0;
        this.activeLerps = [];
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
        if (this.timerId) {
            cancelAnimationFrame(this.timerId);
            this.timerId = null;
        }
        this.cursor = 0;
        this.activeLerps = [];
        if (this.onEvent) this.onEvent({ type: 'stop' });
    }

    tick() {
        if (!this.isPlaying) return;

        // Safety check: if renderer is lost or stopped
        if (!this.renderer) {
             console.error("[Routine] Renderer lost, stopping playback.");
             this.stop();
             return;
        }
        // [Safety] Graceful degradation if WebGPU context is invalid or renderer stopped
        if (this.renderer.isRunning !== undefined && !this.renderer.isRunning) {
             // Only log if we expect it to be running (avoid log spam if intentionally stopped?)
             // Actually, if routine is playing but renderer is not, that's an issue.
             console.warn("[Routine] Renderer is not running. Stopping routine.");
             this.stop();
             return;
        }

        const now = performance.now();
        const dt = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;

        this.elapsedTime += dt * this.playbackSpeed;

        while (this.cursor < this.routine.length) {
            const event = this.routine[this.cursor];

            if (this.elapsedTime >= event.time) {
                this.executeEvent(event);
                this.cursor++;
            } else {
                break;
            }
        }

        this.processLerps(dt);

        if (this.cursor >= this.routine.length && this.activeLerps.length === 0) {
            if (this.loop) {
                console.log("[Routine] Looping...");
                this.elapsedTime = 0;
                this.cursor = 0;
                this.activeLerps = [];
            } else {
                console.log("[Routine] Finished");
                this.stop();
                return;
            }
        }

        this.timerId = requestAnimationFrame(() => this.tick());
    }

    processLerps(dt) {
        if (this.activeLerps.length === 0) return;

        this.activeLerps = this.activeLerps.filter(lerp => {
            lerp.elapsed += dt * this.playbackSpeed;
            const rawProgress = Math.min(1.0, lerp.elapsed / lerp.duration);

            const easeFunc = Easing[lerp.ease] || Easing.linear;
            const progress = easeFunc(rawProgress);

            const currentVal = lerp.startVal + (lerp.endVal - lerp.startVal) * progress;

            if (lerp.isCamera) {
                if (lerp.key === 'cameraRotX') {
                    this.renderer.setCameraParams({ rotation: { x: currentVal } });
                } else if (lerp.key === 'cameraRotY') {
                    this.renderer.setCameraParams({ rotation: { y: currentVal } });
                } else if (lerp.key === 'cameraZoom') {
                    this.renderer.setCameraParams({ zoom: currentVal });
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

    executeEvent(event) {
        const handler = this.handlers.get(event.type);
        if (handler) {
            try {
                handler(event);
            } catch (err) {
                console.error(`[Routine] Error executing handler for '${event.type}':`, err);
            }
        } else {
            // Optional: Warn about unhandled events?
            // console.warn(`[Routine] No handler for event type: ${event.type}`);
        }

        // Notify listener (UI sync)
        if (this.onEvent) {
            this.onEvent(event);
        }
    }

    startLerp(event) {
        if (!this.renderer.params) return;

        if (isNaN(event.value)) {
            console.warn(`[Routine] Invalid lerp value for ${event.key}: ${event.value}`);
            return;
        }

        const currentVal = this.renderer.params[event.key];
        if (currentVal === undefined) {
            console.warn(`[Routine] Cannot lerp unknown param: ${event.key}`);
            return;
        }

        this.activeLerps = this.activeLerps.filter(l => l.key !== event.key);

        this.activeLerps.push({
            key: event.key,
            startVal: currentVal,
            endVal: event.value,
            elapsed: 0,
            duration: event.duration || 1.0,
            ease: event.ease || 'linear'
        });

        console.log(`[Routine] Lerp started: ${event.key} -> ${event.value} (${event.duration || 1.0}s)`);
    }

    handleCamera(evt) {
        let params = {};

        if (typeof evt.target === 'string') {
            const preset = CAMERA_PRESETS[evt.target];
            if (preset) {
                params = { ...preset };
            } else {
                console.warn(`[Routine] Unknown camera target: ${evt.target}`);
            }
        } else if (evt.rotation) {
            params.rotation = evt.rotation;
        }

        if (evt.zoom !== undefined) {
            params.zoom = evt.zoom;
        }

        if (evt.duration && evt.duration > 0 && this.renderer.targetRotation) {
            console.log(`[Routine] Camera Transition started (${evt.duration}s)`);
            const duration = evt.duration;
            const ease = evt.ease || 'linear';

            this.activeLerps = this.activeLerps.filter(l => !l.isCamera);

            if (params.rotation && params.rotation.x !== undefined) {
                this.activeLerps.push({
                    key: 'cameraRotX',
                    startVal: this.renderer.targetRotation.x,
                    endVal: params.rotation.x,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });
            }

            if (params.rotation && params.rotation.y !== undefined) {
                this.activeLerps.push({
                    key: 'cameraRotY',
                    startVal: this.renderer.targetRotation.y,
                    endVal: params.rotation.y,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });
            }

            if (params.zoom !== undefined) {
                this.activeLerps.push({
                    key: 'cameraZoom',
                    startVal: this.renderer.targetZoom,
                    endVal: params.zoom,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });
            }
            return;
        }

        if (this.renderer.setCameraParams) {
            this.renderer.setCameraParams(params);
        }
    }
}

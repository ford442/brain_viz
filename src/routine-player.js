// routine-player.js
// orchestrates timed sequences of brain activity
// Refactored for Extensibility (V2.9)
import { Easing, evaluateSpline } from './math-utils.js';
import { CAMERA_PRESETS, handleCamera } from './routine-camera.js';
import { createDefaultHandlers } from './routine-handlers.js';

export class RoutinePlayer {
    constructor(renderer, regionMap, cameraMap) {
        this.renderer = renderer;
        this.regions = regionMap || {};
        this.cameraMap = cameraMap || {};

        this.routine = [];
        this.isPlaying = false;

        // Time State
        this.elapsedTime = 0;
        this.playbackSpeed = 1.0;
        this.lastFrameTime = 0;
        this.cursor = 0;
        this.loop = false;
        this.timerId = null;
        this.onEvent = null;
        this.lastPauseTime = 0;

        // Phase 2
        this.subRoutines = {};
        this.customPresets = {};
        this.activeLerps = [];
        this.waitingForSignal = null;
        this.audioContext = null;
        this.audioBuffers = {};

        // Phase 3: Dynamic Respiration
        this.state = {
            respirationRate: 1.0
        };
        this.respirationActive = true;
        this.respirationPhaseTime = 0.0;
        this.currentRespirationRate = 1.0;

        this.handlers = new Map();
        this.setupDefaultHandlers();

        this._deviceLost = false;

        if (this.renderer?.device?.lost) {
            this.renderer.device.lost.then((lostInfo) => {
                console.error("[Routine Player] WebGPU Context Lost. Halting playback.", lostInfo);
                this._deviceLost = true;
                this.stop();
            });
        }
    }

    // ... (keep all your existing methods: initAudio, setupDefaultHandlers, registerHandler, etc.)

    tick() {
        if (!this.isPlaying) return;

        if (this._deviceLost || !this.renderer?.device) {
            console.warn("[Routine Engine] WebGPU Context invalid. Stopping.");
            this.stop();
            return;
        }

        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;

        // ==================== PHASE 3: DYNAMIC RESPIRATION ====================
        if (this.respirationActive) {
            let targetRate = 1.0;

            // Read from AudioReactor if available
            if (this.audioReactor?.isActive) {
                const features = this.audioReactor.getFeatures();
                targetRate = 1.0 + (features.energy * 2.5);
            }

            // Allow temporary stimulus boosts
            if (this.state.respirationRate > 1.0) {
                targetRate = Math.max(targetRate, this.state.respirationRate);
            }

            // Smooth rate changes
            this.currentRespirationRate += (targetRate - this.currentRespirationRate) * 0.08;

            const baseCycleDuration = 4.0;
            const cycleDuration = baseCycleDuration / this.currentRespirationRate;

            this.respirationPhaseTime += deltaTime;
            if (this.respirationPhaseTime >= cycleDuration) {
                this.respirationPhaseTime = this.respirationPhaseTime % cycleDuration;
            }

            const phase = this.respirationPhaseTime / cycleDuration;

            // Create breathing pulse (inhale/exhale)
            let breathPulse = 0;
            if (phase < 0.4) {
                const t = phase / 0.4;
                breathPulse = Math.sin(t * Math.PI / 2);           // Inhale
            } else {
                const t = (phase - 0.4) / 0.6;
                breathPulse = 1.0 - Math.pow(1 - t, 2);           // Smooth exhale
            }

            // Apply breathing to visuals
            if (this.renderer?.params) {
                this.renderer.params.flowSpeed = 2.0 + (breathPulse * 5.0);
                this.renderer.params.amplitude = 0.2 + (breathPulse * 1.2);
                this.renderer.params.ambientLight = 0.2 + (breathPulse * 0.4);
            }
        }

        // Gentle decay for stimulus-driven respirationRate boost
        if (this.state.respirationRate > 1.0) {
            this.state.respirationRate -= deltaTime * 0.6;
            if (this.state.respirationRate < 1.0) this.state.respirationRate = 1.0;
        }

        // Advance timeline
        if (!this.waitingForSignal) {
            this.elapsedTime += deltaTime * this.playbackSpeed;

            while (this.cursor < this.routine.length) {
                const activeRoutineContext = this.routine;
                const nextEvent = this.routine[this.cursor];

                if (this.elapsedTime >= nextEvent.time) {
                    this.executeEvent(nextEvent);

                    if (this.routine !== activeRoutineContext) break; // Routine was replaced

                    this.cursor++;
                    if (this.waitingForSignal) break;
                } else {
                    break;
                }
            }
        }

        this.processLerps(deltaTime);

        // Loop or stop
        if (this.cursor >= this.routine.length && this.activeLerps.length === 0) {
            if (this.loop) {
                this.elapsedTime = 0;
                this.cursor = 0;
                this.activeLerps = [];
            } else {
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
            console.warn(`[Routine Engine] Unrecognized Event Type: '${resolvedEvt.type}'. Extensible registry lacks this handler.`);
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

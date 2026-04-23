// routine-player.js
// orchestrates timed sequences of brain activity
// Refactored for Extensibility (V2.9)
import { Easing, evaluateSpline } from './math-utils.js';

const CAMERA_PRESETS = {
    'frontal': { rotation: { x: 0.1, y: 0 }, zoom: 3.0 },     // Face on
    'occipital': { rotation: { x: 0.2, y: Math.PI }, zoom: 3.0 }, // Back
    'temporal': { rotation: { x: 0, y: -Math.PI / 2 }, zoom: 3.5 }, // Right Side
    'parietal': { rotation: { x: 1.0, y: 0 }, zoom: 3.5 },    // Top-ish
    'deep': { rotation: { x: 0.3, y: 0.3 }, zoom: 2.5 },      // Close up angle
    'global': { rotation: { x: 0.3, y: 0 }, zoom: 3.5 },      // Standard view
    // [Phase 2] Expanded Presets
    'top': { rotation: { x: 1.57, y: 0 }, zoom: 3.5 },        // Direct Top-down
    'bottom': { rotation: { x: -1.57, y: 0 }, zoom: 3.5 },    // Bottom-up
    'iso': { rotation: { x: 0.5, y: 0.5 }, zoom: 3.0 }        // Isometric-like
};

export class RoutinePlayer {
    constructor(renderer, regionMap, cameraMap) {
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
        this.state = {}; // [Phase 2] Internal State for Branching

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

        // [Safety Requirement] Graceful degradation if WebGPU context is lost or invalid
        if (this.renderer && this.renderer.device && this.renderer.device.lost) {
             this.renderer.device.lost.then((lostInfo) => {
                 console.error("[Routine Player] WebGPU Context is Lost. Halting routine playback safely.", lostInfo);
                 this._deviceLost = true;
                 this.stop();
             });
        }
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

        // Style Change (instant snap)
        this.registerHandler('style', (evt) => {
            this.renderer.setParams({ style: evt.value });
        });

        // Mode Transition (animated cross-fade via style lerp)
        this.registerHandler('mode-transition', (evt) => {
            this.startLerp({
                key: 'style',
                value: evt.toMode,
                duration: evt.duration !== undefined ? evt.duration : 1.5,
                ease: evt.ease || 'sineInOut'
            });
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

        // [Phase 2] Cognitive Stress Distortion
        this.registerHandler('stress', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            if (evt.duration) {
                this.startLerp({
                    key: 'stress',
                    value: intensity,
                    duration: evt.duration,
                    ease: evt.ease || 'linear'
                });
            } else {
                this.renderer.setParams({ stress: intensity });
            }
        });

        // [Phase 6] Procedural Volumetric Fluid Dynamics
        this.registerHandler('fluid', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            if (evt.duration) {
                this.startLerp({
                    key: 'fluidActive',
                    value: intensity,
                    duration: evt.duration,
                    ease: evt.ease || 'linear'
                });
            } else {
                this.renderer.setParams({ fluidActive: intensity });
            }
        });

        // [Phase 5] Cortisol Structural Decay
        this.registerHandler('cortisol', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            if (evt.duration) {
                this.startLerp({
                    key: 'cortisol',
                    value: intensity,
                    duration: evt.duration,
                    ease: evt.ease || 'linear'
                });
            } else {
                this.renderer.setParams({ cortisol: intensity });
            }
        });

        // [Phase 2] Camera Shake
        this.registerHandler('shake', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 0.05;
            this.renderer.setParams({ shake: intensity });

            if (evt.duration) {
                // Auto-fade out
                this.startLerp({
                    key: 'shake',
                    value: 0.0,
                    duration: evt.duration,
                    ease: evt.ease || 'quadOut'
                });
            }
        });

        // [Phase 2] Dynamic Lighting Control
        this.registerHandler('light', (evt) => {
            if (evt.ambient !== undefined) {
                if (evt.duration) this.startLerp({ key: 'ambientLight', value: evt.ambient, duration: evt.duration, ease: evt.ease });
                else this.renderer.setParams({ ambientLight: evt.ambient });
            }
            if (evt.dirIntensity !== undefined) {
                if (evt.duration) this.startLerp({ key: 'dirIntensity', value: evt.dirIntensity, duration: evt.duration, ease: evt.ease });
                else this.renderer.setParams({ dirIntensity: evt.dirIntensity });
            }
            if (evt.dirX !== undefined) {
                if (evt.duration) this.startLerp({ key: 'lightDirX', value: evt.dirX, duration: evt.duration, ease: evt.ease });
                else this.renderer.setParams({ lightDirX: evt.dirX });
            }
            if (evt.dirY !== undefined) {
                if (evt.duration) this.startLerp({ key: 'lightDirY', value: evt.dirY, duration: evt.duration, ease: evt.ease });
                else this.renderer.setParams({ lightDirY: evt.dirY });
            }
            if (evt.dirZ !== undefined) {
                if (evt.duration) this.startLerp({ key: 'lightDirZ', value: evt.dirZ, duration: evt.duration, ease: evt.ease });
                else this.renderer.setParams({ lightDirZ: evt.dirZ });
            }
        });

        // [Phase 2] Dopamine Burst Routine
        this.registerHandler('dopamine', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 1.0;

            // Instantly boost flowSpeed and amplitude
            this.renderer.setParams({
                flowSpeed: 20.0 * intensity,
                amplitude: 1.5 * intensity
            });

            // Fade back
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
            }
        });

        // [Phase 2] Endorphin Rush
        this.registerHandler('endorphin', (evt) => {
            const duration = evt.duration || 3.0;

            // Instantly suppress stress and shake
            this.renderer.setParams({
                stress: 0.0,
                shake: 0.0,
                colorShift: 0.2 // Slight soothing shift
            });

            // Smoothly restore or keep low over duration
            if (duration > 0) {
                const ease = evt.ease || 'quadInOut';
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            }
        });


        // [Phase 5] Glial Cell Cleanup
        this.registerHandler('glial_cleanup', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 4.0;

            // Instantly apply cool/blue color shift and slight sparkle to simulate active cleanup
            this.renderer.setParams({
                colorShift: -0.6 * intensity, // Shift towards cool/blue
                sparkle: 0.5 * intensity
            });

            // Gradually reduce swelling (growth) and agitations
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'growth', value: 1.0, duration: duration, ease: ease });
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'sparkle', value: 0.0, duration: duration, ease: ease });
            }
        });

        // [Phase 5] GABA Deceleration
        this.registerHandler('gaba', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 3.0;

            // Smoothly decrease flow speed and global playback speed to simulate deceleration
            this.startLerp({ key: 'flowSpeed', value: 0.5 * (2.0 - intensity), duration: duration, ease: 'quadOut' });
            this.startLerp({ key: 'playbackSpeed', value: 0.5 * (2.0 - intensity), duration: duration, ease: 'quadOut' });
            // Calm colors
            this.startLerp({ key: 'colorShift', value: -0.2 * intensity, duration: duration, ease: 'quadOut' });
        });

        // [Phase 5] Melatonin Sleep Onset
        this.registerHandler('melatonin', (evt) => {
            const duration = evt.duration || 5.0;
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;

            // Smoothly decrease temporal activity and energy
            this.startLerp({ key: 'flowSpeed', value: 1.0, duration: duration, ease: 'sineOut' });
            this.startLerp({ key: 'amplitude', value: 0.1, duration: duration, ease: 'sineOut' });

            // Simulate blurring effect
            this.startLerp({ key: 'aperture', value: 0.8 * intensity, duration: duration, ease: 'sineOut' });
            this.startLerp({ key: 'focus', value: 0.5, duration: duration, ease: 'sineOut' });

            // Slow desaturation
            this.startLerp({ key: 'colorShift', value: -0.5 * intensity, duration: duration, ease: 'sineOut' });
        });

        // [Phase 2] Histamine Inflammatory Response
        this.registerHandler('histamine', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 3.0;

            if (evt.target) {
                this.executeEvent({ type: 'stimulus', target: evt.target, intensity: intensity * 2.0 });
            }

            // Inflammatory response: warm/red color shift, slight swelling (growth), and agitation (flowSpeed)
            this.renderer.setParams({
                colorShift: 0.8 * intensity, // Shift towards red
                growth: 1.2 * intensity, // Slight swelling
                flowSpeed: 8.0 * intensity // Agitation
            });

            // Fade back
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'growth', value: 1.0, duration: duration, ease: ease });
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            }
        });

        // [Phase 5] Acetylcholine Memory Consolidation
        this.registerHandler('acetylcholine', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 3.0;

            // Instantly boost sparkle and slightly increase flowSpeed
            this.renderer.setParams({
                sparkle: 1.0 * intensity,
                flowSpeed: 8.0 * intensity,
                colorShift: 0.5 * intensity
            });

            // Slowly fade back to normal
            if (duration > 0) {
                const ease = evt.ease || 'sineInOut';
                this.startLerp({ key: 'sparkle', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            }
        });

        // [Phase 5] Noradrenaline Spike
        this.registerHandler('noradrenaline', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 2.0;

            // Instantly boost flowSpeed, amplitude, and frequency for global alertness
            this.renderer.setParams({
                flowSpeed: 25.0 * intensity,
                amplitude: 1.5 * intensity,
                frequency: 15.0 * intensity
            });

            // Fade back
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
                this.startLerp({ key: 'frequency', value: 2.0, duration: duration, ease: ease });
            }
        });

        // [Phase 2] Adrenaline Surge
        this.registerHandler('adrenaline', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 1.0;

            // Instantly boost light intensity, flow speed, and shift color
            this.renderer.setParams({
                dirIntensity: 3.0 * intensity,
                ambientLight: 0.8 * intensity,
                flowSpeed: 25.0 * intensity,
                colorShift: 1.0 // Shift to warm/bright colors
            });

            // Fade back
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'dirIntensity', value: 0.8, duration: duration, ease: ease });
                this.startLerp({ key: 'ambientLight', value: 0.2, duration: duration, ease: ease });
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            }
        });

        // [Phase 2] Neuronal Glitch (Data Corruption Simulation)
        this.registerHandler('glitch', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 0.5;

            // Instantly apply high cinematic & shake values, plus switch to Cyber style
            this.renderer.setParams({
                style: 1, // Cyber / Wireframe
                aberration: intensity * 2.0,
                grain: intensity * 1.5,
                shake: intensity * 0.2
            });

            // Auto-fade out all effects back to calm/normal levels
            if (duration > 0) {
                const ease = evt.ease || 'quadOut';
                this.startLerp({ key: 'aberration', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'grain', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'shake', value: 0.0, duration: duration, ease: ease });
            }
        });

        // [Phase 7] Cinematic Effects (Aberration, Grain, Focus, Aperture)
        this.registerHandler('cinematic', (evt) => {
            if (evt.aberration !== undefined) {
                if (evt.duration) {
                    this.startLerp({ key: 'aberration', value: evt.aberration, duration: evt.duration, ease: evt.ease });
                } else {
                    this.renderer.setParams({ aberration: evt.aberration });
                }
            }
            if (evt.grain !== undefined) {
                 if (evt.duration) {
                    this.startLerp({ key: 'grain', value: evt.grain, duration: evt.duration, ease: evt.ease });
                } else {
                    this.renderer.setParams({ grain: evt.grain });
                }
            }
            if (evt.focus !== undefined) {
                 if (evt.duration) {
                    this.startLerp({ key: 'focus', value: evt.focus, duration: evt.duration, ease: evt.ease });
                } else {
                    this.renderer.setParams({ focus: evt.focus });
                }
            }
            if (evt.aperture !== undefined) {
                 if (evt.duration) {
                    this.startLerp({ key: 'aperture', value: evt.aperture, duration: evt.duration, ease: evt.ease });
                } else {
                    this.renderer.setParams({ aperture: evt.aperture });
                }
            }
        });

        // Modulate Playback Speed (Dynamic Time Dilation Advanced)
        this.registerHandler('modulate_speed', (evt) => {
            this.modulatePlaybackSpeed(evt.targetSpeed, evt.duration, evt.ease);
        });

        // Neuronal Glitch (Data Corruption Simulation)
        this.registerHandler('glitch', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;

            // Randomly jump parameters
            if (Math.random() > 0.5) this.renderer.setParams({ aberration: Math.random() * intensity });
            if (Math.random() > 0.5) this.renderer.setParams({ grain: Math.random() * intensity });
            if (Math.random() > 0.8) this.renderer.setParams({ shake: Math.random() * 0.1 * intensity });
            if (Math.random() > 0.7) this.renderer.setParams({ style: Math.floor(Math.random() * 4) });

            // Restore after short random duration if autoRestore is true
            if (evt.autoRestore) {
                setTimeout(() => {
                    this.renderer.setParams({ aberration: 0.0, grain: 0.0, shake: 0.0, style: 0.0 });
                }, 100 + Math.random() * 300);
            }
        });

        // Camera Control
        this.registerHandler('camera', (evt) => {
            this.handleCamera(evt);
        });

        // [Phase 2] Haptic Feedback API
        this.registerHandler('haptic', (evt) => {
            if (navigator.vibrate && evt.duration) {
                navigator.vibrate(evt.duration);
            }
        });

        // [Phase 2] Neuro-Sonification (Binaural Beats)
        this.registerHandler('binaural', async (evt) => {
            this.initAudio();
            if (!this.audioContext) return;

            const baseFreq = evt.baseFrequency || 440;
            const beatFreq = evt.beatFrequency || 40;
            const duration = evt.duration || 5.0;
            const vol = evt.volume !== undefined ? evt.volume : 0.5;

            const gainNode = this.audioContext.createGain();
            const oscL = this.audioContext.createOscillator();
            const oscR = this.audioContext.createOscillator();
            const panL = this.audioContext.createStereoPanner();
            const panR = this.audioContext.createStereoPanner();

            oscL.type = evt.oscType || 'sine';
            oscR.type = evt.oscType || 'sine';

            oscL.frequency.setValueAtTime(baseFreq - (beatFreq / 2), this.audioContext.currentTime);
            oscR.frequency.setValueAtTime(baseFreq + (beatFreq / 2), this.audioContext.currentTime);

            panL.pan.value = -1;
            panR.pan.value = 1;

            oscL.connect(panL);
            oscR.connect(panR);
            panL.connect(gainNode);
            panR.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime + duration - 0.1);
            gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

            oscL.start(this.audioContext.currentTime);
            oscR.start(this.audioContext.currentTime);
            oscL.stop(this.audioContext.currentTime + duration);
            oscR.stop(this.audioContext.currentTime + duration);
        });

        // [Phase 2] Neuro-Sonification (Audio Events)
        this.registerHandler('sound', async (evt) => {
            this.initAudio();
            if (!this.audioContext) return;

            const vol = evt.volume !== undefined ? evt.volume : 0.5;
            const gainNode = this.audioContext.createGain();

            if (evt.url) {
                // Play external audio file
                let buffer = this.audioBuffers[evt.url];
                if (!buffer) {
                    try {
                        const response = await fetch(evt.url);
                        const arrayBuffer = await response.arrayBuffer();
                        buffer = await this.audioContext.decodeAudioData(arrayBuffer);
                        this.audioBuffers[evt.url] = buffer;
                    } catch (e) {
                        console.error(`[Routine] Failed to load audio file: ${evt.url}`, e);
                        return;
                    }
                }

                const source = this.audioContext.createBufferSource();
                source.buffer = buffer;

                // Playback rate adjustment based on global playback speed
                source.playbackRate.value = this.playbackSpeed;

                // Simple envelope if duration is provided, else play full buffer
                gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime);
                if (evt.duration) {
                     gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime + evt.duration - 0.05);
                     gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + evt.duration);
                }

                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                source.start(this.audioContext.currentTime);
                if (evt.duration) {
                     source.stop(this.audioContext.currentTime + evt.duration);
                }
            } else {
                // Play synthesized tone
                const freq = evt.frequency || 440;
                const type = evt.oscType || 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
                const duration = evt.duration || 0.5;

                const osc = this.audioContext.createOscillator();

                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.audioContext.currentTime);

                // Envelope to avoid clicking
                gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(vol, this.audioContext.currentTime + 0.05);
                gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime + duration - 0.05);
                gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

                osc.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                osc.start(this.audioContext.currentTime);
                osc.stop(this.audioContext.currentTime + duration);
            }
        });

        // [Phase 2] Memory Fragment Flashbacks
        this.registerHandler('flashback', (evt) => {
            const intensity = evt.intensity || 1.0;
            const message = evt.message || 'MEMORY FLASHBACK';

            this.executeEvent({ type: 'text', message: message, duration: 0.5 });
            this.executeEvent({ type: 'style', value: 1 }); // Cyber / Wireframe
            this.executeEvent({ type: 'cinematic', aberration: intensity * 2.0, grain: intensity * 1.5 });
            this.executeEvent({ type: 'shake', intensity: intensity * 0.2 });

            // Rapid stimuli
            const regions = Object.keys(this.regions);
            if (regions.length > 0) {
                const target = regions[Math.floor(Math.random() * regions.length)];
                this.executeEvent({ type: 'stimulus', target: target, intensity: intensity * 3.0 });
            }

            // Restore after short duration
            setTimeout(() => {
                this.executeEvent({ type: 'style', value: 0 }); // Restore default style
                this.executeEvent({ type: 'cinematic', aberration: 0.0, grain: 0.0 });
                this.executeEvent({ type: 'shake', intensity: 0.0 });
            }, 500);
        });

        // [Phase 2] Default Mode Network (DMN)
        this.registerHandler('dmn', (evt) => {
            const intensity = evt.intensity || 1.0;
            const duration = evt.duration || 5.0;

            // Instantly apply color shift and start low frequency hum, smooth flow
            this.renderer.setParams({
                colorShift: -0.2 * intensity
            });

            this.startLerp({ key: 'frequency', value: 0.5 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });
            this.startLerp({ key: 'amplitude', value: 0.2 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });
            this.startLerp({ key: 'flowSpeed', value: 0.3 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });

            if (this.routine) {
                const revertTime = this.elapsedTime + duration;

                const revertEvents = [
                    { time: revertTime, type: 'lerp', key: 'frequency', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                    { time: revertTime, type: 'lerp', key: 'amplitude', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                    { time: revertTime, type: 'lerp', key: 'flowSpeed', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                    { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: duration * 0.5, ease: 'easeInOutSine' }
                ];

                // Insert events keeping chronological order
                let insertIdx = this.currentEventIndex;
                while (insertIdx < this.routine.length && this.routine[insertIdx].time < revertTime) {
                    insertIdx++;
                }

                this.routine.splice(insertIdx, 0, ...revertEvents);
            }
        });

        // [Phase 2] Oxytocin Burst
        this.registerHandler('oxytocin', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 2.0;

            // Trigger stimulus on both hemispheres symmetrically
            this.executeEvent({ type: 'stimulus', target: [-0.8, 0.0, 0.0], intensity: intensity * 2.0 });
            this.executeEvent({ type: 'stimulus', target: [0.8, 0.0, 0.0], intensity: intensity * 2.0 });

            // Instantly apply warm color shift and slow, flowing speed
            this.renderer.setParams({
                flowSpeed: 2.0 * intensity,
                colorShift: 0.3 * intensity, // Warm/golden tone
                amplitude: 0.8 * intensity
            });

            // Slowly fade back to normal
            if (duration > 0) {
                const ease = evt.ease || 'sineInOut';
                this.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
                this.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
                this.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
            }
        });

        // [Phase 2] Dynamic Time Dilation
        this.registerHandler('speed', (evt) => {
            if (evt.duration) {
                this.startLerp({
                    key: 'playbackSpeed',
                    value: evt.value,
                    duration: evt.duration,
                    ease: evt.ease || 'linear'
                });
            } else {
                this.setPlaybackSpeed(evt.value);
                if (this.onEvent) {
                    this.onEvent({ type: 'speed', value: evt.value });
                }
            }
        });

        // Text (No-op in engine, handled by UI listener)
        this.registerHandler('text', () => {});

        // [Phase 2] CSS Filters (Handled by UI)
        this.registerHandler('cssFilter', () => {}); // Emits event, handled by UI

        // [Phase 2] Interactive Visual Overlays
        this.registerHandler('overlay', () => {}); // Emits event, handled by UI

        // [Phase 2] Interactive Neuro-Storytelling (Choices)
        this.registerHandler('choice', (evt) => {
            // Emits event, handled by UI. UI will render buttons and handle logic.
            // We just pause here to wait for user input.
            if (evt.choices && evt.choices.length > 0) {
                this.pause();
                console.log("[Routine] Execution paused, waiting for user choice.");
            } else {
                console.warn("[Routine] Choice event lacks 'choices' array.");
            }
        });

        // Call (Sub-routine expansion happens at load time, runtime calls are warnings)
        this.registerHandler('call', (evt) => {
            console.warn("[Routine] Unexpanded 'call' event encountered at runtime:", evt);
        });

        // [Phase 2] Branching/Conditional Routines
        this.registerHandler('branch', (evt) => {
            let result = false;
            if (typeof evt.condition === 'function') {
                result = evt.condition();
            } else if (typeof evt.condition === 'string' && evt.condition.startsWith('state.')) {
                const key = evt.condition.substring(6);
                result = !!this.state[key];
            } else {
                result = !!evt.condition;
            }

            const target = result ? evt.trueBranch : evt.falseBranch;
            if (target) {
                if (this.subRoutines[target]) {
                    console.log(`[Routine] Branch evaluated to ${result}. Jumping to: ${target}`);
                    this.playNow(this.subRoutines[target]);
                } else {
                    console.warn(`[Routine] Branch target '${target}' not found in subRoutines.`);
                }
            }
        });

        this.registerHandler('state', (evt) => {
            if (evt.key !== undefined && evt.value !== undefined) {
                this.state[evt.key] = evt.value;
                console.log(`[Routine] State updated: ${evt.key} = ${evt.value}`);
            }
        });

        // [Phase 2] Event Synchronization (Wait/Signal)
        this.registerHandler('wait', (evt) => {
            if (evt.signal) {
                this.waitingForSignal = evt.signal;
                console.log(`[Routine] Paused execution, waiting for signal: '${evt.signal}'`);
            } else {
                console.warn("[Routine] Wait event requires a 'signal' property.");
            }
        });

        this.registerHandler('signal', (evt) => {
            if (evt.signal) {
                this.triggerSignal(evt.signal);
            }
        });

        // [Phase 2] Routine Variables/Math
        this.registerHandler('math', (evt) => {
            if (evt.target === undefined || evt.var1 === undefined) {
                console.warn("[Routine] Math event requires target and var1");
                return;
            }

            let val1 = evt.var1;
            if (typeof evt.var1 === 'string' && evt.var1.startsWith('state.')) {
                val1 = this.state[evt.var1.substring(6)] || 0;
            }

            let val2 = evt.var2 !== undefined ? evt.var2 : 0;
            if (typeof evt.var2 === 'string' && evt.var2.startsWith('state.')) {
                val2 = this.state[evt.var2.substring(6)] || 0;
            }

            let result = 0;
            switch (evt.operator) {
                case 'add': result = val1 + val2; break;
                case 'sub': result = val1 - val2; break;
                case 'mul': result = val1 * val2; break;
                case 'div': result = val2 !== 0 ? val1 / val2 : 0; break;
                case 'mod': result = val2 !== 0 ? val1 % val2 : 0; break;
                default:
                    console.warn(`[Routine] Unknown math operator: ${evt.operator}`);
                    result = val1;
            }

            if (typeof evt.target === 'string' && evt.target.startsWith('state.')) {
                const stateKey = evt.target.substring(6);
                this.state[stateKey] = result;
                console.log(`[Routine] Math executed: ${evt.var1} ${evt.operator} ${evt.var2} = ${result}. Stored in state.${stateKey}`);
            } else {
                 console.warn("[Routine] Math target must be a state variable (e.g., 'state.myVar')");
            }
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
        const isDeviceLost = this._deviceLost;
        const rendererMissing = !this.renderer || !this.renderer.device;

        if (rendererMissing || isDeviceLost) {
             console.warn("[Routine Engine] WebGPU Context is invalid or lost. Stopping playback gracefully.");
             this.stop();
             return;
        }

        // Additional explicit check for the lost promise to prevent crashing if it gets lost mid-tick
        if (this.renderer && this.renderer.device && this.renderer.device.lost) {
             this.renderer.device.lost.then(() => {
                 this._deviceLost = true;
                 this.stop();
             });
        }

        if (typeof this.renderer.isRunning !== 'undefined' && !this.renderer.isRunning) {
             console.warn("[Routine Engine] WebGPU Renderer is not running. Pausing tick loop safely.");
             this.stop();
             return;
        }

        // Calculate precise delta time using performance.now() to prevent drift
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;

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

    handleCamera(evt) {
        let params = {};

        const getPresetParams = (target) => {
            if (typeof target === 'string') {
                const preset = CAMERA_PRESETS[target] || this.cameraMap[target] || this.customPresets[target];
                if (preset) {
                    return { ...preset };
                } else {
                    console.warn(`[Routine] Unknown camera target: ${target}`);
                    return null;
                }
            } else if (target && target.rotation) {
                return target;
            }
            return null;
        };

        if (evt.path && Array.isArray(evt.path) && evt.duration && evt.duration > 0 && this.renderer.targetRotation) {
            console.log(`[Routine] Spline Camera Transition started (${evt.duration}s)`);
            const duration = evt.duration;
            const ease = evt.ease || 'linear';

            this.activeLerps = this.activeLerps.filter(l => !l.isCamera);

            let pathX = [this.renderer.targetRotation.x];
            let pathY = [this.renderer.targetRotation.y];
            let pathZoom = [this.renderer.targetZoom];

            let hasValidPath = false;

            for (const step of evt.path) {
                const stepParams = getPresetParams(step);
                if (stepParams) {
                    hasValidPath = true;
                    if (stepParams.rotation && stepParams.rotation.x !== undefined) {
                        pathX.push(stepParams.rotation.x);
                    } else {
                        pathX.push(pathX[pathX.length - 1]);
                    }

                    if (stepParams.rotation && stepParams.rotation.y !== undefined) {
                        pathY.push(stepParams.rotation.y);
                    } else {
                        pathY.push(pathY[pathY.length - 1]);
                    }

                    if (stepParams.zoom !== undefined) {
                        pathZoom.push(stepParams.zoom);
                    } else {
                        pathZoom.push(pathZoom[pathZoom.length - 1]);
                    }
                }
            }

            if (hasValidPath) {
                this.activeLerps.push({
                    key: 'cameraRotX',
                    startVal: this.renderer.targetRotation.x,
                    path: pathX,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                this.activeLerps.push({
                    key: 'cameraRotY',
                    startVal: this.renderer.targetRotation.y,
                    path: pathY,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                this.activeLerps.push({
                    key: 'cameraZoom',
                    startVal: this.renderer.targetZoom,
                    path: pathZoom,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });
            }
            return;
        }

        params = getPresetParams(evt.target) || {};
        if (evt.rotation) {
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

            if (evt.path && Array.isArray(evt.path)) {
                // Spline path support
                const pathRotX = [this.renderer.targetRotation.x];
                const pathRotY = [this.renderer.targetRotation.y];
                const pathZoom = [this.renderer.targetZoom];

                let prevX = this.renderer.targetRotation.x;
                let prevY = this.renderer.targetRotation.y;
                let prevZoom = this.renderer.targetZoom;

                for (const point of evt.path) {
                    let pointParams = {};
                    if (typeof point === 'string') {
                        const preset = CAMERA_PRESETS[point] || this.cameraMap[point] || this.customPresets[point];
                        if (preset) pointParams = { ...preset };
                        else console.warn(`[Routine] Unknown camera target in path: ${point}`);
                    } else {
                        pointParams = { ...point };
                    }

                    const px = (pointParams.rotation && pointParams.rotation.x !== undefined) ? pointParams.rotation.x : prevX;
                    const py = (pointParams.rotation && pointParams.rotation.y !== undefined) ? pointParams.rotation.y : prevY;
                    const pz = pointParams.zoom !== undefined ? pointParams.zoom : prevZoom;

                    pathRotX.push(px);
                    pathRotY.push(py);
                    pathZoom.push(pz);

                    prevX = px;
                    prevY = py;
                    prevZoom = pz;
                }

                this.activeLerps.push({
                    key: 'cameraRotX',
                    startVal: this.renderer.targetRotation.x,
                    path: pathRotX,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                this.activeLerps.push({
                    key: 'cameraRotY',
                    startVal: this.renderer.targetRotation.y,
                    path: pathRotY,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

                this.activeLerps.push({
                    key: 'cameraZoom',
                    startVal: this.renderer.targetZoom,
                    path: pathZoom,
                    elapsed: 0,
                    duration: duration,
                    isCamera: true,
                    ease: ease
                });

            } else {
                // Standard linear/eased lerp or Pathfinding arc
                const currentRotX = this.renderer.targetRotation.x;
                const currentRotY = this.renderer.targetRotation.y;
                const currentZoom = this.renderer.targetZoom;

                const targetRotX = (params.rotation && params.rotation.x !== undefined) ? params.rotation.x : currentRotX;
                const targetRotY = (params.rotation && params.rotation.y !== undefined) ? params.rotation.y : currentRotY;
                const targetZoom = params.zoom !== undefined ? params.zoom : currentZoom;

                const deltaY = Math.abs(targetRotY - currentRotY);
                const deltaX = Math.abs(targetRotX - currentRotX);

                if (evt.avoidCollision && (deltaY > 2.0 || deltaX > 2.0)) {
                    // Pathfinding: Create a spline path that arcs outward to avoid clipping through the center
                    console.log(`[Routine] Pathfinding Camera Transition started (${duration}s) to avoid collision.`);
                    const midRotX = (currentRotX + targetRotX) / 2.0;
                    // Slightly offset the midpoint Y rotation to create a nice curve
                    let midRotY = (currentRotY + targetRotY) / 2.0;
                    if (Math.abs(currentRotY - targetRotY) > Math.PI) {
                        midRotY += Math.PI; // Go the other way around if it's shorter
                    }

                    // Push the zoom out at the midpoint
                    const maxZoom = Math.max(currentZoom, targetZoom);
                    const midZoom = maxZoom + 3.0; // Bump out by 3.0 units

                    this.activeLerps.push({
                        key: 'cameraRotX',
                        startVal: currentRotX,
                        path: [currentRotX, midRotX, targetRotX],
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });

                    this.activeLerps.push({
                        key: 'cameraRotY',
                        startVal: currentRotY,
                        path: [currentRotY, midRotY, targetRotY],
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });

                    this.activeLerps.push({
                        key: 'cameraZoom',
                        startVal: currentZoom,
                        path: [currentZoom, midZoom, targetZoom],
                        elapsed: 0,
                        duration: duration,
                        isCamera: true,
                        ease: ease
                    });
                } else {
                    if (params.rotation && params.rotation.x !== undefined) {
                        this.activeLerps.push({
                            key: 'cameraRotX',
                            startVal: currentRotX,
                            endVal: targetRotX,
                            elapsed: 0,
                            duration: duration,
                            isCamera: true,
                            ease: ease
                        });
                    }

                    if (params.rotation && params.rotation.y !== undefined) {
                        this.activeLerps.push({
                            key: 'cameraRotY',
                            startVal: currentRotY,
                            endVal: targetRotY,
                            elapsed: 0,
                            duration: duration,
                            isCamera: true,
                            ease: ease
                        });
                    }

                    if (params.zoom !== undefined) {
                        this.activeLerps.push({
                            key: 'cameraZoom',
                            startVal: currentZoom,
                            endVal: targetZoom,
                            elapsed: 0,
                            duration: duration,
                            isCamera: true,
                            ease: ease
                        });
                    }
                }
            }
            return;
        }

        if (this.renderer.setCameraParams && Object.keys(params).length > 0) {
            this.renderer.setCameraParams(params);
        }
    }
}
// End of routine player

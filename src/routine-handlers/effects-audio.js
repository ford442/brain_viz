import { handleCamera } from '../routine-camera.js';

export function registerEffectsAudioHandlers(handlers, player) {
    handlers.set('cinematic', (evt) => {
        if (evt.aberration !== undefined) {
            if (evt.duration) {
                player.startLerp({ key: 'aberration', value: evt.aberration, duration: evt.duration, ease: evt.ease });
            } else {
                player.renderer.setParams({ aberration: evt.aberration });
            }
        }
        if (evt.grain !== undefined) {
             if (evt.duration) {
                player.startLerp({ key: 'grain', value: evt.grain, duration: evt.duration, ease: evt.ease });
            } else {
                player.renderer.setParams({ grain: evt.grain });
            }
        }
        if (evt.focus !== undefined) {
             if (evt.duration) {
                player.startLerp({ key: 'focus', value: evt.focus, duration: evt.duration, ease: evt.ease });
            } else {
                player.renderer.setParams({ focus: evt.focus });
            }
        }
        if (evt.aperture !== undefined) {
             if (evt.duration) {
                player.startLerp({ key: 'aperture', value: evt.aperture, duration: evt.duration, ease: evt.ease });
            } else {
                player.renderer.setParams({ aperture: evt.aperture });
            }
        }
    });

    // Modulate Playback Speed (Dynamic Time Dilation Advanced)
    handlers.set('modulate_speed', (evt) => {
        player.modulatePlaybackSpeed(evt.targetSpeed, evt.duration, evt.ease);
    });

    // Neuronal Glitch (Data Corruption Simulation)
    handlers.set('glitch', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;

        // Randomly jump parameters
        if (Math.random() > 0.5) player.renderer.setParams({ aberration: Math.random() * intensity });
        if (Math.random() > 0.5) player.renderer.setParams({ grain: Math.random() * intensity });
        if (Math.random() > 0.8) player.renderer.setParams({ shake: Math.random() * 0.1 * intensity });
        if (Math.random() > 0.7) player.renderer.setParams({ style: Math.floor(Math.random() * 4) });

        // Restore after short random duration if autoRestore is true
        if (evt.autoRestore) {
            setTimeout(() => {
                player.renderer.setParams({ aberration: 0.0, grain: 0.0, shake: 0.0, style: 0.0 });
            }, 100 + Math.random() * 300);
        }
    });

    // Camera Control
    handlers.set('camera', (evt) => {
        handleCamera(player, evt);
    });

    // [Phase 2] Haptic Feedback API
    handlers.set('haptic', (evt) => {
        if (navigator.vibrate && evt.duration) {
            navigator.vibrate(evt.duration);
        }
    });

    // [Phase 2] Neuro-Sonification (Binaural Beats)

    // [Phase 12] Clip Plane / Internal Reveal
    handlers.set('clip', (evt) => {
        const targetZ = evt.sliceZ !== undefined ? evt.sliceZ : 0.0; // 0.0 is center, 2.0 is outside
        const duration = evt.duration || 2.0;
        const ease = evt.ease || 'easeInOutSine';

        player.startLerp({
            key: 'sliceZ',
            value: targetZ,
            duration: duration,
            ease: ease
        });
    });

    handlers.set('binaural', async (evt) => {
        player.initAudio();
        if (!player.audioContext) return;

        const baseFreq = evt.baseFrequency || 440;
        const beatFreq = evt.beatFrequency || 40;
        const duration = evt.duration || 5.0;
        const vol = evt.volume !== undefined ? evt.volume : 0.5;

        const gainNode = player.audioContext.createGain();
        const oscL = player.audioContext.createOscillator();
        const oscR = player.audioContext.createOscillator();
        const panL = player.audioContext.createStereoPanner();
        const panR = player.audioContext.createStereoPanner();

        oscL.type = evt.oscType || 'sine';
        oscR.type = evt.oscType || 'sine';

        oscL.frequency.setValueAtTime(baseFreq - (beatFreq / 2), player.audioContext.currentTime);
        oscR.frequency.setValueAtTime(baseFreq + (beatFreq / 2), player.audioContext.currentTime);

        panL.pan.value = -1;
        panR.pan.value = 1;

        oscL.connect(panL);
        oscR.connect(panR);
        panL.connect(gainNode);
        panR.connect(gainNode);
        gainNode.connect(player.audioContext.destination);

        gainNode.gain.setValueAtTime(0, player.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(vol, player.audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(vol, player.audioContext.currentTime + duration - 0.1);
        gainNode.gain.linearRampToValueAtTime(0, player.audioContext.currentTime + duration);

        oscL.start(player.audioContext.currentTime);
        oscR.start(player.audioContext.currentTime);
        oscL.stop(player.audioContext.currentTime + duration);
        oscR.stop(player.audioContext.currentTime + duration);
    });

    // [Phase 2] Neuro-Sonification (Audio Events)
    handlers.set('sound', async (evt) => {
        player.initAudio();
        if (!player.audioContext) return;

        const vol = evt.volume !== undefined ? evt.volume : 0.5;
        const gainNode = player.audioContext.createGain();

        if (evt.url) {
            // Play external audio file
            let buffer = player.audioBuffers[evt.url];
            if (!buffer) {
                try {
                    const response = await fetch(evt.url);
                    const arrayBuffer = await response.arrayBuffer();
                    buffer = await player.audioContext.decodeAudioData(arrayBuffer);
                    player.audioBuffers[evt.url] = buffer;
                } catch (e) {
                    console.error(`[Routine] Failed to load audio file: ${evt.url}`, e);
                    return;
                }
            }

            const source = player.audioContext.createBufferSource();
            source.buffer = buffer;

            // Playback rate adjustment based on global playback speed
            source.playbackRate.value = player.playbackSpeed;

            // Simple envelope if duration is provided, else play full buffer
            gainNode.gain.setValueAtTime(vol, player.audioContext.currentTime);
            if (evt.duration) {
                 gainNode.gain.setValueAtTime(vol, player.audioContext.currentTime + evt.duration - 0.05);
                 gainNode.gain.linearRampToValueAtTime(0, player.audioContext.currentTime + evt.duration);
            }

            source.connect(gainNode);
            gainNode.connect(player.audioContext.destination);

            source.start(player.audioContext.currentTime);
            if (evt.duration) {
                 source.stop(player.audioContext.currentTime + evt.duration);
            }
        } else {
            // Play synthesized tone
            const freq = evt.frequency || 440;
            const type = evt.oscType || 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
            const duration = evt.duration || 0.5;

            const osc = player.audioContext.createOscillator();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, player.audioContext.currentTime);

            // Envelope to avoid clicking
            gainNode.gain.setValueAtTime(0, player.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(vol, player.audioContext.currentTime + 0.05);
            gainNode.gain.setValueAtTime(vol, player.audioContext.currentTime + duration - 0.05);
            gainNode.gain.linearRampToValueAtTime(0, player.audioContext.currentTime + duration);

            osc.connect(gainNode);
            gainNode.connect(player.audioContext.destination);

            osc.start(player.audioContext.currentTime);
            osc.stop(player.audioContext.currentTime + duration);
        }
    });
}

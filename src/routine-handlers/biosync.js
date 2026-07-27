import { handleCamera } from '../routine-camera.js';

export function registerBiosyncHandlers(handlers, player) {
    handlers.set('neuromodulator', (evt) => {
        const profileKey = evt.profile;
        if (profileKey && window.updateNeuromodulatorUI) {
            window.updateNeuromodulatorUI(profileKey);
        }
        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: evt.duration || 3.0 });
        }
    });

    // Environmental Noise Simulation (background ambient lighting shifts)
    handlers.set('environmental_noise', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        // Modulate ambient light and directional intensity to simulate noise/flicker
        // as well as minor shaking
        player.startLerp({ key: 'ambientLight', value: Math.max(0.1, 0.2 + (0.3 * intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'dirIntensity', value: Math.max(0.2, 0.8 - (0.4 * intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'shake', value: intensity * 0.05, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });


    // Pupillary Dilation Simulation (dynamic camera FOV shifts)
    handlers.set('pupillary_dilation', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;
        const ease = evt.ease || 'sineInOut';

        // Modulate camera FOV and light intensity based on pupillary dilation
        const defaultFov = Math.PI / 4;
        const targetFov = defaultFov + (intensity * 0.5); // Increase FOV

        player.executeEvent({
            type: 'camera',
            fov: targetFov,
            duration: duration,
            ease: ease
        });

        player.startLerp({ key: 'dirIntensity', value: 0.8 + (intensity * 1.5), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // Galvanic Skin Response (GSR) Sync (maps GSR to mesh structural noise)
    handlers.set('gsr_sync', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;
        const ease = evt.ease || 'sineInOut';

        // Modulate stress (structural noise) and flow speed based on GSR arousal
        player.startLerp({ key: 'stress', value: intensity * 1.5, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: 4.0 + (intensity * 2.0), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });


    handlers.set('neurotransmitter_depletion', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;

        player.startLerp({ key: 'decimation', value: intensity, duration: duration, ease: 'quadIn' });

        // Dim the global brightness to match the depletion
        player.startLerp({ key: 'ambientLight', value: Math.max(0.05, 0.2 - (0.1 * intensity)), duration: duration, ease: 'quadIn' });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // Cognitive Dissonance Simulation
    handlers.set('cognitive_dissonance', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'cognitiveDissonance', value: intensity, duration: duration, ease: ease });
        player.startLerp({ key: 'shake', value: intensity * 0.1, duration: duration, ease: ease });
        player.startLerp({ key: 'stress', value: intensity * 0.5, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // HRV Glitch Sync (maps heart rate variability to visual distortions)
    handlers.set('hrv_sync', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;
        const ease = evt.ease || 'sineInOut';

        // Modulate aberration, grain, and shake based on HRV intensity
        player.startLerp({ key: 'aberration', value: intensity * 2.0, duration: duration, ease: ease });
        player.startLerp({ key: 'grain', value: intensity * 1.5, duration: duration, ease: ease });
        player.startLerp({ key: 'shake', value: intensity * 0.2, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // Hypothermia Simulation (reduced metabolic rate and frosty hues)
    handlers.set('hypothermia', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        // Modulate flowSpeed, amplitude, and frequency for reduced metabolic rate
        player.startLerp({ key: 'flowSpeed', value: Math.max(0.1, 4.0 - (3.5 * intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'amplitude', value: Math.max(0.05, 0.5 - (0.4 * intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'frequency', value: Math.max(0.1, 2.0 - (1.5 * intensity)), duration: duration, ease: ease });

        // Apply a frosty hue shift (cool blue tones, typically negative colorShift values around -0.8 to -1.0 depending on shader implementation)
        player.startLerp({ key: 'colorShift', value: -1.0 * intensity, duration: duration, ease: ease });

        // Slightly dim the global brightness
        player.startLerp({ key: 'ambientLight', value: Math.max(0.05, 0.2 - (0.1 * intensity)), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // Cellular Apoptosis Simulation
    handlers.set('cellular_apoptosis', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 6.0;
        const ease = evt.ease || 'quadIn';

        // Drive the new apoptosis uniforms / parameters
        player.startLerp({ key: 'apoptosis', value: intensity, duration: duration, ease: ease });
        player.startLerp({ key: 'decimation', value: intensity * 0.8, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: Math.max(0.2, 4.0 - (3.0 * intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'ambientLight', value: Math.max(0.04, 0.2 - (0.12 * intensity)), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });
}

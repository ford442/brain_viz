import { handleCamera } from '../routine-camera.js';

export function registerCoreHandlers(handlers, player) {
    handlers.set('stimulus', (evt) => {
        let coords = [0,0,0];
        if (typeof evt.target === 'string' && player.regions[evt.target]) {
            coords = player.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }

        const intensity = evt.intensity || 1.0;
        const duration = evt.duration || 0.0;
        player.renderer.injectStimulus(coords[0], coords[1], coords[2], intensity, duration);

        // [Phase 3] Temporary boost to respiration rate on strong stimuli
        if (intensity > 0.5 && player.state.respirationRate !== undefined) {
            // Cap the max respiration rate boost from visual stimuli to 2.5
            player.state.respirationRate = Math.min(2.5, player.state.respirationRate + (intensity * 0.2));
        }
    });

    // Style Change (instant snap)
    handlers.set('style', (evt) => {
        player.renderer.setParams({ style: evt.value });
    });

    // Mode Transition (animated cross-fade via style lerp)
    handlers.set('mode-transition', (evt) => {
        player.startLerp({
            key: 'style',
            value: evt.toMode,
            duration: evt.duration !== undefined ? evt.duration : 1.5,
            ease: evt.ease || 'sineInOut'
        });
    });

    // Parameter Update
    handlers.set('param', (evt) => {
        player.renderer.setParams({ [evt.key]: evt.value });
    });

    // Lerp Transition
    handlers.set('lerp', (evt) => {
        player.startLerp(evt);
    });

    // Calm State
    handlers.set('calm', () => {
        player.renderer.calmState();
    });

    // Reset Activity
    handlers.set('reset', () => {
        player.renderer.resetActivity();
    });

    // [Phase 2] Cognitive Stress Distortion
    handlers.set('stress', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        if (evt.duration) {
            player.startLerp({
                key: 'stress',
                value: intensity,
                duration: evt.duration,
                ease: evt.ease || 'linear'
            });
        } else {
            player.renderer.setParams({ stress: intensity });
        }
    });

    // [Phase 6] Procedural Volumetric Fluid Dynamics

    // [Phase 17] TMS Spatial Distortions
    const tmsHandler = (evt) => {
        let coords = [0, 0, 0];
        if (typeof evt.target === 'string' && player.regions[evt.target]) {
            coords = player.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }

        const intensity = evt.intensity !== undefined ? evt.intensity : 1.2;
        const radius = evt.radius !== undefined ? evt.radius : 0.28;
        const duration = evt.duration !== undefined ? evt.duration * 1000 : 650; // duration is in ms for renderer

        player.renderer.triggerTMS(coords, intensity, radius, duration);
    };
    // [Phase 2.5] Synaptic Binding Kinetics
    handlers.set('synapse_kinetics', (evt) => {
        const duration = evt.duration || 2.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const ease = evt.ease || 'quadOut';

        // Modulate sparkle for particle effect and saturation for kinetic energy
        player.startLerp({ key: 'sparkle', value: intensity * 1.5, duration: duration, ease: ease });
        player.startLerp({ key: 'pulseSaturation', value: 1.0 + (intensity * 0.5), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    handlers.set('dynamic_weather', (evt) => {
        const duration = evt.duration || 5.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'fogDensity', value: 0.1 * intensity, duration: duration, ease: ease });
        player.startLerp({ key: 'dirIntensity', value: 0.2 + (0.5 * (1.0 / intensity)), duration: duration, ease: ease });
        player.startLerp({ key: 'ambientLight', value: 0.05 + (0.1 * (1.0 / intensity)), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    handlers.set('flow_state', (evt) => {
        const duration = evt.duration || 3.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const ease = evt.ease || 'sineInOut';

        // Glowing harmonic waves
        player.startLerp({ key: 'sparkle', value: intensity * 1.8, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: 2.0 + (intensity * 8.0), duration: duration, ease: ease });
        player.startLerp({ key: 'amplitude', value: 0.8 + (intensity * 1.2), duration: duration, ease: ease });
        player.startLerp({ key: 'frequency', value: 1.0 + (intensity * 3.0), duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });


    handlers.set('stroke_lesion', (evt) => {
        let coords = [0, 0, 0];
        if (typeof evt.target === 'string' && player.regions[evt.target]) {
            coords = player.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }

        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const radius = evt.radius !== undefined ? evt.radius : 0.5;
        const duration = evt.duration || 5.0;

        player.renderer.triggerLesion(coords, radius);
        player.startLerp({ key: 'lesionActive', value: intensity, duration: duration, ease: 'quadOut' });
    });

    handlers.set('tms_distortion', tmsHandler);
    handlers.set('apply_tms', tmsHandler);

    handlers.set('fluid', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        if (evt.duration) {
            player.startLerp({
                key: 'fluidActive',
                value: intensity,
                duration: evt.duration,
                ease: evt.ease || 'linear'
            });
        } else {
            player.renderer.setParams({ fluidActive: intensity });
        }
    });

    // [Phase 2] Serotonin Color Shift & Fluid Sim

    handlers.set('visual_cortex_filter', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'edgeDetection', value: intensity, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

}

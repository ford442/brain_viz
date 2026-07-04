import { handleCamera } from './routine-camera.js';

export function createDefaultHandlers(player) {
    const handlers = new Map();

    // Stimulus Injection
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

    handlers.set('serotonin', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;

        // Gradually shift color toward serotonin representation, speed up flow, and activate fluid dynamics
        player.startLerp({ key: 'colorShift', value: 0.5 * intensity, duration: 2.0, ease: 'sineInOut' });
        player.startLerp({ key: 'flowSpeed', value: 8.0 * intensity, duration: 2.0, ease: 'cubicIn' });
        player.startLerp({ key: 'fluidActive', value: 1.5 * intensity, duration: 2.0, ease: 'sineInOut' });

        // Smoothly fade back after full surge is reached
        if (duration > 0) {
            const ease = evt.ease || 'sineInOut';

            // Keep chronological ordering for reverting the values back to normal
            if (player.routine) {
                const revertTime = player.elapsedTime + 2.0;

                const revertEvents = [
                    { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: duration, ease: ease },
                    { time: revertTime, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: duration, ease: 'quadOut' },
                    { time: revertTime, type: 'lerp', key: 'fluidActive', value: 0.0, duration: duration, ease: ease }
                ];

                let insertIdx = player.currentEventIndex ?? player.cursor;
                while (insertIdx < player.routine.length && player.routine[insertIdx].time < revertTime) {
                    insertIdx++;
                }

                player.routine.splice(insertIdx, 0, ...revertEvents);
            }
        }
    });

    // [Phase 5] Cortisol Structural Decay
    handlers.set('cortisol', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        if (evt.duration) {
            player.startLerp({
                key: 'cortisol',
                value: intensity,
                duration: evt.duration,
                ease: evt.ease || 'linear'
            });
        } else {
            player.renderer.setParams({ cortisol: intensity });
        }
    });

    // [Phase 2] Camera Shake
    handlers.set('shake', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 0.05;
        player.renderer.setParams({ shake: intensity });

        if (evt.duration) {
            // Auto-fade out
            player.startLerp({
                key: 'shake',
                value: 0.0,
                duration: evt.duration,
                ease: evt.ease || 'quadOut'
            });
        }
    });

    // [Phase 2] Dynamic Lighting Control
    handlers.set('light', (evt) => {
        if (evt.ambient !== undefined) {
            if (evt.duration) player.startLerp({ key: 'ambientLight', value: evt.ambient, duration: evt.duration, ease: evt.ease });
            else player.renderer.setParams({ ambientLight: evt.ambient });
        }
        if (evt.dirIntensity !== undefined) {
            if (evt.duration) player.startLerp({ key: 'dirIntensity', value: evt.dirIntensity, duration: evt.duration, ease: evt.ease });
            else player.renderer.setParams({ dirIntensity: evt.dirIntensity });
        }
        if (evt.dirX !== undefined) {
            if (evt.duration) player.startLerp({ key: 'lightDirX', value: evt.dirX, duration: evt.duration, ease: evt.ease });
            else player.renderer.setParams({ lightDirX: evt.dirX });
        }
        if (evt.dirY !== undefined) {
            if (evt.duration) player.startLerp({ key: 'lightDirY', value: evt.dirY, duration: evt.duration, ease: evt.ease });
            else player.renderer.setParams({ lightDirY: evt.dirY });
        }
        if (evt.dirZ !== undefined) {
            if (evt.duration) player.startLerp({ key: 'lightDirZ', value: evt.dirZ, duration: evt.duration, ease: evt.ease });
            else player.renderer.setParams({ lightDirZ: evt.dirZ });
        }
    });

    // [Phase 2] Dopamine Burst Routine
    handlers.set('dopamine', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 1.0;

        // Instantly boost flowSpeed and amplitude
        player.renderer.setParams({
            flowSpeed: 20.0 * intensity,
            amplitude: 1.5 * intensity
        });

        // Fade back
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
        }
    });

    // [Phase 2] Endorphin Rush
    handlers.set('endorphin', (evt) => {
        const duration = evt.duration || 3.0;

        // Instantly suppress stress and shake
        player.renderer.setParams({
            stress: 0.0,
            shake: 0.0,
            colorShift: 0.2 // Slight soothing shift
        });

        // Smoothly restore or keep low over duration
        if (duration > 0) {
            const ease = evt.ease || 'quadInOut';
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
        }
    });

    // [Phase 5] Glial Cell Cleanup
    handlers.set('glial_cleanup', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 4.0;

        // Instantly apply cool/blue color shift and slight sparkle to simulate active cleanup
        player.renderer.setParams({
            colorShift: -0.6 * intensity, // Shift towards cool/blue
            sparkle: 0.5 * intensity
        });

        // Gradually reduce swelling (growth) and agitations
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'growth', value: 1.0, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'sparkle', value: 0.0, duration: duration, ease: ease });
        }
    });

    // [Phase 5] GABA Deceleration
    handlers.set('gaba', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;

        // Smoothly decrease flow speed and global playback speed to simulate deceleration
        player.startLerp({ key: 'flowSpeed', value: 0.5 * (2.0 - intensity), duration: duration, ease: 'quadOut' });
        player.startLerp({ key: 'playbackSpeed', value: 0.5 * (2.0 - intensity), duration: duration, ease: 'quadOut' });
        // Calm colors
        player.startLerp({ key: 'colorShift', value: -0.2 * intensity, duration: duration, ease: 'quadOut' });
    });

    // [Phase 5] ATP Energy Depletion
    handlers.set('atp_depletion', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;

        // Slow down playback speed and desaturate
        player.startLerp({ key: 'playbackSpeed', value: 0.2 * (2.0 - intensity), duration: duration * 0.5, ease: 'quadOut' });
        player.startLerp({ key: 'colorShift', value: -0.8 * intensity, duration: duration * 0.5, ease: 'quadOut' });

        // Fade back
        if (duration > 0) {
             const revertTime = player.elapsedTime + duration;
             const revertEvents = [
                { time: revertTime, type: 'lerp', key: 'playbackSpeed', value: 1.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: duration * 0.5, ease: 'quadIn' }
             ];
             let insertIdx = player.currentEventIndex ?? player.cursor;
             while (insertIdx < player.routine.length && player.routine[insertIdx].time < revertTime) {
                 insertIdx++;
             }
             player.routine.splice(insertIdx, 0, ...revertEvents);
        }
    });

    // [Phase 5] Endocannabinoids
    handlers.set('endocannabinoid', (evt) => {
        const duration = evt.duration || 5.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;

        // Suppress stress/shake, moderate flowSpeed, increase amplitude slightly
        player.renderer.setParams({
            stress: 0.0,
            shake: 0.0
        });

        player.startLerp({ key: 'flowSpeed', value: 6.0 * intensity, duration: duration, ease: 'sineOut' });
        player.startLerp({ key: 'amplitude', value: 0.8 * intensity, duration: duration, ease: 'sineOut' });

        // Warm, pleasant color shift
        player.startLerp({ key: 'colorShift', value: 0.3 * intensity, duration: duration, ease: 'sineOut' });
    });

    // [Phase 5] Melatonin Sleep Onset
    handlers.set('melatonin', (evt) => {
        const duration = evt.duration || 5.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;

        // Smoothly decrease temporal activity and energy
        player.startLerp({ key: 'flowSpeed', value: 1.0, duration: duration, ease: 'sineOut' });
        player.startLerp({ key: 'amplitude', value: 0.1, duration: duration, ease: 'sineOut' });

        // Simulate blurring effect
        player.startLerp({ key: 'aperture', value: 0.8 * intensity, duration: duration, ease: 'sineOut' });
        player.startLerp({ key: 'focus', value: 0.5, duration: duration, ease: 'sineOut' });

        // Slow desaturation
        player.startLerp({ key: 'colorShift', value: -0.5 * intensity, duration: duration, ease: 'sineOut' });
    });

    // [Phase 2] Sleep Deprivation Simulation
    handlers.set('sleep_deprivation', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 10.0;

        // Progressive desaturation and blurring
        player.startLerp({ key: 'colorShift', value: -0.8 * intensity, duration: duration, ease: 'sineInOut' });
        player.startLerp({ key: 'aperture', value: 0.5 * intensity, duration: duration, ease: 'sineInOut' });

        // Sluggish flow speed
        player.startLerp({ key: 'flowSpeed', value: 1.5, duration: duration, ease: 'sineInOut' });

        // Periodic glitch injections
        const numGlitches = Math.floor(duration / 2.0); // A glitch roughly every 2 seconds
        if (numGlitches > 0 && player.routine) {
            const eventsToInsert = [];
            for (let i = 1; i <= numGlitches; i++) {
                eventsToInsert.push({
                    time: player.elapsedTime + (i * 2.0) + (Math.random() - 0.5), // Jitter the timing slightly
                    type: 'glitch',
                    intensity: intensity * 1.5 * (i / numGlitches), // Glitches get more intense over time
                    autoRestore: true,
                    _isDynamic: true // Tag for cleanup
                });
            }

            // Add fade back to baseline
            eventsToInsert.push(
                { time: player.elapsedTime + duration, type: 'lerp', key: 'colorShift', value: 0.0, duration: 3.0, _isDynamic: true },
                { time: player.elapsedTime + duration, type: 'lerp', key: 'aperture', value: 0.0, duration: 3.0, _isDynamic: true },
                { time: player.elapsedTime + duration, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 3.0, _isDynamic: true }
            );

            eventsToInsert.sort((a, b) => a.time - b.time);

            let insertIdx = player.currentEventIndex ?? player.cursor;
            for (const ev of eventsToInsert) {
                while (insertIdx < player.routine.length && player.routine[insertIdx].time < ev.time) {
                    insertIdx++;
                }
                player.routine.splice(insertIdx, 0, ev);
                insertIdx++; // Move past the newly inserted event
            }
        }
    });

    // [Phase 2] Histamine Inflammatory Response
    handlers.set('histamine', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;

        if (evt.target) {
            player.executeEvent({ type: 'stimulus', target: evt.target, intensity: intensity * 2.0 });
        }

        // Inflammatory response: warm/red color shift, slight swelling (growth), and agitation (flowSpeed)
        player.renderer.setParams({
            colorShift: 0.8 * intensity, // Shift towards red
            growth: 1.2 * intensity, // Slight swelling
            flowSpeed: 8.0 * intensity // Agitation
        });

        // Fade back
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'growth', value: 1.0, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
        }
    });

    // [Phase 2] Environmental Hazards
    handlers.set('electrical', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 1.0;
        player.renderer.injectElectrical(intensity, duration);
    });

    handlers.set('mercury', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 1.0;
        player.renderer.injectMercury(intensity, duration);
    });

    handlers.set('heavy_metal', (evt) => {
        const val = evt.value !== undefined ? evt.value : 1.0;
        const duration = evt.duration || 2.0;
        player.startLerp({ key: 'heavyMetal', value: val, duration, ease: evt.ease || 'linear' });
    });

    // [Phase 9] Cognitive Load (Dynamic LoD Visual Cortex Fatigue)
    handlers.set('cognitive_load', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;

        if (duration > 0) {
            const ease = evt.ease || 'sineInOut';
            player.startLerp({ key: 'cognitiveLoad', value: intensity, duration: duration, ease: ease });
        } else {
            player.renderer.setParams({ cognitiveLoad: intensity });
        }
    });

    // [Phase 2] Myelin Sheath Degradation (Neurodegenerative Simulation)
    handlers.set('myelin_degradation', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 10.0;

        // Permanently and progressively reduce flowSpeed and amplitude
        player.startLerp({ key: 'flowSpeed', value: Math.max(0.5, 4.0 - (3.0 * intensity)), duration: duration, ease: 'sineOut' });
        player.startLerp({ key: 'amplitude', value: Math.max(0.1, 0.5 - (0.4 * intensity)), duration: duration, ease: 'sineOut' });

        // Induce structural breakdown and data loss via glitching/aberration
        player.startLerp({ key: 'aberration', value: 1.5 * intensity, duration: duration, ease: 'sineIn' });
        player.startLerp({ key: 'colorShift', value: -0.6 * intensity, duration: duration, ease: 'sineInOut' }); // desaturate/cool

        // Occasional severe glitches
        const numGlitches = Math.floor(duration / 2.5);
        if (numGlitches > 0 && player.routine) {
            const eventsToInsert = [];
            for (let i = 1; i <= numGlitches; i++) {
                eventsToInsert.push({
                    time: player.elapsedTime + (i * 2.5) + (Math.random() - 0.5),
                    type: 'glitch',
                    intensity: intensity * 1.5 * (i / numGlitches),
                    autoRestore: true
                });
            }
            eventsToInsert.sort((a, b) => a.time - b.time);
            let insertIdx = player.currentEventIndex ?? player.cursor;
            for (const ev of eventsToInsert) {
                while (insertIdx < player.routine.length && player.routine[insertIdx].time < ev.time) {
                    insertIdx++;
                }
                player.routine.splice(insertIdx, 0, ev);
                insertIdx++;
            }
        }
    });
    // [Phase 2] Heartbeat Simulation
    handlers.set('heartbeat', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 1.0; // Total duration of the double-pulse

        // Lub (First pulse)
        player.renderer.setParams({
            amplitude: 1.5 * intensity,
            flowSpeed: 8.0 * intensity
        });

        // Dub (Second pulse) - slightly delayed
        setTimeout(() => {
            if (!player.isPlaying) return;
            player.renderer.setParams({
                amplitude: 1.8 * intensity,
                flowSpeed: 10.0 * intensity
            });

            // Fade back after dub
            if (duration > 0) {
                const fadeDuration = duration * 0.7; // use remaining time for fade
                const ease = evt.ease || 'quadOut';
                player.startLerp({ key: 'amplitude', value: 0.5, duration: fadeDuration, ease: ease });
                player.startLerp({ key: 'flowSpeed', value: 4.0, duration: fadeDuration, ease: ease });
            }
        }, (duration * 1000) * 0.25); // dub starts at 25% of the total duration

        // Fade back for lub (before dub hits)
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'amplitude', value: 0.8, duration: duration * 0.25, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 5.0, duration: duration * 0.25, ease: ease });
        }
    });

    // [Phase 5] Acetylcholine Memory Consolidation
    handlers.set('acetylcholine', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;

        // Instantly boost sparkle and slightly increase flowSpeed
        player.renderer.setParams({
            sparkle: 1.0 * intensity,
            flowSpeed: 8.0 * intensity,
            colorShift: 0.5 * intensity
        });

        // Slowly fade back to normal
        if (duration > 0) {
            const ease = evt.ease || 'sineInOut';
            player.startLerp({ key: 'sparkle', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
        }
    });

    // [Phase 5] Noradrenaline Spike
    handlers.set('noradrenaline', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;

        // Instantly boost flowSpeed, amplitude, and frequency for global alertness
        player.renderer.setParams({
            flowSpeed: 25.0 * intensity,
            amplitude: 1.5 * intensity,
            frequency: 15.0 * intensity
        });

        // Fade back
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
            player.startLerp({ key: 'frequency', value: 2.0, duration: duration, ease: ease });
        }
    });

    // [Phase 2] Sensory Overload Simulation
    handlers.set('sensory_overload', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 5.0;

        // Instantly spike stress, shake, aberration, and speed
        player.renderer.setParams({
            stress: 2.0 * intensity,
            shake: 0.15 * intensity,
            aberration: 2.0 * intensity,
            flowSpeed: 20.0 * intensity,
            colorShift: 0.8 * intensity // Shift to harsh colors
        });

        // Random rapid stimuli using timeline injection
        const regions = Object.keys(player.regions);
        const eventsToInsert = [];

        if (regions.length > 0 && player.routine) {
            // Pre-calculate stimuli events every 0.2s for the duration
            const numStimuli = Math.floor(duration / 0.2);
            for (let i = 1; i <= numStimuli; i++) {
                const target = regions[Math.floor(Math.random() * regions.length)];
                eventsToInsert.push({
                    time: player.elapsedTime + (i * 0.2),
                    type: 'stimulus',
                    target: target,
                    intensity: intensity * 3.0
                });
            }
        }

        if (duration > 0 && player.routine) {
             const revertTime = player.elapsedTime + duration;
             const ease = evt.ease || 'quadOut';
             const revertEvents = [
                { time: revertTime, type: 'lerp', key: 'stress', value: 0.0, duration: 2.0, ease: ease },
                { time: revertTime, type: 'lerp', key: 'shake', value: 0.0, duration: 2.0, ease: ease },
                { time: revertTime, type: 'lerp', key: 'aberration', value: 0.0, duration: 2.0, ease: ease },
                { time: revertTime, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 2.0, ease: ease },
                { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: 2.0, ease: ease }
             ];
             eventsToInsert.push(...revertEvents);
        }

        if (eventsToInsert.length > 0 && player.routine) {
             // Sort the events to insert
             eventsToInsert.sort((a, b) => a.time - b.time);

             let insertIdx = player.currentEventIndex ?? player.cursor;
             for (const ev of eventsToInsert) {
                 while (insertIdx < player.routine.length && player.routine[insertIdx].time < ev.time) {
                     insertIdx++;
                 }
                 player.routine.splice(insertIdx, 0, ev);
                 insertIdx++;
             }
        }
    });

    // [Phase 2] Adrenaline Surge
    handlers.set('adrenaline', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 1.0;

        // Instantly boost light intensity, flow speed, and shift color
        player.renderer.setParams({
            dirIntensity: 3.0 * intensity,
            ambientLight: 0.8 * intensity,
            flowSpeed: 25.0 * intensity,
            colorShift: 1.0 // Shift to warm/bright colors
        });

        // Fade back
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'dirIntensity', value: 0.8, duration: duration, ease: ease });
            player.startLerp({ key: 'ambientLight', value: 0.2, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
        }
    });

    // [Phase 7] Cinematic Effects (Aberration, Grain, Focus, Aperture)
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

    // [Phase 2] Memory Fragment Flashbacks
    handlers.set('flashback', (evt) => {
        const intensity = evt.intensity || 1.0;
        const message = evt.message || 'MEMORY FLASHBACK';

        player.executeEvent({ type: 'text', message: message, duration: 0.5 });
        player.executeEvent({ type: 'style', value: 1 }); // Cyber / Wireframe
        player.executeEvent({ type: 'cinematic', aberration: intensity * 2.0, grain: intensity * 1.5 });
        player.executeEvent({ type: 'shake', intensity: intensity * 0.2 });

        // Rapid stimuli
        const regions = Object.keys(player.regions);
        if (regions.length > 0) {
            const target = regions[Math.floor(Math.random() * regions.length)];
            player.executeEvent({ type: 'stimulus', target: target, intensity: intensity * 3.0 });
        }

        // Restore after short duration
        setTimeout(() => {
            player.executeEvent({ type: 'style', value: 0 }); // Restore default style
            player.executeEvent({ type: 'cinematic', aberration: 0.0, grain: 0.0 });
            player.executeEvent({ type: 'shake', intensity: 0.0 });
        }, 500);
    });

    // [Phase 2] Default Mode Network (DMN)
    handlers.set('dmn', (evt) => {
        const intensity = evt.intensity || 1.0;
        const duration = evt.duration || 5.0;

        // Instantly apply color shift and start low frequency hum, smooth flow
        player.renderer.setParams({
            colorShift: -0.2 * intensity
        });

        player.startLerp({ key: 'frequency', value: 0.5 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });
        player.startLerp({ key: 'amplitude', value: 0.2 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });
        player.startLerp({ key: 'flowSpeed', value: 0.3 * intensity, duration: duration * 0.5, ease: 'easeInOutSine' });

        if (player.routine) {
            const revertTime = player.elapsedTime + duration;

            const revertEvents = [
                { time: revertTime, type: 'lerp', key: 'frequency', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                { time: revertTime, type: 'lerp', key: 'amplitude', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                { time: revertTime, type: 'lerp', key: 'flowSpeed', value: 1.0, duration: duration * 0.5, ease: 'easeInOutSine' },
                { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: duration * 0.5, ease: 'easeInOutSine' }
            ];

            // Insert events keeping chronological order
            let insertIdx = player.currentEventIndex ?? player.cursor;
            while (insertIdx < player.routine.length && player.routine[insertIdx].time < revertTime) {
                insertIdx++;
            }

            player.routine.splice(insertIdx, 0, ...revertEvents);
        }
    });

    // [Phase 2] Oxytocin Burst
    handlers.set('oxytocin', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;

        // Trigger stimulus on both hemispheres symmetrically
        player.executeEvent({ type: 'stimulus', target: [-0.8, 0.0, 0.0], intensity: intensity * 2.0 });
        player.executeEvent({ type: 'stimulus', target: [0.8, 0.0, 0.0], intensity: intensity * 2.0 });

        // Instantly apply warm color shift and slow, flowing speed
        player.renderer.setParams({
            flowSpeed: 2.0 * intensity,
            colorShift: 0.3 * intensity, // Warm/golden tone
            amplitude: 0.8 * intensity
        });

        // Slowly fade back to normal
        if (duration > 0) {
            const ease = evt.ease || 'sineInOut';
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
        }
    });

    // [Phase 2] Dynamic Time Dilation
    handlers.set('speed', (evt) => {
        if (evt.duration) {
            player.startLerp({
                key: 'playbackSpeed',
                value: evt.value,
                duration: evt.duration,
                ease: evt.ease || 'linear'
            });
        } else {
            player.setPlaybackSpeed(evt.value);
            if (player.onEvent) {
                player.onEvent({ type: 'speed', value: evt.value });
            }
        }
    });

    // Text (No-op in engine, handled by UI listener)
    handlers.set('text', () => {});

    // [Phase 2] CSS Filters (Handled by UI)
    handlers.set('cssFilter', () => {}); // Emits event, handled by UI

    // [Phase 2] Interactive Visual Overlays
    handlers.set('overlay', () => {}); // Emits event, handled by UI

    // [Phase 2] Interactive Neuro-Storytelling (Choices)
    handlers.set('choice', (evt) => {
        // Emits event, handled by UI. UI will render buttons and handle logic.
        // We just pause here to wait for user input.
        if (evt.choices && evt.choices.length > 0) {
            player.pause();
            console.log("[Routine] Execution paused, waiting for user choice.");
        } else {
            console.warn("[Routine] Choice event lacks 'choices' array.");
        }
    });

    // Call (Sub-routine expansion happens at load time, runtime calls are warnings)
    handlers.set('call', (evt) => {
        console.warn("[Routine] Unexpanded 'call' event encountered at runtime:", evt);
    });

    // [Phase 2] Branching/Conditional Routines
    handlers.set('branch', (evt) => {
        let result = false;
        if (typeof evt.condition === 'function') {
            result = evt.condition();
        } else if (typeof evt.condition === 'string' && evt.condition === 'Math.random() > 0.5') {
            // Hardcode logic for JSON safe functions if needed
            result = Math.random() > 0.5;
        } else if (typeof evt.condition === 'string' && evt.condition.startsWith('state.')) {
            const key = evt.condition.substring(6);
            result = !!player.state[key];
        } else {
            result = !!evt.condition;
        }

        const target = result ? evt.trueBranch : evt.falseBranch;
        if (target) {
            if (player.subRoutines[target]) {
                console.log(`[Routine] Branch evaluated to ${result}. Jumping to: ${target}`);
                player.playNow(player.subRoutines[target]);
            } else {
                console.warn(`[Routine] Branch target '${target}' not found in subRoutines.`);
            }
        }
    });

    handlers.set('state', (evt) => {
        if (evt.key !== undefined && evt.value !== undefined) {
            player.state[evt.key] = evt.value;
            console.log(`[Routine] State updated: ${evt.key} = ${evt.value}`);
        }
    });

    // [Phase 2] Event Synchronization (Wait/Signal)
    handlers.set('wait', (evt) => {
        if (evt.signal) {
            player.waitingForSignal = evt.signal;
            console.log(`[Routine] Paused execution, waiting for signal: '${evt.signal}'`);
        } else {
            console.warn("[Routine] Wait event requires a 'signal' property.");
        }
    });

    handlers.set('signal', (evt) => {
        if (evt.signal) {
            player.triggerSignal(evt.signal);
        }
    });

    // [Phase 2] Routine Variables/Math
    handlers.set('math', (evt) => {
        if (evt.target === undefined || evt.var1 === undefined) {
            console.warn("[Routine] Math event requires target and var1");
            return;
        }

        let val1 = evt.var1;
        if (typeof evt.var1 === 'string' && evt.var1.startsWith('state.')) {
            val1 = player.state[evt.var1.substring(6)] || 0;
        }

        let val2 = evt.var2 !== undefined ? evt.var2 : 0;
        if (typeof evt.var2 === 'string' && evt.var2.startsWith('state.')) {
            val2 = player.state[evt.var2.substring(6)] || 0;
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
            player.state[stateKey] = result;
            console.log(`[Routine] Math executed: ${evt.var1} ${evt.operator} ${evt.var2} = ${result}. Stored in state.${stateKey}`);
        } else {
             console.warn("[Routine] Math target must be a state variable (e.g., 'state.myVar')");
        }
    });



    // [Phase 10] Auditory Hallucinations
    handlers.set('auditory_hallucination', (evt) => {
        const flashes = evt.flashes || 10;
        const duration = evt.duration || 2.0;
        const intensity = evt.intensity || 2.0;

        for (let i = 0; i < flashes; i++) {
            const timeOffset = (Math.random() * duration);

            // Generate random coordinate roughly around temporal lobe
            const x = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.3);
            const y = -0.2 + Math.random() * 0.4;
            const z = -0.3 + Math.random() * 0.6;

            // We use setTimeout because this is an instant handler, but we want the flashes distributed over time.
            // Alternatively, we could inject these into the timeline, but since we are inside a handler, setTimeout is acceptable for transient visual effects.
            // But since RoutinePlayer relies on a declarative timeline, modifying the timeline is better.

            const dynamicEvent = {
                time: player.elapsedTime + timeOffset,
                type: 'stimulus',
                target: [x, y, z],
                intensity: intensity * (0.5 + Math.random() * 0.5)
            };

            // Find insertion point to keep routine sorted
            let insertIdx = player.cursor;
            while (insertIdx < player.routine.length && player.routine[insertIdx].time <= dynamicEvent.time) {
                insertIdx++;
            }
            player.routine.splice(insertIdx, 0, dynamicEvent);
        }
    });

    // [Phase 10] Neuroplasticity Sprouting
    handlers.set('neuroplasticity', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.5;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'growth', value: intensity, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: 8.0, duration: duration, ease: ease });
    });

    // [Phase 15] Dendritic Growth Animation
    handlers.set('dendritic_growth', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.5;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'growth', value: intensity, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });


    // [Phase 19] Memory Formation
    handlers.set('memory_formation', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 2.0;
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'sparkle', value: intensity, duration: duration, ease: ease });
        player.startLerp({ key: 'growth', value: intensity * 1.5, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: 5.0 * intensity, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // [Phase 14] Dynamic Network Topology
    handlers.set('dynamic_topology', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;
        const ease = evt.ease || 'sineInOut';
        player.startLerp({ key: 'networkTopology', value: intensity, duration: duration, ease: ease });
        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    // [Phase 14] Synchronized Firing Patterns
    handlers.set('sync_burst', (evt) => {
        const duration = evt.duration || 5.0;
        const intensity = evt.intensity || 1.5;
        const rate = evt.rate || 0.5; // seconds per pulse
        const numPulses = Math.floor(duration / rate);

        // Track continuous synchronized firing occurrences for plasticity
        player.state.syncBurstCount = (player.state.syncBurstCount || 0) + 1;
        if (player.state.syncBurstCount > 3) {
            console.log("[Routine] Continuous synchronized firing detected. Triggering dynamic network topology shift.");
            const plasticityIntensity = Math.min(2.0, (player.state.syncBurstCount - 3) * 0.5);
            player.executeEvent({ type: 'dynamic_topology', intensity: plasticityIntensity, duration: 4.0, message: "Long-term structural plasticity triggered..." });
        }

        const regions = Object.keys(player.regions);
        if (regions.length > 0 && player.routine) {
            const eventsToInsert = [];
            for (let i = 0; i < numPulses; i++) {
                const t = player.elapsedTime + (i * rate);

                // Stimulate all regions simultaneously
                for (const region of regions) {
                    eventsToInsert.push({
                        time: t, type: 'stimulus', target: region, intensity: intensity
                    });
                }

                eventsToInsert.push({
                    time: t, type: 'lerp', key: 'amplitude', value: 1.5 * intensity, duration: rate * 0.4, ease: 'quadOut'
                });
                eventsToInsert.push({
                    time: t + (rate * 0.4), type: 'lerp', key: 'amplitude', value: 0.5, duration: rate * 0.6, ease: 'quadIn'
                });
            }
            eventsToInsert.sort((a, b) => a.time - b.time);

            let insertIdx = player.cursor;
            for (const ev of eventsToInsert) {
                while (insertIdx < player.routine.length && player.routine[insertIdx].time < ev.time) {
                    insertIdx++;
                }
                player.routine.splice(insertIdx, 0, ev);
                insertIdx++;
            }
        }
    });

    // ── [SynaptiX] Comparative AI/Human Event Handlers ──

    // Load an AI tensor pattern by name or from a raw Float32Array
    handlers.set('synaptiXLoad', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        if (evt.pattern && typeof evt.pattern === 'string') {
            // Delegate to engine if available on renderer
            if (renderer.synaptixEngine) {
                renderer.synaptixEngine.generatePattern(evt.pattern);
            }
        } else if (evt.data && evt.data instanceof Float32Array) {
            renderer.setAITensorData(evt.data);
        }
        // Auto-enable SynaptiX style if not active
        if (renderer.params && renderer.params.style < 4.0) {
            renderer.setParams({ style: 4.0 });
        }
    });

    // Blend AI influence (0–1)
    handlers.set('synaptiXBlend', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        const value = evt.value !== undefined ? evt.value : 0.5;
        if (evt.duration) {
            player.startLerp({ key: 'aiInfluence', value: value, duration: evt.duration, ease: evt.ease || 'sineInOut' });
        } else {
            renderer.setParams({ aiInfluence: value });
        }
    });

    // Inject a stimulus into the AI tensor field
    handlers.set('injectAIStimulus', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        let coords = [0, 0, 0];
        if (typeof evt.target === 'string' && player.regions[evt.target]) {
            coords = player.regions[evt.target];
        } else if (Array.isArray(evt.target)) {
            coords = evt.target;
        }
        const intensity = evt.intensity || 1.0;
        // Write directly to AI tensor via a temporary Gaussian blob
        if (renderer.synaptixEngine) {
            const blob = new Float32Array(32 * 32 * 32);
            const dim = 32;
            const cx = Math.floor((coords[0] / 1.6 + 0.5) * dim);
            const cy = Math.floor((coords[1] / 1.6 + 0.5) * dim);
            const cz = Math.floor((coords[2] / 1.6 + 0.5) * dim);
            const radius = evt.radius || 4;
            for (let z = 0; z < dim; z++) {
                for (let y = 0; y < dim; y++) {
                    for (let x = 0; x < dim; x++) {
                        const d2 = (x-cx)*(x-cx) + (y-cy)*(y-cy) + (z-cz)*(z-cz);
                        if (d2 < radius*radius) {
                            blob[z*dim*dim + y*dim + x] = intensity * Math.exp(-d2 / (radius*0.5));
                        }
                    }
                }
            }
            renderer.synaptixEngine.setTensorData(blob);
        }
    });

    // Temporary resonance boost effect
    handlers.set('resonanceBurst', (evt) => {
        const renderer = player.renderer;
        if (!renderer) return;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 2.0;
        const baseThreshold = renderer.params.resonanceThreshold || 0.2;

        // Drop threshold → more resonance
        renderer.setParams({ resonanceThreshold: baseThreshold * (1.0 - intensity * 0.8) });

        // Flash AI influence up briefly
        const baseInfluence = renderer.params.aiInfluence || 0.5;
        renderer.setParams({ aiInfluence: Math.min(1.0, baseInfluence + intensity * 0.3) });

        // Revert after duration
        if (duration > 0 && player.routine) {
            const revertTime = player.elapsedTime + duration;
            const revertEvents = [
                { time: revertTime, type: 'param', key: 'resonanceThreshold', value: baseThreshold },
                { time: revertTime, type: 'param', key: 'aiInfluence', value: baseInfluence }
            ];
            let insertIdx = player.cursor;
            while (insertIdx < player.routine.length && player.routine[insertIdx].time < revertTime) {
                insertIdx++;
            }
            player.routine.splice(insertIdx, 0, ...revertEvents);
        }
    });


    // [Phase 21] Neuromodulator Switch
    handlers.set('neuromodulator', (evt) => {
        const profileKey = evt.profile;
        if (profileKey && window.updateNeuromodulatorUI) {
            window.updateNeuromodulatorUI(profileKey);
        }
        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: evt.duration || 3.0 });
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

    return handlers;
}

import { handleCamera } from '../routine-camera.js';

export function registerNeuromodulatorsHandlers(handlers, player) {
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

        // Instantly boost flowSpeed and amplitude, and enable dopamine trails
        player.renderer.setParams({
            flowSpeed: 20.0 * intensity,
            amplitude: 1.5 * intensity,
            dopamineTrails: 1.0 * intensity
        });

        // Fade back
        if (duration > 0) {
            const ease = evt.ease || 'quadOut';
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
            player.startLerp({ key: 'amplitude', value: 0.5, duration: duration, ease: ease });
            player.startLerp({ key: 'dopamineTrails', value: 0.0, duration: duration, ease: ease });
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
        player.executeEvent({ type: 'immune_migration', intensity: intensity * 1.2, duration: duration });

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

    // [Phase 5 / Phase 2.5 Extension] ATP Energy Depletion Cascade
    handlers.set('atp_depletion', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 8.0;

        const easeIn = 'quadIn';
        const easeOut = 'quadOut';

        // Stage 1: Regional shutdown (Frontal & Temporal) - reduce sparkle and signal saturation
        player.startLerp({ key: 'sparkle', value: 0.1, duration: duration * 0.3, ease: easeIn });
        player.startLerp({ key: 'pulseSaturation', value: 0.2, duration: duration * 0.4, ease: easeIn });
        player.startLerp({ key: 'decimation', value: intensity * 0.15, duration: duration * 0.5, ease: easeIn }); // Slight mesh decay

        // Stage 2: Global Slow-Motion & Dimming
        // Instead of setTimeout, insert delayed lerp events into the routine
        const slowMoTime = player.elapsedTime + duration * 0.4;
        const slowMoEvents = [
            { time: slowMoTime, type: 'lerp', key: 'playbackSpeed', value: Math.max(0.05, 0.2 * (2.0 - intensity)), duration: duration * 0.6, ease: easeOut },
            { time: slowMoTime, type: 'lerp', key: 'ambientLight', value: 0.1, duration: duration * 0.6, ease: easeOut },
            { time: slowMoTime, type: 'lerp', key: 'dirIntensity', value: 0.2, duration: duration * 0.6, ease: easeOut },
            { time: slowMoTime, type: 'lerp', key: 'colorShift', value: -0.9 * intensity, duration: duration * 0.6, ease: easeOut },
            { time: slowMoTime, type: 'lerp', key: 'fogDensity', value: 0.08 * intensity, duration: duration * 0.6, ease: easeOut }
        ];

        // Stage 3: Fade back / Recovery
        if (duration > 0) {
             const revertTime = player.elapsedTime + duration;
             const newEvents = [
                 ...slowMoEvents,
                { time: revertTime, type: 'lerp', key: 'sparkle', value: 0.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'pulseSaturation', value: 1.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'decimation', value: 0.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'playbackSpeed', value: 1.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'ambientLight', value: 1.2, duration: duration * 0.5, ease: 'quadIn' }, // default ambient
                { time: revertTime, type: 'lerp', key: 'dirIntensity', value: 1.0, duration: duration * 0.5, ease: 'quadIn' }, // default dir
                { time: revertTime, type: 'lerp', key: 'colorShift', value: 0.0, duration: duration * 0.5, ease: 'quadIn' },
                { time: revertTime, type: 'lerp', key: 'fogDensity', value: 0.0, duration: duration * 0.5, ease: 'quadIn' }
             ];
             let insertIdx = player.currentEventIndex ?? player.cursor;
             while (insertIdx < player.routine.length && player.routine[insertIdx].time <= slowMoTime) {
                 insertIdx++;
             }
             player.routine.splice(insertIdx, 0, ...newEvents);

             // Sort to ensure chronological order after insertion
             player.routine.sort((a, b) => a.time - b.time);
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
    // [Phase 6] Immune Cell Migration
    handlers.set('immune_migration', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 4.0;
        const ease = evt.ease || 'quadOut';

        player.renderer.setParams({
            immuneActivity: intensity
        });

        if (duration > 0) {
            player.startLerp({ key: 'immuneActivity', value: 0.0, duration: duration, ease: ease });
        }
    });

    handlers.set('histamine', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 3.0;

        if (evt.target) {
            player.executeEvent({ type: 'stimulus', target: evt.target, intensity: intensity * 2.0 });
        }
        player.executeEvent({ type: 'immune_migration', intensity: intensity * 0.6, duration: duration });

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

    // [Phase 2.5] Targeted Drug Delivery (Micro-capsules)
    handlers.set('drug_delivery', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration || 4.0;
        const target = evt.target || 'frontal';
        const ease = evt.ease || 'quadOut';

        // Trigger stimulus at the target region
        player.executeEvent({ type: 'stimulus', target: target, intensity: intensity * 2.0 });

        // Spike sparkle and instantly adjust colorShift/flowSpeed to simulate bursting capsules
        player.renderer.setParams({
            sparkle: 1.5 * intensity,
            colorShift: 0.7 * intensity,
            flowSpeed: 6.0 * intensity
        });

        // Fade back over duration
        if (duration > 0) {
            player.startLerp({ key: 'sparkle', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: ease });
        }

        if (evt.message) {
             player.executeEvent({ type: 'text', message: evt.message, duration: duration });
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

}

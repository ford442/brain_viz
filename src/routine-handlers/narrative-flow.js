import { handleCamera } from '../routine-camera.js';

export function registerNarrativeFlowHandlers(handlers, player) {
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



    // [Phase 2.5] Visual Cortex Fatigue
    handlers.set('visual_cortex_fatigue', (evt) => {
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        player.startLerp({ key: 'visualFatigue', value: intensity, duration: duration, ease: ease });
        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
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

    // [Phase 10] Neuroplasticity Decay
    handlers.set('neuroplasticity_decay', (evt) => {
        const duration = evt.duration || 5.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'growth', value: 0.5, duration: duration, ease: ease });
        player.startLerp({ key: 'flowSpeed', value: 2.0, duration: duration, ease: ease });
        player.startLerp({ key: 'amplitude', value: 0.1, duration: duration, ease: ease });
        player.startLerp({ key: 'plasticityDecay', value: 1.0, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
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

    handlers.set('spatial_memory_retrieval', (evt) => {
        const intensity = evt.intensity || 1.0;
        const duration = evt.duration || 3000;

        player.renderer.setParams({ memoryBreadcrumbs: 0.0 });
        player.startLerp({ key: 'memoryBreadcrumbs', value: intensity, duration: duration * 0.2, ease: 'sineOut' });

        // Instead of setTimeout or mutating the routine, we use a delayed tween
        player.startLerp({ key: 'memoryBreadcrumbs', value: 0.0, duration: duration * 0.8, ease: 'sineIn', delay: duration * 0.2 });
    });

    handlers.set('psychedelic_trip', (evt) => {
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const duration = evt.duration !== undefined ? evt.duration : 1.0;

        player.startLerp({
            key: 'psychedelic',
            value: intensity,
            duration: duration,
            ease: 'sineInOut'
        });

        if (intensity > 0) {
            player.startLerp({
                key: 'aberration',
                value: intensity * 2.0,
                duration: duration,
                ease: 'sineInOut'
            });
            player.startLerp({
                key: 'flowSpeed',
                value: 4.0 + (intensity * 2.0), // base flow speed + intensity
                duration: duration,
                ease: 'sineInOut'
            });
        } else {
             player.startLerp({
                key: 'aberration',
                value: 0.0,
                duration: duration,
                ease: 'sineInOut'
            });
             player.startLerp({
                key: 'flowSpeed',
                value: 4.0, // default
                duration: duration,
                ease: 'sineInOut'
            });
        }
    });

    handlers.set('signal_trails', (evt) => {
        const duration = evt.duration || 3.0;
        const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
        const ease = evt.ease || 'sineInOut';

        player.startLerp({ key: 'trailLength', value: intensity, duration: duration, ease: ease });

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });
}

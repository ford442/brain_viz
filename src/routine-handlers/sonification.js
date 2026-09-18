// [Neuro-Sonification] Ambient soundscape routine events. Requires
// player.sonificationEngine (wired in src/main-sonification-integration.js) —
// handlers no-op gracefully if it isn't present (e.g. a MockRenderer-based
// test harness).
export function registerSonificationHandlers(handlers, player) {
    handlers.set('sonify_enable', async (evt) => {
        if (!player.sonificationEngine) return;
        await player.sonificationEngine.start();
        if (evt.preset) player.sonificationEngine.setPreset(evt.preset);
    });

    handlers.set('sonify_disable', () => {
        player.sonificationEngine?.stop();
    });

    handlers.set('sonify_preset', (evt) => {
        if (!player.sonificationEngine || !evt.name) return;
        player.sonificationEngine.setPreset(evt.name);
    });

    handlers.set('sonify_param', (evt) => {
        if (!player.sonificationEngine || evt.key === undefined) return;
        player.sonificationEngine.setParam(evt.key, evt.value, evt.duration);
    });

    handlers.set('biofeedback_audio', (evt) => {
        if (!player.sonificationEngine) return;
        const heartRate = evt.heartRate !== undefined ? evt.heartRate : 75;
        const duration = evt.duration !== undefined ? evt.duration : 0.3;

        // Modulate generative audio based on heart rate
        const filterCutoff = heartRate * 8; // e.g., 75 -> 600Hz, 120 -> 960Hz
        const beatFreq = heartRate / 2;     // e.g., 75 -> 37.5Hz, 120 -> 60Hz

        player.sonificationEngine.setParam('filterCutoff', filterCutoff, duration);
        player.sonificationEngine.setParam('beatFreq', beatFreq, duration);

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }
    });

    handlers.set('external_data_sonification', (evt) => {
        const duration = evt.duration || 10.0;
        const feedType = evt.feedType || 'stock_market';

        let currentValue = feedType === 'stock_market' ? 100 : 0;

        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: duration });
        }

        if (player.sonificationEngine) {
            player.sonificationEngine.setPreset('meditation');
        }

        const tickIntervalSeconds = 0.5; // seconds
        const totalTicks = Math.floor(duration / tickIntervalSeconds);

        for (let i = 0; i < totalTicks; i++) {
            player.activeTasks.push({
                delay: i * tickIntervalSeconds,
                execute: () => {
                    // Generate next mock value
                    if (feedType === 'stock_market') {
                        currentValue += (Math.random() - 0.45) * 5; // Slight upward trend
                    } else {
                        currentValue += (Math.random() - 0.5) * 2;
                    }

                    // Trigger visual pulse on connectome
                    player.executeEvent({
                        type: 'pathway_pulse',
                        pathway: 'mesocorticolimbic-dopamine',
                        duration: 0.5,
                        intensity: Math.min(3.0, Math.abs(currentValue) / 50)
                    });

                    // Sonify the value
                    if (player.sonificationEngine) {
                        const cutoff = Math.max(100, Math.min(2000, 200 + currentValue * 10));
                        player.sonificationEngine.setParam('filterCutoff', cutoff, 0.2);

                        const beat = Math.max(1, Math.min(100, 10 + currentValue * 0.5));
                        player.sonificationEngine.setParam('beatFreq', beat, 0.2);
                    }
                }
            });
        }
    });
}

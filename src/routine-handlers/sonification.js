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
}

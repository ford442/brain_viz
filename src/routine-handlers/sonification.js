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
}

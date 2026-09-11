// [Neuro-Weaver] Paint Energy routine events. Requires player.paintController
// (wired in src/main-paint-integration.js) — handlers no-op gracefully if
// it isn't present (e.g. a MockRenderer-based test harness).
export function registerPaintHandlers(handlers, player) {
    handlers.set('paint_enable', (evt) => {
        if (!player.paintController) return;
        player.paintController.enable();
        if (evt.radius !== undefined || evt.intensity !== undefined || evt.decayHalfLife !== undefined) {
            player.paintController.setBrush({
                radius: evt.radius,
                intensity: evt.intensity,
                decayHalfLife: evt.decayHalfLife,
            });
        }
        if (evt.erase !== undefined) {
            player.paintController.setEraseMode(Boolean(evt.erase));
        }
    });

    handlers.set('paint_disable', () => {
        player.paintController?.disable();
    });

    // Captures a full tensor snapshot for later scripted playback by default;
    // pass `restore` (an index or label from a prior capture) to restore one
    // instead.
    handlers.set('paint_snapshot', async (evt) => {
        if (!player.paintController) return;
        if (evt.restore !== undefined) {
            await player.paintController.restoreSnapshot(evt.restore);
        } else {
            await player.paintController.snapshot(evt.label);
        }
    });
}

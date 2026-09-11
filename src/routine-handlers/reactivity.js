// [Neuro-Weaver] Reactivity Router routine events. Lets a routine drive the
// Brain DJ audio->param mapping matrix (src/reactivity-router.js), wired via
// player.reactivityRouter in src/main-reactivity-integration.js. Handlers
// no-op gracefully if it isn't present (e.g. a MockRenderer-based test
// harness).
export function registerReactivityHandlers(handlers, player) {
    handlers.set('reactivity_map', (evt) => {
        if (!player.reactivityRouter) return;
        player.reactivityRouter.applyRoutineEvent(evt);
    });
}

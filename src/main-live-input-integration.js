// main-live-input-integration.js — [Neuro-Weaver] Wires the Live Input Bus
// (src/live-input-bus.js) to the fragments it routes: AudioReactor features,
// BCI band power, and Training Mode metrics. None of those modules are
// rewritten — each is registered as a bus *source* via a small sample()
// closure that reads its already-updated public state, so the bus adds one
// shared mapping table on top instead of a fifth one.
import { LiveInputBus } from './live-input-bus.js';
import { METRICS as TRAINING_METRICS } from './training-engine.js';

/**
 * @param {import('./brain-renderer.js').BrainRenderer} renderer
 * @param {import('./routine-player.js').RoutinePlayer} player
 * @param {import('./audio-reactor.js').AudioReactor} audioReactor
 * @param {import('./bci/bci-session.js').BCISession|null} bciSession
 * @param {import('./training-engine.js').TrainingEngine|null} trainingEngine
 * @param {import('./synaptix-engine.js').SynaptiXEngine|null} synaptixEngine
 */
export function setupLiveInputIntegration(renderer, player, audioReactor, bciSession, trainingEngine, synaptixEngine) {
    const bus = new LiveInputBus(renderer);

    // Source: mic features. AudioReactor.update() is still called from
    // main-update-loop.js (it also drives the legacy ReactivityRouter and the
    // onset->injectStimulus hook); this source just reads the result.
    bus.registerSource('audio', {
        hz: 60,
        features: ['bass', 'energy', 'brightness', 'onset'],
        sample: () => audioReactor.getFeatures(),
    });

    // Source: EEG band power. Populated once a BCI device (or its simulation
    // fallback) has produced at least one feature frame.
    if (bciSession) {
        bus.registerSource('bci', {
            hz: 30,
            features: ['alpha', 'beta', 'gamma'],
            sample: () => bciSession.latestFeatures?.bands || {},
        });
    }

    // Source: the same simulated/live-derived metrics Training Mode courses
    // already sample each frame (src/training-engine.js METRICS). Sampling
    // here is independent of whether a course is running, so calm/alpha/flow
    // are available to the mapping matrix even outside Training Mode.
    const trainingCtx = { renderer, audioReactor, synaptixEngine, bciSession };
    bus.registerSource('training', {
        hz: 30,
        features: Object.keys(TRAINING_METRICS),
        sample: () => {
            const values = {};
            for (const [key, metric] of Object.entries(TRAINING_METRICS)) {
                values[key] = metric.sample(trainingCtx);
            }
            return values;
        },
    });

    if (!bus.loadFromLocalStorage()) {
        bus.enabled = true;
    }

    player.liveInputBus = bus;
    window.__liveInputDebug = { bus };

    return bus;
}

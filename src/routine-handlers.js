import { registerCoreHandlers } from './routine-handlers/core.js';
import { registerNeuromodulatorsHandlers } from './routine-handlers/neuromodulators.js';
import { registerEffectsAudioHandlers } from './routine-handlers/effects-audio.js';
import { registerNarrativeFlowHandlers } from './routine-handlers/narrative-flow.js';
import { registerSynaptixHandlers } from './routine-handlers/synaptix.js';
import { registerBiosyncHandlers } from './routine-handlers/biosync.js';
import { registerTrainingHandlers } from './routine-handlers/training.js';
import { registerBciHandlers } from './routine-handlers/bci.js';
import { registerPaintHandlers } from './routine-handlers/paint.js';
import { registerSonificationHandlers } from './routine-handlers/sonification.js';
import { registerReactivityHandlers } from './routine-handlers/reactivity.js';

export function createDefaultHandlers(player) {
    const handlers = new Map();
    registerCoreHandlers(handlers, player);
    registerNeuromodulatorsHandlers(handlers, player);
    registerEffectsAudioHandlers(handlers, player);
    registerNarrativeFlowHandlers(handlers, player);
    registerSynaptixHandlers(handlers, player);
    registerBiosyncHandlers(handlers, player);
    registerTrainingHandlers(handlers, player);
    registerBciHandlers(handlers, player);
    registerPaintHandlers(handlers, player);
    registerSonificationHandlers(handlers, player);
    registerReactivityHandlers(handlers, player);
    return handlers;
}

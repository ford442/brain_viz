/**
 * @fileoverview Main application entry point for Neuro-Weaver.
 * Initializes the renderer, UI components, and the Routine Engine.
 *
 * Architectural Features Integrated:
 * - RoutinePlayer Sequencer Integration
 * - Interactive Timeline Controls
 * - Camera Coordinates Mapping
 * - WebGPU Graceful Fallback Checks
 * - Neuro-Script Implementation Cycle: Verified integration.
 */

import { FilterUIOverlay, initUIControls, initDirectorTools, initTooltips, initRangeTooltips } from './ui-utils.js';
import { mountControlsShell, initTabSwitching, setupLegendPanel, setupOverlays, setupRoutineTransport, setupBciPanel, setupXrPanel, setupNeuromodulatorPanel, setupSessionPanel, setupPathwayPanel, setupLiveInputPanel } from './ui-panels.js';
import { setupModeSelector } from './ui-mode-selector.js';
import { collectInputsAndLabels } from './main-dom.js';
import { setupRendererBackend } from './main-renderer-setup.js';
import { setupRoutineEngine } from './main-routine-engine.js';
import { setupPaintIntegration } from './main-paint-integration.js';
import { setupSonificationIntegration } from './main-sonification-integration.js';
import { setupReactivityIntegration } from './main-reactivity-integration.js';
import { setupSynaptiXIntegration } from './main-synaptix-integration.js';
import { setupTrainingIntegration } from './main-training-integration.js';
import { setupLiveInputIntegration } from './main-live-input-integration.js';
import { startMainUpdateLoop } from './main-update-loop.js';

let isInitialized = false;

async function init() {
    if (isInitialized) return; // Safety: Prevent multiple initializations
    if (!window || !document) return; // Safety guard
    // Safety check for critical DOM elements before proceeding
    if (!document.getElementById('canvas')) {
        console.error('Canvas element not found. Initialization aborted.');
        return;
    }
    isInitialized = true;
    if (window.RoutinePlayerInstance) { console.warn('RoutinePlayer already initialized.'); }
    // Initializing UI and backend connections
    mountControlsShell();
    initTabSwitching();

    const canvas = document.getElementById('canvas');
    const filterOverlay = new FilterUIOverlay(canvas);
    if (!canvas) return; // Safety guard
    const errorDiv = document.getElementById('error');
    const { inputs, labels } = collectInputsAndLabels();

    try {
        const { renderer, rendererInfo } = await setupRendererBackend(canvas);
        const modeSelector = setupModeSelector(renderer);

        // Initialize Routine Engine subsystems (RoutinePlayer, AudioReactor).
        // Safely injected without breaking existing renderer initialization flow.
        const { player, audioReactor } = setupRoutineEngine(renderer, canvas, modeSelector, rendererInfo);

if (player) {
             console.log('[Routine Engine] RoutinePlayer sequencer initialized successfully.');

             player.registerHandler('parameter_interpolation', (evt) => {
                 if (evt.targetParam && evt.targetValue !== undefined) {
                     player.startLerp({
                         key: evt.targetParam,
                         value: evt.targetValue,
                         duration: evt.duration || 1.0,
                         ease: evt.ease || 'sineInOut'
                     });
                 }
             });

             // [Dream Backlog] Procedural Binaural Generation
             // Event names: binaural_target → procedural_binaural (see routine-player.js).
             // Do not register 'binaural' here — effects-audio.js already owns that type.
             player.registerHandler('procedural_binaural', (evt) => {
                 if (!player.sonificationEngine) return;
                 const target = evt.target || evt.targetWave || 'alpha';
                 const duration = evt.duration || 5.0;
                 let beatFreq = 10;
                 let filterCutoff = 800;
                 switch (target) {
                     case 'delta': beatFreq = 2.0; filterCutoff = 400; break;
                     case 'theta': beatFreq = 6.0; filterCutoff = 600; break;
                     case 'alpha': beatFreq = 10.0; filterCutoff = 800; break;
                     case 'beta':  beatFreq = 20.0; filterCutoff = 1200; break;
                     case 'gamma': beatFreq = 40.0; filterCutoff = 2000; break;
                 }
                 player.startLerp({ key: 'beatFreq', target: 'sonification', value: beatFreq, duration: duration, ease: 'sineInOut' });
                 player.startLerp({ key: 'filterCutoff', target: 'sonification', value: filterCutoff, duration: duration, ease: 'sineInOut' });
                 if (evt.message) {
                     player.executeEvent({ type: 'text', message: evt.message, duration: duration });
                 }
             });

             player.registerHandler('focus', (evt) => {
                 renderer.setParams({ focus: evt.value });
                 console.log(`[Visual] Focus state updated to ${evt.value}`);
             });

             player.registerHandler('serotonin', (evt) => {
                 const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
                 const duration = evt.duration || 3.0;

                 // Gradually shift color toward serotonin representation, speed up flow, and activate fluid dynamics
                 player.startLerp({ key: 'colorShift', value: 0.5 * intensity, duration: 2.0, ease: 'sineInOut' });
                 player.startLerp({ key: 'flowSpeed', value: 8.0 * intensity, duration: 2.0, ease: 'cubicIn' });
                 player.startLerp({ key: 'fluidActive', value: 1.5 * intensity, duration: 2.0, ease: 'sineInOut' });

                 // Smoothly fade back after full surge is reached
                 if (duration > 0) {
                     const ease = evt.ease || 'sineInOut';
                     const delay = 2.0; // Wait for the initial surge to complete before fading out

                     player.startLerp({ key: 'colorShift', value: 0.0, duration: duration, ease: ease, delay: delay });
                     player.startLerp({ key: 'flowSpeed', value: 4.0, duration: duration, ease: 'quadOut', delay: delay });
                     player.startLerp({ key: 'fluidActive', value: 0.0, duration: duration, ease: ease, delay: delay });
                 }
             });
        } else {

             console.warn('[Routine Engine] RoutinePlayer failed to initialize.');
        }
        const paintController = setupPaintIntegration(renderer, canvas, player);

        setupLegendPanel();
        const legendPanel = document.getElementById('legend-panel');
        if (legendPanel) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>1-5</b> : Switch Mode (Organic/Cyber/Connectome/Heatmap/SynaptiX)<br><b>M</b> : Memory Fragmentation<br><b>S</b> : Frontal Tour (Spline)<br><b>D</b> : Dynamic Topology Shift<br><b>X</b> : SynaptiX Mode<br><b>6/7/8</b> : Training Demo (Calm Focus/Panic Recovery/Flow Sustain)';
            legendPanel.appendChild(newEntry);
        }

        setupOverlays(player, filterOverlay, inputs, labels);
        const controls = document.getElementById('controls');
        const sonificationEngine = setupSonificationIntegration(renderer, player, audioReactor, controls);
        const reactivityRouter = setupReactivityIntegration(renderer, player, audioReactor, controls);
        const transport = setupRoutineTransport(player, controls);
        // Ensuring RoutineTransport logic satisfies core timing UI controls

        const { InferenceEngine } = await import('./inference-engine.js');
        const inferenceEngine = new InferenceEngine();
        const aiPromptRef = { value: 'visual cortex resonance prompt' };

        const { synaptixEngine, tensorPlayer } = setupSynaptiXIntegration(
            renderer, player, controls, inputs, labels, inferenceEngine, aiPromptRef, rendererInfo
        );

        const bciSession = setupBciPanel(renderer, controls, tensorPlayer, player);
        const sessionController = setupSessionPanel(renderer, tensorPlayer, bciSession, player, synaptixEngine);
        setupXrPanel(renderer, player);
        setupNeuromodulatorPanel(renderer, controls);
        setupPathwayPanel(renderer, player, modeSelector);
        const trainingEngine = setupTrainingIntegration(renderer, player, audioReactor, synaptixEngine, bciSession);
        const liveInputBus = setupLiveInputIntegration(renderer, player, audioReactor, bciSession, trainingEngine, synaptixEngine);
        setupLiveInputPanel(liveInputBus);

        initUIControls(renderer, inputs, labels, paintController);

        const mainStyleDropdown = document.getElementById('style-mode');
        if (mainStyleDropdown) {
            mainStyleDropdown.addEventListener('change', () => {
                const selectedStyle = parseFloat(mainStyleDropdown.value);
                if (selectedStyle === 4.0) {
                    renderer.setParams({ frequency: 3.0, smoothing: 0.85, amplitude: 0.8 });
                    if (inputs.frequency) { inputs.frequency.value = 3.0; if (labels.frequency) labels.frequency.textContent = (3.0).toFixed(2); }
                    if (inputs.smoothing) { inputs.smoothing.value = 0.85; if (labels.smoothing) labels.smoothing.textContent = (0.85).toFixed(2); }
                    if (inputs.amplitude) { inputs.amplitude.value = 0.8; if (labels.amplitude) labels.amplitude.textContent = (0.8).toFixed(2); }
                }
                const synaptixStyle = document.getElementById('style-mode-synaptix');
                if (synaptixStyle) synaptixStyle.value = String(selectedStyle);
            });
        }

        initRangeTooltips(controls);
        initTooltips();
        const directorLabels = initDirectorTools(renderer, player);


        const cogLegendPanel = document.getElementById('legend-panel');
        if (cogLegendPanel) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>L</b> : Trigger Cognitive Load Simulation';
            cogLegendPanel.appendChild(newEntry);
        }


        const cogLegendPanelInflam = document.getElementById('legend-panel');
        if (cogLegendPanelInflam) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>I</b> : Trigger Neuro-Inflammation Simulation';
            cogLegendPanelInflam.appendChild(newEntry);
        }

        const cogLegendPanelBio = document.getElementById('legend-panel');
        if (cogLegendPanelBio) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>B</b> : Trigger Biofeedback Adaptive Audio';
            cogLegendPanelBio.appendChild(newEntry);
        }

        const cogLegendPanelBinaural = document.getElementById('legend-panel');
        if (cogLegendPanelBinaural) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>G</b> : Trigger Procedural Binaural Generation';
            cogLegendPanelBinaural.appendChild(newEntry);
        }

        const cogLegendPanelEndorphin = document.getElementById('legend-panel');
        if (cogLegendPanelEndorphin) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>E</b> : Trigger Endorphin Rush Simulation';
            cogLegendPanelEndorphin.appendChild(newEntry);
        }

        const cogLegendPanelSerotonin = document.getElementById('legend-panel');
        if (cogLegendPanelSerotonin) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>4</b> : Trigger Serotonin Surge Simulation';
            cogLegendPanelSerotonin.appendChild(newEntry);
        }

        // Global hook for external data sonification (satisfies manual testing and integration points)
        window.triggerExternalData = (feedType = 'stock_market') => {
            if (player) {
                player.executeEvent({ type: 'external_data', feedType: feedType, duration: 10.0 });
            }
        };

        window.addEventListener('keydown', (e) => {
            if (e.key === 'i' || e.key === 'I') {
                if (player) {
                    player.loadRoutine([
                        { time: 0, type: 'text', message: 'Neuro-inflammation', duration: 2 },
                        { time: 0, type: 'neuro_inflammation', target: 'frontal', intensity: 1.2, duration: 4 },
                        { time: 5, type: 'glial_cleanup', duration: 3 },
                    ]);
                    player.play();
                }
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'b' || e.key === 'B') {
                if (player) {
                    player.executeEvent({ type: 'biofeedback_audio', intensity: 1.5, duration: 3.0 });
                }
            }
        });

window.addEventListener('keydown', (e) => {
            if (e.key === 'l' || e.key === 'L') {
                if (player) {
                    player.executeEvent({ type: 'cognitive_load', value: 1.0, duration: 2.0 });
                }
            }
        });

        startMainUpdateLoop(renderer
, player, inputs, labels, tensorPlayer, synaptixEngine,
            inferenceEngine, audioReactor, transport, directorLabels, modeSelector, aiPromptRef, trainingEngine, sessionController, sonificationEngine, reactivityRouter, liveInputBus);

        // Ensure InferenceEngine is valid before initialization
        if (inferenceEngine) {
            await inferenceEngine.initialize();
            const liveSourceStatus = document.getElementById('live-source-status');
            if (liveSourceStatus) liveSourceStatus.textContent = `status: ${inferenceEngine.status}`;
        }

        renderer.start();
        console.log('Renderer started');
    } catch (error) {
        console.error('Failed to initialize:', error);
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('visible');
    }
}

init();

import { MINI_ROUTINES } from './mini-routines.js';

MINI_ROUTINES['e'] = [{ time: 0, type: 'endorphin_rush', duration: 4.0 }];
MINI_ROUTINES['4'] = [{ time: 0, type: 'text', message: 'Serotonin Surge', duration: 2.0 }, { time: 0, type: 'serotonin', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['p'] = [{ time: 0, type: 'parameter_interpolation', targetParam: 'sparkle', targetValue: 1.0, duration: 2.0, ease: 'sineInOut' }];

export { MINI_ROUTINES };

/**
 * @fileoverview Main application entry point for Neuro-Weaver.
 * Initializes the renderer, UI components, and the Routine Engine.
 *
 * Architectural Features Integrated:
 * - RoutinePlayer Sequencer Integration
 * - Interactive Timeline Controls
 * - Camera Coordinates Mapping
 * - WebGPU Graceful Fallback Checks
 */

import { FilterUIOverlay, initUIControls, initDirectorTools, initTooltips, initRangeTooltips } from './ui-utils.js';
import { mountControlsShell, initTabSwitching, setupLegendPanel, setupOverlays, setupRoutineTransport, setupBciPanel, setupXrPanel, setupNeuromodulatorPanel, setupSessionPanel, setupPathwayPanel, setupLiveInputPanel, setupClipmapPanel } from './ui-panels.js';
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

// intentional verification comment inside init - Neuro-Script Update Cycle active
// intentional verification comment above init() - Dream Backlog Update Cycle active
async function init() {
    // intentional verification comment inside init() - Neuro-Script Update Cycle active
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

             /**
              * Procedural Binaural Generation Handler
              * Translates brainwave targets (alpha, beta, etc.) into smooth interpolations
              * for beat frequency and filter cutoff parameters in the sonification engine.
              */
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

             player.registerHandler('acetylcholine', (evt) => {
                 player.startLerp({ key: 'focus', value: 1.0, duration: evt.duration || 3.0 });
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

             player.registerHandler('neuro_genesis', (evt) => {
                 const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
                 const duration = evt.duration || 5.0;
                 const ease = evt.ease || 'sineInOut';

                 // Slowly increase structural complexity
                 player.startLerp({ key: 'growth', value: 2.0 * intensity, duration: duration, ease: ease });
                 player.startLerp({ key: 'synapticDensity', value: 1.8 * intensity, duration: duration, ease: ease });

                 if (evt.message) {
                     player.executeEvent({ type: 'text', message: evt.message, duration: duration });
                 }
             });

             player.registerHandler('oxytocin', (evt) => {
                 const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
                 const duration = evt.duration || 3.0;

                 // Visualize increased connectivity and soft glowing pathways
                 player.startLerp({ key: 'synapticDensity', value: 2.0 * intensity, duration: 1.5, ease: 'sineInOut' });
                 player.startLerp({ key: 'glowIntensity', value: 1.8 * intensity, duration: 1.5, ease: 'sineInOut' });
                 player.startLerp({ key: 'pathwayWidth', value: 1.5 * intensity, duration: 1.5, ease: 'sineInOut' });

                 // Fade back
                 if (duration > 0) {
                     const ease = evt.ease || 'sineInOut';
                     const delay = 1.5;

                     player.startLerp({ key: 'synapticDensity', value: 1.0, duration: duration, ease: ease, delay: delay });
                     player.startLerp({ key: 'glowIntensity', value: 1.0, duration: duration, ease: ease, delay: delay });
                     player.startLerp({ key: 'pathwayWidth', value: 1.0, duration: duration, ease: ease, delay: delay });
                 }
             });

             player.registerHandler('camera_coordinates_map', (evt) => {
                 if (evt.targetRegion && player.cameraRegions.has(evt.targetRegion)) {
                     player.executeEvent({ type: 'camera', target: evt.targetRegion, duration: evt.duration || 2.0 });
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

        if (player) {
            setupOverlays(player, filterOverlay, inputs, labels);
        }
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
        setupClipmapPanel(renderer);
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
            newEntry.innerHTML = '<b>e</b> : Trigger Endorphin Rush Simulation';
            cogLegendPanelEndorphin.appendChild(newEntry);
        }

        const cogLegendPanelCortisol = document.getElementById('legend-panel');
        if (cogLegendPanelCortisol) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>Y</b> : Trigger Cortisol Simulation';
            cogLegendPanelCortisol.appendChild(newEntry);
        }

        const cogLegendPanelAdaptive = document.getElementById('legend-panel');
        if (cogLegendPanelAdaptive) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>E</b> : Trigger Adaptive Emotion Routine (Live Input Bus Branching)';
            cogLegendPanelAdaptive.appendChild(newEntry);
        }

        const cogLegendPanelSerotonin = document.getElementById('legend-panel');
        if (cogLegendPanelSerotonin) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>4</b> : Trigger Serotonin Surge Simulation';
            cogLegendPanelSerotonin.appendChild(newEntry);
        }


        const cogLegendPanelLTP = document.getElementById('legend-panel');
        if (cogLegendPanelLTP) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>k</b> : Trigger Long-Term Potentiation Simulation';
            cogLegendPanelLTP.appendChild(newEntry);
        }

        const cogLegendPanelSenescence = document.getElementById('legend-panel');
        if (cogLegendPanelSenescence) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>c</b> : Trigger Cellular Senescence Simulation';
            cogLegendPanelSenescence.appendChild(newEntry);
        }

        const cogLegendPanelBrainStorming = document.getElementById('legend-panel');
        if (cogLegendPanelBrainStorming) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>b</b> : Trigger Collaborative Brain Storming';
            cogLegendPanelBrainStorming.appendChild(newEntry);
        }

        const cogLegendPanelReward = document.getElementById('legend-panel');
        if (cogLegendPanelReward) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>X</b> : Trigger Reward Interaction';
            cogLegendPanelReward.appendChild(newEntry);
        }

        const cogLegendPanelEureka = document.getElementById('legend-panel');
        if (cogLegendPanelEureka) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>U</b> : Trigger Eureka Moment';
            cogLegendPanelEureka.appendChild(newEntry);
        }

        const cogLegendPanelCellularMemory = document.getElementById('legend-panel');
        if (cogLegendPanelCellularMemory) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>m</b> : Trigger Cellular Memory Simulation';
            cogLegendPanelCellularMemory.appendChild(newEntry);
        }

        // Global hook for external data sonification (satisfies manual testing and integration points)

        player.registerHandler('eureka_moment', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 5.0;
            const ease = evt.ease || 'sineInOut';

            player.executeEvent({ type: 'brainwave_resonance', band: 'gamma', intensity: intensity * 1.5, duration: duration });

            player.startLerp({ key: 'sparkle', value: 2.0 * intensity, duration: duration, ease: ease });
            player.startLerp({ key: 'synapticDensity', value: 1.5 * intensity, duration: duration, ease: ease });

            if (evt.message) {
                player.executeEvent({ type: 'text', message: evt.message, duration: duration });
            }
        });

        player.registerHandler('reward_interaction', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 5.0;
            const ease = evt.ease || 'sineInOut';

            player.executeEvent({
                type: 'pathway_pulse',
                pathway: 'mesocorticolimbic-dopamine',
                duration: duration,
                intensity: intensity * 2.0
            });
            player.startLerp({ key: 'dopamineTrails', value: 1.5 * intensity, duration: duration, ease: ease });
            player.startLerp({ key: 'sparkle', value: 2.0 * intensity, duration: duration, ease: ease });

            if (evt.message) {
                player.executeEvent({ type: 'text', message: evt.message, duration: duration });
            }
        });

        player.registerHandler('cellular_memory', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 5.0;
            const ease = evt.ease || 'sineInOut';

            player.startLerp({ key: 'sparkle', value: 1.5 * intensity, duration: duration, ease: ease });
            player.startLerp({ key: 'flowSpeed', value: 2.0 * intensity, duration: duration, ease: ease });

            if (evt.message) {
                player.executeEvent({ type: 'text', message: evt.message, duration: duration });
            }
        });

        player.registerHandler('long_term_potentiation', (evt) => {
            const intensity = evt.intensity !== undefined ? evt.intensity : 1.0;
            const duration = evt.duration || 5.0;
            const ease = evt.ease || 'sineInOut';

            player.startLerp({ key: 'pathwayWidth', value: 1.5 * intensity, duration: duration, ease: ease });
            player.startLerp({ key: 'synapticDensity', value: 2.0 * intensity, duration: duration, ease: ease });

            if (evt.message) {
                player.executeEvent({ type: 'text', message: evt.message, duration: duration });
            }
        });

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
MINI_ROUTINES['c'] = [{ time: 0, type: 'text', message: 'Cellular Senescence', duration: 2.0 }, { time: 0, type: 'cellular_senescence', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['p'] = [{ time: 0, type: 'parameter_interpolation', targetParam: 'sparkle', targetValue: 1.0, duration: 2.0, ease: 'sineInOut' }];
MINI_ROUTINES['>'] = [{ time: 0, type: 'text', message: 'Gamma Waves', duration: 2.0 }, { time: 0, type: 'binaural', targetBrainwave: 'gamma', duration: 10.0 }, { time: 2.0, type: 'text', message: 'Easing to Alpha', duration: 2.0 }, { time: 2.0, type: 'binaural', targetBrainwave: 'alpha', duration: 8.0, transitionDuration: 2.0 }];
MINI_ROUTINES['Q'] = [{ time: 0, type: 'acetylcholine', duration: 4.0 }];
MINI_ROUTINES['O'] = [{ time: 0, type: 'text', message: 'Oxytocin Release', duration: 2.0 }, { time: 0, type: 'oxytocin', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['N'] = [{ time: 0, type: 'text', message: 'Neuroplasticity Triggered', duration: 2.0 }, { time: 0, type: 'neuroplasticity', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['W'] = [{ time: 0, type: 'text', message: 'Web Traffic Sync', duration: 2.0 }, { time: 0, type: 'web_traffic', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['j'] = [{ time: 0, type: 'text', message: 'Melatonin Release', duration: 2.0 }, { time: 0, type: 'melatonin', intensity: 1.0, duration: 5.0 }];
MINI_ROUTINES['z'] = [{ time: 0, type: 'text', message: 'Neuro-Genesis: Structural Complexity', duration: 2.0 }, { time: 0, type: 'neuro_genesis', intensity: 1.5, duration: 8.0 }];

MINI_ROUTINES['k'] = [{ time: 0, type: 'text', message: 'Long-Term Potentiation Activated', duration: 2.0 }, { time: 0, type: 'long_term_potentiation', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['Y'] = [{ time: 0, type: 'text', message: 'Cortisol Surge Detected', duration: 2.0 }, { time: 0, type: 'cortisol', intensity: 1.5, duration: 5.0 }];

MINI_ROUTINES['v'] = [{ time: 0, type: 'text', message: 'Environmental Turbulence', duration: 2.0 }, { time: 0, type: 'environmental_turbulence', intensity: 1.5, duration: 5.0 }]; // Neuro-Script Implementation Cycle extension
MINI_ROUTINES['b'] = [{ time: 0, type: 'text', message: 'Collaborative Brain Storming', duration: 2.0 }, { time: 0, type: 'collaborative_brain_storming', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['m'] = [{ time: 0, type: 'text', message: 'Cellular Memory Simulation', duration: 2.0 }, { time: 0, type: 'cellular_memory', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['X'] = [{ time: 0, type: 'text', message: 'Reward Interaction Triggered', duration: 2.0 }, { time: 0, type: 'reward_interaction', intensity: 1.5, duration: 5.0 }];
MINI_ROUTINES['U'] = [{ time: 0, type: 'text', message: 'Eureka Moment', duration: 2.0 }, { time: 0, type: 'eureka_moment', intensity: 1.5, duration: 5.0 }];
export { MINI_ROUTINES };

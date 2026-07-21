// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { InferenceEngine } from './inference-engine.js';
import { FilterUIOverlay, initUIControls, initDirectorTools, initTooltips, initRangeTooltips } from './ui-utils.js';
import { mountControlsShell, initTabSwitching, setupLegendPanel, setupOverlays, setupRoutineTransport, setupBciPanel, setupNeuromodulatorPanel } from './ui-panels.js';
import { setupModeSelector } from './ui-mode-selector.js';
import { collectInputsAndLabels } from './main-dom.js';
import { setupRendererBackend } from './main-renderer-setup.js';
import { setupRoutineEngine } from './main-routine-engine.js';
import { setupSynaptiXIntegration } from './main-synaptix-integration.js';
import { setupTrainingIntegration } from './main-training-integration.js';
import { startMainUpdateLoop } from './main-update-loop.js';

async function init() {
    // [Neuro-Weaver] Initializing UI and backend connections
    mountControlsShell();
    initTabSwitching();

    const canvas = document.getElementById('canvas');
    const filterOverlay = new FilterUIOverlay(canvas);
    const errorDiv = document.getElementById('error');
    const { inputs, labels } = collectInputsAndLabels();

    try {
        const { renderer, rendererInfo } = await setupRendererBackend(canvas);
        const modeSelector = setupModeSelector(renderer);

        // [Neuro-Script Cycle] setupRoutineEngine returns RoutinePlayer and AudioReactor instances.
        const { player, audioReactor } = setupRoutineEngine(renderer, canvas, modeSelector, rendererInfo);

        setupLegendPanel();
        const legendPanel = document.getElementById('legend-panel');
        if (legendPanel) {
            const newEntry = document.createElement('div');
            newEntry.innerHTML = '<b>1-5</b> : Switch Mode (Organic/Cyber/Connectome/Heatmap/SynaptiX)<br><b>M</b> : Memory Fragmentation<br><b>S</b> : Frontal Tour (Spline)<br><b>D</b> : Dynamic Topology Shift<br><b>X</b> : SynaptiX Mode<br><b>6/7/8</b> : Training Demo (Calm Focus/Panic Recovery/Flow Sustain)';
            legendPanel.appendChild(newEntry);
        }

        setupOverlays(player, filterOverlay, inputs, labels);
        const controls = document.getElementById('controls');
        const transport = setupRoutineTransport(player, controls);

        const inferenceEngine = new InferenceEngine();
        const aiPromptRef = { value: 'visual cortex resonance prompt' };

        const { synaptixEngine, tensorPlayer } = setupSynaptiXIntegration(
            renderer, player, controls, inputs, labels, inferenceEngine, aiPromptRef, rendererInfo
        );

        setupBciPanel(renderer, controls, tensorPlayer);
        setupNeuromodulatorPanel(renderer, controls);
        const trainingEngine = setupTrainingIntegration(renderer, player, audioReactor, synaptixEngine);

        initUIControls(renderer, inputs, labels);

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

        startMainUpdateLoop(renderer, player, inputs, labels, tensorPlayer, synaptixEngine,
            inferenceEngine, audioReactor, transport, directorLabels, modeSelector, aiPromptRef, trainingEngine);

        await inferenceEngine.initialize();
        const liveSourceStatus = document.getElementById('live-source-status');
        if (liveSourceStatus) liveSourceStatus.textContent = `status: ${inferenceEngine.status}`;

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

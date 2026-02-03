// Main application entry point
// Neuro-Weaver V2.6 Implementation - Volumetric Renderer
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';

async function init() {
    // [V2.6] Initialize UI and Renderer
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth'),
        sliceZ: document.getElementById('clip'),
        flowSpeed: document.getElementById('speed'), // V2.3
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        sliceZ: document.getElementById('val-clip'),
        flowSpeed: document.getElementById('val-speed') // V2.3
    };
    
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
        // Initialize AI components
        const inferenceEngine = new InferenceEngine();
        const aiEnabled = await inferenceEngine.initialize();
        let aiMode = false;

        // Add AI toggle button
        const aiToggle = document.createElement('button');
        aiToggle.textContent = 'Enable AI "Dreaming"';
        aiToggle.style.background = '#424';
        aiToggle.style.borderColor = '#d0d';
        aiToggle.style.color = '#eaffea';
        aiToggle.onclick = () => {
            aiMode = !aiMode;
            aiToggle.textContent = aiMode ? 'Disable AI Mode' : 'Enable AI "Dreaming"';
            aiToggle.style.background = aiMode ? '#626' : '#424';
        };
        const controls = document.getElementById('controls');
        controls.appendChild(document.createElement('hr'));
        controls.appendChild(aiToggle);

        // [Neuro-Weaver] Refactored: Setup UI Controls
        initUIControls(renderer, inputs, labels);

        console.log('Starting renderer... V2.6 Active');

        // --- AI LOOP ---
        const classMap = new Float32Array(1000 * 3);
        for(let i=0; i<3000; i++) {
            classMap[i] = (Math.random() - 0.5) * 2.0;
        }

        const runAI = async () => {
            if (aiMode && aiEnabled) {
                const topK = await inferenceEngine.runInference();
                if (topK) {
                    topK.forEach(item => {
                        const idx = item.index;
                        const strength = item.value * 0.5;
                        const x = classMap[idx*3];
                        const y = classMap[idx*3+1];
                        const z = classMap[idx*3+2];
                        renderer.injectStimulus(x, y, z, strength);
                    });
                }
            }
            setTimeout(runAI, 100);
        };
        runAI();

        renderer.start();
        console.log('Renderer started');

    } catch (error) {
        console.error('Failed to initialize:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

// [Neuro-Weaver] Refactored: Modular UI Initialization (V2.7)
function initUIControls(renderer, uiInputs, uiLabels) {
    // Helper to update renderer and label
    const syncParam = (paramKey, paramValue) => {
        const floatVal = parseFloat(paramValue);
        renderer.setParams({ [paramKey]: floatVal });
        if (uiLabels[paramKey]) uiLabels[paramKey].textContent = floatVal.toFixed(2);
    };

    // 1. Parameter Sliders (Reactive Inputs)
    Object.keys(uiInputs).forEach(key => {
        const inputEl = uiInputs[key];
        if (!inputEl) return;

        // Set initial value from DOM
        syncParam(key, inputEl.value);

        // Skip event listener for Select elements (handled separately)
        if (inputEl.tagName === 'SELECT') return;

        inputEl.addEventListener('input', (evt) => {
            syncParam(key, evt.target.value);
        });
    });

    // 2. Style Selection Logic (Visualization Modes)
    const styleDropdown = document.getElementById('style-mode');
    if (styleDropdown) {
        styleDropdown.addEventListener('change', (evt) => {
            const selectedStyle = parseFloat(evt.target.value);
            renderer.setParams({ style: selectedStyle });

            // [Neuro-Weaver] Apply Style Presets (V2.7 Refined)
            const stylePresets = {
                3: { amplitude: 1.0, smoothing: 0.95 }, // Heatmap (Volumetric)
                2: { frequency: 8.0, smoothing: 0.2, amplitude: 1.5 }, // Connectome (Fibers)
                1: { frequency: 5.0, smoothing: 0.5 }, // Cyber (Digital)
                0: { frequency: 2.0, smoothing: 0.9 } // Organic (Surface)
            };

            const activePreset = stylePresets[selectedStyle] || stylePresets[0];
            Object.keys(activePreset).forEach(pKey => {
                renderer.setParams({ [pKey]: activePreset[pKey] });
                if(uiInputs[pKey]) uiInputs[pKey].value = activePreset[pKey];
                syncParam(pKey, activePreset[pKey]);
            });
        });
    }

    // 3. Region Stimulation Controls (Anatomical Mapping)
    const bindStimulusButtons = () => {
        // Anatomical Region Configuration
        const brainRegions = [
            { id: 'stim-frontal', pos: [0, 0, 1.2], label: 'Frontal Lobe' },
            { id: 'stim-occipital', pos: [0, 0, -1.2], label: 'Occipital Lobe' },
            { id: 'stim-parietal', pos: [0, 1.0, 0], label: 'Parietal Lobe' },
            { id: 'stim-temporal', pos: [1.0, 0, 0], label: 'Temporal Lobe' },
            { id: 'stim-deep', pos: [0, 0, 0], label: 'Deep Structure' }
        ];

        brainRegions.forEach(region => {
            const btnEl = document.getElementById(region.id);
            if (btnEl) {
                btnEl.addEventListener('click', () => {
                    // [Neuro-Weaver] Inject Pulse at defined coordinates
                    renderer.injectStimulus(...region.pos, 1.0);
                });
            }
        });

        // Random Stimulus
        const randomBtn = document.getElementById('stim-random');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                renderer.injectStimulus(
                    (Math.random() - 0.5) * 2.0,
                    (Math.random() - 0.5) * 2.0,
                    (Math.random() - 0.5) * 2.0,
                    1.0
                );
            });
        }

        // Calm State
        const calmBtn = document.getElementById('stim-calm');
        if (calmBtn) {
            calmBtn.addEventListener('click', () => {
                renderer.calmState();
                // Sync UI sliders
                ['amplitude', 'frequency', 'smoothing'].forEach(k => {
                    if(uiInputs[k]) uiInputs[k].value = renderer.params[k];
                    syncParam(k, renderer.params[k]);
                });
            });
        }

        // Reset Activity
        const resetBtn = document.getElementById('stim-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => renderer.resetActivity());
        }
    };

    bindStimulusButtons();
}

init();
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

// [Neuro-Weaver] Refactored: Modular UI Initialization
function initUIControls(renderer, inputs, labels) {
    // Helper to update renderer and label
    const updateParam = (key, value) => {
        const numVal = parseFloat(value);
        renderer.setParams({ [key]: numVal });
        if (labels[key]) labels[key].textContent = numVal.toFixed(2);
    };

    // 1. Parameter Sliders
    Object.keys(inputs).forEach(key => {
        const input = inputs[key];
        if (!input) return;

        // Set initial value
        updateParam(key, input.value);

        if (input.tagName === 'SELECT') return;

        input.addEventListener('input', (e) => {
            updateParam(key, e.target.value);
        });
    });

    // 2. Style Selection Logic
    const styleSelect = document.getElementById('style-mode');
    if (styleSelect) {
        styleSelect.addEventListener('change', (e) => {
            const val = parseFloat(e.target.value);
            renderer.setParams({ style: val });

            // [Neuro-Weaver] Apply Style Presets
            const presets = {
                3: { amplitude: 1.0, smoothing: 0.95 }, // Heatmap
                2: { frequency: 8.0, smoothing: 0.2, amplitude: 1.5 }, // Connectome
                1: { frequency: 5.0, smoothing: 0.5 }, // Cyber
                0: { frequency: 2.0, smoothing: 0.9 } // Organic
            };

            const preset = presets[val] || presets[0];
            Object.keys(preset).forEach(k => {
                renderer.setParams({ [k]: preset[k] });
                if(inputs[k]) inputs[k].value = preset[k];
                updateParam(k, preset[k]);
            });
        });
    }

    // 3. Region Stimulation Controls (Refactored for V2.6)
    const setupButtonListeners = () => {
        // Anatomical Region Configuration
        const regionConfig = [
            { id: 'stim-frontal', pos: [0, 0, 1.2], label: 'Frontal Lobe' },
            { id: 'stim-occipital', pos: [0, 0, -1.2], label: 'Occipital Lobe' },
            { id: 'stim-parietal', pos: [0, 1.0, 0], label: 'Parietal Lobe' },
            { id: 'stim-temporal', pos: [1.0, 0, 0], label: 'Temporal Lobe' },
            { id: 'stim-deep', pos: [0, 0, 0], label: 'Deep Structure' }
        ];

        regionConfig.forEach(conf => {
            const btn = document.getElementById(conf.id);
            if (btn) {
                btn.addEventListener('click', () => {
                    // [Neuro-Weaver] Inject Pulse at defined coordinates
                    renderer.injectStimulus(...conf.pos, 1.0);
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
                    if(inputs[k]) inputs[k].value = renderer.params[k];
                    updateParam(k, renderer.params[k]);
                });
            });
        }

        // Reset Activity
        const resetBtn = document.getElementById('stim-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => renderer.resetActivity());
        }
    };

    setupButtonListeners();
}

init();
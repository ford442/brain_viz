// Main application entry point
// Neuro-Weaver V2 Implementation
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';

async function init() {
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth'),
        clipZ: document.getElementById('clip'),
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        clipZ: document.getElementById('val-clip')
    };
    
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
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
        document.getElementById('controls').appendChild(document.createElement('hr'));
        document.getElementById('controls').appendChild(aiToggle);

        // Helper to update renderer and label
        const updateParam = (key, value) => {
            const numVal = parseFloat(value);
            renderer.setParams({ [key]: numVal });
            if (labels[key]) labels[key].textContent = numVal.toFixed(2);
        };

        // Attach listeners
        Object.keys(inputs).forEach(key => {
            const input = inputs[key];
            if (!input) return;

            // Set initial value
            updateParam(key, input.value);
            
            // Special handling for style dropdown which isn't range
            if (input.tagName === 'SELECT') return;

            input.addEventListener('input', (e) => {
                updateParam(key, e.target.value);
            });
        });

        // Style dropdown listener
        const styleSelect = document.getElementById('style-mode');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value);
                renderer.setParams({ style: val });

                // Style Presets
                if (val === 3) { // Heatmap
                    renderer.setParams({ amplitude: 1.0, smoothing: 0.95 });
                    inputs.amplitude.value = 1.0;
                    inputs.smoothing.value = 0.95;
                    updateParam('amplitude', 1.0);
                    updateParam('smoothing', 0.95);
                }
                else if (val === 2) { // Connectome Preset
                    renderer.setParams({ frequency: 8.0, smoothing: 0.2, amplitude: 1.5 });
                    inputs.frequency.value = 8.0;
                    inputs.smoothing.value = 0.2;
                    inputs.amplitude.value = 1.5;
                    updateParam('frequency', 8.0);
                    updateParam('smoothing', 0.2);
                    updateParam('amplitude', 1.5);
                } else if (val === 1) { // Cyber preset
                    renderer.setParams({ frequency: 5.0, smoothing: 0.5 });
                    inputs.frequency.value = 5.0;
                    inputs.smoothing.value = 0.5;
                    updateParam('frequency', 5.0);
                    updateParam('smoothing', 0.5);
                } else { // Organic preset
                    renderer.setParams({ frequency: 2.0, smoothing: 0.9 });
                    inputs.frequency.value = 2.0;
                    inputs.smoothing.value = 0.9;
                    updateParam('frequency', 2.0);
                    updateParam('smoothing', 0.9);
                }
            });
        }

        // --- STIMULUS BUTTONS ---
        const stimBtns = {
            'stim-frontal': [0, 0, 1.2],
            'stim-occipital': [0, 0, -1.2],
            'stim-parietal': [0, 1.0, 0],
            'stim-temporal': [1.0, 0, 0],
            'stim-deep': [0, 0, 0],
        };

        Object.keys(stimBtns).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    const pos = stimBtns[id];
                    // Strong pulse
                    renderer.triggerStimulus(pos[0], pos[1], pos[2], 1.0);
                });
            }
        });

        document.getElementById('stim-random').addEventListener('click', () => {
             const x = (Math.random() - 0.5) * 2.0;
             const y = (Math.random() - 0.5) * 2.0;
             const z = (Math.random() - 0.5) * 2.0;
             renderer.triggerStimulus(x, y, z, 1.0);
        });

        console.log('Starting renderer... V2 Active');

        // --- AI LOOP ---
        // Map 1000 classes to random 3D positions in the brain
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
                        // Use value strength
                        const strength = item.value * 0.5; // Scale down a bit
                        const x = classMap[idx*3];
                        const y = classMap[idx*3+1];
                        const z = classMap[idx*3+2];
                        renderer.triggerStimulus(x, y, z, strength);
                    });
                }
            }
            // Run every 100ms
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

init();

// Main application entry point
// Neuro-Weaver V2.3 Implementation - Volumetric Renderer
import { BrainRenderer } from './brain-renderer.js';

async function init() {
    // [V2.3] Initialize UI and Renderer
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth'),
        clipZ: document.getElementById('clip'),
        flowSpeed: document.getElementById('speed'), // V2.3
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        clipZ: document.getElementById('val-clip'),
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
        
        // [Neuro-Weaver] Refactored: Setup UI Controls
        setupControls(renderer, inputs, labels);

        console.log('Starting renderer... V2.3 Active');
        renderer.start();
        console.log('Renderer started');

    } catch (error) {
        console.error('Failed to initialize:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

function setupControls(renderer, inputs, labels) {
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

    // --- STIMULUS BUTTONS (V2.2 UI) ---
    // Maps UI buttons to 3D brain coordinates for stimulus injection.
    // Verified: Coordinates target specific anatomical lobe regions.
    const stimBtns = {
        'stim-frontal': [0, 0, 1.2],
        'stim-occipital': [0, 0, -1.2],
        'stim-parietal': [0, 1.0, 0],
        'stim-temporal': [1.0, 0, 0],
        'stim-deep': [0, 0, 0],
    };

    // V2.2: Attach event listeners to stimulus buttons
    // [V2.3] Setup Anatomical Region Buttons
    // [Neuro-Weaver] UI Control: Maps anatomical buttons to 3D coordinates
    Object.keys(stimBtns).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                const pos = stimBtns[id];
                // [Neuro-Weaver] Action: Trigger strong pulse at target region
                renderer.injectStimulus(pos[0], pos[1], pos[2], 1.0);
            });
        }
    });

    // [V2.3] Random Stimulus
    const randomBtn = document.getElementById('stim-random');
    if (randomBtn) {
        randomBtn.addEventListener('click', () => {
            const x = (Math.random() - 0.5) * 2.0;
            const y = (Math.random() - 0.5) * 2.0;
            const z = (Math.random() - 0.5) * 2.0;
            renderer.injectStimulus(x, y, z, 1.0);
        });
    }

    // Calm State Button
    const calmBtn = document.getElementById('stim-calm');
    if (calmBtn) {
        calmBtn.addEventListener('click', () => {
            renderer.calmState();
            // Update UI sliders to reflect calm state
            inputs.amplitude.value = renderer.params.amplitude;
            inputs.frequency.value = renderer.params.frequency;
            inputs.smoothing.value = renderer.params.smoothing;
            updateParam('amplitude', renderer.params.amplitude);
            updateParam('frequency', renderer.params.frequency);
            updateParam('smoothing', renderer.params.smoothing);
        });
    }

    // Reset Activity Button
    const resetBtn = document.getElementById('stim-reset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            renderer.resetActivity();
        });
    }
}

init();

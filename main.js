// Main application entry point
import { BrainRenderer } from './brain-renderer.js';

async function init() {
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth')
        , style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth')
    };
    
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
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
            
            input.addEventListener('input', (e) => {
                updateParam(key, e.target.value);
            });
        });

        // Style dropdown separate listener (change event)
        const styleSelect = document.getElementById('style-mode');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value);
                renderer.setParams({ style: val });
                if (val === 1) {
                    // Cyber preset
                    inputs.frequency.value = 5.0;
                    inputs.smoothing.value = 0.5;
                    updateParam('frequency', 5.0);
                    updateParam('smoothing', 0.5);
                } else {
                    // Organic preset
                    inputs.frequency.value = 2.0;
                    inputs.smoothing.value = 0.9;
                    updateParam('frequency', 2.0);
                    updateParam('smoothing', 0.9);
                }
            });
        }

        renderer.start();
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

init();

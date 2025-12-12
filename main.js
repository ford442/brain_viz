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

        renderer.start();
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

init();

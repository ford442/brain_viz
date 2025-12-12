// Main application entry point
import { BrainRenderer } from './brain-renderer.js';

async function init() {
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // Check WebGPU support
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser. Please use Chrome Canary or another compatible browser.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        renderer.start();
    } catch (error) {
        console.error('Failed to initialize brain renderer:', error);
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
    }
}

init();

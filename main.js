// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]

async function init() {
    const canvas = document.getElementById('canvas');
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth'),
        sliceZ: document.getElementById('clip'),
        flowSpeed: document.getElementById('speed'),
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        sliceZ: document.getElementById('val-clip'),
        flowSpeed: document.getElementById('val-speed')
    };
    
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser.';
        errorDiv.style.display = 'block';
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
        // --- 1. SETUP ROUTINE PLAYER ---
        // Define region map for easy scripting
        const regionMap = {
            'frontal': [0, 0, 1.2],
            'occipital': [0, 0, -1.2],
            'parietal': [0, 1.0, 0],
            'temporal': [1.0, 0, 0],
            'deep': [0, 0, 0]
        };

        const player = new RoutinePlayer(renderer, regionMap);

        // Sync UI when routine executes events
        player.onEvent = (event) => {
             if (event.type === 'style') {
                 if (inputs.style) inputs.style.value = event.value;
             }
             if (event.type === 'param') {
                 if (inputs[event.key]) inputs[event.key].value = event.value;
                 if (labels[event.key]) labels[event.key].textContent = event.value.toFixed(2);
             }
             if (event.type === 'calm') {
                 // Calm state modifies amplitude, frequency, smoothing
                 // We should sync them if they are in the renderer params
                 ['amplitude', 'frequency', 'smoothing'].forEach(k => {
                    if (inputs[k]) inputs[k].value = renderer.params[k];
                    if (labels[k]) labels[k].textContent = renderer.params[k].toFixed(2);
                 });
             }
             if (event.type === 'reset') {
                 // Reset might clear buffers but usually doesn't change params,
                 // but if it did, we'd sync here.
             }
        };

        // Define a "Deep Thought" Routine
        const deepThoughtRoutine = [
            // 0s: Reset and start in Organic Mode, Global View
            { time: 0.0, type: 'reset' },
            { time: 0.0, type: 'camera', target: 'global' },
            { time: 0.1, type: 'style', value: 0 }, // Organic
            { time: 0.1, type: 'calm' },

            // 1s - 3s: Visual Input (Occipital) - Zoom in on back of brain
            { time: 1.0, type: 'camera', target: 'occipital', zoom: 4.5 },
            { time: 1.0, type: 'stimulus', target: 'occipital', intensity: 0.8 },
            { time: 1.5, type: 'stimulus', target: 'occipital', intensity: 1.0 },
            { time: 2.0, type: 'stimulus', target: 'occipital', intensity: 1.2 },

            // 4s: Shift to Frontal (Processing) - Rotate to face
            { time: 4.0, type: 'camera', target: 'frontal' },
            { time: 4.0, type: 'style', value: 2 }, // Connectome
            { time: 4.1, type: 'lerp', key: 'flowSpeed', value: 2.0, duration: 1.0 }, // Slow down smoothly
            { time: 4.5, type: 'stimulus', target: 'frontal', intensity: 1.5 },

            // 6s: Deep Insight (Global Activity) - Zoom out slightly, maybe look from top
            { time: 6.0, type: 'camera', target: 'parietal' },
            { time: 6.0, type: 'lerp', key: 'flowSpeed', value: 8.0, duration: 2.0 }, // Speed up smoothly
            { time: 6.0, type: 'stimulus', target: 'deep', intensity: 2.0 },
            { time: 6.2, type: 'stimulus', target: 'temporal', intensity: 1.0 },
            { time: 6.4, type: 'stimulus', target: 'parietal', intensity: 1.0 },

            // 9s: Heatmap View of the aftermath - Wide angle
            { time: 9.0, type: 'camera', target: 'global', zoom: 2.8 },
            { time: 9.0, type: 'style', value: 3 }, // Heatmap

            // 12s: Fade out
            { time: 12.0, type: 'calm' },
            { time: 13.0, type: 'style', value: 0 } // Back to Organic
        ];

        // --- UI FOR ROUTINE ---
        const controls = document.getElementById('controls');

        const routineContainer = document.createElement('div');
        routineContainer.style.marginTop = "10px";
        routineContainer.style.paddingTop = "10px";
        routineContainer.style.borderTop = "1px solid #444";

        const playBtn = document.createElement('button');
        playBtn.textContent = '▶ Run "Deep Thought" Sequence';
        playBtn.style.width = "100%";
        playBtn.style.background = "#0055aa";
        playBtn.style.color = "white";

        playBtn.onclick = () => {
            player.loadRoutine(deepThoughtRoutine, false); // Set true to loop
            player.play();
        };

        routineContainer.appendChild(playBtn);
        controls.appendChild(routineContainer);

        // -----------------------------

        const inferenceEngine = new InferenceEngine();
        const aiEnabled = await inferenceEngine.initialize();

        // [Existing AI Button Code preserved...]
        let aiMode = false;
        const aiToggle = document.createElement('button');
        aiToggle.textContent = 'Enable AI "Dreaming"';
        aiToggle.style.background = '#424';
        aiToggle.style.borderColor = '#d0d';
        aiToggle.style.color = '#eaffea';
        aiToggle.style.marginTop = "5px";
        aiToggle.onclick = () => {
            aiMode = !aiMode;
            aiToggle.textContent = aiMode ? 'Disable AI Mode' : 'Enable AI "Dreaming"';
            aiToggle.style.background = aiMode ? '#626' : '#424';
            // Stop routine if AI starts
            if(aiMode) player.stop();
        };
        controls.appendChild(aiToggle);

        initUIControls(renderer, inputs, labels); // [Reuse existing function]

        // AI Loop
        const classMap = new Float32Array(1000 * 3);
        for(let i=0; i<3000; i++) classMap[i] = (Math.random() - 0.5) * 2.0;

        const runAI = async () => {
            if (aiMode && aiEnabled) {
                const topK = await inferenceEngine.runInference();
                if (topK) {
                    topK.forEach(item => {
                        const idx = item.index;
                        const strength = item.value * 0.5;
                        renderer.injectStimulus(classMap[idx*3], classMap[idx*3+1], classMap[idx*3+2], strength);
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

// [Include your existing initUIControls function here unchanged]
function initUIControls(renderer, uiInputs, uiLabels) {
    // [Neuro-Weaver] Sync UI State with Renderer Params
    const syncParam = (paramKey, paramValue) => {
        const floatVal = parseFloat(paramValue);
        renderer.setParams({ [paramKey]: floatVal });
        if (uiLabels[paramKey]) uiLabels[paramKey].textContent = floatVal.toFixed(2);
    };

    // Attach listeners to all inputs
    Object.keys(uiInputs).forEach(key => {
        const inputEl = uiInputs[key];
        if (!inputEl) return;
        syncParam(key, inputEl.value);
        if (inputEl.tagName === 'SELECT') return;
        inputEl.addEventListener('input', (evt) => syncParam(key, evt.target.value));
    });

    const styleDropdown = document.getElementById('style-mode');
    if (styleDropdown) {
        styleDropdown.addEventListener('change', (evt) => {
            const selectedStyle = parseFloat(evt.target.value);
            renderer.setParams({ style: selectedStyle });
            // Style presets...
            const stylePresets = {
                3: { amplitude: 1.0, smoothing: 0.95 },
                2: { frequency: 8.0, smoothing: 0.2, amplitude: 1.5 },
                1: { frequency: 5.0, smoothing: 0.5 },
                0: { frequency: 2.0, smoothing: 0.9 }
            };
            const activePreset = stylePresets[selectedStyle] || stylePresets[0];
            Object.keys(activePreset).forEach(pKey => {
                renderer.setParams({ [pKey]: activePreset[pKey] });
                if(uiInputs[pKey]) uiInputs[pKey].value = activePreset[pKey];
                syncParam(pKey, activePreset[pKey]);
            });
        });
    }

    // [Neuro-Weaver] Stimulus Button Event Listeners
    // Maps UI buttons to 3D brain coordinates for injection
    const regions = [
        { id: 'stim-frontal', pos: [0, 0, 1.2] },   // Frontal Lobe
        { id: 'stim-occipital', pos: [0, 0, -1.2] }, // Occipital Lobe
        { id: 'stim-parietal', pos: [0, 1.0, 0] },   // Parietal Lobe
        { id: 'stim-temporal', pos: [1.0, 0, 0] },   // Temporal Lobe
        { id: 'stim-deep', pos: [0, 0, 0] }          // Deep Structures
    ];

    regions.forEach(region => {
        const btn = document.getElementById(region.id);
        if (btn) {
            btn.addEventListener('click', () => {
                // Inject stimulus at region coordinates with intensity 1.0
                renderer.injectStimulus(region.pos[0], region.pos[1], region.pos[2], 1.0);
            });
        }
    });

    document.getElementById('stim-random')?.addEventListener('click', () => {
        renderer.injectStimulus((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 1.0);
    });

    document.getElementById('stim-calm')?.addEventListener('click', () => {
        renderer.calmState();
        ['amplitude', 'frequency', 'smoothing'].forEach(k => {
            if(uiInputs[k]) uiInputs[k].value = renderer.params[k];
            syncParam(k, renderer.params[k]);
        });
    });

    document.getElementById('stim-reset')?.addEventListener('click', () => renderer.resetActivity());
}

init();

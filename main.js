// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]
import { AudioReactor } from './audio-reactor.js';   // [NEW]

// [Phase 3] Keyboard Triggered Routines
const MINI_ROUTINES = {
    '1': [ // Surprise
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'param', key: 'frequency', value: 12.0 },
        { time: 0.0, type: 'param', key: 'amplitude', value: 2.0 },
        { time: 0.0, type: 'camera', zoom: 2.5 }, // Zoom in
        { time: 0.1, type: 'stimulus', target: 'deep', intensity: 8.0 },
        { time: 0.5, type: 'lerp', key: 'amplitude', value: 0.5, duration: 1.5 }
    ],
    '2': [ // Calm
        { time: 0.0, type: 'calm' }, // Helper to reset params
        { time: 0.0, type: 'lerp', key: 'frequency', value: 0.5, duration: 2.0 },
        { time: 0.0, type: 'camera', target: 'global' } // Reset cam
    ],
    '3': [ // Scan
        { time: 0.0, type: 'param', key: 'sliceZ', value: -1.5 },
        { time: 0.0, type: 'camera', target: 'parietal' },
        { time: 0.5, type: 'lerp', key: 'sliceZ', value: 1.5, duration: 4.0 },
        { time: 5.0, type: 'param', key: 'sliceZ', value: 2.0 } // Reset slice
    ],
    '4': [ // Serotonin Surge
        { time: 0.0, type: 'text', message: 'Serotonin Flood...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 1.0, duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 8.0, duration: 2.0 },
        { time: 3.0, type: 'lerp', key: 'colorShift', value: 0.0, duration: 3.0 },
        { time: 3.0, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 3.0 }
    ]
};

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
        colorShift: document.getElementById('shift'), // [Phase 5]
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        sliceZ: document.getElementById('val-clip'),
        flowSpeed: document.getElementById('val-speed'),
        colorShift: document.getElementById('val-shift') // [Phase 5]
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
        // [Phase 2] Register Mini-Routines for recursive 'call' support
        player.registerSubRoutines(MINI_ROUTINES);

        const audioReactor = new AudioReactor();

        // --- KEYBOARD TRIGGERS ---
        document.addEventListener('keydown', (e) => {
            const routine = MINI_ROUTINES[e.key];
            if (routine) {
                console.log(`[Main] Triggering Mini-Routine: ${e.key}`);
                player.playNow(routine);
            }
        });

        // Legend UI
        const legend = document.createElement('div');
        legend.id = 'keyboard-legend';
        legend.style.position = 'absolute';
        legend.style.bottom = '10px';
        legend.style.right = '10px';
        legend.style.background = 'rgba(0, 0, 0, 0.7)';
        legend.style.color = '#fff';
        legend.style.padding = '8px';
        legend.style.fontFamily = 'monospace';
        legend.style.fontSize = '12px';
        legend.style.pointerEvents = 'none';
        legend.innerHTML = 'Keys: 1=Surprise, 2=Calm, 3=Scan, 4=Serotonin';
        document.body.appendChild(legend);

        // [Phase 4] Narrative Overlay
        const narrative = document.createElement('div');
        narrative.id = 'narrative-overlay';
        Object.assign(narrative.style, {
            position: 'absolute',
            bottom: '15%',
            width: '100%',
            textAlign: 'center',
            color: 'rgba(220, 240, 255, 0.9)',
            fontFamily: '"Courier New", monospace',
            fontSize: '24px',
            textShadow: '0 0 10px rgba(0, 150, 255, 0.8)',
            pointerEvents: 'none',
            transition: 'opacity 1.0s ease-in-out',
            opacity: '0',
            zIndex: '100'
        });
        document.body.appendChild(narrative);

        // Sync UI when routine executes events
        let narrativeTimeout = null;

        player.onEvent = (event) => {
             if (event.type === 'text') {
                 if (event.message) {
                     narrative.textContent = event.message;
                     narrative.style.opacity = '1';

                     if (narrativeTimeout) clearTimeout(narrativeTimeout);

                     // Optional: Auto-fade if duration is provided
                     if (event.duration) {
                         narrativeTimeout = setTimeout(() => {
                             narrative.style.opacity = '0';
                             narrativeTimeout = null;
                         }, event.duration * 1000);
                     }
                 } else {
                     narrative.style.opacity = '0';
                     if (narrativeTimeout) {
                         clearTimeout(narrativeTimeout);
                         narrativeTimeout = null;
                     }
                 }
             }
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

        // --- UI FOR ROUTINE ---
        const controls = document.getElementById('controls');

        const routineContainer = document.createElement('div');
        routineContainer.style.marginTop = "10px";
        routineContainer.style.paddingTop = "10px";
        routineContainer.style.borderTop = "1px solid #444";

        // Transport Controls
        const transportDiv = document.createElement('div');
        transportDiv.style.display = 'flex';
        transportDiv.style.gap = '5px';
        transportDiv.style.marginBottom = '5px';

        const btnPlay = document.createElement('button');
        btnPlay.textContent = '▶ Play';
        btnPlay.style.flex = '2';
        btnPlay.style.background = "#0055aa";
        btnPlay.style.color = "white";

        const btnStop = document.createElement('button');
        btnStop.textContent = '⏹';
        btnStop.style.flex = '1';
        btnStop.style.background = "#aa2222";

        transportDiv.appendChild(btnPlay);
        transportDiv.appendChild(btnStop);
        routineContainer.appendChild(transportDiv);

        // Transport Info (Time + Loop)
        const infoDiv = document.createElement('div');
        infoDiv.style.display = 'flex';
        infoDiv.style.justifyContent = 'space-between';
        infoDiv.style.alignItems = 'center';
        infoDiv.style.marginBottom = '10px';
        infoDiv.style.fontSize = '12px';
        infoDiv.style.color = '#aaa';

        const timeDisplay = document.createElement('span');
        timeDisplay.textContent = "00:00 / 00:00";

        const loopLabel = document.createElement('label');
        loopLabel.style.display = 'flex';
        loopLabel.style.alignItems = 'center';
        loopLabel.style.gap = '5px';
        loopLabel.style.margin = '0';

        const chkLoop = document.createElement('input');
        chkLoop.type = 'checkbox';
        chkLoop.style.width = 'auto'; // Reset width from CSS

        loopLabel.appendChild(chkLoop);
        loopLabel.appendChild(document.createTextNode('Loop'));

        infoDiv.appendChild(timeDisplay);
        infoDiv.appendChild(loopLabel);
        routineContainer.appendChild(infoDiv);

        // Event Listeners
        let isLoading = false;
        btnPlay.onclick = async () => {
            if (player.isPlaying) {
                player.pause();
            } else {
                // If no routine loaded, load default
                if (player.routine.length === 0) {
                     isLoading = true;
                     btnPlay.textContent = "⏳ Loading...";
                     await player.loadRoutineFromFile('routines/deep_thought.json', chkLoop.checked);
                     isLoading = false;
                     player.play();
                } else {
                    // Resume if paused, otherwise Play
                    if (player.lastPauseTime > 0) {
                        player.resume();
                    } else {
                        player.play();
                    }
                }
            }
        };

        btnStop.onclick = () => player.stop();

        chkLoop.onchange = () => {
            player.loop = chkLoop.checked;
        };

        // [New] JSON Loader Input
        const fileLabel = document.createElement('label');
        fileLabel.textContent = "Load Custom Routine (.json)";
        fileLabel.style.marginTop = "10px";
        routineContainer.appendChild(fileLabel);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.color = "#aaa";
        fileInput.style.marginTop = "5px";
        fileInput.style.width = "100%";

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const routineData = JSON.parse(evt.target.result);
                    player.loadRoutine(routineData, false);
                    player.play();
                    console.log(`[Main] Loaded custom routine: ${file.name}`);
                } catch (err) {
                    console.error("Invalid JSON:", err);
                    alert("Failed to parse routine JSON.");
                }
            };
            reader.readAsText(file);
        });

        routineContainer.appendChild(fileInput);
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

        // [Audio Reactivity Button]
        const audioBtn = document.createElement('button');
        audioBtn.textContent = 'Enable Audio Reactivity 🎤';
        audioBtn.style.background = '#442';
        audioBtn.style.borderColor = '#dd4';
        audioBtn.style.color = '#ff9';
        audioBtn.style.marginTop = "5px";
        audioBtn.onclick = async () => {
            if (!audioReactor.isActive) {
                await audioReactor.start();
                audioBtn.textContent = 'Disable Audio Reactivity 🔇';
                audioBtn.style.background = '#662';
            } else {
                audioReactor.stop();
                audioBtn.textContent = 'Enable Audio Reactivity 🎤';
                audioBtn.style.background = '#442';
            }
        };
        controls.appendChild(audioBtn);

        initUIControls(renderer, inputs, labels); // [Reuse existing function]

        // UI & Audio Loop
        const updateLoop = () => {
            // 1. Audio Reactivity
            if (audioReactor.isActive) {
                audioReactor.update(renderer);
                // Sync UI sliders
                if(inputs.amplitude) inputs.amplitude.value = renderer.params.amplitude;
                if(labels.amplitude) labels.amplitude.textContent = renderer.params.amplitude.toFixed(2);
                if(inputs.flowSpeed) inputs.flowSpeed.value = renderer.params.flowSpeed;
                if(labels.flowSpeed) labels.flowSpeed.textContent = renderer.params.flowSpeed.toFixed(2);
            }

            // 2. Transport UI Update
            if (player.isPlaying) {
                btnPlay.textContent = "⏸ Pause";
                btnPlay.style.background = "#aa8800";
            } else {
                if (!isLoading) {
                    btnPlay.textContent = (player.lastPauseTime > 0) ? "▶ Resume" : "▶ Play";
                    btnPlay.style.background = (player.lastPauseTime > 0) ? "#00aa55" : "#0055aa";
                }
            }

            // Time Format
            const fmt = (t) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };
            timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;

            requestAnimationFrame(updateLoop);
        };
        updateLoop();

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

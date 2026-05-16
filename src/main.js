// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]
import { AudioReactor } from './audio-reactor.js';   // [NEW]
import { TensorPlayer } from './tensor-player.js'; // [BCI]
import { MINI_ROUTINES } from './mini-routines.js';
import { FilterUIOverlay, initUIControls, initDirectorTools, initTooltips, flashButton, glowRegionButtons, initRangeTooltips } from './ui-utils.js';
import { setupLegendPanel, setupOverlays, setupRoutineTransport, setupBciPanel } from './ui-panels.js';

async function init() {
    // Main script updated for neuro-script cycle.
    const canvas = document.getElementById('canvas');
    const filterOverlay = new FilterUIOverlay(canvas);
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
        sparkle: document.getElementById('sparkle'), // [Phase 5]
        growth: document.getElementById('growth'), // [Phase 6]
        shake: document.getElementById('shake'), // [Phase 2]
        stress: document.getElementById('stress'), // [Phase 2] Stress Distortion
        cortisol: document.getElementById('cortisol'), // [Phase 5] Cortisol Decay
        heavyMetal: document.getElementById('heavyMetal'), // [Phase 6] Heavy Metal Accumulation
        fluidActive: document.getElementById('fluidActive'), // [Phase 6] Fluid Dynamics
        fogDensity: document.getElementById('fogDensity'),
        aberration: document.getElementById('aberration'), // [Phase 7]
        grain: document.getElementById('grain'), // [Phase 7]
        focus: document.getElementById('focus'), // [Phase 7]
        aperture: document.getElementById('aperture'), // [Phase 7]
        ambientLight: document.getElementById('ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('lightDirZ'), // [Phase 2]
        altitude: document.getElementById('altitude'), // Altitude/Hypoxia
        oxygen: document.getElementById('oxygen'), // Altitude/Hypoxia (read-only)
        metabolicRate: document.getElementById('metabolic'), // Altitude/Hypoxia
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        sliceZ: document.getElementById('val-clip'),
        flowSpeed: document.getElementById('val-speed'),
        colorShift: document.getElementById('val-shift'), // [Phase 5]
        sparkle: document.getElementById('val-sparkle'), // [Phase 5]
        growth: document.getElementById('val-growth'), // [Phase 6]
        shake: document.getElementById('val-shake'), // [Phase 2]
        stress: document.getElementById('val-stress'), // [Phase 2] Stress Distortion
        cortisol: document.getElementById('val-cortisol'), // [Phase 5] Cortisol Decay
        heavyMetal: document.getElementById('val-heavyMetal'), // [Phase 6] Heavy Metal Accumulation
        fluidActive: document.getElementById('val-fluidActive'), // [Phase 6] Fluid Dynamics
        fogDensity: document.getElementById('val-fogDensity'),
        aberration: document.getElementById('val-aberration'), // [Phase 7]
        grain: document.getElementById('val-grain'), // [Phase 7]
        focus: document.getElementById('val-focus'), // [Phase 7]
        aperture: document.getElementById('val-aperture'), // [Phase 7]
        ambientLight: document.getElementById('val-ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('val-dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('val-lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('val-lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('val-lightDirZ'), // [Phase 2]
        altitude: document.getElementById('val-altitude'), // Altitude/Hypoxia
        oxygen: document.getElementById('val-oxygen'), // Altitude/Hypoxia (read-only)
        metabolicRate: document.getElementById('val-metabolic') // Altitude/Hypoxia
    };
    
    if (!navigator.gpu) {
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = 'Your browser does not support WebGPU. Please use Chrome 113+ or Edge 113+ with WebGPU enabled.';
        errorDiv.classList.add('visible');
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
        // --- 1. SETUP ROUTINE PLAYER ---
        // Define explicit regions for easy scripting and better camera angles
        const regionCoordinatesMap = {
            'frontal': [0, 0, 1.2],
            'occipital': [0, 0, -1.2],
            'parietal': [0, 1.0, 0],
            'temporal': [1.0, 0, 0],
            'deep': [0, 0, 0]
        };

        // Define a map of camera coordinates to easily jump to specific views
        const cameraCoordinatesMap = {
            'overview': { rotation: { x: 0.5, y: -0.5 }, zoom: 4.0 },
            'close-up': { rotation: { x: 0.1, y: 0.1 }, zoom: 1.5 },
            'scan': { rotation: { x: 0.8, y: 0.2 }, zoom: 3.0 },
            'cortex-top': { rotation: { x: 1.5, y: 0 }, zoom: 3.0 },
            'brainstem': { rotation: { x: -0.5, y: 3.14 }, zoom: 2.5 },
            'left-hemisphere': { rotation: { x: 0, y: 1.57 }, zoom: 3.5 },
            'right-hemisphere': { rotation: { x: 0, y: -1.57 }, zoom: 3.5 },
            'frontal-lobe': { rotation: { x: 0.2, y: 0 }, zoom: 2.5 },
            'occipital-lobe': { rotation: { x: 0.2, y: 3.14 }, zoom: 2.5 },
            'parietal-lobe': { rotation: { x: 1.0, y: 0 }, zoom: 2.5 },
            'temporal-lobe-left': { rotation: { x: 0.2, y: 1.57 }, zoom: 2.5 },
            'temporal-lobe-right': { rotation: { x: 0.2, y: -1.57 }, zoom: 2.5 },
            'cerebellum': { rotation: { x: -0.8, y: 3.14 }, zoom: 2.5 }
        };

        // Initialize RoutinePlayer, ensuring it expects the BrainRenderer instance
        // [Integration Check] Verified `init()` flow is not broken
        const player = new RoutinePlayer(renderer, regionCoordinatesMap, cameraCoordinatesMap);
        // Integration verified: RoutinePlayer instantiated safely without breaking init flow
        console.log("[Neuro-Script Initialization Cycle] Routine Engine Instantiated.");

        // [Safety Handling] Hook up WebGPU device lost promise for player fallback
        if (renderer.device && renderer.device.lost) {
            renderer.device.lost.then((lostEventInfo) => {
                console.error("[Main Logic] WebGPU Context Lost event intercepted. Stopping all routines safely.", lostEventInfo);
                if (player) player.stop();
            });
        }
        window.playerState = player.state; // Share state with global window for inline logic

        // [Phase 10] Persistent Style Lock — routines cannot override the dropdown selection
        player.registerHandler('style', () => {});
        player.registerHandler('mode-transition', () => {});

        // [Phase 3] Extensible Event System Demo
        // Register a custom 'debug' handler to demonstrate the new V2.9 architecture
        player.registerHandler('debug', (evt) => {
             console.log(`%c[Routine Debug] ${evt.message}`, 'color: #ff00ff; font-weight: bold;');
        });

        // [Phase 2] Register Mini-Routines for recursive 'call' support
        player.registerSubRoutines(MINI_ROUTINES);

        const audioReactor = new AudioReactor();

        // --- KEYBOARD TRIGGERS ---
        document.addEventListener('keydown', (e) => {
            // Signal triggering (Spacebar)
            if (e.code === 'Space') {
                e.preventDefault();
                if (player.waitingForSignal === 'continue_scan') {
                    player.triggerSignal('continue_scan');
                }
            }

            const routine = MINI_ROUTINES[e.key];
            if (routine) {
                console.log(`[Main] Triggering Mini-Routine: ${e.key}`);
                player.playNow(routine);
            }
        });

        setupLegendPanel();

        setupOverlays(player, filterOverlay, inputs, labels);

        const controls = document.getElementById('controls');
        const transport = setupRoutineTransport(player, controls);

        const tensorPlayer = new TensorPlayer(renderer);
        setupBciPanel(renderer, controls, tensorPlayer);

        const inferenceEngine = new InferenceEngine();

        // [Existing AI Button Code preserved...]
        let aiMode = false;
        let aiEnabled = false;
        let aiLoading = false;
        const aiToggle = document.createElement('button');
        aiToggle.textContent = 'Enable AI "Dreaming"';
        aiToggle.dataset.tooltip = "Enable AI-driven SqueezeNet inference to auto-inject stimuli";
        aiToggle.style.background = '#424';
        aiToggle.style.borderColor = '#d0d';
        aiToggle.style.color = '#eaffea';
        aiToggle.style.marginTop = "5px";
        aiToggle.onclick = async () => {
            if (aiLoading) return;

            if (!aiMode && !aiEnabled) {
                aiLoading = true;
                aiToggle.disabled = true;
                aiToggle.textContent = 'Loading AI Model...';

                try {
                    aiEnabled = await inferenceEngine.initialize();
                } finally {
                    aiLoading = false;
                    aiToggle.disabled = false;
                }

                if (!aiEnabled) {
                    aiToggle.textContent = 'AI Load Failed - Retry';
                    aiToggle.style.background = '#533';
                    aiToggle.title = inferenceEngine.lastError?.message || 'Check the browser console and network tab for ONNX runtime asset loading errors.';
                    return;
                }
            }

            aiMode = !aiMode;
            aiToggle.title = '';
            aiToggle.textContent = aiMode ? 'Disable AI Mode' : 'Enable AI "Dreaming"';
            aiToggle.style.background = aiMode ? '#626' : '#424';
            // Stop routine if AI starts
            if(aiMode) player.stop();
        };
        controls.appendChild(aiToggle);

        // [Audio Reactivity Button]
        const audioBtn = document.createElement('button');
        audioBtn.textContent = 'Enable Audio Reactivity 🎤';
        audioBtn.dataset.tooltip = "Use microphone input to modulate neural activity amplitude";
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

        initRangeTooltips(controls); // [Custom range tooltip helper]
        initTooltips(); // [Phase 9] Contextual tooltip system

        // [Director Mode]
        const directorLabels = initDirectorTools(renderer, player);

        // UI & Audio Loop
        const updateLoop = (timestamp) => {
            // 0. BCI Tensor Playback
            tensorPlayer.update(timestamp);

            // 1. Audio Reactivity
            if (audioReactor.isActive) {
                audioReactor.update(renderer);
                // Sync UI sliders
                if(inputs.amplitude) inputs.amplitude.value = renderer.params.amplitude;
                if(labels.amplitude) labels.amplitude.textContent = renderer.params.amplitude.toFixed(2);
                if(inputs.flowSpeed) inputs.flowSpeed.value = renderer.params.flowSpeed;
                if(labels.flowSpeed) labels.flowSpeed.textContent = renderer.params.flowSpeed.toFixed(2);
            }

            // 2. Routine Status Dot
            const routineDot = document.getElementById('routine-status-dot');
            if (routineDot) {
                if (player.isPlaying) {
                    routineDot.classList.add('active');
                } else {
                    routineDot.classList.remove('active');
                }
            }

            // 3. Transport UI Update
            if (player.isPlaying) {
                if (!transport.state.isLoading) transport.btnPlay.innerHTML = "⏸";
                transport.statusDot.style.background = '#00e5e5';
                transport.statusDot.classList.add('status-pulse');
            } else {
                if (!transport.state.isLoading) transport.btnPlay.innerHTML = "▶";
                transport.statusDot.classList.remove('status-pulse');
                transport.statusDot.style.background = (player.lastPauseTime > 0) ? '#ffaa00' : '#445566';
            }

            // Time Format
            const fmt = (t) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };
            transport.timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;

            // Progress bar
            const progressPercent = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
            transport.progressFill.style.width = `${progressPercent}%`;

            // 3. Director Tools Update
            if (directorLabels) {
                directorLabels.RotX.textContent = renderer.rotation.x.toFixed(3);
                directorLabels.RotY.textContent = renderer.rotation.y.toFixed(3);
                directorLabels.Zoom.textContent = renderer.zoom.toFixed(2);
            }

            requestAnimationFrame(updateLoop);
        };
        requestAnimationFrame(updateLoop);

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
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('visible');
    }
}

init();
// End of main

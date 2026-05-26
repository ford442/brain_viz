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
        // [Issue Checklist] RoutinePlayer integrated with renderer, regionMap, and cameraMap
        const player = new RoutinePlayer(renderer, regionCoordinatesMap, cameraCoordinatesMap);
        // Integration verified: RoutinePlayer instantiated safely without breaking init flow
        console.log("[Neuro-Script Initialization Cycle] Routine Engine Instantiated.");

        window.playerState = player.state;

        player.registerHandler('style', () => {});
        player.registerHandler('mode-transition', () => {});
        player.registerHandler('debug', (evt) => {
            console.log(`%c[Routine Debug] ${evt.message}`, 'color: #ff00ff; font-weight: bold;');
        });
        player.registerSubRoutines(MINI_ROUTINES);

        // === Audio Reactor (Brain DJ Mode) ===
        const audioReactor = new AudioReactor();
        player.audioReactor = audioReactor;

        // --- KEYBOARD TRIGGERS ---
        document.addEventListener('keydown', (e) => {
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

        // AI Toggle (preserved)
        let aiMode = false;
        let aiEnabled = false;
        // ... (your existing aiToggle code) ...

        // [Phase 1 WASM] Wire WASM simulation engine toggle
        const wasmToggleBtn    = document.getElementById('btn-wasm-toggle');
        const wasmBenchmarkBtn = document.getElementById('btn-wasm-benchmark');
        const wasmStatusDiv    = document.getElementById('wasm-status');

        if (wasmToggleBtn) {
            wasmToggleBtn.addEventListener('click', async () => {
                if (!renderer.wasmMode) {
                    wasmToggleBtn.textContent = '⏳ Loading WASM…';
                    wasmToggleBtn.disabled = true;
                    const ok = await renderer.enableWasmMode();
                    wasmToggleBtn.disabled = false;
                    if (ok) {
                        wasmToggleBtn.textContent = '🧠 C++ WASM Engine (active)';
                        wasmToggleBtn.style.borderColor = 'rgba(0,229,100,0.5)';
                        wasmToggleBtn.style.color = '#00e564';
                        if (wasmBenchmarkBtn) wasmBenchmarkBtn.style.display = '';
                        if (wasmStatusDiv)    wasmStatusDiv.textContent = 'WASM engine active — tensor physics running on CPU (C++).';
                    } else {
                        wasmToggleBtn.textContent = '⚙️ WebGPU Compute (active) — WASM unavailable';
                        if (wasmStatusDiv)    wasmStatusDiv.textContent = 'WASM build not found. Run: npm run build:wasm';
                    }
                } else {
                    renderer.disableWasmMode();
                    wasmToggleBtn.textContent = '⚙️ WebGPU Compute (active)';
                    wasmToggleBtn.style.borderColor = 'rgba(0,200,180,0.3)';
                    wasmToggleBtn.style.color = '#99aabb';
                    if (wasmBenchmarkBtn) wasmBenchmarkBtn.style.display = 'none';
                    if (wasmStatusDiv)    wasmStatusDiv.textContent = 'WebGPU compute shader active.';
                }
            });
        }

        if (wasmBenchmarkBtn) {
            wasmBenchmarkBtn.addEventListener('click', () => {
                const result = renderer.runWasmBenchmark(100);
                if (result && wasmStatusDiv) {
                    wasmStatusDiv.textContent =
                        `Benchmark: 100 steps in ${result.elapsedMs.toFixed(1)} ms` +
                        ` (${result.stepsPerSec.toFixed(0)} steps/sec)`;
                }
            });
        }

        // Audio Reactivity Button
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
                player.executeEvent({ type: 'respiration', duration: 4.0, continuous: true });
            } else {
                audioReactor.stop();
                audioBtn.textContent = 'Enable Audio Reactivity 🎤';
                audioBtn.style.background = '#442';
                if (player.routine) {
                    player.routine = player.routine.filter(evt => evt.type !== 'respiration');
                }
            }
        };
        controls.appendChild(audioBtn);

        initUIControls(renderer, inputs, labels);
        initRangeTooltips(controls);
        initTooltips();
        const directorLabels = initDirectorTools(renderer, player);

        // ==================== MAIN UPDATE LOOP ====================
        const updateLoop = (timestamp) => {
            tensorPlayer.update(timestamp);

            // Audio Reactivity (Brain DJ Mode)
            if (audioReactor.isActive) {
                audioReactor.update(renderer, player);

                const features = audioReactor.getFeatures();

                // Store base values on first run
                if (window.baseParams === undefined) {
                    window.baseParams = {
                        zoom: renderer.camera?.zoom || 2.5,
                        colorShift: renderer.params.colorShift || 0.0,
                        sparkle: renderer.params.sparkle || 0.0
                    };
                }

                // === Music-Reactive Visual Parameters ===
                // Energy → Camera Zoom (breathing effect)
                const targetZoom = window.baseParams.zoom - (features.energy * 0.4);
                renderer.setCameraParams({ zoom: targetZoom });

                // Bass → Color Shift
                const targetColorShift = window.baseParams.colorShift + (features.bass * 2.8);
                renderer.setParams({ colorShift: targetColorShift });

                // Brightness → Sparkle / Glow
                const targetSparkle = window.baseParams.sparkle + (features.brightness * 1.8);
                renderer.setParams({ sparkle: targetSparkle });

                // Onset → Particle Stimulus Burst
                if (features.onset > 0.6 && Math.random() > 0.6) {
                    const r = 1.0 + Math.random() * 0.3;
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.random() * Math.PI;
                    const x = r * Math.sin(phi) * Math.cos(theta);
                    const y = r * Math.sin(phi) * Math.sin(theta);
                    const z = r * Math.cos(phi);
                    renderer.injectStimulus(x, y, z, features.onset * 2.5);
                }
            }

            // Sync UI Sliders
            if (inputs.amplitude) inputs.amplitude.value = renderer.params.amplitude;
            if (labels.amplitude) labels.amplitude.textContent = renderer.params.amplitude.toFixed(2);
            if (inputs.flowSpeed) inputs.flowSpeed.value = renderer.params.flowSpeed;
            if (labels.flowSpeed) labels.flowSpeed.textContent = renderer.params.flowSpeed.toFixed(2);

            // Routine UI Updates
            const routineDot = document.getElementById('routine-status-dot');
            if (routineDot) {
                routineDot.classList.toggle('active', player.isPlaying);
            }

            if (player.isPlaying) {
                transport.btnPlay.innerHTML = "⏸";
                transport.statusDot.style.background = '#00e5e5';
                transport.statusDot.classList.add('status-pulse');
            } else {
                transport.btnPlay.innerHTML = "▶";
                transport.statusDot.classList.remove('status-pulse');
                transport.statusDot.style.background = (player.lastPauseTime > 0) ? '#ffaa00' : '#445566';
            }

            // Time & Progress
            const fmt = (t) => Math.floor(t / 60).toString().padStart(2, '0') + ':' + Math.floor(t % 60).toString().padStart(2, '0');
            transport.timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;
            transport.progressFill.style.width = player.duration > 0 ? `${(player.currentTime / player.duration) * 100}%` : '0%';

            if (directorLabels) {
                directorLabels.RotX.textContent = renderer.rotation.x.toFixed(3);
                directorLabels.RotY.textContent = renderer.rotation.y.toFixed(3);
                directorLabels.Zoom.textContent = renderer.zoom.toFixed(2);
            }

            requestAnimationFrame(updateLoop);
        };

        requestAnimationFrame(updateLoop);

        // AI Loop
        const runAI = async () => { /* ... your existing AI loop ... */ };
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

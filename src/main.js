// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { createBrainRenderer, buildRendererUrl, persistRendererPreference } from './brain-renderer-factory.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]
import { AudioReactor } from './audio-reactor.js';   // [NEW]
import { TensorPlayer } from './tensor-player.js'; // [BCI]
import { SynaptiXEngine } from './synaptix-engine.js';
import { MINI_ROUTINES } from './mini-routines.js';
import { FilterUIOverlay, initUIControls, initDirectorTools, initTooltips, flashButton, glowRegionButtons, initRangeTooltips } from './ui-utils.js';
import { setupLegendPanel, setupOverlays, setupRoutineTransport, setupBciPanel, setupNeuromodulatorPanel } from './ui-panels.js';
import { setupModeSelector } from './ui-mode-selector.js';

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
        pointCloudDensity: document.getElementById('pointCloudDensity'), // [V3.1]
        fiberCoupling: document.getElementById('fiberCoupling'), // [V3.2]
        connectomeVariant: document.getElementById('connectomeVariant'), // [V3.3]
        fiberSymmetry: document.getElementById('fiberSymmetry'), // [V3.3]
        bundleCoherence: document.getElementById('bundleCoherence'), // [V3.3]
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
        style: document.getElementById('style-mode'),
        aiInfluence: document.getElementById('aiInfluence'),
        resonanceThreshold: document.getElementById('resonanceThreshold'),
        aiLayer: document.getElementById('aiLayer'),
        fusionParticles: document.getElementById('fusion-particles'),
        frameScrubber: document.getElementById('frame-scrubber'),
        frameRate: document.getElementById('frame-rate'),
        liveSourceEnable: document.getElementById('live-source-enable')
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
        pointCloudDensity: document.getElementById('val-pointCloudDensity'), // [V3.1]
        fiberCoupling: document.getElementById('val-fiberCoupling'), // [V3.2]
        connectomeVariant: document.getElementById('val-connectomeVariant'), // [V3.3]
        fiberSymmetry: document.getElementById('val-fiberSymmetry'), // [V3.3]
        bundleCoherence: document.getElementById('val-bundleCoherence'), // [V3.3]
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
        metabolicRate: document.getElementById('val-metabolic'), // Altitude/Hypoxia
        aiInfluence: document.getElementById('val-aiInfluence'),
        resonanceThreshold: document.getElementById('val-resonanceThreshold'),
        aiLayer: document.getElementById('val-aiLayer'),
        frameIndex: document.getElementById('val-frame-index'),
        frameTotal: document.getElementById('val-frame-total'),
        frameRate: document.getElementById('val-frame-rate')
    };
    
    try {
        const rendererInfo = await createBrainRenderer(canvas);
        const renderer = rendererInfo.renderer;
        // [V3.3] Prominent always-visible mode selector (pills + hotkeys 1-5).
        const modeSelector = setupModeSelector(renderer);
        const rendererBackendInput = document.getElementById('renderer-backend');
        const webglDebugWireframeInput = document.getElementById('webgl-debug-wireframe');
        const webglDebugTensorInput = document.getElementById('webgl-debug-tensor');
        const webglDebugIsolateInput = document.getElementById('webgl-debug-isolate');
        const rendererStatus = document.getElementById('renderer-status');
        const rendererNotes = document.getElementById('renderer-reload-note');
        const webglDebugPanel = document.getElementById('webgl-debug-controls');

        if (rendererBackendInput) {
            rendererBackendInput.value = rendererInfo.rendererType;
            rendererBackendInput.addEventListener('change', (evt) => {
                const nextRenderer = evt.target.value === 'webgl' ? 'webgl' : 'webgpu';
                persistRendererPreference(nextRenderer);
                window.location.assign(buildRendererUrl(nextRenderer));
            });
        }

        if (rendererStatus) {
            const fallbackText = rendererInfo.fallbackReason ? ` | fallback: ${rendererInfo.fallbackReason}` : '';
            rendererStatus.textContent = `active: ${rendererInfo.rendererType}${fallbackText}`;
        }
        if (rendererNotes) {
            rendererNotes.textContent = rendererInfo.rendererType === 'webgl'
                ? 'WebGL2 debug renderer active. Switch back to WebGPU for the full WGSL pipeline.'
                : 'WebGPU renderer active. Switch to WebGL2 when you need easier automated inspection.';
        }

        const isWebGLRenderer = rendererInfo.rendererType === 'webgl';
        if (webglDebugPanel) {
            webglDebugPanel.style.display = isWebGLRenderer ? '' : 'none';
        }
        if (webglDebugWireframeInput) {
            webglDebugWireframeInput.checked = renderer.getDebugOptions ? renderer.getDebugOptions().wireframe : false;
            webglDebugWireframeInput.addEventListener('change', (evt) => {
                renderer.setDebugOptions?.({ wireframe: evt.target.checked });
            });
        }
        if (webglDebugTensorInput) {
            webglDebugTensorInput.checked = renderer.getDebugOptions ? renderer.getDebugOptions().tensorField : false;
            webglDebugTensorInput.addEventListener('change', (evt) => {
                renderer.setDebugOptions?.({ tensorField: evt.target.checked });
            });
        }
        if (webglDebugIsolateInput) {
            webglDebugIsolateInput.value = renderer.getDebugOptions ? renderer.getDebugOptions().isolate : 'all';
            webglDebugIsolateInput.addEventListener('change', (evt) => {
                renderer.setDebugOptions?.({ isolate: evt.target.value });
            });
        }
        
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

        const explicitSplineMap = {
            'frontal-tour': ['overview', 'cortex-top', 'frontal-lobe', 'close-up'],
            'full-rotation': ['overview', 'left-hemisphere', 'brainstem', 'right-hemisphere', 'overview']
        };

        // Initialize RoutinePlayer, ensuring it expects the BrainRenderer instance
        // [Integration Check] Verified `init()` flow is not broken
        // [Issue Checklist] RoutinePlayer integrated with renderer, regionMap, and cameraMap
        // [Neuro-Script Cycle] RoutinePlayer initialized and evaluated
        // Check Dependencies: ensure RoutinePlayer expects a BrainRenderer instance
        if (!renderer) {
            console.error("BrainRenderer instance missing. Cannot initialize RoutinePlayer.");
            return;
        }
        const player = new RoutinePlayer(renderer, regionCoordinatesMap, cameraCoordinatesMap);

        // Expose player to global scope for external API triggers and debugging
        window.routineEngine = player;

        player.splineMap = explicitSplineMap;

        // Ensure graceful WebGPU degradation handler is wired
        const attachDeviceLostHandler = (rndr, plyr) => {
            if (rndr.device && rndr.device.lost) {
                 rndr.device.lost.then((info) => {
                      const telemetryData = {
                          event: "WebGPU_Context_Lost",
                          timestamp: performance.now(),
                          timelinePosition: plyr.currentTime,
                          reason: info.reason,
                          message: info.message
                      };
                      console.warn(`[Telemetry] WebGPU Context Lost:`, telemetryData);

                      plyr._deviceLost = true;
                      plyr.stop();
                      rndr.stop();

                      const errorDiv = document.getElementById('error');
                      if (errorDiv) {
                          errorDiv.classList.add('visible');
                          const title = errorDiv.querySelector('.error-title');
                          if (title) title.textContent = "WebGPU Context Lost";

                          const msg = document.getElementById('error-message');
                          if (msg) {
                              msg.innerHTML = `The GPU connection was lost (Reason: ${info.reason || 'unknown'}).<br><br>
                              <button id="btn-reconnect" style="padding: 8px 16px; background: #00e5e5; color: #000; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">
                                  Reconnect & Restore Timeline
                              </button>`;

                              document.getElementById('btn-reconnect').addEventListener('click', async () => {
                                  try {
                                      console.log("[Telemetry] Attempting WebGPU Context Recovery...");
                                      errorDiv.classList.remove('visible');
                                      msg.innerHTML = '';
                                      if (title) title.textContent = "Neural Interface Offline — WebGPU Required";

                                      await rndr.initialize();
                                      console.log("[Telemetry] Renderer re-initialized.");

                                      attachDeviceLostHandler(rndr, plyr);

                                      rndr.start();
                                      plyr._deviceLost = false;
                                      if (plyr.routine && plyr.routine.length > 0) {
                                          plyr.resume();
                                      }
                                      console.log(`[Telemetry] Timeline restored at position ${plyr.currentTime.toFixed(2)}s`);

                                  } catch (e) {
                                      console.error("[Telemetry] Recovery failed:", e);
                                      errorDiv.classList.add('visible');
                                      msg.textContent = `Recovery failed: ${e.message}`;
                                  }
                              });
                          }
                      }
                 });
            }
        };
        if (rendererInfo.usingWebGPU) {
            attachDeviceLostHandler(renderer, player);
        }

        // Integration verified: RoutinePlayer instantiated safely without breaking init flow
        console.log("[Neuro-Script Initialization Cycle] Routine Engine Instantiated.");

        window.playerState = player.state;
        window.visualizerAPI = player.getAPI();
        // [Neuro-Script Cycle] Implemented clearLerps API feature


        player.registerHandler('style', () => {});
        player.registerHandler('mode-transition', () => {});
        player.registerHandler('debug', (evt) => {
            console.log(`%c[Routine Debug] ${evt.message}`, 'color: #ff00ff; font-weight: bold;');
        });
        player.registerHandler('memory_fragmentation', (evt) => {
            if (player.renderer && player.renderer.params) {
                player.renderer.params.aberration = (player.renderer.params.aberration || 0) + (evt.value || 0.5);
                player.renderer.params.grain = (player.renderer.params.grain || 0) + (evt.value || 0.5);
                player.renderer.params.shake = (player.renderer.params.shake || 0) + (evt.value || 0.2);
                player.renderer.params.flowSpeed = Math.max(0.1, (player.renderer.params.flowSpeed || 4.0) - (evt.value || 2.0));

                // Trigger a glitch effect
                player.executeEvent({ type: 'glitch', duration: evt.duration || 1.0, intensity: evt.value || 0.8 });

                if (evt.message) {
                    player.executeEvent({ type: 'text', message: evt.message, duration: evt.duration || 2.0 });
                }
            }
        });
        player.registerHandler('neuroplasticity', (evt) => {
            if (player.renderer && player.renderer.params) {
                player.renderer.params.growth = (player.renderer.params.growth || 0) + (evt.value || 0.1);
            }
        });
        player.registerSubRoutines(MINI_ROUTINES);

        MINI_ROUTINES['E'] = [
            { time: 0.0, type: 'text', message: 'Visual Cortex Processing', duration: 3.0 },
            { time: 0.0, type: 'visual_cortex_filter', intensity: 1.0, duration: 1.5, ease: 'cubicOut' },
            { time: 0.0, type: 'camera', target: 'occipital', duration: 2.0, ease: 'sineInOut' },
            { time: 4.0, type: 'visual_cortex_filter', intensity: 0.0, duration: 2.0, ease: 'sineInOut' },
            { time: 6.0, type: 'calm' }
        ];


        // Click-based localized energy injection via new API
        let mainIsDragging = false;
        let mainDragDistance = 0;
        let mainLastX = 0;
        let mainLastY = 0;

        canvas.addEventListener('mousedown', (e) => {
            mainIsDragging = false;
            mainDragDistance = 0;
            mainLastX = e.clientX;
            mainLastY = e.clientY;
        });

        canvas.addEventListener('mousemove', (e) => {
            const dx = e.clientX - mainLastX;
            const dy = e.clientY - mainLastY;
            mainDragDistance += Math.sqrt(dx * dx + dy * dy);
            if (mainDragDistance > 5) {
                mainIsDragging = true;
            }
            mainLastX = e.clientX;
            mainLastY = e.clientY;
        });

        canvas.addEventListener('mouseup', (e) => {
            if (!mainIsDragging) {
                // Determine a relative coordinate
                const rect = canvas.getBoundingClientRect();
                const u = (e.clientX - rect.left) / rect.width;
                const v = (e.clientY - rect.top) / rect.height;

                // Map screen roughly to tensor volume coordinates (-1.6 to 1.6)
                const nx = (u - 0.5) * 2.0;
                const ny = -(v - 0.5) * 2.0;

                const targetCoords = [nx * 1.6, ny * 1.6, 0.0];
                console.log(`[Main] Explicit click detected. Injecting API stimulus at ${targetCoords.map(n => n.toFixed(2)).join(',')}`);

                if (window.visualizerAPI && window.visualizerAPI.injectRegion) {
                    window.visualizerAPI.injectRegion(targetCoords, 2.0, 1.5);
                }
            }
        });

        MINI_ROUTINES['M'] = [
            { time: 0.0, type: 'text', message: 'Memory Fragmentation Sequence', duration: 2.0 },
            { time: 0.0, type: 'style', value: 1 },
            { time: 0.0, type: 'camera', target: 'close-up', duration: 1.0 },
            { time: 1.0, type: 'memory_fragmentation', value: 0.8, duration: 2.5, message: 'Synaptic uncoupling detected...' },
            { time: 3.5, type: 'flashback', duration: 1.5, intensity: 1.2 },
            { time: 5.0, type: 'memory_fragmentation', value: 1.5, duration: 3.0, message: 'Data loss imminent.' },
            { time: 8.0, type: 'calm' },
            { time: 8.0, type: 'camera', target: 'overview', duration: 2.0 },
            { time: 8.0, type: 'text', message: 'Fragmentation Subsided.', duration: 2.0 }
        ];

        MINI_ROUTINES['S'] = [
            { time: 0.0, type: 'text', message: 'Frontal Tour Sequence', duration: 2.0 },
            { time: 0.0, type: 'camera', target: 'frontal-tour', duration: 5.0, ease: 'sineInOut' }
        ];

        MINI_ROUTINES['D'] = [
            { time: 0.0, type: 'text', message: 'Dynamic Network Topology Shift', duration: 2.0 },
            { time: 0.0, type: 'camera', target: 'overview', duration: 2.0, ease: 'sineInOut' },
            { time: 1.0, type: 'dynamic_topology', intensity: 2.0, duration: 5.0 },
            { time: 6.0, type: 'text', message: 'Structural Plasticity Active', duration: 2.0 },
            { time: 10.0, type: 'dynamic_topology', intensity: 0.0, duration: 4.0 },
            { time: 14.0, type: 'text', message: 'Topology Stabilized.', duration: 2.0 }
        ];

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

            // [V3.3] Mode hotkeys: 1=Organic, 2=Cyber, 3=Connectome, 4=Heatmap, 5=SynaptiX.
            // Skip while typing in a field so prompts/sliders aren't hijacked.
            const tag = (e.target && e.target.tagName) || '';
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
            if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '5') {
                modeSelector.applyStyle(parseFloat(e.key) - 1.0);
                return;
            }

            const routine = MINI_ROUTINES[e.key] || MINI_ROUTINES[e.key.toLowerCase()] || MINI_ROUTINES[e.key.toUpperCase()];
            if (routine) {
                console.log(`[Main] Triggering Mini-Routine: ${e.key}`);
                player.playNow(routine);
            }
        });

        setupLegendPanel();
    // Add memory fragmentation and spline tour to legend
    const legendPanel = document.getElementById('legend-panel');
    if (legendPanel) {
        const newEntry = document.createElement('div');
        newEntry.innerHTML = '<b>1-5</b> : Switch Mode (Organic/Cyber/Connectome/Heatmap/SynaptiX)<br><b>M</b> : Memory Fragmentation<br><b>S</b> : Frontal Tour (Spline)<br><b>D</b> : Dynamic Topology Shift<br><b>X</b> : SynaptiX Mode';
        legendPanel.appendChild(newEntry);
    }

        setupOverlays(player, filterOverlay, inputs, labels);
        const controls = document.getElementById('controls');
        const transport = setupRoutineTransport(player, controls);
        const tensorPlayer = new TensorPlayer(renderer);
        const synaptixEngine = new SynaptiXEngine(renderer);
        renderer.synaptixEngine = synaptixEngine;
        setupBciPanel(renderer, controls, tensorPlayer);
        setupNeuromodulatorPanel(renderer, controls);
        const styleSynaptix = document.getElementById('style-mode-synaptix');
        const synaptixSourceStatus = document.getElementById('synaptix-source-status');
        const synaptixShowcaseButton = document.getElementById('btn-synaptix-showcase');

        const inferenceEngine = new InferenceEngine();
        let aiPrompt = 'visual cortex resonance prompt';
        let lastAIStep = 0;

        const syncStyleDropdowns = (styleValue) => {
            const styleString = String(styleValue);
            const mainStyle = document.getElementById('style-mode');
            if (mainStyle) mainStyle.value = styleString;
            if (styleSynaptix) styleSynaptix.value = styleString;
        };

        const syncSynaptiXUiFromRenderer = () => {
            if (inputs.aiInfluence) inputs.aiInfluence.value = renderer.params.aiInfluence;
            if (labels.aiInfluence) labels.aiInfluence.textContent = renderer.params.aiInfluence.toFixed(2);
            if (inputs.resonanceThreshold) inputs.resonanceThreshold.value = renderer.params.resonanceThreshold;
            if (labels.resonanceThreshold) labels.resonanceThreshold.textContent = renderer.params.resonanceThreshold.toFixed(2);
            if (inputs.fusionParticles) inputs.fusionParticles.checked = synaptixEngine.fusionParticlesEnabled;
            syncStyleDropdowns(renderer.params.style);
        };

        const applySynaptiXScene = ({
            pattern,
            phantomSequence,
            aiInfluence,
            resonanceThreshold,
            style = 4.0,
            sourceInfo
        }) => {
            if (phantomSequence) {
                synaptixEngine.generatePhantomFrames(phantomSequence);
            }
            if (pattern) {
                synaptixEngine.generatePattern(pattern);
            }
            synaptixEngine.pauseFrames();
            renderer.setSynaptiXParams({
                style,
                aiInfluence: aiInfluence ?? renderer.params.aiInfluence,
                resonanceThreshold: resonanceThreshold ?? renderer.params.resonanceThreshold
            });
            if (sourceInfo) {
                synaptixEngine.lastSourceInfo = sourceInfo;
            }
            syncSynaptiXUiFromRenderer();
        };

        const runSynaptiXShowcase = async (routinePath = '/routines/synaptix_resonance.json') => {
            applySynaptiXScene({
                phantomSequence: 'resonance',
                aiInfluence: 0.68,
                resonanceThreshold: 0.16,
                sourceInfo: 'Built-in SynaptiX showcase phantoms'
            });
            await player.loadRoutineFromFile(routinePath, false);
            player.play();
            return true;
        };

        player.registerHandler('synaptix', (evt) => {
            const action = evt.action || 'pattern';
            if (action === 'pattern' && evt.pattern) {
                applySynaptiXScene({
                    pattern: evt.pattern,
                    aiInfluence: evt.aiInfluence,
                    resonanceThreshold: evt.resonanceThreshold,
                    style: evt.style ?? 4.0,
                    sourceInfo: evt.sourceInfo
                });
                return;
            }
            if (action === 'phantom-sequence') {
                applySynaptiXScene({
                    phantomSequence: evt.sequence || 'resonance',
                    aiInfluence: evt.aiInfluence,
                    resonanceThreshold: evt.resonanceThreshold,
                    style: evt.style ?? 4.0,
                    sourceInfo: evt.sourceInfo
                });
                return;
            }
            if (action === 'play-frames') {
                synaptixEngine.playFrames(evt.rate || 4);
                return;
            }
            if (action === 'pause-frames') {
                synaptixEngine.pauseFrames();
                return;
            }
            if (action === 'params') {
                renderer.setSynaptiXParams(evt.params || {});
                syncSynaptiXUiFromRenderer();
            }
        });

        // AI Toggle (preserved)
        let aiMode = false;
        let aiEnabled = false;
        // ... (your existing aiToggle code) ...

        // [Phase 1 WASM] Wire WASM simulation engine toggle
        const wasmToggleBtn    = document.getElementById('btn-wasm-toggle');
        const wasmBenchmarkBtn = document.getElementById('btn-wasm-benchmark');
        const wasmStatusDiv    = document.getElementById('wasm-status');

        if (wasmToggleBtn) {
            if (rendererInfo.usingWebGL) {
                wasmToggleBtn.textContent = '⚙️ WebGL2 Renderer (WASM compute unavailable)';
                wasmToggleBtn.disabled = true;
                wasmToggleBtn.style.opacity = '0.6';
                if (wasmStatusDiv) wasmStatusDiv.textContent = 'WASM simulation is only wired into the WebGPU renderer path.';
            }
            wasmToggleBtn.addEventListener('click', async () => {
                if (rendererInfo.usingWebGL) return;
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

        // [SynaptiX] Wire AI tensor file loading
        const aiTensorFileInput = document.getElementById('ai-tensor-file');
        if (aiTensorFileInput) {
            aiTensorFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                await synaptixEngine.loadTensorFile(file);
                if (renderer.params.style < 4.0) {
                    renderer.setSynaptiXParams({ style: 4.0 });
                    const mainStyle = document.getElementById('style-mode');
                    if (mainStyle) mainStyle.value = '4';
                    if (styleSynaptix) styleSynaptix.value = '4';
                }
            });
        }

        // [SynaptiX] Wire AI pattern generation
        const aiPatternSelect = document.getElementById('ai-pattern');
        const btnGenerateAI = document.getElementById('btn-generate-ai');
        if (btnGenerateAI && aiPatternSelect) {
            btnGenerateAI.addEventListener('click', () => {
                const pattern = aiPatternSelect.value;
                if (pattern && pattern !== 'none') {
                    synaptixEngine.generatePattern(pattern);
                    if (renderer.params.style < 4.0) {
                        renderer.setSynaptiXParams({ style: 4.0 });
                        syncStyleDropdowns(4);
                    }
                }
            });
        }

        if (synaptixShowcaseButton) {
            synaptixShowcaseButton.addEventListener('click', () => {
                runSynaptiXShowcase();
            });
        }

        // [SynaptiX] Wire SynaptiX tab style dropdown
        if (styleSynaptix) {
            styleSynaptix.addEventListener('change', (evt) => {
                const selectedStyle = parseFloat(evt.target.value);
                renderer.setSynaptiXParams({ style: selectedStyle });
                const mainStyle = document.getElementById('style-mode');
                if (mainStyle) mainStyle.value = selectedStyle;
            });
        }

        // [SynaptiX] Wire Layer scrubber
        if (inputs.aiLayer) {
            inputs.aiLayer.addEventListener('input', (evt) => {
                const layer = parseInt(evt.target.value, 10);
                const layerMax = Math.max(1, synaptixEngine.layerCount - 1);
                renderer.setSynaptiXParams({ aiLayer: layer / layerMax });
                if (labels.aiLayer) labels.aiLayer.textContent = layer;
                if (synaptixEngine.frameSequence.length > 0) {
                    const frameIndex = Math.round((layer / layerMax) * (synaptixEngine.frameSequence.length - 1));
                    synaptixEngine.scrubToFrame(frameIndex);
                }
            });
        }

        // [SynaptiX] Wire Fusion Particles toggle
        if (inputs.fusionParticles) {
            inputs.fusionParticles.addEventListener('change', (evt) => {
                synaptixEngine.fusionParticlesEnabled = evt.target.checked;
                // Mirror to renderer params for shader visibility if needed
                renderer.setSynaptiXParams({ fusionParticles: evt.target.checked ? 1.0 : 0.0 });
            });
        }

        // [SynaptiX] Wire preset pattern buttons
        document.querySelectorAll('.synaptix-preset').forEach((btn) => {
            btn.addEventListener('click', () => {
                const pattern = btn.dataset.pattern;
                if (pattern) {
                    synaptixEngine.generatePattern(pattern);
                    // Auto-switch to SynaptiX style if not already
                    if (renderer.params.style < 4.0) {
                        renderer.setSynaptiXParams({ style: 4.0 });
                        syncStyleDropdowns(4);
                    }
                }
            });
        });

        // [SynaptiX] Wire Token Playback controls
        const btnFramePlay = document.getElementById('btn-frame-play');
        const btnFramePause = document.getElementById('btn-frame-pause');
        if (btnFramePlay) {
            btnFramePlay.addEventListener('click', () => {
                const rate = inputs.frameRate ? parseInt(inputs.frameRate.value, 10) : 4;
                synaptixEngine.playFrames(rate);
            });
        }
        if (btnFramePause) {
            btnFramePause.addEventListener('click', () => {
                synaptixEngine.pauseFrames();
            });
        }
        if (inputs.frameRate) {
            inputs.frameRate.addEventListener('input', (evt) => {
                const rate = parseInt(evt.target.value, 10);
                synaptixEngine.framePlaybackRate = rate;
                if (labels.frameRate) labels.frameRate.textContent = rate;
            });
        }
        if (inputs.frameScrubber) {
            inputs.frameScrubber.addEventListener('input', (evt) => {
                const idx = parseInt(evt.target.value, 10);
                synaptixEngine.scrubToFrame(idx);
                if (labels.frameIndex) labels.frameIndex.textContent = idx;
            });
        }

        // [SynaptiX] Wire Live Source toggle skeleton
        const liveSourceStatus = document.getElementById('live-source-status');
        if (inputs.liveSourceEnable) {
            inputs.liveSourceEnable.addEventListener('change', (evt) => {
                if (evt.target.checked) {
                    // Skeleton: user provides callback via window.setSynaptiXLiveSource
                    if (window.setSynaptiXLiveSource && typeof window.setSynaptiXLiveSource === 'function') {
                        window.setSynaptiXLiveSource(synaptixEngine);
                        if (liveSourceStatus) liveSourceStatus.textContent = 'status: connected (callback)';
                    } else {
                        console.warn('[SynaptiX] No live source callback found. Define window.setSynaptiXLiveSource(engine) to connect.');
                        if (liveSourceStatus) liveSourceStatus.textContent = 'status: no callback defined';
                        evt.target.checked = false;
                    }
                } else {
                    synaptixEngine.setLiveCallback(null);
                    if (liveSourceStatus) liveSourceStatus.textContent = 'status: disconnected';
                }
            });
        }

        window.setLiveAIFrame = (data) => {
            if (!data) return false;
            if (data instanceof Float32Array) {
                synaptixEngine.setTensorData(data);
                synaptixEngine.lastSourceInfo = 'Live AI frame pushed';
                return true;
            }
            if (Array.isArray(data) || typeof data.length === 'number') {
                const activeLayer = Math.round((renderer.params.aiLayer || 0) * Math.max(0, synaptixEngine.layerCount - 1));
                synaptixEngine.projectActivation(data, activeLayer, Math.max(1, synaptixEngine.layerCount));
                synaptixEngine.lastSourceInfo = `Live AI activation projected (${data.length} values)`;
                return true;
            }
            return false;
        };

        window.setSynaptiXPrompt = (prompt) => {
            aiPrompt = String(prompt || 'visual cortex resonance prompt');
        };

        window.runSynaptiXHallucinationDemo = async () => {
            aiPrompt = 'hallucination uncanny conflict prompt';
            const result = await inferenceEngine.stepSynaptiX(synaptixEngine, renderer, {
                prompt: aiPrompt,
                tokenIndex: inferenceEngine.tokenCounter
            });
            if (result) {
                renderer.setSynaptiXParams({
                    style: 4.0,
                    aiInfluence: 0.82,
                    resonanceThreshold: 0.12
                });
            }
            return result;
        };

        window.runSynaptiXShowcase = runSynaptiXShowcase;
        window.__synaptixDebug = {
            runShowcase: runSynaptiXShowcase,
            getState: () => ({
                style: renderer.params.style,
                aiInfluence: renderer.params.aiInfluence,
                resonanceThreshold: renderer.params.resonanceThreshold,
                currentPattern: synaptixEngine.currentPattern,
                frameCount: synaptixEngine.frameSequence.length,
                frameIndex: synaptixEngine.frameIndex,
                sourceInfo: synaptixEngine.lastSourceInfo,
                isRoutinePlaying: player.isPlaying
            })
        };

        initUIControls(renderer, inputs, labels);

        // [SynaptiX] Patch main style dropdown for preset 4 and SynaptiX tab sync
        const mainStyleDropdown = document.getElementById('style-mode');
        if (mainStyleDropdown) {
            mainStyleDropdown.addEventListener('change', () => {
                const selectedStyle = parseFloat(mainStyleDropdown.value);
                if (selectedStyle === 4.0) {
                    renderer.setParams({ frequency: 3.0, smoothing: 0.85, amplitude: 0.8 });
                    if (inputs.frequency) { inputs.frequency.value = 3.0; if (labels.frequency) labels.frequency.textContent = (3.0).toFixed(2); }
                    if (inputs.smoothing) { inputs.smoothing.value = 0.85; if (labels.smoothing) labels.smoothing.textContent = (0.85).toFixed(2); }
                    if (inputs.amplitude) { inputs.amplitude.value = 0.8; if (labels.amplitude) labels.amplitude.textContent = (0.8).toFixed(2); }
                }
                const synaptixStyle = document.getElementById('style-mode-synaptix');
                if (synaptixStyle) synaptixStyle.value = String(selectedStyle);
            });
        }
        initRangeTooltips(controls);
        initTooltips();
        const directorLabels = initDirectorTools(renderer, player);

        // ==================== MAIN UPDATE LOOP ====================
        const updateLoop = (timestamp) => {
            tensorPlayer.update(timestamp);

            // [SynaptiX] Update frame playback and live source polling
            if (synaptixEngine) synaptixEngine.update(timestamp);

            if (timestamp - lastAIStep >= (1000 / Math.max(1, inferenceEngine.liveFrameRate))) {
                lastAIStep = timestamp;
                if (renderer.params.style >= 4.0 || inputs.liveSourceEnable?.checked) {
                    inferenceEngine.stepSynaptiX(synaptixEngine, renderer, {
                        prompt: aiPrompt,
                        tokenIndex: inferenceEngine.tokenCounter
                    }).then((result) => {
                        if (!result) return;
                        if (inputs.liveSourceEnable?.checked && liveSourceStatus) {
                            liveSourceStatus.textContent = `status: ${inferenceEngine.status} token=${result.token}`;
                        }
                    }).catch((err) => {
                        console.warn('[SynaptiX] Live inference step failed:', err);
                    });
                }
            }

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
            if (inputs.pointCloudDensity) inputs.pointCloudDensity.value = renderer.params.pointCloudDensity;
            if (labels.pointCloudDensity) labels.pointCloudDensity.textContent = renderer.params.pointCloudDensity.toFixed(2);
            if (inputs.fiberCoupling) inputs.fiberCoupling.value = renderer.params.fiberCoupling;
            if (labels.fiberCoupling) labels.fiberCoupling.textContent = renderer.params.fiberCoupling.toFixed(2);
            if (inputs.aiInfluence) inputs.aiInfluence.value = renderer.params.aiInfluence;
            if (labels.aiInfluence) labels.aiInfluence.textContent = renderer.params.aiInfluence.toFixed(2);
            if (inputs.resonanceThreshold) inputs.resonanceThreshold.value = renderer.params.resonanceThreshold;
            if (labels.resonanceThreshold) labels.resonanceThreshold.textContent = renderer.params.resonanceThreshold.toFixed(2);
            if (inputs.aiLayer) {
                const layerMax = Math.max(1, synaptixEngine.layerCount - 1);
                inputs.aiLayer.max = String(layerMax);
                const layerVal = Math.round((renderer.params.aiLayer || 0) * layerMax);
                inputs.aiLayer.value = layerVal;
                if (labels.aiLayer) labels.aiLayer.textContent = layerVal;
            }
            if (synaptixSourceStatus) synaptixSourceStatus.textContent = synaptixEngine.lastSourceInfo;

            // [SynaptiX] Update resonance stats display
            const stats = synaptixEngine.computeResonanceStats(renderer._lastHumanTensor);
            const barHuman = document.getElementById('bar-human-energy');
            const barAI = document.getElementById('bar-ai-energy');
            const barResonance = document.getElementById('bar-resonance');
            const valHuman = document.getElementById('val-human-energy');
            const valAI = document.getElementById('val-ai-energy');
            const valResonance = document.getElementById('val-resonance');
            if (barHuman) barHuman.style.width = `${stats.humanEnergy}%`;
            if (barAI) barAI.style.width = `${stats.aiEnergy}%`;
            if (barResonance) barResonance.style.width = `${stats.resonance}%`;
            if (valHuman) valHuman.textContent = `${stats.humanEnergy.toFixed(1)}%`;
            if (valAI) valAI.textContent = `${stats.aiEnergy.toFixed(1)}%`;
            if (valResonance) valResonance.textContent = `${stats.resonance.toFixed(1)}%`;

            // [SynaptiX] Sync frame scrubber
            if (inputs.frameScrubber && synaptixEngine.frameSequence.length > 0) {
                inputs.frameScrubber.max = String(synaptixEngine.frameSequence.length - 1);
                inputs.frameScrubber.disabled = false;
                if (labels.frameTotal) labels.frameTotal.textContent = synaptixEngine.frameSequence.length;
                if (labels.frameIndex) labels.frameIndex.textContent = synaptixEngine.frameIndex;
                if (parseInt(inputs.frameScrubber.value, 10) !== synaptixEngine.frameIndex) {
                    inputs.frameScrubber.value = synaptixEngine.frameIndex;
                }
            } else if (inputs.frameScrubber) {
                inputs.frameScrubber.disabled = true;
                inputs.frameScrubber.max = '0';
                if (labels.frameTotal) labels.frameTotal.textContent = '0';
            }

            // Sync style dropdowns
            const mainStyle = document.getElementById('style-mode');
            const synaptixStyle = document.getElementById('style-mode-synaptix');
            if (mainStyle && parseFloat(mainStyle.value) !== renderer.params.style) {
                mainStyle.value = String(renderer.params.style);
            }
            if (synaptixStyle && parseFloat(synaptixStyle.value) !== renderer.params.style) {
                synaptixStyle.value = String(renderer.params.style);
            }
            modeSelector.syncActive(renderer.params.style);

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
        const runAI = async () => {
            await inferenceEngine.initialize();
            if (liveSourceStatus) {
                liveSourceStatus.textContent = `status: ${inferenceEngine.status}`;
            }
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

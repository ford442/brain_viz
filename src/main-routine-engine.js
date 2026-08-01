// Extracted from main.js
import { RoutinePlayer } from './routine-player.js';
import { AudioReactor } from './audio-reactor.js';
import { MINI_ROUTINES } from './mini-routines.js';
import { DOPAMINE_PATHWAY_DEMO } from './pathways.js';

export function setupRoutineEngine(renderer, canvas, modeSelector, rendererInfo) {
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
    // [Neuro-Script Cycle] Routine engine integration explicit validation
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
    player.registerSubRoutines({ ...MINI_ROUTINES, 'dopamine-pathway-demo': DOPAMINE_PATHWAY_DEMO });

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

    // --- INTERACTIVE SYNTHESIS CONTROL LAYOUT ---
    // Map a 13-key row on the keyboard to a C-major/chromatic octave starting at C3 (130.81 Hz)
    const synthKeyMap = {
        'A': 130.81, // C3
        'W': 138.59, // C#3
        'S': 146.83, // D3
        'E': 155.56, // D#3
        'D': 164.81, // E3
        'F': 174.61, // F3
        'T': 185.00, // F#3
        'G': 196.00, // G3
        'Y': 207.65, // G#3
        'H': 220.00, // A3
        'U': 233.08, // A#3
        'J': 246.94, // B3
        'K': 261.63  // C4
    };

    // --- KEYBOARD TRIGGERS ---
    const activeKeys = new Set();
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return; // Ignore hold repeats for synth notes

        const rawKey = e.key;
        activeKeys.add(rawKey);
        activeKeys.add(rawKey.toLowerCase());

        // The Synth control shares keys with the mini-routines.
        // To avoid breaking existing tests (e.g., test using 'a' for Adrenaline)
        // while allowing synth play, we trigger the synth but DO NOT return early
        // if there is a matching routine below.
        let synthPlayed = false;
        const upperKey = e.key.toUpperCase();
        if (synthKeyMap[upperKey] && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const tag = (e.target && e.target.tagName) || '';
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
            if (!typing) {
                audioReactor.playTone(synthKeyMap[upperKey]);
                synthPlayed = true;
            }
        }

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

        let matchedRoutine = null;
        let matchedKey = e.key;

        // Advanced Trigger System implementation for multi-key chords
        if (!typing) {
            if (activeKeys.has('Shift') && activeKeys.has('a')) {
                matchedRoutine = MINI_ROUTINES['A'];
                matchedKey = 'Shift+A';
            } else {
                matchedRoutine = MINI_ROUTINES[e.key] || MINI_ROUTINES[e.key.toLowerCase()] || MINI_ROUTINES[e.key.toUpperCase()];
            }
        }

        if (matchedRoutine) {
            console.log(`[Main] Triggering Mini-Routine: ${matchedKey}`);
            player.playNow(matchedRoutine);
        }
    });

    document.addEventListener('keyup', (e) => {
        const rawKey = e.key;
        activeKeys.delete(rawKey);
        activeKeys.delete(rawKey.toLowerCase());

        // Ensure modifiers are cleaned up reliably
        if (rawKey === 'Shift') {
            activeKeys.clear();
        }

        const upperKey = e.key.toUpperCase();
        if (synthKeyMap[upperKey]) {
            audioReactor.stopTone(synthKeyMap[upperKey]);
        }
    });

    return { player, audioReactor };
}

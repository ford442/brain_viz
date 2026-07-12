// Extracted from main.js
import { SynaptiXEngine } from './synaptix-engine.js';
import { TensorPlayer } from './tensor-player.js';

export function setupSynaptiXIntegration(renderer, player, controls, inputs, labels, inferenceEngine, aiPromptRef, rendererInfo) {
    const styleSynaptix = document.getElementById('style-mode-synaptix');
    const synaptixSourceStatus = document.getElementById('synaptix-source-status');
    const synaptixShowcaseButton = document.getElementById('btn-synaptix-showcase');

    const tensorPlayer = new TensorPlayer(renderer);
    const synaptixEngine = new SynaptiXEngine(renderer);
    renderer.synaptixEngine = synaptixEngine;

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
        aiPromptRef.value = String(prompt || 'visual cortex resonance prompt');
    };

    window.runSynaptiXHallucinationDemo = async () => {
        aiPromptRef.value = 'hallucination uncanny conflict prompt';
        const result = await inferenceEngine.stepSynaptiX(synaptixEngine, renderer, {
            prompt: aiPromptRef.value,
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

    return { synaptixEngine, tensorPlayer };
}

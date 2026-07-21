// main-update-loop.js — RAF loop syncing UI, SynaptiX, audio reactivity, and routine transport
export function startMainUpdateLoop(renderer, player, inputs, labels, tensorPlayer, synaptixEngine, inferenceEngine, audioReactor, transport, directorLabels, modeSelector, aiPromptRef, trainingEngine) {
    let lastAIStep = 0;
    let lastTrainingTime = 0;
    const liveSourceStatus = document.getElementById('live-source-status');

    const updateLoop = (timestamp) => {
        tensorPlayer.update(timestamp);

        if (trainingEngine) {
            const dt = lastTrainingTime > 0 ? Math.min(0.1, (timestamp - lastTrainingTime) / 1000) : 0;
            lastTrainingTime = timestamp;
            trainingEngine.update(dt);
        }

        if (synaptixEngine) synaptixEngine.update(timestamp);

        if (timestamp - lastAIStep >= (1000 / Math.max(1, inferenceEngine.liveFrameRate))) {
            lastAIStep = timestamp;
            if (renderer.params.style >= 4.0 || inputs.liveSourceEnable?.checked) {
                inferenceEngine.stepSynaptiX(synaptixEngine, renderer, {
                    prompt: aiPromptRef.value,
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

        if (audioReactor.isActive) {
            audioReactor.update(renderer, player);
            const features = audioReactor.getFeatures();

            if (window.baseParams === undefined) {
                window.baseParams = {
                    zoom: renderer.camera?.zoom || 2.5,
                    colorShift: renderer.params.colorShift || 0.0,
                    sparkle: renderer.params.sparkle || 0.0
                };
            }

            const targetZoom = window.baseParams.zoom - (features.energy * 0.4);
            renderer.setCameraParams({ zoom: targetZoom });

            const targetColorShift = window.baseParams.colorShift + (features.bass * 2.8);
            renderer.setParams({ colorShift: targetColorShift });

            const targetSparkle = window.baseParams.sparkle + (features.brightness * 1.8);
            renderer.setParams({ sparkle: targetSparkle });

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

        const synaptixSourceStatus = document.getElementById('synaptix-source-status');
        if (synaptixSourceStatus) synaptixSourceStatus.textContent = synaptixEngine.lastSourceInfo;

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

        const mainStyle = document.getElementById('style-mode');
        const synaptixStyle = document.getElementById('style-mode-synaptix');
        if (mainStyle && parseFloat(mainStyle.value) !== renderer.params.style) {
            mainStyle.value = String(renderer.params.style);
        }
        if (synaptixStyle && parseFloat(synaptixStyle.value) !== renderer.params.style) {
            synaptixStyle.value = String(renderer.params.style);
        }
        modeSelector.syncActive(renderer.params.style);

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
}

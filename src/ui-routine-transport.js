// ui-routine-transport.js
import { TimelineEditor } from './timeline-editor.js';
import { setupTimelineEditor } from './ui-timeline-editor.js';

export function setupRoutineTransport(player, controls) {
    // --- UI FOR ROUTINE ---

    const routineContainer = document.createElement('div');
    routineContainer.style.marginTop = "10px";
    routineContainer.style.paddingTop = "10px";
    routineContainer.style.borderTop = "1px solid #444";

    // Transport Bar
    const transportBar = document.createElement('div');
    transportBar.style.display = 'flex';
    transportBar.style.alignItems = 'center';
    transportBar.style.gap = '6px';
    transportBar.style.marginBottom = '8px';

    const btnSkip = document.createElement('button');
    btnSkip.innerHTML = '⏮';
    btnSkip.title = 'Skip Forward';
    btnSkip.style.width = '32px';
    btnSkip.style.height = '32px';
    btnSkip.style.padding = '0';
    btnSkip.style.fontSize = '14px';
    btnSkip.style.display = 'flex';
    btnSkip.style.alignItems = 'center';
    btnSkip.style.justifyContent = 'center';

    const btnPlay = document.createElement('button');
    btnPlay.innerHTML = '▶';
    btnPlay.title = 'Play / Pause';
    btnPlay.style.width = '32px';
    btnPlay.style.height = '32px';
    btnPlay.style.padding = '0';
    btnPlay.style.fontSize = '14px';
    btnPlay.style.display = 'flex';
    btnPlay.style.alignItems = 'center';
    btnPlay.style.justifyContent = 'center';

    const btnStop = document.createElement('button');
    btnStop.innerHTML = '⏹';
    btnStop.title = 'Stop';
    btnStop.style.width = '32px';
    btnStop.style.height = '32px';
    btnStop.style.padding = '0';
    btnStop.style.fontSize = '14px';
    btnStop.style.display = 'flex';
    btnStop.style.alignItems = 'center';
    btnStop.style.justifyContent = 'center';

    const btnLoop = document.createElement('button');
    btnLoop.innerHTML = '🔁';
    btnLoop.title = 'Toggle Loop';
    btnLoop.style.width = '32px';
    btnLoop.style.height = '32px';
    btnLoop.style.padding = '0';
    btnLoop.style.fontSize = '14px';
    btnLoop.style.display = 'flex';
    btnLoop.style.alignItems = 'center';
    btnLoop.style.justifyContent = 'center';
    btnLoop.style.opacity = '0.5';

    const statusDot = document.createElement('span');
    statusDot.style.width = '8px';
    statusDot.style.height = '8px';
    statusDot.style.borderRadius = '50%';
    statusDot.style.background = '#445566';
    statusDot.style.display = 'inline-block';
    statusDot.style.flexShrink = '0';

    const timeDisplay = document.createElement('span');
    timeDisplay.textContent = "00:00 / 00:00";
    timeDisplay.style.fontFamily = "'JetBrains Mono', monospace";
    timeDisplay.style.fontSize = '12px';
    timeDisplay.style.color = '#00e5e5';
    timeDisplay.style.marginLeft = 'auto';
    timeDisplay.style.marginRight = '4px';

    const btnGen = document.createElement('button');
    btnGen.innerHTML = '🎲';
    btnGen.title = 'Procedural Generation';
    btnGen.style.width = '32px';
    btnGen.style.height = '32px';
    btnGen.style.padding = '0';
    btnGen.style.fontSize = '14px';
    btnGen.style.display = 'flex';
    btnGen.style.alignItems = 'center';
    btnGen.style.justifyContent = 'center';

    transportBar.appendChild(btnSkip);
    transportBar.appendChild(btnPlay);
    transportBar.appendChild(btnStop);
    transportBar.appendChild(btnLoop);
    transportBar.appendChild(statusDot);
    transportBar.appendChild(timeDisplay);
    transportBar.appendChild(btnGen);
    routineContainer.appendChild(transportBar);

    // Progress bar
    const progressTrack = document.createElement('div');
    progressTrack.style.width = '100%';
    progressTrack.style.height = '3px';
    progressTrack.style.background = 'rgba(100,150,200,0.2)';
    progressTrack.style.borderRadius = '2px';
    progressTrack.style.marginBottom = '10px';
    progressTrack.style.overflow = 'hidden';

    const progressFill = document.createElement('div');
    progressFill.style.height = '100%';
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #00e5e5, #00ffaa)';
    progressFill.style.transition = 'width 0.1s linear';
    progressTrack.appendChild(progressFill);
    routineContainer.appendChild(progressTrack);

    // Playback Speed Control
    const speedDiv = document.createElement('div');
    speedDiv.style.marginTop = "5px";
    speedDiv.style.marginBottom = "10px";
    speedDiv.style.display = "flex";
    speedDiv.style.alignItems = "center";
    speedDiv.style.gap = "10px";
    speedDiv.style.fontSize = "12px";

    const speedLabel = document.createElement('span');
    speedLabel.id = "routine-speed-label";
    speedLabel.textContent = "Speed: 1.0x";
    speedLabel.style.minWidth = "70px";
    speedLabel.style.fontFamily = "'JetBrains Mono', monospace";
    speedLabel.style.color = "#00e5e5";

    const speedSlider = document.createElement('input');
    speedSlider.type = "range";
    speedSlider.id = "routine-speed";
    speedSlider.min = "0.1";
    speedSlider.max = "5.0";
    speedSlider.step = "0.1";
    speedSlider.value = "1.0";
    speedSlider.style.flex = "1";

    speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        player.setPlaybackSpeed(val);
        speedLabel.textContent = `Speed: ${val.toFixed(1)}x`;
    });

    speedDiv.appendChild(speedLabel);
    speedDiv.appendChild(speedSlider);
    routineContainer.appendChild(speedDiv);

    // Load Custom Routine (styled label + hidden input)
    const fileWrapper = document.createElement('div');
    fileWrapper.style.marginTop = "8px";

    const fileLabel = document.createElement('label');
    fileLabel.textContent = "Load Custom Routine (.json / .csv)";
    fileLabel.dataset.tooltip = "Load a custom routine script (.json or .csv)";
    fileLabel.style.display = 'inline-block';
    fileLabel.style.width = '100%';
    fileLabel.style.padding = '6px 10px';
    fileLabel.style.background = '#1a1a2e';
    fileLabel.style.border = '1px solid #445566';
    fileLabel.style.borderRadius = '6px';
    fileLabel.style.color = '#aabbcc';
    fileLabel.style.fontFamily = "'Inter', sans-serif";
    fileLabel.style.fontWeight = '600';
    fileLabel.style.fontSize = '11px';
    fileLabel.style.cursor = 'pointer';
    fileLabel.style.textAlign = 'center';
    fileLabel.style.transition = 'all 0.2s ease';
    fileLabel.style.marginBottom = '6px';

    fileLabel.addEventListener('mouseenter', () => {
        fileLabel.style.transform = 'translateY(-1px)';
        fileLabel.style.filter = 'brightness(1.2)';
    });
    fileLabel.addEventListener('mouseleave', () => {
        fileLabel.style.transform = 'translateY(0)';
        fileLabel.style.filter = 'brightness(1)';
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json, .csv';
    fileInput.style.display = 'none';

    fileLabel.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            if (file.name.toLowerCase().endsWith('.csv')) {
                try {
                    player.loadRoutineFromCSV(text, false);
                    player.play();
                    console.log(`[Main] Loaded custom CSV routine: ${file.name}`);
                } catch (err) {
                    console.error("Invalid CSV:", err);
                    alert("Failed to parse routine CSV.");
                }
            } else {
                try {
                    const routineData = JSON.parse(text);
                    player.loadRoutine(routineData, false);
                    player.play();
                    console.log(`[Main] Loaded custom routine: ${file.name}`);
                } catch (err) {
                    console.error("Invalid JSON:", err);
                    alert("Failed to parse routine JSON.");
                }
            }
        };
        reader.readAsText(file);
    });

    fileWrapper.appendChild(fileLabel);
    fileWrapper.appendChild(fileInput);
    routineContainer.appendChild(fileWrapper);

    // --- GUI Timeline Editor ---
    setupTimelineEditor(player, routineContainer);
    const timelineEditor = new TimelineEditor(player);

    const btnEditor = document.createElement('button');
    btnEditor.textContent = 'Open Timeline Editor';
    btnEditor.dataset.tooltip = "Create and edit custom routines interactively";
    btnEditor.style.width = '100%';
    btnEditor.style.marginTop = '8px';
    btnEditor.style.padding = '6px 10px';
    btnEditor.style.background = '#2a1a3e';
    btnEditor.style.border = '1px solid #554466';
    btnEditor.style.borderRadius = '6px';
    btnEditor.style.color = '#ccaabb';
    btnEditor.style.cursor = 'pointer';
    btnEditor.onclick = () => timelineEditor.open();

    routineContainer.appendChild(btnEditor);
    // --- End GUI Timeline Editor ---

    // Event Listeners
    const state = { isLoading: false, loopActive: false };

    btnPlay.onclick = async () => {
        if (player.isPlaying) {
            player.pause();
        } else {
            if (player.routine.length === 0) {
                 state.isLoading = true;
                 btnPlay.innerHTML = "⏳";
                 await player.loadRoutineFromFile('/routines/deep_thought.json', state.loopActive);
                 state.isLoading = false;
                 player.play();
            } else {
                if (player.lastPauseTime > 0) {
                    player.resume();
                } else {
                    player.play();
                }
            }
        }
    };

    btnStop.onclick = () => player.stop();

    btnSkip.onclick = () => {
        if (player.routine.length === 0) return;
        const skipAmount = 5.0;
        const target = Math.min(player.elapsedTime + skipAmount, player.duration);
        while (player.cursor < player.routine.length && player.routine[player.cursor].time <= target) {
            player.cursor++;
        }
        player.elapsedTime = target;
    };

    btnGen.onclick = () => {
         player.generateProceduralRoutine();
         player.play();
    };

    btnLoop.onclick = () => {
        state.loopActive = !state.loopActive;
        player.loop = state.loopActive;
        btnLoop.style.opacity = state.loopActive ? '1' : '0.5';
    };

    // Status dot pulse animation style injection
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
        @keyframes pulse-cyan {
            0% { box-shadow: 0 0 0 0 rgba(0, 229, 229, 0.7); }
            70% { box-shadow: 0 0 0 6px rgba(0, 229, 229, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 229, 229, 0); }
        }
        .status-pulse {
            animation: pulse-cyan 1.5s infinite;
        }
    `;
    document.head.appendChild(pulseStyle);

    controls.appendChild(routineContainer);

    return { btnPlay, statusDot, timeDisplay, progressFill, state };
}


// ui-bci-panel.js
import { BUILTIN_PATTERNS } from './tensor-player.js';

export function setupBciPanel(renderer, controls, tensorPlayer) {
    // -----------------------------
    // [BCI] Tensor Data Player Panel
    // -----------------------------

    const bciContainer = document.createElement('div');
    bciContainer.style.marginTop = '10px';
    bciContainer.style.paddingTop = '10px';
    bciContainer.style.borderTop = '1px solid #444';

    const bciTitle = document.createElement('div');
    bciTitle.textContent = 'BCI Tensor Playback';
    bciTitle.dataset.tooltip = "Stream pre-recorded 32×32×32 neural tensor frames";
    bciTitle.style.color = '#00ffaa';
    bciTitle.style.fontSize = '12px';
    bciTitle.style.fontWeight = 'bold';
    bciTitle.style.marginBottom = '6px';
    bciContainer.appendChild(bciTitle);

    // Built-in pattern selector
    const bciPatternSelect = document.createElement('select');
    bciPatternSelect.style.width = '100%';
    bciPatternSelect.style.marginBottom = '5px';
    bciPatternSelect.dataset.tooltip = "Select a built-in BCI pattern to simulate";
    bciPatternSelect.style.background = '#1a2a3a';
    bciPatternSelect.style.color = '#ddd';
    bciPatternSelect.style.border = '1px solid #444';
    bciPatternSelect.style.padding = '3px';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Built-in Patterns —';
    bciPatternSelect.appendChild(defaultOpt);
    BUILTIN_PATTERNS.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.label;
        opt.title = p.description;
        bciPatternSelect.appendChild(opt);
    });
    bciContainer.appendChild(bciPatternSelect);

    // Transport row
    const bciTransport = document.createElement('div');
    bciTransport.style.display = 'flex';
    bciTransport.style.gap = '4px';
    bciTransport.style.marginBottom = '5px';

    const bciPlay = document.createElement('button');
    bciPlay.textContent = '▶';
    bciPlay.title = 'Play BCI data';
    bciPlay.style.flex = '1';
    bciPlay.style.background = '#005522';
    bciPlay.style.color = '#00ffaa';

    const bciPause = document.createElement('button');
    bciPause.textContent = '⏸';
    bciPause.title = 'Pause';
    bciPause.style.flex = '1';
    bciPause.style.background = '#334';

    const bciStop = document.createElement('button');
    bciStop.textContent = '⏹';
    bciStop.title = 'Stop & restore physics';
    bciStop.style.flex = '1';
    bciStop.style.background = '#330011';
    bciStop.style.color = '#ff5566';

    bciTransport.appendChild(bciPlay);
    bciTransport.appendChild(bciPause);
    bciTransport.appendChild(bciStop);
    bciContainer.appendChild(bciTransport);

    // Speed control
    const bciSpeedRow = document.createElement('div');
    bciSpeedRow.style.display = 'flex';
    bciSpeedRow.style.gap = '8px';
    bciSpeedRow.style.alignItems = 'center';
    bciSpeedRow.style.fontSize = '11px';
    bciSpeedRow.style.color = '#aaa';
    bciSpeedRow.style.marginBottom = '5px';

    const bciSpeedLabel = document.createElement('span');
    bciSpeedLabel.textContent = '1.0×';
    bciSpeedLabel.style.minWidth = '32px';

    const bciSpeedSlider = document.createElement('input');
    bciSpeedSlider.type = 'range';
    bciSpeedSlider.min = '0.1';
    bciSpeedSlider.max = '4.0';
    bciSpeedSlider.step = '0.1';
    bciSpeedSlider.value = '1.0';
    bciSpeedSlider.style.flex = '1';
    bciSpeedSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        tensorPlayer.setSpeed(v);
        bciSpeedLabel.textContent = v.toFixed(1) + '×';
    });

    bciSpeedRow.appendChild(document.createTextNode('Speed: '));
    bciSpeedRow.appendChild(bciSpeedSlider);
    bciSpeedRow.appendChild(bciSpeedLabel);
    bciContainer.appendChild(bciSpeedRow);

    // Frame scrubber + counter
    const bciScrubRow = document.createElement('div');
    bciScrubRow.style.display = 'flex';
    bciScrubRow.style.gap = '6px';
    bciScrubRow.style.alignItems = 'center';
    bciScrubRow.style.marginBottom = '5px';

    const bciScrubber = document.createElement('input');
    bciScrubber.type = 'range';
    bciScrubber.min = '0';
    bciScrubber.max = '1';
    bciScrubber.value = '0';
    bciScrubber.style.flex = '1';

    const bciFrameLabel = document.createElement('span');
    bciFrameLabel.textContent = '0/0';
    bciFrameLabel.style.fontSize = '10px';
    bciFrameLabel.style.color = '#888';
    bciFrameLabel.style.minWidth = '48px';

    bciScrubber.addEventListener('input', (e) => {
        tensorPlayer.seek(parseInt(e.target.value));
    });

    bciScrubRow.appendChild(bciScrubber);
    bciScrubRow.appendChild(bciFrameLabel);
    bciContainer.appendChild(bciScrubRow);

    // File loader (custom .bin / .npy / .csv)
    const bciFileLabel = document.createElement('label');
    bciFileLabel.textContent = 'Load tensor file (.bin / .npy / .csv)';
    bciFileLabel.style.fontSize = '11px';
    bciFileLabel.style.color = '#888';
    bciContainer.appendChild(bciFileLabel);

    const bciFileInput = document.createElement('input');
    bciFileInput.type = 'file';
    bciFileInput.accept = '.bin,.npy,.csv';
    bciFileInput.style.width = '100%';
    bciFileInput.style.color = '#aaa';
    bciFileInput.style.fontSize = '11px';
    bciFileInput.style.marginTop = '3px';
    bciContainer.appendChild(bciFileInput);

    controls.appendChild(bciContainer);

    // TensorPlayer callbacks
    tensorPlayer.onFrameChange = (frame, total) => {
        bciFrameLabel.textContent = `${frame}/${total}`;
        if (total > 1) {
            bciScrubber.max = total - 1;
            bciScrubber.value = frame;
        }
    };
    tensorPlayer.onPlayStateChange = (playing) => {
        bciPlay.textContent = playing ? '⏸' : '▶';
        bciPlay.style.background = playing ? '#005588' : '#005522';
    };

    // BCI transport button handlers
    let bciGenerating = false;
    const loadAndPlayPattern = async (patternId) => {
        const pattern = BUILTIN_PATTERNS.find(p => p.id === patternId);
        if (!pattern) return;
        if (bciGenerating) return;
        bciGenerating = true;
        bciPlay.textContent = '⏳';
        bciPlay.disabled = true;
        try {
            const frames = await Promise.resolve(pattern.generate(tensorPlayer));
            tensorPlayer.loadFrames(frames);
            tensorPlayer.play();
        } finally {
            bciGenerating = false;
            bciPlay.disabled = false;
        }
    };

    bciPlay.onclick = async () => {
        if (tensorPlayer.isPlaying) {
            tensorPlayer.pause();
        } else if (tensorPlayer.totalFrames > 0) {
            tensorPlayer.play();
        } else {
            const patternId = bciPatternSelect.value;
            if (patternId) {
                await loadAndPlayPattern(patternId);
            } else {
                // Default: alpha waves
                await loadAndPlayPattern('alpha-waves');
                bciPatternSelect.value = 'alpha-waves';
            }
        }
    };

    bciPause.onclick = () => tensorPlayer.pause();
    bciStop.onclick = () => {
        tensorPlayer.stop();
        bciScrubber.value = 0;
    };

    bciPatternSelect.addEventListener('change', async (e) => {
        if (!e.target.value) return;
        await loadAndPlayPattern(e.target.value);
    });

    bciFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            let frames;
            if (file.name.endsWith('.npy')) {
                frames = await tensorPlayer.loadNPY(file);
            } else if (file.name.endsWith('.csv')) {
                frames = await tensorPlayer.loadCSVSeries(file);
            } else {
                frames = await tensorPlayer.loadBinary(file);
            }
            tensorPlayer.loadFrames(frames);
            tensorPlayer.play();
            bciPatternSelect.value = ''; // deselect built-in
        } catch (err) {
            console.error('[TensorPlayer] Failed to load file:', err);
            alert('Failed to load tensor file: ' + err.message);
        }
    });
}


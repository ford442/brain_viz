import { TimelineEditor } from './timeline-editor.js';
// src/ui-panels.js — Extracted UI panel builders from main.js
// Neuro-Weaver V2.8

import { BUILTIN_PATTERNS } from './tensor-player.js';
import { DEFAULT_PROFILES, getCustomProfile, saveCustomProfile } from './neuromodulators.js';

import { setupTimelineEditor } from './ui-timeline-editor.js';

export function setupLegendPanel() {
    const fabHelp = document.createElement('button');
    fabHelp.className = 'fab-help';
    fabHelp.innerHTML = '?';
    fabHelp.title = 'Keyboard Shortcuts';
    document.body.appendChild(fabHelp);

    const legendPanel = document.createElement('div');
    legendPanel.className = 'legend-panel';
    legendPanel.innerHTML = `
        <h3>Keyboard Shortcuts</h3>
        <div class="legend-section">
            <div class="legend-section-title">Views</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">7</span><span>Top View</span></div>
                <div class="legend-item"><span class="legend-key">8</span><span>Bottom View</span></div>
                <div class="legend-item"><span class="legend-key">9</span><span>Isometric</span></div>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-section-title">States</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">1</span><span>Surprise</span></div>
                <div class="legend-item"><span class="legend-key">2</span><span>Calm</span></div>
                <div class="legend-item"><span class="legend-key">3</span><span>Scan</span></div>
                <div class="legend-item"><span class="legend-key">4</span><span>Serotonin</span></div>
                <div class="legend-item"><span class="legend-key">5</span><span>Epiphany</span></div>
                <div class="legend-item"><span class="legend-key">F</span><span>Flow State</span></div>
                <div class="legend-item"><span class="legend-key">X</span><span>Neurotransmitter Depletion</span></div>

                <div class="legend-item"><span class="legend-key">W</span><span>Weather</span></div>
                <div class="legend-item"><span class="legend-key">P</span><span>Panic</span></div>
                <div class="legend-item"><span class="legend-key">6</span><span>Cortisol</span></div>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-section-title">Neurochemical</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">UI</span><span>Neuromodulator Panel</span></div>
                <div class="legend-item"><span class="legend-key">d</span><span>Dopamine</span></div>
                <div class="legend-item"><span class="legend-key">e</span><span>Endorphin</span></div>
                <div class="legend-item"><span class="legend-key">y</span><span>Oxytocin</span></div>
                <div class="legend-item"><span class="legend-key">r</span><span>Acetylcholine</span></div>
                <div class="legend-item"><span class="legend-key">h</span><span>GABA</span></div>
                <div class="legend-item"><span class="legend-key">j</span><span>Melatonin</span></div>
                <div class="legend-item"><span class="legend-key">a</span><span>Adrenaline</span></div>
                <div class="legend-item"><span class="legend-key">u</span><span>Noradrenaline</span></div>
                <div class="legend-item"><span class="legend-key">B</span><span>Endocannabinoid</span></div>
                <div class="legend-item"><span class="legend-key">K</span><span>ATP Depletion</span></div>
                <div class="legend-item"><span class="legend-key">U</span><span>Sleep Deprivation</span></div>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-section-title">Systems</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">,</span><span>Pupillary Dilation</span></div>
                <div class="legend-item"><span class="legend-key">H</span><span>Heartbeat</span></div>
                <div class="legend-item"><span class="legend-key">R</span><span>Respiration</span></div>
                <div class="legend-item"><span class="legend-key">E</span><span>Electrical</span></div>
                <div class="legend-item"><span class="legend-key">M</span><span>Mercury Vapor</span></div>
                <div class="legend-item"><span class="legend-key">T</span><span>TMS Pulse</span></div>
                <div class="legend-item"><span class="legend-key">I</span><span>Inflammation</span></div>
                <div class="legend-item"><span class="legend-key">C</span><span>Glial Cleanup</span></div>
                <div class="legend-item"><span class="legend-key">F</span><span>Fluid Dynamics</span></div>
                <div class="legend-item"><span class="legend-key">W</span><span>Sensory Overload</span></div>
                <div class="legend-item"><span class="legend-key">A</span><span>Auditory Hallucination</span></div>
                <div class="legend-item"><span class="legend-key">[</span><span>Binding Kinetics</span></div>
                <div class="legend-item"><span class="legend-key">Q</span><span>Neuroplasticity</span></div>
                <div class="legend-item"><span class="legend-key">K</span><span>Memory Formation</span></div>
                <div class="legend-item"><span class="legend-key">N</span><span>Myelin Degradation</span></div>
                <div class="legend-item"><span class="legend-key">*</span><span>Sync Burst</span></div>
                <div class="legend-item"><span class="legend-key">D</span><span>Dynamic Topology</span></div>
                <div class="legend-item"><span class="legend-key">+</span><span>Dendritic Growth</span></div>
                <div class="legend-item"><span class="legend-key">E</span><span>Visual Cortex Processing</span></div>
                <div class="legend-item"><span class="legend-key">?</span><span>Cognitive Dissonance</span></div>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-section-title">Cinematic</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">0</span><span>Focus</span></div>
                <div class="legend-item"><span class="legend-key">-</span><span>Breathe</span></div>
                <div class="legend-item"><span class="legend-key">l</span><span>Lighting</span></div>
                <div class="legend-item"><span class="legend-key">g</span><span>Fog</span></div>
                <div class="legend-item"><span class="legend-key">f</span><span>Filters</span></div>
                <div class="legend-item"><span class="legend-key">v</span><span>Fly-Through</span></div>
                <div class="legend-item"><span class="legend-key">V</span><span>HRV Glitch Sync</span></div>
                <div class="legend-item"><span class="legend-key">O</span><span>Dynamic FOV</span></div>
                <div class="legend-item"><span class="legend-key">Z</span><span>Clip Reveal</span></div>
                <div class="legend-item"><span class="legend-key">X</span><span>Marker Event</span></div>
                <div class="legend-item"><span class="legend-key">L</span><span>Lobe Tour</span></div>
                <div class="legend-item"><span class="legend-key">i</span><span>Interactive</span></div>
            </div>
        </div>
        <div class="legend-section">
            <div class="legend-section-title">Advanced</div>
            <div class="legend-row">
                <div class="legend-item"><span class="legend-key">=</span><span>Exponential Ease</span></div>
                <div class="legend-item"><span class="legend-key">t</span><span>Time Warp</span></div>
                <div class="legend-item"><span class="legend-key">x</span><span>Time Modulation</span></div>
                <div class="legend-item"><span class="legend-key">p</span><span>Spline</span></div>
                <div class="legend-item"><span class="legend-key">w</span><span>Math / Variables</span></div>
                <div class="legend-item"><span class="legend-key">q</span><span>Choice</span></div>
                <div class="legend-item"><span class="legend-key">!</span><span>Glitch</span></div>
                <div class="legend-item"><span class="legend-key">G</span><span>GSR Sync</span></div>
                <div class="legend-item"><span class="legend-key">S</span><span>Signal</span></div>
                <div class="legend-item"><span class="legend-key">m</span><span>Memory</span></div>
                <div class="legend-item"><span class="legend-key">b</span><span>Branch</span></div>
                <div class="legend-item"><span class="legend-key">o</span><span>Orbit Avoid</span></div>
                <div class="legend-item"><span class="legend-key">c</span><span>Custom Audio</span></div>
                <div class="legend-item"><span class="legend-key">k</span><span>Binaural</span></div>
                <div class="legend-item"><span class="legend-key">n</span><span>Neuro-Cinema</span></div>
                <div class="legend-item"><span class="legend-key">z</span><span>Default Mode</span></div>
                <div class="legend-item"><span class="legend-key">Y</span><span>Smooth Easing</span></div>
                <div class="legend-item"><span class="legend-key">~</span><span>Stroke Lesion</span></div>
            </div>
        </div>
    `;
    document.body.appendChild(legendPanel);

    let legendOpen = false;
    const legendStorageKey = 'neuro_weaver_legend_seen';

    function toggleLegend(forceState) {
        legendOpen = forceState !== undefined ? forceState : !legendOpen;
        if (legendOpen) {
            legendPanel.classList.add('open');
        } else {
            legendPanel.classList.remove('open');
        }
    }

    fabHelp.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLegend();
    });

    document.addEventListener('click', (e) => {
        if (legendOpen && !legendPanel.contains(e.target) && e.target !== fabHelp) {
            toggleLegend(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && legendOpen) {
            toggleLegend(false);
        }
    });

    // Auto-open on first visit
    try {
        if (!localStorage.getItem(legendStorageKey)) {
            localStorage.setItem(legendStorageKey, 'true');
            toggleLegend(true);
        }
    } catch (e) {}
}

export function setupOverlays(player, filterOverlay, inputs, labels) {
    // [Phase 4] Narrative Overlay
    const narrative = document.createElement('div');
    narrative.id = 'narrative-overlay';
    Object.assign(narrative.style, {
        position: 'absolute',
        bottom: '15%',
        width: '100%',
        textAlign: 'center',
        color: 'rgba(200, 240, 255, 0.95)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '22px',
        letterSpacing: '1px',
        textShadow: '0 0 10px rgba(0,150,255,0.6), 0 0 40px rgba(0,100,200,0.3)',
        pointerEvents: 'none',
        transition: 'opacity 1.0s ease-in-out',
        opacity: '0',
        zIndex: '100'
    });
    const narrativeText = document.createElement('span');
    narrativeText.id = 'narrative-text';
    narrative.appendChild(narrativeText);
    const narrativeCursor = document.createElement('span');
    narrativeCursor.id = 'narrative-cursor';
    narrativeCursor.textContent = '|';
    narrativeCursor.style.color = '#00e5e5';
    narrativeCursor.style.fontWeight = '100';
    narrativeCursor.style.display = 'none';
    narrative.appendChild(narrativeCursor);
    document.body.appendChild(narrative);

    // [Phase 2] Interactive Visual Overlay Container
    const visualOverlay = document.createElement('div');
    visualOverlay.id = 'visual-overlay';
    Object.assign(visualOverlay.style, {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 20, 40, 0.9)',
        border: '2px solid #00aaff',
        padding: '20px 40px',
        borderRadius: '10px',
        color: '#fff',
        fontFamily: 'monospace',
        textAlign: 'center',
        display: 'none',
        zIndex: '300',
        boxShadow: '0 0 20px rgba(0, 150, 255, 0.5)'
    });
    document.body.appendChild(visualOverlay);

    // Sync UI when routine executes events
    let narrativeTimeout = null;
    let typeInterval = null;

    player.onEvent = (event) => {
         if (event.type === 'choice') {
             if (event.choices) {
                 let html = `<h3>${event.message || 'Make a choice:'}</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">`;
                 event.choices.forEach((c, idx) => {
                     html += `<button id="choice-btn-${idx}" style="padding: 10px 20px; background: #0055aa; color: white; border: none; cursor: pointer; border-radius: 4px; font-family: monospace; font-size: 14px;">${c.text}</button>`;
                 });
                 html += `</div>`;

                 visualOverlay.innerHTML = html;
                 visualOverlay.style.display = 'block';

                 event.choices.forEach((c, idx) => {
                     const btn = document.getElementById(`choice-btn-${idx}`);
                     if (btn) {
                         btn.onmouseover = () => btn.style.background = '#0077ff';
                         btn.onmouseout = () => btn.style.background = '#0055aa';
                         btn.onclick = () => {
                             visualOverlay.style.display = 'none';

                             // Apply state updates if present
                             if (c.stateUpdates) {
                                 for (const [key, val] of Object.entries(c.stateUpdates)) {
                                     player.state[key] = val;
                                 }
                             }

                             // Execute branch if present
                             if (c.branch && player.subRoutines[c.branch]) {
                                 console.log(`[UI] Branching to: ${c.branch}`);
                                 // We use playNow which resets the current routine to the branch
                                 player.playNow(player.subRoutines[c.branch]);
                             } else {
                                 // Just resume if no branch
                                 player.resume();
                             }
                         };
                     }
                 });
             }
         }
         if (event.type === 'overlay') {
             if (event.content) {
                 visualOverlay.innerHTML = event.content;
                 visualOverlay.style.display = 'block';

                 if (event.interactive) {
                     player.pause();
                     const btn = document.createElement('button');
                     btn.textContent = event.buttonText || 'Continue';
                     Object.assign(btn.style, {
                         marginTop: '20px', padding: '10px 20px', background: '#0055aa',
                         color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px',
                         fontFamily: 'monospace', fontSize: '14px'
                     });
                     btn.onmouseover = () => btn.style.background = '#0077ff';
                     btn.onmouseout = () => btn.style.background = '#0055aa';
                     btn.onclick = () => {
                         visualOverlay.style.display = 'none';
                         player.resume();
                     };
                     visualOverlay.appendChild(btn);
                 } else if (event.duration) {
                     setTimeout(() => {
                         visualOverlay.style.display = 'none';
                     }, event.duration * 1000);
                 }
             } else {
                 visualOverlay.style.display = 'none';
             }
         }
         if (event.type === 'cssFilter') {
             if (event.filter) {
                 filterOverlay.applyFilter(event.filter);
             }
         }
         if (event.type === 'text') {
             if (event.message) {
                 // Simple Markdown parsing for bold, italic, and links
                 let htmlMessage = event.message
                     .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
                     .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
                     .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#00aaff;">$1</a>'); // Links

                 // Strip tags for typing
                 const tmp = document.createElement('div');
                 tmp.innerHTML = htmlMessage;
                 const plainText = tmp.textContent || '';

                 if (narrativeTimeout) clearTimeout(narrativeTimeout);
                 if (typeInterval) clearInterval(typeInterval);

                 narrative.style.opacity = '1';
                 narrativeText.textContent = '';
                 narrativeCursor.style.display = 'inline';

                 let i = 0;
                 const maxTypingTime = event.duration ? (event.duration * 1000) / 2 : Infinity;
                 const interval = plainText.length > 0 && maxTypingTime !== Infinity
                     ? Math.min(30, Math.floor(maxTypingTime / plainText.length))
                     : 30;

                 typeInterval = setInterval(() => {
                     i++;
                     narrativeText.textContent = plainText.substring(0, i);
                     if (i >= plainText.length) {
                         clearInterval(typeInterval);
                         typeInterval = null;
                         narrativeText.innerHTML = htmlMessage;
                         narrativeCursor.style.display = 'none';
                     }
                 }, interval);

                 // Optional: Auto-fade if duration is provided
                 if (event.duration) {
                     narrativeTimeout = setTimeout(() => {
                         narrative.style.opacity = '0';
                         narrativeTimeout = null;
                     }, event.duration * 1000);
                 }
             } else {
                 narrative.style.opacity = '0';
                 narrativeText.textContent = '';
                 narrativeCursor.style.display = 'none';
                 if (narrativeTimeout) {
                     clearTimeout(narrativeTimeout);
                     narrativeTimeout = null;
                 }
                 if (typeInterval) {
                     clearInterval(typeInterval);
                     typeInterval = null;
                 }
             }
         }
         if (event.type === 'param') {
             if (inputs[event.key]) inputs[event.key].value = event.value;
             if (labels[event.key]) labels[event.key].textContent = event.value.toFixed(2);
         }
         if (event.type === 'calm') {
             // Calm state modifies amplitude, frequency, smoothing
             // We should sync them if they are in the renderer params
             ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'cortisol', 'cognitiveLoad', 'fluidActive', 'fogDensity', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
                if (inputs[k]) inputs[k].value = player.renderer.params[k];
                if (labels[k]) labels[k].textContent = player.renderer.params[k].toFixed(2);
             });
         }
         if (event.type === 'reset') {
             // Reset might clear buffers but usually doesn't change params,
             // but if it did, we'd sync here.
         }
         if (event.type === 'speed') {
             const speedSlider = document.getElementById('routine-speed');
             const speedLabel = document.getElementById('routine-speed-label');
             if (speedSlider) speedSlider.value = event.value;
             if (speedLabel) speedLabel.textContent = `Speed: ${event.value.toFixed(1)}x`;
         }
    };

    return { narrative, narrativeText, narrativeCursor, visualOverlay };
}

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

export function setupNeuromodulatorPanel(renderer, controls) {
    const neuroContainer = document.createElement('div');
    neuroContainer.style.marginTop = '10px';
    neuroContainer.style.paddingTop = '10px';
    neuroContainer.style.borderTop = '1px solid #444';

    const neuroTitle = document.createElement('div');
    neuroTitle.id = 'neuro-panel-title';
    neuroTitle.textContent = 'Neuromodulator Profile';
    neuroTitle.dataset.tooltip = "Live-edit chemical diffusion, decay, and regional retention";
    neuroTitle.style.color = '#ffffff';
    neuroTitle.style.fontSize = '12px';
    neuroTitle.style.fontWeight = 'bold';
    neuroTitle.style.marginBottom = '6px';
    neuroContainer.appendChild(neuroTitle);

    const select = document.createElement('select');
    select.id = 'neuro-profile-select';
    select.style.width = '100%';
    select.style.marginBottom = '8px';
    select.style.background = '#222';
    select.style.color = '#fff';
    select.style.border = '1px solid #555';
    select.style.padding = '4px';

    Object.keys(DEFAULT_PROFILES).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = DEFAULT_PROFILES[key].name;
        select.appendChild(opt);
    });
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom';
    select.appendChild(customOpt);

    neuroContainer.appendChild(select);

    const slidersContainer = document.createElement('div');
    slidersContainer.id = 'neuro-sliders-container';

    const sliders = [
        { id: 'neuro-diffusion', label: 'Diffusion Rate', min: 0.0, max: 0.5, step: 0.01, prop: 'diffusionRate' },
        { id: 'neuro-decay', label: 'Decay Rate', min: 0.8, max: 1.0, step: 0.001, prop: 'decayRate' },
        { id: 'neuro-pulse', label: 'Pulse Saturation', min: 0.0, max: 3.0, step: 0.1, prop: 'pulseSaturation' },
        { id: 'neuro-trail', label: 'Trail Length', min: 0.0, max: 5.0, step: 0.1, prop: 'trailLength' },
        { id: 'neuro-ret-front', label: 'Retention: Frontal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'frontal' },
        { id: 'neuro-ret-occ', label: 'Retention: Occipital', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'occipital' },
        { id: 'neuro-ret-temp', label: 'Retention: Temporal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'temporal' },
        { id: 'neuro-ret-par', label: 'Retention: Parietal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'parietal' }
    ];

    const sliderElements = {};

    sliders.forEach(s => {
        const wrap = document.createElement('div');
        wrap.className = 'control-row';
        wrap.style.marginBottom = '4px';

        const label = document.createElement('label');
        label.textContent = s.label;
        label.style.flex = '1';
        label.style.fontSize = '11px';

        const valLabel = document.createElement('span');
        valLabel.style.width = '30px';
        valLabel.style.textAlign = 'right';
        valLabel.style.fontSize = '11px';
        valLabel.style.color = '#00ffaa';

        const input = document.createElement('input');
        input.type = 'range';
        input.min = s.min;
        input.max = s.max;
        input.step = s.step;
        input.style.flex = '2';

        input.oninput = (e) => {
            valLabel.textContent = e.target.value;
            if (window.visualizerAPI && window.visualizerAPI.setNeuromodulatorParams) {
                // If a built-in profile is modified, switch to Custom automatically
                if (select.value !== 'custom') {
                    select.value = 'custom';
                }

                // Read all current slider values to build the custom profile
                const currentProfile = {
                    name: 'Custom',
                    color: '#ffffff',
                    diffusionRate: parseFloat(sliderElements['diffusionRate'].value),
                    decayRate: parseFloat(sliderElements['decayRate'].value),
                    pulseSaturation: parseFloat(sliderElements['pulseSaturation'].value),
                    trailLength: parseFloat(sliderElements['trailLength'].value),
                    retentionBias: {
                        frontal: parseFloat(sliderElements['retentionBias_frontal'].value),
                        occipital: parseFloat(sliderElements['retentionBias_occipital'].value),
                        temporal: parseFloat(sliderElements['retentionBias_temporal'].value),
                        parietal: parseFloat(sliderElements['retentionBias_parietal'].value)
                    }
                };
                window.visualizerAPI.setNeuromodulatorParams(currentProfile);
            }
        };

        wrap.appendChild(label);
        wrap.appendChild(input);
        wrap.appendChild(valLabel);
        slidersContainer.appendChild(wrap);

        sliderElements[s.subprop ? `${s.prop}_${s.subprop}` : s.prop] = input;
    });

    neuroContainer.appendChild(slidersContainer);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save as Custom';
    saveBtn.style.width = '100%';
    saveBtn.style.marginTop = '6px';
    saveBtn.style.padding = '4px';
    saveBtn.style.background = '#333';
    saveBtn.style.color = '#fff';
    saveBtn.style.border = '1px solid #555';
    saveBtn.style.cursor = 'pointer';

    saveBtn.onclick = () => {
        const customProfile = {
            name: 'Custom',
            color: '#ffffff',
            diffusionRate: parseFloat(sliderElements['diffusionRate'].value),
            decayRate: parseFloat(sliderElements['decayRate'].value),
            pulseSaturation: parseFloat(sliderElements['pulseSaturation'].value),
            trailLength: parseFloat(sliderElements['trailLength'].value),
            retentionBias: {
                frontal: parseFloat(sliderElements['retentionBias_frontal'].value),
                occipital: parseFloat(sliderElements['retentionBias_occipital'].value),
                temporal: parseFloat(sliderElements['retentionBias_temporal'].value),
                parietal: parseFloat(sliderElements['retentionBias_parietal'].value)
            }
        };
        saveCustomProfile(customProfile);
        alert('Custom profile saved.');
    };

    neuroContainer.appendChild(saveBtn);
    controls.appendChild(neuroContainer);

    function loadProfileToUI(profileKey) {
        let profile;
        if (profileKey === 'custom') {
            profile = getCustomProfile();
        } else {
            profile = DEFAULT_PROFILES[profileKey];
        }

        if (!profile) return;

        neuroTitle.style.color = profile.color;

        sliderElements['diffusionRate'].value = profile.diffusionRate;
        sliderElements['diffusionRate'].nextElementSibling.textContent = profile.diffusionRate;

        sliderElements['decayRate'].value = profile.decayRate;
        sliderElements['decayRate'].nextElementSibling.textContent = profile.decayRate;

        sliderElements['pulseSaturation'].value = profile.pulseSaturation;
        sliderElements['pulseSaturation'].nextElementSibling.textContent = profile.pulseSaturation;

        sliderElements['trailLength'].value = profile.trailLength;
        sliderElements['trailLength'].nextElementSibling.textContent = profile.trailLength;

        sliderElements['retentionBias_frontal'].value = profile.retentionBias.frontal;
        sliderElements['retentionBias_frontal'].nextElementSibling.textContent = profile.retentionBias.frontal;

        sliderElements['retentionBias_occipital'].value = profile.retentionBias.occipital;
        sliderElements['retentionBias_occipital'].nextElementSibling.textContent = profile.retentionBias.occipital;

        sliderElements['retentionBias_temporal'].value = profile.retentionBias.temporal;
        sliderElements['retentionBias_temporal'].nextElementSibling.textContent = profile.retentionBias.temporal;

        sliderElements['retentionBias_parietal'].value = profile.retentionBias.parietal;
        sliderElements['retentionBias_parietal'].nextElementSibling.textContent = profile.retentionBias.parietal;

        if (window.visualizerAPI && window.visualizerAPI.setNeuromodulatorParams) {
            window.visualizerAPI.setNeuromodulatorParams(profile);
        }
    }

    select.addEventListener('change', (e) => {
        loadProfileToUI(e.target.value);
    });

    // We must expose a way to externally update the UI (e.g. from marker events)
    window.updateNeuromodulatorUI = (profileKey) => {
        if (select.value !== profileKey) {
            select.value = profileKey;
            loadProfileToUI(profileKey);
        }
    };

    // Initialize UI and sliders on load
    loadProfileToUI(select.value);
}

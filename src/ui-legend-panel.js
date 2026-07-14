// ui-legend-panel.js
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
                <div class="legend-item"><span class="legend-key">^</span><span>Signal Trails</span></div>
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
                <div class="legend-item"><span class="legend-key">#</span><span>Psychedelic Trip</span></div>
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


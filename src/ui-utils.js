export class FilterUIOverlay {
    constructor(canvas) {
        this.canvas = canvas;
    }

    applyFilter(filterString) {
        if (this.canvas) {
            this.canvas.style.filter = filterString;
        }
    }
}

export function initUIControls(renderer, uiInputs, uiLabels) {
    // [Neuro-Weaver] Sync UI State with Renderer Params
    const syncParam = (paramKey, paramValue) => {
        const floatVal = parseFloat(paramValue);
        renderer.setParams({ [paramKey]: floatVal });
        if (uiLabels[paramKey]) uiLabels[paramKey].textContent = floatVal.toFixed(2);
    };

    // Attach listeners to all inputs
    Object.keys(uiInputs).forEach(key => {
        const inputEl = uiInputs[key];
        if (!inputEl) return;
        syncParam(key, inputEl.value);
        if (inputEl.tagName === 'SELECT') return;
        inputEl.addEventListener('input', (evt) => syncParam(key, evt.target.value));
    });

    const styleDropdown = document.getElementById('style-mode');
    if (styleDropdown) {
        styleDropdown.addEventListener('change', (evt) => {
            const selectedStyle = parseFloat(evt.target.value);
            renderer.setParams({ style: selectedStyle });
            // Style presets...
            const stylePresets = {
                3: { amplitude: 1.0, smoothing: 0.95 },
                2: { frequency: 8.0, smoothing: 0.2, amplitude: 1.5 },
                1: { frequency: 5.0, smoothing: 0.5 },
                0: { frequency: 2.0, smoothing: 0.9 }
            };
            const activePreset = stylePresets[selectedStyle] || stylePresets[0];
            Object.keys(activePreset).forEach(pKey => {
                renderer.setParams({ [pKey]: activePreset[pKey] });
                if(uiInputs[pKey]) uiInputs[pKey].value = activePreset[pKey];
                syncParam(pKey, activePreset[pKey]);
            });
            // [Phase 10] Mode-change toast
            const controls = document.getElementById('controls');
            if (controls) {
                let toast = controls.querySelector('.mode-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.className = 'mode-toast';
                    controls.appendChild(toast);
                }
                const modeName = styleDropdown.options[styleDropdown.selectedIndex].text.replace(/^\d+\.\s*/, '');
                toast.textContent = `Mode: ${modeName}`;
                toast.classList.add('show');
                clearTimeout(toast._hideTimer);
                toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 1000);
            }
        });
    }

    // Altitude/Hypoxia Special Handler
    const altitudeInput = document.getElementById('altitude');
    if (altitudeInput) {
        altitudeInput.addEventListener('input', (evt) => {
            const altVal = parseFloat(evt.target.value);
            renderer.setParams({ altitude: altVal });
            renderer.updateAltitudeState();

            // Update UI labels
            const val = uiInputs.altitude;
            if (uiLabels.altitude) uiLabels.altitude.textContent = altVal.toFixed(0);
            if (uiLabels.oxygen) uiLabels.oxygen.textContent = renderer.params.oxygenLevel.toFixed(2);
            if (uiLabels.metabolicRate) uiLabels.metabolicRate.textContent = renderer.params.metabolicRate.toFixed(2);

            // Sync read-only oxygen slider
            if (uiInputs.oxygen) uiInputs.oxygen.value = renderer.params.oxygenLevel;
        });
    }

    // [Neuro-Weaver] Stimulus Button Event Listeners
    // Maps UI buttons to 3D brain coordinates for injection
    const regions = [
        { id: 'stim-frontal', pos: [0, 0, 1.2] },   // Frontal Lobe
        { id: 'stim-occipital', pos: [0, 0, -1.2] }, // Occipital Lobe
        { id: 'stim-parietal', pos: [0, 1.0, 0] },   // Parietal Lobe
        { id: 'stim-temporal', pos: [1.0, 0, 0] },   // Temporal Lobe
        { id: 'stim-deep', pos: [0, 0, 0] }          // Deep Structures
    ];

    regions.forEach(region => {
        const btn = document.getElementById(region.id);
        if (btn) {
            btn.addEventListener('click', () => {
                // Inject stimulus at region coordinates with intensity 1.0
                renderer.injectStimulus(region.pos[0], region.pos[1], region.pos[2], 1.0);
                flashButton(btn);
            });
        }
    });

    document.getElementById('stim-random')?.addEventListener('click', () => {
        renderer.injectStimulus((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 1.0);
        flashButton(document.getElementById('stim-random'));
    });

    document.getElementById('stim-electrical')?.addEventListener('click', () => {
        const intensity = parseFloat(document.getElementById('hazard-intensity').value) / 100.0;
        const duration = parseFloat(document.getElementById('hazard-duration').value);
        renderer.injectElectrical(intensity, duration);
        flashButton(document.getElementById('stim-electrical'));
    });

    document.getElementById('stim-mercury')?.addEventListener('click', () => {
        const intensity = parseFloat(document.getElementById('hazard-intensity').value) / 100.0;
        const duration = parseFloat(document.getElementById('hazard-duration').value);
        renderer.injectMercury(intensity, duration);
        flashButton(document.getElementById('stim-mercury'));
    });

    document.getElementById('stim-calm')?.addEventListener('click', () => {
        renderer.calmState();
        flashButton(document.getElementById('stim-calm'));
        glowRegionButtons();
        ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'cortisol', 'heavyMetal', 'cognitiveLoad', 'fluidActive', 'fogDensity', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
            if(uiInputs[k]) uiInputs[k].value = renderer.params[k];
            syncParam(k, renderer.params[k]);
        });
    });

    document.getElementById('stim-reset')?.addEventListener('click', () => renderer.resetActivity());
}

export function initDirectorTools(renderer, player) {
    const container = document.createElement('div');
    container.id = 'director-tools';
    Object.assign(container.style, {
        position: 'absolute',
        bottom: '10px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid #0055aa',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#00aaff',
        zIndex: '200'
    });

    const title = document.createElement('div');
    title.textContent = "DIRECTOR MODE";
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    title.style.color = '#fff';
    container.appendChild(title);

    const labels = {};
    ['RotX', 'RotY', 'Zoom'].forEach(key => {
        const div = document.createElement('div');
        div.style.marginBottom = '2px';
        const label = document.createElement('span');
        label.textContent = `${key}: `;
        label.style.color = '#aaa';
        const val = document.createElement('span');
        val.textContent = '0.00';
        val.style.color = '#0ff';

        div.appendChild(label);
        div.appendChild(val);
        container.appendChild(div);
        labels[key] = val;
    });

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy State';
    Object.assign(copyBtn.style, {
        marginTop: '8px',
        background: '#004488',
        border: '1px solid #0066cc',
        color: 'white',
        cursor: 'pointer',
        width: '100%'
    });

    copyBtn.onclick = () => {
        if (player) {
            player.logCameraState();
        } else {
            console.warn("Player not available for logging");
        }

        const origText = copyBtn.textContent;
        copyBtn.textContent = '✅ Logged to Console';
        setTimeout(() => copyBtn.textContent = origText, 1500);
    };
    container.appendChild(copyBtn);

    document.body.appendChild(container);
    return labels;
}

export function initTooltips() {
    let tooltip = document.getElementById('nw-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'nw-tooltip';
        document.body.appendChild(tooltip);
    }

    let showTimeout = null;
    let currentTarget = null;

    const hide = () => {
        if (showTimeout) { clearTimeout(showTimeout); showTimeout = null; }
        currentTarget = null;
        tooltip.classList.remove('visible');
    };

    const position = (target) => {
        const rect = target.getBoundingClientRect();
        const ttRect = tooltip.getBoundingClientRect();
        let top = rect.top + window.scrollY - ttRect.height - 8;
        let left = rect.left + window.scrollX + (rect.width / 2) - (ttRect.width / 2);
        // Flip to below if too close to top
        if (top < window.scrollY + 10) {
            top = rect.bottom + window.scrollY + 8;
        }
        // Clamp horizontal
        left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    };

    const show = (target) => {
        const text = target.dataset.tooltip || target.title || '';
        if (!text) return;
        tooltip.textContent = text;
        tooltip.style.display = 'block';
        // Force layout so we can measure
        void tooltip.offsetWidth;
        position(target);
        tooltip.classList.add('visible');
    };

    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip], [title]');
        if (!target) { hide(); return; }
        if (target === currentTarget) return;
        hide();
        currentTarget = target;
        showTimeout = setTimeout(() => show(target), 400);
    });

    document.body.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip], [title]');
        if (target && target === currentTarget) {
            hide();
        }
    });

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
}

export function flashButton(btn) {
    if (!btn) return;
    btn.classList.remove('flashing');
    void btn.offsetWidth;
    btn.classList.add('flashing');
    setTimeout(() => btn.classList.remove('flashing'), 600);
}

export function glowRegionButtons() {
    document.querySelectorAll('.btn-region').forEach(btn => {
        btn.classList.remove('calm-glow');
        void btn.offsetWidth;
        btn.classList.add('calm-glow');
        setTimeout(() => btn.classList.remove('calm-glow'), 800);
    });
}

export function initRangeTooltips(container) {
    if (!container) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'range-tooltip';
    Object.assign(tooltip.style, {
        position: 'absolute',
        display: 'none',
        pointerEvents: 'none',
        zIndex: '1000',
        background: 'rgba(0, 20, 40, 0.9)',
        color: '#00ffaa',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid rgba(0, 229, 229, 0.3)',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s ease'
    });
    document.body.appendChild(tooltip);

    const ranges = container.querySelectorAll('input[type="range"]');
    ranges.forEach(range => {
        const show = () => {
            tooltip.textContent = range.value;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            positionTooltip(range);
        };
        const hide = () => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
            }, 150);
        };
        const positionTooltip = (r) => {
            const rect = r.getBoundingClientRect();
            const min = parseFloat(r.min || 0);
            const max = parseFloat(r.max || 100);
            const val = parseFloat(r.value || 0);
            const percent = max === min ? 0 : (val - min) / (max - min);
            const thumbWidth = 14;
            const thumbCenter = percent * (rect.width - thumbWidth) + thumbWidth / 2;
            const tooltipRect = tooltip.getBoundingClientRect();
            const top = rect.top + window.scrollY - tooltipRect.height - 6;
            const left = rect.left + window.scrollX + thumbCenter - (tooltipRect.width / 2);
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        };

        range.addEventListener('input', () => {
            show();
            positionTooltip(range);
        });
        range.addEventListener('mouseenter', show);
        range.addEventListener('mouseleave', hide);
        range.addEventListener('focus', show);
        range.addEventListener('blur', hide);
    });
}

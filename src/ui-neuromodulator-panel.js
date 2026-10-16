// ui-neuromodulator-panel.js
import { DEFAULT_PROFILES, getCustomProfile, saveCustomProfile } from './neuromodulators.js';

export function setupNeuromodulatorPanel(renderer, controls) {
    const neuroContainer = document.createElement('div');
    neuroContainer.style.marginTop = '10px';
    neuroContainer.style.paddingTop = '10px';
    neuroContainer.style.borderTop = '1px solid #444';

    const neuroTitle = document.createElement('div');
    neuroTitle.id = 'neuro-panel-title';
    neuroTitle.textContent = 'Neuromodulator Profile';
    neuroTitle.dataset.tooltip = "Live-edit decay, diffusion and regional retention of the neural field (docs/tensor-physics.md §3.4)";
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

    // [Tensor Physics] `scope` says what a slider actually reaches, and the
    // row shows it. These sliders used to look identical while only some of
    // them did anything; see docs/tensor-physics.md §3.4 and §6.14.
    //   field   — read by the neural field on WebGPU, WASM and WebGL
    //   visual  — read by a render shader only
    //   unwired — read by nothing yet; kept so saved profiles round-trip
    const SCOPE_BADGES = {
        field: { text: 'field', color: '#00ffaa', tooltip: 'Changes the simulated neural field on every renderer (WebGPU, WASM, WebGL).' },
        visual: { text: 'visual only', color: '#ffcc66', tooltip: 'Changes rendering only — the simulated field is unaffected.' },
        unwired: { text: 'not wired', color: '#888888', tooltip: 'Stored in the profile but read by nothing yet. Moving it has no effect.' },
    };
    const sliders = [
        { id: 'neuro-diffusion', label: 'Diffusion Rate', min: 0.0, max: 0.5, step: 0.01, prop: 'diffusionRate', scope: 'field',
          tooltip: 'How far activity spreads per step. 0.1 = unchanged; 0 = no spread.' },
        { id: 'neuro-decay', label: 'Decay Rate', min: 0.8, max: 1.0, step: 0.001, prop: 'decayRate', scope: 'field',
          tooltip: 'Per-step retention. Higher keeps activity longer; 0.96 = unchanged.' },
        { id: 'neuro-pulse', label: 'Pulse Saturation', min: 0.0, max: 3.0, step: 0.1, prop: 'pulseSaturation', scope: 'unwired' },
        { id: 'neuro-trail', label: 'Trail Length', min: 0.0, max: 5.0, step: 0.1, prop: 'trailLength', scope: 'visual',
          tooltip: 'Connectome fiber pulse trails. Values below 1 have no effect.' },
        { id: 'neuro-ret-front', label: 'Retention: Frontal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'frontal', scope: 'field',
          tooltip: 'Frontal lobe retention. Each +1 above 0.5 halves its activity loss.' },
        { id: 'neuro-ret-occ', label: 'Retention: Occipital', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'occipital', scope: 'field',
          tooltip: 'Occipital lobe retention. Each +1 above 0.0 halves its activity loss.' },
        { id: 'neuro-ret-temp', label: 'Retention: Temporal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'temporal', scope: 'field',
          tooltip: 'Temporal lobe retention. Each +1 above 0.2 halves its activity loss.' },
        { id: 'neuro-ret-par', label: 'Retention: Parietal', min: -1.0, max: 2.0, step: 0.1, prop: 'retentionBias', subprop: 'parietal', scope: 'field',
          tooltip: 'Parietal lobe retention. Each +1 above 0.2 halves its activity loss.' }
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

        const badge = SCOPE_BADGES[s.scope];
        const scopeTag = document.createElement('span');
        scopeTag.className = 'neuro-scope-badge';
        scopeTag.dataset.scope = s.scope;
        scopeTag.textContent = badge.text;
        scopeTag.style.marginLeft = '4px';
        scopeTag.style.fontSize = '9px';
        scopeTag.style.color = badge.color;
        scopeTag.style.opacity = '0.85';
        label.appendChild(scopeTag);
        label.dataset.tooltip = s.tooltip ? `${s.tooltip} ${badge.tooltip}` : badge.tooltip;
        if (s.scope === 'unwired') label.style.opacity = '0.6';

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

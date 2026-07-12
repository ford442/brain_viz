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

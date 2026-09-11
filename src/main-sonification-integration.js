// [Neuro-Sonification] Wires SonificationEngine into the routine player and
// adds a UI toggle + preset selector, mirroring the AudioReactor button in
// main-synaptix-integration.js. No mic permission required — this engine
// only reads tensor/renderer state and writes audio out.
import { SonificationEngine, SONIFICATION_PRESETS } from './sonification-engine.js';

export function setupSonificationIntegration(renderer, player, audioReactor, controls) {
    const sonificationEngine = new SonificationEngine(audioReactor);
    player.sonificationEngine = sonificationEngine;

    if (controls) {
        const wrapper = document.createElement('div');
        wrapper.style.marginTop = '5px';
        wrapper.style.display = 'flex';
        wrapper.style.gap = '5px';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Enable Sonification 🔊';
        toggleBtn.style.background = '#224';
        toggleBtn.style.borderColor = '#48d';
        toggleBtn.style.color = '#9cf';

        const presetSelect = document.createElement('select');
        presetSelect.title = 'Sonification preset';
        Object.entries(SONIFICATION_PRESETS).forEach(([key, cfg]) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = cfg.name;
            presetSelect.appendChild(opt);
        });
        presetSelect.value = sonificationEngine.currentPreset;
        presetSelect.addEventListener('change', () => {
            sonificationEngine.setPreset(presetSelect.value);
        });

        toggleBtn.onclick = async () => {
            if (!sonificationEngine.isActive) {
                await sonificationEngine.start();
                sonificationEngine.setPreset(presetSelect.value);
                toggleBtn.textContent = 'Disable Sonification 🔈';
                toggleBtn.style.background = '#446';
            } else {
                sonificationEngine.stop();
                toggleBtn.textContent = 'Enable Sonification 🔊';
                toggleBtn.style.background = '#224';
            }
        };

        wrapper.appendChild(toggleBtn);
        wrapper.appendChild(presetSelect);
        controls.appendChild(wrapper);
    }

    return sonificationEngine;
}

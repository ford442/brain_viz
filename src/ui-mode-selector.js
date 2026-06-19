// ui-mode-selector.js
// [V3.3] Prominent, always-visible visualization-mode selector (segmented pill control).
// It reuses the existing #style-mode <select> change pipeline as the single source of
// truth so presets, the mode toast, and SynaptiX dropdown sync all run unchanged.
// Switching modes only updates a uniform (no pipeline rebuild), so rapid toggling is
// glitch-free and works regardless of the active renderer backend (WebGPU or WebGL2).

export const MODE_DEFS = [
    { style: 0, name: 'Organic',    key: '1', desc: 'Organic surface — smooth volumetric cortical shell.' },
    { style: 1, name: 'Cyber',      key: '2', desc: 'Cyber wireframe — glowing circuit lattice.' },
    { style: 2, name: 'Connectome', key: '3', desc: 'Connectome — symmetrical glowing DTI fibre tracts.' },
    { style: 3, name: 'Heatmap',    key: '4', desc: 'Heatmap — volumetric thermal activity field.' },
    { style: 4, name: 'SynaptiX',   key: '5', desc: 'SynaptiX — AI ↔ Human mirror comparison.' },
];

export function setupModeSelector(renderer) {
    const selector = document.getElementById('mode-selector');
    const styleDropdown = document.getElementById('style-mode');
    if (!selector || !styleDropdown) {
        return { applyStyle: () => {}, syncActive: () => {} };
    }

    const pills = Array.from(selector.querySelectorAll('.mode-pill'));

    const syncActive = (styleValue) => {
        const v = Math.floor(styleValue);
        pills.forEach((pill) => {
            pill.classList.toggle('active', parseInt(pill.dataset.style, 10) === v);
        });
    };

    const applyStyle = (styleValue) => {
        // Drive the canonical dropdown so every existing change-listener fires exactly once.
        if (parseFloat(styleDropdown.value) !== styleValue) {
            styleDropdown.value = String(styleValue);
            styleDropdown.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            renderer.setParams({ style: styleValue });
        }
        syncActive(styleValue);
    };

    pills.forEach((pill) => {
        pill.addEventListener('click', () => applyStyle(parseFloat(pill.dataset.style)));
    });

    syncActive(renderer.params.style);
    return { applyStyle, syncActive };
}

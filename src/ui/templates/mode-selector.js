// [Neuro-Weaver] Mode-selector pill markup, generated from the single MODE_DEFS
// source of truth so labels/tooltips/hotkeys can't drift from ui-mode-selector.js.
import { MODE_DEFS } from '../../ui-mode-selector.js';

export function renderModeSelector() {
    const pills = MODE_DEFS.map(({ style, name, key, desc }) => {
        const tooltip = `${desc.replace(/\.$/, '')} (hotkey ${key})`;
        const classes = ['mode-pill', style === 4 ? 'synaptix' : '', style === 0 ? 'active' : '']
            .filter(Boolean).join(' ');
        return `<button class="${classes}" data-style="${style}" data-tooltip="${tooltip}"><span class="mode-key">${key}</span><span class="mode-name">${name}</span></button>`;
    }).join('\n            ');

    return `<div id="mode-selector" class="mode-selector" role="tablist" aria-label="Visualization mode">
            ${pills}
        </div>`;
}

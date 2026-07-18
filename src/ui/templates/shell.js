// [Neuro-Weaver] Assembles the #controls panel markup from its tab templates and
// mounts it into the DOM. This is the single place that owns the controls shell's
// structure — index.html only provides the empty mount point.
import { renderModeSelector } from './mode-selector.js';
import { renderActivityTab } from './tab-activity.js';
import { renderNeurochemicalTab } from './tab-neurochemical.js';
import { renderStimulusTab } from './tab-stimulus.js';
import { renderCinematicTab } from './tab-cinematic.js';
import { renderLightingTab } from './tab-lighting.js';
import { renderSynaptixTab } from './tab-synaptix.js';
import { renderTrainingTab } from './tab-training.js';

const TABS = [
    { id: 'tab-activity', label: 'Activity', render: renderActivityTab },
    { id: 'tab-neurochemical', label: 'Neurochemical', render: renderNeurochemicalTab },
    { id: 'tab-stimulus', label: 'Stimulus', render: renderStimulusTab },
    { id: 'tab-cinematic', label: 'Cinematic', render: renderCinematicTab },
    { id: 'tab-lighting', label: 'Lighting', render: renderLightingTab },
    { id: 'tab-synaptix', label: 'SynaptiX', render: renderSynaptixTab },
    { id: 'tab-training', label: 'Training', render: renderTrainingTab },
];

function renderTabBar() {
    const buttons = TABS.map(({ id, label }, i) =>
        `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${id}">${label}</button>`
    ).join('\n            ');
    return `<div class="tab-bar">
            ${buttons}
        </div>`;
}

function renderControlsShell() {
    const panes = TABS.map((tab) => tab.render()).join('\n\n            ');
    return `<h2>NEURO-WEAVER V2.6 <span id="routine-status-dot" class="routine-dot"></span></h2>

        ${renderModeSelector()}

        ${renderTabBar()}

        <div class="tab-content">
            ${panes}
        </div>`;
}

/** Mounts the controls shell into the #controls element. Must run before any
 * code queries controls by ID (collectInputsAndLabels, ui-mode-selector, etc). */
export function mountControlsShell() {
    const controls = document.getElementById('controls');
    if (!controls) return;
    controls.innerHTML = renderControlsShell();
}

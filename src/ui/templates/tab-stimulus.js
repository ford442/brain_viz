// [Neuro-Weaver] Stimulus tab: hazard exposure, region targets, state control.
export function renderStimulusTab() {
    return `<div id="tab-stimulus" class="tab-pane">
                <div class="section-header expanded" data-section="stim-hazard">Hazard Exposure</div>
                <div class="section-content">
                    <label style="margin-bottom:10px; color:#fff" data-tooltip="Trigger external environmental neurotoxins">Inject Stimulus</label>
                    <!-- Environmental Exposure Buttons -->
                    <button id="stim-electrical" class="btn-hazard" type="button" data-tooltip="Simulate ion-channel disruption from current">Electrical Exposure</button>
                    <button id="stim-mercury" class="btn-hazard" type="button" data-tooltip="Model heavy-metal synaptic interference">Vapor/Mercury Exposure</button>
                    <div class="control-group">
                        <label data-tooltip="Strength of toxic exposure effect">Hazard Intensity <span id="val-hazard-intensity" class="value">50</span></label>
                        <input type="range" id="hazard-intensity" min="0" max="100" step="1" value="50">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Length of environmental hazard event">Hazard Duration (s) <span id="val-hazard-duration" class="value">5</span></label>
                        <input type="range" id="hazard-duration" min="0" max="10" step="1" value="5">
                    </div>
                </div>

                <div class="section-header" data-section="stim-region">Region Targets</div>
                <div class="section-content">
                    <div class="btn-grid">
                        <button id="stim-frontal" class="btn-region" type="button" data-tooltip="Inject signal into executive function region">Frontal Lobe (Cognition)</button>
                        <button id="stim-parietal" class="btn-region" type="button" data-tooltip="Inject signal into spatial processing region">Parietal Lobe (Sensory)</button>
                        <button id="stim-temporal" class="btn-region" type="button" data-tooltip="Inject signal into auditory/memory region">Temporal Lobe (Memory)</button>
                        <button id="stim-occipital" class="btn-region" type="button" data-tooltip="Inject signal into visual cortex">Occipital Lobe (Vision)</button>
                        <button id="stim-deep" class="btn-region" type="button" data-tooltip="Inject signal into limbic/thalamic core">Deep Brain (Core)</button>
                        <button id="stim-random" class="btn-danger" type="button" data-tooltip="Stochastic activation at random coordinates">Random Pulse</button>
                    </div>
                </div>

                <div class="section-header" data-section="stim-state">State Control</div>
                <div class="section-content">
                    <button id="stim-calm" class="btn-calm" type="button" data-tooltip="Reset all parameters to baseline resting values">Calm State</button>
                    <button id="stim-reset" class="btn-calm" type="button" data-tooltip="Clear accumulated tensor field energy">Reset Activity</button>
                </div>
            </div>`;
}

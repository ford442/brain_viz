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

                <div class="section-header" data-section="stim-paint">Paint Energy</div>
                <div class="section-content">
                    <button id="paint-toggle" class="btn-region" type="button" data-tooltip="Click-drag on the brain to paint activation energy">Enable Paint Mode</button>
                    <button id="paint-erase-toggle" class="btn-hazard" type="button" data-tooltip="Paint strokes damp existing energy instead of adding it">Eraser Mode</button>
                    <div class="control-group">
                        <label data-tooltip="Radius of the paint brush">Brush Radius <span id="val-paint-radius" class="value">0.35</span></label>
                        <input type="range" id="paint-radius" min="0.1" max="1.0" step="0.01" value="0.35">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Peak intensity of each paint stroke">Brush Intensity <span id="val-paint-intensity" class="value">0.80</span></label>
                        <input type="range" id="paint-intensity" min="0.05" max="2.0" step="0.05" value="0.8">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Half-life of painted energy after the stroke ends">Decay Half-Life (s) <span id="val-paint-decay" class="value">1.2</span></label>
                        <input type="range" id="paint-decay" min="0.1" max="5.0" step="0.1" value="1.2">
                    </div>
                    <button id="paint-clear" class="btn-calm" type="button" data-tooltip="Clear all accumulated tensor field energy (same as Reset Activity)">Clear Paint</button>
                </div>

                <div class="section-header" data-section="stim-state">State Control</div>
                <div class="section-content">
                    <button id="stim-calm" class="btn-calm" type="button" data-tooltip="Reset all parameters to baseline resting values">Calm State</button>
                    <button id="stim-reset" class="btn-calm" type="button" data-tooltip="Clear accumulated tensor field energy">Reset Activity</button>
                </div>
            </div>`;
}

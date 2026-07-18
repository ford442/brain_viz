// [Neuro-Weaver] Neurochemical tab: stress chemistry, altitude/hypoxia.
export function renderNeurochemicalTab() {
    return `<div id="tab-neurochemical" class="tab-pane">
                <div class="section-header expanded" data-section="neuro-stress">Stress Chemistry</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Metaphorical hue rotation during mood elevation">Serotonin Shift <span id="val-shift" class="value">0.0</span></label>
                        <input type="range" id="shift" min="0.0" max="1.0" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Simulates stress-induced dendritic atrophy">Cortisol (Decay) <span id="val-cortisol" class="value">0.00</span></label>
                        <input type="range" id="cortisol" min="0" max="1" step="0.01" value="0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Simulates permanent structural alterations from long-term heavy metal accumulation">Heavy Metal Acc. <span id="val-heavyMetal" class="value">0.00</span></label>
                        <input type="range" id="heavyMetal" min="0" max="1" step="0.01" value="0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Amplitude of geometric warping from tension">Stress (Distortion) <span id="val-stress" class="value">0.0</span></label>
                        <input type="range" id="stress" min="0.0" max="2.0" step="0.05" value="0.0">
                    </div>
                </div>

                <div class="section-header" data-section="neuro-altitude">Altitude / Hypoxia</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Simulated elevation for oxygen deprivation modeling">Altitude (meters) <span id="val-altitude" class="value">0</span></label>
                        <input type="range" id="altitude" min="0" max="8000" step="100" value="0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Derived blood-oxygen saturation from altitude">Oxygen Level <span id="val-oxygen" class="value">1.00</span></label>
                        <input type="range" id="oxygen" min="0.3" max="1.0" step="0.01" value="1.0" disabled style="opacity: 0.5; cursor: not-allowed;">
                        <span style="font-size: 0.8em; color: #666;">(Read-only: derived from altitude)</span>
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Neural energy consumption multiplier">Metabolic Rate <span id="val-metabolic" class="value">1.0</span></label>
                        <input type="range" id="metabolic" min="0.5" max="2.0" step="0.05" value="1.0">
                    </div>
                </div>
            </div>`;
}

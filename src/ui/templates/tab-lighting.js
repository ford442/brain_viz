// [Neuro-Weaver] Lighting tab: ambient & directional light controls.
export function renderLightingTab() {
    return `<div id="tab-lighting" class="tab-pane">
                <div class="section-header expanded" data-section="lighting-ambient">Ambient & Directional</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Base fill illumination of the scene">Ambient Light: <span id="val-ambientLight" class="val-display">0.2</span></label>
                        <input type="range" id="ambientLight" min="0.0" max="1.0" step="0.01" value="0.2">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Strength of the primary directional light source">Dir Intensity: <span id="val-dirIntensity" class="val-display">0.8</span></label>
                        <input type="range" id="dirIntensity" min="0.0" max="5.0" step="0.1" value="0.8">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="X vector component of primary light direction">Light Dir X: <span id="val-lightDirX" class="val-display">1.0</span></label>
                        <input type="range" id="lightDirX" min="-1.0" max="1.0" step="0.1" value="1.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Y vector component of primary light direction">Light Dir Y: <span id="val-lightDirY" class="val-display">1.0</span></label>
                        <input type="range" id="lightDirY" min="-1.0" max="1.0" step="0.1" value="1.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Z vector component of primary light direction">Light Dir Z: <span id="val-lightDirZ" class="val-display">1.0</span></label>
                        <input type="range" id="lightDirZ" min="-1.0" max="1.0" step="0.1" value="1.0">
                    </div>
                </div>
            </div>`;
}

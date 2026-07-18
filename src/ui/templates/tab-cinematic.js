// [Neuro-Weaver] Cinematic tab: lens effects (shake, aberration, grain, focus, aperture).
export function renderCinematicTab() {
    return `<div id="tab-cinematic" class="tab-pane">
                <div class="section-header expanded" data-section="cinematic-lens">Lens Effects</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Physical trauma or stress-induced viewpoint jitter">Camera Shake <span id="val-shake" class="value">0.0</span></label>
                        <input type="range" id="shake" min="0.0" max="0.5" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="RGB channel separation lens effect">Chromatic Aberration <span id="val-aberration" class="value">0.0</span></label>
                        <input type="range" id="aberration" min="0.0" max="2.0" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Photochemical noise overlay intensity">Film Grain <span id="val-grain" class="value">0.0</span></label>
                        <input type="range" id="grain" min="0.0" max="1.0" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Depth-of-field focal plane position">Focus Distance <span id="val-focus" class="value">0.5</span></label>
                        <input type="range" id="focus" min="0.0" max="1.0" step="0.01" value="0.5">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Bokeh strength of out-of-focus regions">Aperture (Blur) <span id="val-aperture" class="value">0.0</span></label>
                        <input type="range" id="aperture" min="0.0" max="1.0" step="0.01" value="0.0">
                    </div>
                </div>
            </div>`;
}

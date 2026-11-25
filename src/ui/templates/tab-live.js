// [Neuro-Weaver] Live Input Bus tab: the mapping matrix that routes mic/BCI/
// training features to renderer params (docs/live-input-bus.md). Rows are
// built dynamically by src/ui-live-input-panel.js.
export function renderLiveTab() {
    return `<div id="tab-live" class="tab-pane">
                <div class="section-header expanded" data-section="live-input-bus">Live Input Bus</div>
                <div class="section-content">
                    <div style="font-size:9px;color:#556677;margin-bottom:6px;line-height:1.35;">
                        Routes a live feature (mic, BCI, training, MIDI or heart rate) to a renderer
                        parameter. Derived signal for visualization, not a diagnostic reading.
                    </div>
                    <div class="control-group" style="font-size:10px;">
                        <button id="btn-live-midi-connect" type="button">Connect MIDI</button>
                        <button id="btn-live-midi-disconnect" type="button">Disconnect</button>
                        <span id="live-midi-status" role="status">Disconnected</span>
                    </div>
                    <div class="control-group" style="font-size:10px;">
                        <button id="btn-live-hr-connect" type="button">Connect heart rate</button>
                        <button id="btn-live-hr-disconnect" type="button">Disconnect</button>
                        <span id="live-hr-status" role="status">Disconnected</span>
                        <div>Heart rate: hr maps 40–180 bpm to 0–1 (clamped); bpm is raw.</div>
                    </div>
                    <div class="control-group" style="display:flex;align-items:center;gap:8px;">
                        <label style="display:flex;align-items:center;gap:4px;font-size:11px;">
                            <input id="live-bus-enabled" type="checkbox" checked> Enabled
                        </label>
                        <button id="btn-live-bus-add" type="button" style="margin-left:auto;">+ Add Mapping</button>
                    </div>
                    <div id="live-bus-grid" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;"></div>
                    <div class="control-group" style="display:flex;gap:6px;margin-top:6px;">
                        <button id="btn-live-bus-export" type="button" style="flex:1;">Export JSON</button>
                        <button id="btn-live-bus-import" type="button" style="flex:1;">Import JSON</button>
                        <input id="live-bus-import-file" type="file" accept="application/json" style="display:none;">
                    </div>
                </div>
            </div>`;
}

// [Neuro-Weaver] First-class live EEG/BCI device, calibration, recording, and playback controls.
export function renderBciTab() {
    return `<div id="tab-bci" class="tab-pane">
                <div class="section-header expanded" data-section="bci-device">BCI Device</div>
                <div class="section-content">
                    <div class="control-group">
                        <label>Source</label>
                        <select id="bci-device-source">
                            <option value="muse">Muse 2 / Muse S (auto-detect)</option>
                            <option value="cyton">OpenBCI Cyton</option>
                            <option value="cyton-daisy">OpenBCI Cyton + Daisy</option>
                        </select>
                    </div>
                    <div id="bci-openbci-url-row" class="control-group" style="display:none;">
                        <label>Bridge WebSocket URL</label>
                        <input id="bci-openbci-url" type="text" value="ws://127.0.0.1:8765">
                        <div style="font-size:9px;color:#667788;margin-top:3px;">Run <code>npm run bci:bridge</code>, then send OpenBCI GUI UDP TimeSeriesRaw to 127.0.0.1:12345.</div>
                    </div>
                    <div class="control-group" style="display:flex;gap:6px;">
                        <button id="btn-bci-connect" type="button" style="flex:1;color:#88ffaa;">Scan / Connect</button>
                        <button id="btn-bci-disconnect" type="button" style="flex:1;color:#ff9999;">Disconnect</button>
                    </div>
                    <div id="bci-device-status" style="font:10px var(--font-mono);color:#8899aa;line-height:1.5;">No BCI device connected</div>
                    <div class="control-group" style="margin-top:7px;">
                        <label>Estimated Signal Quality <span id="val-bci-quality" class="value">0%</span></label>
                        <div style="height:7px;background:#102030;border-radius:4px;overflow:hidden;"><div id="bar-bci-quality" style="height:100%;width:0%;background:#ff5566;"></div></div>
                        <div id="bci-band-values" style="font:10px var(--font-mono);color:#7aaacc;margin-top:5px;">α -- · β -- · γ -- · 0 Hz</div>
                    </div>
                    <div id="bci-channel-quality" style="font:9px var(--font-mono);color:#667788;max-height:100px;overflow:auto;"></div>
                </div>

                <div class="section-header" data-section="bci-calibration">Calibration & Mapping</div>
                <div class="section-content">
                    <div style="font-size:10px;color:#8899aa;line-height:1.4;">20-second calibration: 10s neutral with eyes open, then 10s relaxed with eyes closed.</div>
                    <button id="btn-bci-calibrate" type="button" style="width:100%;margin-top:6px;">Start Calibration</button>
                    <div id="bci-calibration-status" style="font:10px var(--font-mono);color:#667788;margin-top:4px;"></div>
                    <div id="bci-channel-mapping" style="margin-top:8px;"></div>
                    <button id="btn-bci-reset-mapping" type="button" style="width:100%;margin-top:5px;font-size:10px;">Reset Channel Mapping</button>
                </div>

                <div class="section-header" data-section="bci-recording">Local Recording</div>
                <div class="section-content">
                    <div class="control-group" style="display:flex;gap:5px;">
                        <button id="btn-bci-record" type="button" style="flex:1;color:#ff9999;">● Record</button>
                        <button id="btn-bci-record-stop" type="button" style="flex:1;">■ Stop</button>
                        <button id="btn-bci-download" type="button" style="flex:1;" disabled>↓ Download</button>
                    </div>
                    <label style="font-size:10px;color:#667788;">Replay .nwbci recording</label>
                    <input id="bci-replay-file" type="file" accept=".nwbci">
                    <div style="font-size:9px;color:#667788;margin-top:5px;line-height:1.35;">Raw EEG and processed tensors stay on this device unless you explicitly download them. This visualization is not a medical or diagnostic instrument.</div>
                </div>

                <div class="section-header" data-section="bci-playback">Tensor Playback</div>
                <div class="section-content">
                    <select id="bci-pattern" style="width:100%;">
                        <option value="">— Built-in Patterns —</option>
                        <option value="alpha-waves">Alpha Waves (8-12 Hz)</option>
                        <option value="working-memory">Working Memory Task</option>
                        <option value="visual-burst">Visual Processing Cascade</option>
                        <option value="seizure-spread">Seizure Spread (Ictal)</option>
                        <option value="meditation">Meditation / Slow-Wave</option>
                    </select>
                    <div class="control-group" style="display:flex;gap:5px;margin-top:6px;">
                        <button id="btn-bci-play" type="button" style="flex:1;">▶</button>
                        <button id="btn-bci-pause" type="button" style="flex:1;">⏸</button>
                        <button id="btn-bci-stop" type="button" style="flex:1;">⏹</button>
                    </div>
                    <div class="control-group" style="display:flex;gap:6px;align-items:center;">
                        <input id="bci-scrubber" type="range" min="0" max="1" value="0" style="flex:1;">
                        <span id="bci-frame-label" style="font:10px var(--font-mono);color:#778899;">0/0</span>
                    </div>
                    <div class="control-group">
                        <label>Speed <span id="val-bci-speed" class="value">1.0×</span></label>
                        <input id="bci-speed" type="range" min="0.1" max="4" step="0.1" value="1">
                    </div>
                    <label style="font-size:10px;color:#667788;">Load tensor file (.bin / .npy / .csv)</label>
                    <input id="bci-tensor-file" type="file" accept=".bin,.npy,.csv">
                </div>
            </div>`;
}

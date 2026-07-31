// [Neuro-Weaver] Local-only Double Mirror capture, replay, and descriptive analysis controls.
export function renderSessionTab() {
    return `<div id="tab-session" class="tab-pane">
                <div class="section-header expanded" data-section="session-record">Capture</div>
                <div class="section-content">
                    <label class="session-check"><input id="session-camera" type="checkbox"> Camera thumbnails (320×180, 10 Hz)</label>
                    <label class="session-check"><input id="session-audio" type="checkbox"> Microphone features (no audible audio)</label>
                    <label class="session-check"><input id="session-consent" type="checkbox"> I consent to local-only capture on this device</label>
                    <video id="session-camera-preview" muted playsinline style="display:none;width:100%;aspect-ratio:16/9;object-fit:cover;background:#050a12;border:1px solid #24445a;border-radius:5px;"></video>
                    <div class="control-group session-button-row">
                        <button id="btn-session-record" type="button" style="color:#ff9999;">● Record</button>
                        <button id="btn-session-record-stop" type="button" disabled>■ Stop</button>
                        <button id="btn-session-download" type="button" disabled>↓ .nwsession</button>
                    </div>
                    <div id="session-status" class="session-status">Ready · maximum 5 minutes</div>
                    <div class="control-group">
                        <label>Timestamped note</label>
                        <textarea id="session-note" rows="2" maxlength="1000" placeholder="What is happening or being felt?"></textarea>
                        <input id="session-mood" type="text" maxlength="80" placeholder="Mood (optional)">
                        <button id="btn-session-note" type="button">Add note</button>
                    </div>
                    <div class="session-privacy">Stores 32³ tensor frames, small still thumbnails, derived audio features, and notes. No continuous video, raw/audible audio, network request, or cloud upload.</div>
                </div>

                <div class="section-header" data-section="session-replay">Replay</div>
                <div class="section-content">
                    <label>Import .nwsession</label>
                    <input id="session-file" type="file" accept=".nwsession,application/x-neuro-weaver-session">
                    <div class="control-group session-button-row">
                        <button id="btn-session-play" type="button" disabled>▶</button>
                        <button id="btn-session-pause" type="button" disabled>⏸</button>
                        <button id="btn-session-stop" type="button" disabled>⏹</button>
                    </div>
                    <input id="session-scrubber" type="range" min="0" max="0" value="0" disabled>
                    <div id="session-time" class="session-status">00:00.0 / 00:00.0</div>
                </div>

                <div class="section-header" data-section="session-analysis">Descriptive Analysis</div>
                <div class="section-content">
                    <canvas id="session-heatmap" width="256" height="256" style="width:100%;background:#06111a;border:1px solid #24445a;"></canvas>
                    <div id="session-analysis-summary" class="session-status">Import a session to analyze aligned samples.</div>
                    <button id="btn-session-csv" type="button" disabled>Export aligned CSV</button>
                    <div class="session-privacy">Correlation is descriptive, non-causal, non-diagnostic, and sensitive to sampling, device processing, and sensor latency.</div>
                </div>
            </div>`;
}

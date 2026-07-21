// [Neuro-Weaver] Neurofeedback Training tab: course picker, live objective ring/gauge, session history.
// Course options here mirror `BUILTIN_COURSES` in src/training-engine.js — keep both in sync.
export function renderTrainingTab() {
    return `<div id="tab-training" class="tab-pane">
                <div class="section-header expanded" data-section="training-course">Neurofeedback Course</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Hold a simulated brain-state metric inside its target band to complete the course">Course</label>
                        <select id="training-course-select">
                            <option value="calm-focus">Calm Focus</option>
                            <option value="panic-recovery">Panic Recovery</option>
                            <option value="flow-sustain">Flow Sustain</option>
                        </select>
                        <div id="training-course-desc" style="margin-top:4px;font-size:10px;color:#8899aa;line-height:1.35;"></div>
                    </div>
                    <div class="control-group" style="display:flex;gap:6px;">
                        <button id="btn-training-start" type="button"
                            style="flex:1;padding:8px;background:#0a2a1a;border:1px solid rgba(0,229,100,0.3);border-radius:6px;color:#88ffaa;font-size:12px;cursor:pointer;">▶ Start Course</button>
                        <button id="btn-training-stop" type="button"
                            style="flex:1;padding:8px;background:#2a0a0a;border:1px solid rgba(255,80,80,0.3);border-radius:6px;color:#ff9999;font-size:12px;cursor:pointer;">■ Stop</button>
                    </div>

                    <div class="control-group" style="display:flex;align-items:center;gap:12px;margin-top:8px;">
                        <div id="training-ring" style="width:64px;height:64px;border-radius:50%;background:conic-gradient(#334455 0deg,#334455 360deg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <div id="training-ring-label" style="width:48px;height:48px;border-radius:50%;background:#0a1420;display:flex;align-items:center;justify-content:center;font-size:11px;color:#00e5e5;">--</div>
                        </div>
                        <div style="flex:1;">
                            <div id="training-objective-label" style="font-size:11px;color:#ddeeff;margin-bottom:4px;">No active course</div>
                            <div style="height:6px;background:#0a1a2a;border-radius:3px;overflow:hidden;">
                                <div id="training-metric-bar" style="width:0%;height:100%;background:#00e5e5;transition:width 0.2s;"></div>
                            </div>
                            <div id="training-metric-val" style="font-size:10px;color:#8899aa;margin-top:3px;">value: -- · band: --</div>
                        </div>
                    </div>

                    <div class="control-group" style="display:flex;gap:14px;margin-top:6px;font-size:10px;color:#8899aa;">
                        <span>Streak <span id="val-training-streak" style="color:#00ffaa;font-family:var(--font-mono);">0.0s</span></span>
                        <span>Best <span id="val-training-best" style="color:#00ffaa;font-family:var(--font-mono);">0.0s</span></span>
                    </div>
                    <div style="font-size:9px;color:#556677;margin-top:2px;">
                        Keyboard demo baseline: press <b>6</b> (Calm Focus) / <b>7</b> (Panic Recovery) / <b>8</b> (Flow Sustain) to start &amp; auto-drive that course's metric hands-free.
                    </div>
                </div>

                <div class="section-header" data-section="training-history">Session History</div>
                <div class="section-content">
                    <div id="training-history-list" style="font-size:10px;color:#aabbcc;line-height:1.6;max-height:140px;overflow-y:auto;"></div>
                    <button id="btn-training-clear-history" type="button"
                        style="width:100%;margin-top:6px;padding:5px;background:#1a1a1a;border:1px solid #444;border-radius:5px;color:#999;font-size:10px;cursor:pointer;">Clear History</button>
                </div>
            </div>`;
}

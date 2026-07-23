export function renderXrTab() {
    return `<div id="tab-xr" class="tab-pane">
                <div class="section-header expanded" data-section="xr-session">Immersive Session</div>
                <div class="section-content">
                    <div id="xr-status" style="font-size:10px;color:#88aacc;line-height:1.45;margin-bottom:8px;">Checking XR support…</div>
                    <button id="btn-xr-switch-webgl" type="button" style="display:none;width:100%;margin-bottom:6px;padding:8px;background:#172238;border:1px solid #4477aa;border-radius:5px;color:#aaddff;cursor:pointer;">Switch to WebGL2 for XR</button>
                    <div style="display:flex;gap:6px;">
                        <button id="btn-xr-enter-vr" type="button" style="flex:1;padding:9px;background:#10243a;border:1px solid #2288cc;border-radius:5px;color:#99ddff;cursor:pointer;">Enter VR</button>
                        <button id="btn-xr-enter-ar" type="button" style="flex:1;padding:9px;background:#163224;border:1px solid #33aa77;border-radius:5px;color:#aaffcc;cursor:pointer;">Tabletop AR</button>
                    </div>
                    <button id="btn-xr-end" type="button" disabled style="width:100%;margin-top:6px;padding:7px;background:#321818;border:1px solid #aa5555;border-radius:5px;color:#ffaaaa;cursor:pointer;">End XR Session</button>
                </div>

                <div class="section-header expanded" data-section="xr-navigation">XR Navigation</div>
                <div class="section-content">
                    <div class="control-group">
                        <label>Viewpoint</label>
                        <select id="xr-lobe-preset">
                            <option value="global">Global</option><option value="frontal">Frontal</option>
                            <option value="occipital">Occipital</option><option value="temporal">Temporal</option>
                            <option value="parietal">Parietal</option><option value="deep">Deep</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>XR Style</label>
                        <select id="xr-style"><option value="0">Organic</option><option value="2">Connectome</option></select>
                    </div>
                    <div style="font-size:9px;color:#667788;line-height:1.5;">
                        Thumbstick: orbit / approach · Trigger or pinch: stimulate / paint · Grip: next lobe viewpoint.<br>
                        Routine camera and spline events move the XR rig automatically.
                    </div>
                </div>
            </div>`;
}

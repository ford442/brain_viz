// [Neuro-Weaver] SynaptiX tab: AI/human mirror controls, presets, tensor source, token playback.
export function renderSynaptixTab() {
    return `<div id="tab-synaptix" class="tab-pane">
                <div class="section-header expanded" data-section="synaptix-core">AI ↔ Human Mirror</div>
                <div class="section-content">
                    <div class="control-group">
                        <label>Visualization Style</label>
                        <select id="style-mode-synaptix">
                            <option value="0">0. Organic (Surface)</option>
                            <option value="1">1. Cyber (Wireframe)</option>
                            <option value="2">2. Connectome (Fibers)</option>
                            <option value="3">3. Heatmap (Volumetric)</option>
                            <option value="4">4. SynaptiX (AI ↔ Human Mirror)</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>AI Influence <span id="val-aiInfluence" class="value">0.50</span></label>
                        <input type="range" id="aiInfluence" min="0.0" max="1.0" step="0.01" value="0.5">
                    </div>
                    <div class="control-group">
                        <label>Resonance Threshold <span id="val-resonanceThreshold" class="value">0.20</span></label>
                        <input type="range" id="resonanceThreshold" min="0.05" max="0.5" step="0.01" value="0.2">
                    </div>
                    <div class="control-group">
                        <label>AI Layer / Head <span id="val-aiLayer" class="value">0</span></label>
                        <input type="range" id="aiLayer" min="0" max="63" step="1" value="0">
                    </div>
                    <div class="control-group" style="display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" id="fusion-particles" checked style="width:auto;">
                        <label for="fusion-particles" style="margin:0;cursor:pointer;">Enable Fusion Particles</label>
                    </div>
                    <!-- Resonance Stats -->
                    <div class="control-group" style="margin-top:10px;padding:8px;background:rgba(0,0,0,0.25);border-radius:6px;">
                        <label style="font-size:11px;color:#8899aa;margin-bottom:6px;">Resonance Stats</label>
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                            <span style="font-size:10px;color:#00e5e5;width:50px;">Human</span>
                            <div style="flex:1;height:6px;background:#0a1a2a;border-radius:3px;overflow:hidden;">
                                <div id="bar-human-energy" style="width:0%;height:100%;background:#00e5e5;transition:width 0.3s;"></div>
                            </div>
                            <span id="val-human-energy" class="value" style="width:36px;text-align:right;font-size:10px;">0%</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                            <span style="font-size:10px;color:#ff00cc;width:50px;">AI</span>
                            <div style="flex:1;height:6px;background:#0a1a2a;border-radius:3px;overflow:hidden;">
                                <div id="bar-ai-energy" style="width:0%;height:100%;background:#ff00cc;transition:width 0.3s;"></div>
                            </div>
                            <span id="val-ai-energy" class="value" style="width:36px;text-align:right;font-size:10px;">0%</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="font-size:10px;color:#ffdd55;width:50px;">Overlap</span>
                            <div style="flex:1;height:6px;background:#0a1a2a;border-radius:3px;overflow:hidden;">
                                <div id="bar-resonance" style="width:0%;height:100%;background:#ffdd55;transition:width 0.3s;"></div>
                            </div>
                            <span id="val-resonance" class="value" style="width:36px;text-align:right;font-size:10px;">0%</span>
                        </div>
                    </div>
                </div>

                <div class="section-header" data-section="synaptix-presets">Preset Patterns</div>
                <div class="section-content">
                    <div class="control-group" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                        <button class="synaptix-preset" data-pattern="aligned-prefrontal" type="button"
                            style="padding:6px;background:#0a1a2a;border:1px solid rgba(0,229,229,0.25);border-radius:5px;color:#aaddff;font-size:11px;cursor:pointer;">
                            🧠 Aligned Prefrontal
                        </button>
                        <button class="synaptix-preset" data-pattern="hallucination-spike" type="button"
                            style="padding:6px;background:#0a1a2a;border:1px solid rgba(255,0,180,0.25);border-radius:5px;color:#ffaadd;font-size:11px;cursor:pointer;">
                            ⚡ Hallucination Spike
                        </button>
                        <button class="synaptix-preset" data-pattern="visual-mismatch" type="button"
                            style="padding:6px;background:#0a1a2a;border:1px solid rgba(180,100,255,0.25);border-radius:5px;color:#ccbbff;font-size:11px;cursor:pointer;">
                            👁 Visual Mismatch
                        </button>
                        <button class="synaptix-preset" data-pattern="full-resonance" type="button"
                            style="padding:6px;background:#0a1a2a;border:1px solid rgba(255,220,80,0.25);border-radius:5px;color:#ffeeaa;font-size:11px;cursor:pointer;">
                            ✨ Full Resonance
                        </button>
                    </div>
                </div>

                <div class="section-header" data-section="synaptix-tensor">AI Tensor Source</div>
                <div class="section-content">
                    <div class="control-group">
                        <label>Load AI Tensor (.npy / .bin / .csv)</label>
                        <input type="file" id="ai-tensor-file" accept=".npy,.bin,.csv">
                        <div id="synaptix-source-status" style="margin-top:4px;font-size:10px;color:#667788;font-family:'JetBrains Mono',monospace;">No AI tensor loaded</div>
                        <div style="margin-top:4px;font-size:10px;color:#8899aa;line-height:1.35;">
                            Default projector: early layers map to occipital, mid layers to temporal/parietal, deep layers to frontal volume.
                        </div>
                    </div>
                    <div class="control-group">
                        <label>AI Pattern</label>
                        <select id="ai-pattern">
                            <option value="none">— None —</option>
                            <option value="attention-frontal">Attention: Frontal (Reasoning)</option>
                            <option value="attention-occipital">Attention: Occipital (Vision)</option>
                            <option value="attention-temporal">Attention: Temporal (Language)</option>
                            <option value="gradient-explode">Gradient Explosion</option>
                            <option value="embedding-space">Token Embedding Space</option>
                            <option value="aligned-prefrontal">Aligned Prefrontal</option>
                            <option value="hallucination-spike">Hallucination Spike</option>
                            <option value="visual-mismatch">Visual Mismatch</option>
                            <option value="full-resonance">Full Resonance</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <button id="btn-generate-ai" type="button"
                            style="width:100%;padding:8px;background:#0a1a2a;border:1px solid rgba(200,0,180,0.3);
                                   border-radius:6px;color:#ddaaff;font-size:12px;cursor:pointer;">
                            ✨ Generate AI Pattern
                        </button>
                    </div>
                    <div class="control-group">
                        <button id="btn-synaptix-showcase" type="button"
                            style="width:100%;padding:8px;background:#101d33;border:1px solid rgba(255,221,85,0.35);
                                   border-radius:6px;color:#ffeeaa;font-size:12px;cursor:pointer;">
                            ▶ Run SynaptiX Showcase (X)
                        </button>
                    </div>
                </div>

                <div class="section-header" data-section="synaptix-playback">Token Playback</div>
                <div class="section-content">
                    <div class="control-group" style="display:flex;gap:6px;align-items:center;">
                        <button id="btn-frame-play" type="button"
                            style="flex:1;padding:6px;background:#0a2a1a;border:1px solid rgba(0,229,100,0.3);border-radius:5px;color:#88ffaa;font-size:11px;cursor:pointer;">▶ Play</button>
                        <button id="btn-frame-pause" type="button"
                            style="flex:1;padding:6px;background:#2a1a0a;border:1px solid rgba(229,180,0,0.3);border-radius:5px;color:#ffdd88;font-size:11px;cursor:pointer;">⏸ Pause</button>
                    </div>
                    <div class="control-group">
                        <label>Frame <span id="val-frame-index" class="value">0</span> / <span id="val-frame-total">0</span></label>
                        <input type="range" id="frame-scrubber" min="0" max="0" step="1" value="0" disabled>
                    </div>
                    <div class="control-group">
                        <label>Playback Rate <span id="val-frame-rate" class="value">4</span> fps</label>
                        <input type="range" id="frame-rate" min="1" max="30" step="1" value="4">
                    </div>
                    <div class="control-group">
                        <label>Live Source</label>
                        <div style="display:flex;gap:6px;align-items:center;">
                            <input type="checkbox" id="live-source-enable" style="width:auto;">
                            <label for="live-source-enable" style="margin:0;cursor:pointer;font-size:11px;">Enable callback feed</label>
                        </div>
                        <div id="live-source-status" style="margin-top:4px;font-size:10px;color:#667788;font-family:'JetBrains Mono',monospace;">status: disconnected</div>
                    </div>
                </div>
            </div>`;
}

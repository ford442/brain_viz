export function renderExchangeTab() {
    return `<div id="tab-exchange" class="tab-pane">
                <div class="section-header expanded" data-section="exchange-local">Neuro-Script Exchange</div>
                <div class="section-content">
                    <div style="font-size:10px;color:#778899;margin-bottom:8px;line-height:1.4;">
                        Export the current routine to share, import a .json script to run locally, or remix one of the bundled experiences.
                    </div>

                    <!-- Import / Export -->
                    <div class="control-group" style="display:flex;gap:6px;">
                        <button id="btn-exchange-export" type="button" style="flex:1;">↑ Export Routine</button>
                        <button id="btn-exchange-import" type="button" style="flex:1;">↓ Import Routine</button>
                        <input id="exchange-import-file" type="file" accept=".json,application/json" style="display:none;">
                    </div>

                    <hr style="border: 0; border-top: 1px solid #334455; margin: 12px 0;">

                    <!-- Bundled routines -->
                    <div class="control-group">
                        <label>Bundled Library</label>
                        <div style="display:flex;gap:6px;margin-top:4px;">
                            <select id="exchange-library-select" style="flex:1;">
                                <option value="altitude_simulation.json">Altitude Simulation</option>
                                <option value="deep_thought.json">Deep Thought</option>
                                <option value="synaptix_hallucination.json">SynaptiX Hallucination</option>
                                <option value="synaptix_resonance.json">SynaptiX Resonance</option>
                                <option value="synaptix_multi_brain.json">SynaptiX Multi-Brain</option>
                            </select>
                            <button id="btn-exchange-load-bundled" type="button">Load</button>
                        </div>
                    </div>
                </div>
            </div>`;
}

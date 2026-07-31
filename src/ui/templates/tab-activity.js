// [Neuro-Weaver] Activity tab: signal dynamics, flow & growth, visualization/slice, simulation engine.
export function renderActivityTab() {
    return `<div id="tab-activity" class="tab-pane active">
                <div class="section-header expanded" data-section="activity-signal">Signal Dynamics</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Base oscillation rate of neural firing patterns">Activity Frequency <span id="val-freq" class="value">2.0</span></label>
                        <input type="range" id="freq" min="0.1" max="10.0" step="0.1" value="2.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Intensity of signal peaks in the tensor field">Amplitude <span id="val-amp" class="value">0.5</span></label>
                        <input type="range" id="amp" min="0.0" max="2.0" step="0.1" value="0.5">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Minimum value to trigger a visual action potential">Spike Threshold <span id="val-thresh" class="value">0.8</span></label>
                        <input type="range" id="thresh" min="0.0" max="1.0" step="0.05" value="0.8">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Temporal interpolation between signal frames">Smoothing <span id="val-smooth" class="value">0.9</span></label>
                        <input type="range" id="smooth" min="0.0" max="0.99" step="0.01" value="0.9">
                    </div>
                </div>

                <div class="section-header" data-section="activity-flow">Flow & Growth</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Velocity of neurotransmitter signaling propagation">Signal Flow Speed <span id="val-speed" class="value">4.0</span></label>
                        <input type="range" id="speed" min="0.0" max="10.0" step="0.5" value="4.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Intensity of dendrite activation particle effects">Synaptic Sparkle <span id="val-sparkle" class="value">0.0</span></label>
                        <input type="range" id="sparkle" min="0.0" max="1.0" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Rate of structural arbor expansion">Dendritic Growth <span id="val-growth" class="value">1.0</span></label>
                        <input type="range" id="growth" min="0.0" max="1.0" step="0.01" value="1.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Density / LOD of fibre point cloud nodes, boutons, and varicosity beads">Point Density <span id="val-pointCloudDensity" class="value">1.0</span></label>
                        <input type="range" id="pointCloudDensity" min="0.0" max="2.0" step="0.01" value="1.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Bidirectional tensor↔fiber coupling strength (0 = off)">Fiber Coupling <span id="val-fiberCoupling" class="value">0.50</span></label>
                        <input type="range" id="fiberCoupling" min="0.0" max="1.0" step="0.01" value="0.5">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Connectome palette: 0 = Anatomical DTI tracts, 1 = abstract Reasoning Pathways routing">Connectome Variant <span id="val-connectomeVariant" class="value">0.00</span></label>
                        <input type="range" id="connectomeVariant" min="0.0" max="1.0" step="0.01" value="0.0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Bilateral symmetry of fibre bundles (0 = free/organic, 1 = mirrored hemispheres)">Fiber Symmetry <span id="val-fiberSymmetry" class="value">0.85</span></label>
                        <input type="range" id="fiberSymmetry" min="0.0" max="1.0" step="0.01" value="0.85">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Tightness of fibres within each tract bundle (higher = cleaner tractography)">Bundle Coherence <span id="val-bundleCoherence" class="value">0.60</span></label>
                        <input type="range" id="bundleCoherence" min="0.0" max="1.0" step="0.01" value="0.6">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Volumetric cerebrospinal fluid simulation strength">Fluid Dynamics <span id="val-fluidActive" class="value">0.00</span></label>
                        <input type="range" id="fluidActive" min="0" max="2" step="0.05" value="0">
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Atmospheric depth occlusion density">Volumetric Fog <span id="val-fogDensity" class="value">0.00</span></label>
                        <input type="range" id="fogDensity" min="0.0" max="0.5" step="0.01" value="0.0">
                    </div>
                </div>

                <div class="section-header" data-section="activity-render">Visualization & Slice</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Select the active rendering backend. The page reloads to switch between the full WebGPU path and the WebGL2 debug fallback.">Renderer Backend</label>
                        <select id="renderer-backend">
                            <option value="webgpu">WebGPU</option>
                            <option value="webgl">WebGL2 Fallback</option>
                        </select>
                        <div id="renderer-status" style="font-size:10px;color:#99aabb;margin-top:4px;"></div>
                        <div id="renderer-reload-note" style="font-size:10px;color:#556677;margin-top:2px;"></div>
                    </div>
                    <div class="control-group">
                        <label data-tooltip="Render mode: surface, wireframe, fibers, or thermal"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00e5e5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px;opacity:0.8;"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>Visualization Style</label>
                        <select id="style-mode">
                            <option value="0">0. Organic (Surface)</option>
                            <option value="1">1. Cyber (Wireframe)</option>
                            <option value="2">2. Connectome (Fibers)</option>
                            <option value="3">3. Heatmap (Volumetric) [V2.3]</option>
                            <option value="4">4. SynaptiX (Multi-Brain Mirror)</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <!-- V2.2 Control: Slice Plane -->
                        <label data-tooltip="Cross-sectional cutting plane depth">Clip Plane Z (Slice) <span id="val-clip" class="value">2.0</span></label>
                        <input type="range" id="clip" min="-2.0" max="2.0" step="0.1" value="2.0">
                    </div>
                    <div id="webgl-debug-controls" style="display:none;">
                        <div class="control-group">
                            <label data-tooltip="WebGL2 debug helper: render the cortex in lines instead of filled triangles.">WebGL Wireframe</label>
                            <input type="checkbox" id="webgl-debug-wireframe">
                        </div>
                        <div class="control-group">
                            <label data-tooltip="WebGL2 debug helper: keep the tensor point cloud visible even outside Heatmap mode.">WebGL Tensor Debug</label>
                            <input type="checkbox" id="webgl-debug-tensor" checked>
                        </div>
                        <div class="control-group">
                            <label data-tooltip="WebGL2 debug helper: isolate one render layer at a time.">WebGL Style Isolation</label>
                            <select id="webgl-debug-isolate">
                                <option value="all">All Layers</option>
                                <option value="mesh">Mesh Only</option>
                                <option value="fibers">Fibers Only</option>
                                <option value="tensor">Tensor Only</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="section-header" data-section="activity-pathways">Named Pathways</div>
                <div class="section-content pathway-panel" id="pathway-panel">
                    <div class="control-group">
                        <label for="pathway-select">Pathway overlay</label>
                        <select id="pathway-select"></select>
                    </div>
                    <div class="pathway-button-row">
                        <button id="pathway-pulse" type="button">Pulse</button>
                        <button id="pathway-block" type="button">Block</button>
                        <button id="pathway-demo" type="button">Run Demo</button>
                    </div>
                    <div id="pathway-status" class="pathway-status" aria-live="polite"></div>
                    <div class="pathway-legend">
                        <div><span id="pathway-color" class="pathway-swatch"></span><b>Dopamine</b> — gold narrative signal</div>
                        <div><b>Landmarks:</b> VTA · nucleus accumbens · prefrontal cortex</div>
                        <div><b>Branches:</b> mesolimbic · mesocortical</div>
                        <div class="pathway-caveat">Schematic landmarks and procedural fibers; not atlas registration or tractography.</div>
                    </div>
                </div>

                <!-- [Phase 1 WASM] C++ Engine Toggle -->
                <div class="section-header" data-section="activity-wasm">Simulation Engine</div>
                <div class="section-content">
                    <div class="control-group">
                        <label data-tooltip="Switch tensor physics between WebGPU compute shader (GPU) and native C++ WASM engine (CPU). Requires npm run build:wasm.">
                            Simulation Backend
                        </label>
                        <button id="btn-wasm-toggle" type="button"
                            style="width:100%;padding:8px;background:#0a1a2a;border:1px solid rgba(0,200,180,0.3);
                                   border-radius:6px;color:#99aabb;font-size:12px;cursor:pointer;text-align:left;">
                            ⚙️ WebGPU Compute (active)
                        </button>
                        <button id="btn-wasm-benchmark" type="button"
                            style="width:100%;margin-top:4px;padding:6px;background:#0a1a2a;
                                   border:1px solid rgba(0,200,100,0.3);border-radius:6px;
                                   color:#99aabb;font-size:11px;cursor:pointer;text-align:left;display:none;">
                            📊 Run WASM Benchmark (100 steps)
                        </button>
                        <div id="wasm-status" style="font-size:10px;color:#556677;margin-top:4px;"></div>
                    </div>
                </div>
            </div>`;
}

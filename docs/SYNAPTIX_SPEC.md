# SynaptiX Mode Implementation Spec

> Historical single-avatar implementation specification. The current dual-avatar behavior, partner naming, temporal coupling model, and normalized partner-source contract are documented in [`synaptix.md`](synaptix.md).
## For Agent Swarm — Neuro-Weaver V2.7

---

## 1. ARCHITECTURE OVERVIEW

SynaptiX Mode is **Style 4.0**. It renders a bichromatic comparative brain where:
- **Human tensor** (`activityTensor`) = cyan/emerald organic patterns
- **AI tensor** (`aiTensor`) = magenta/violet geometric patterns  
- **Resonance** = white-gold bursts where |human - AI| < threshold
- **Divergence** = violet noise where values diverge

Style 4.0 uses the **solid mesh pipeline** (same as Organic/Cyber/Heatmap).

---

## 2. GPU BUFFER CHANGES

### 2.1 New Buffer: `aiTensorBuffer`
- Size: `this.voxelCount * 4` bytes (same as `tensorBuffer`)
- Usage: `GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST`
- Created in `initVolumetricResources()` alongside `tensorBuffer`
- Initialized with zeros

### 2.2 Render Bind Group Layout (3 bindings)
Update from 2 entries to 3:
```javascript
{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
{ binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
{ binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }
```

The bind group entries array becomes:
```javascript
[
    { binding: 0, resource: { buffer: this.uniformBuffer } },
    { binding: 1, resource: { buffer: this.tensorBuffer } },
    { binding: 2, resource: { buffer: this.aiTensorBuffer } }
]
```

### 2.3 Uniform Buffer Expansion
- Change `RENDER_UNIFORM_FLOAT_COUNT` from `64` to `68`
- New fields at end of `Uniforms` struct (all WGSL shaders):
  - `aiInfluence: f32` — blend weight (0 = all human, 1 = all AI)
  - `resonanceThreshold: f32` — threshold for resonance bursts
  - `synaptiXActive: f32` — 0 or 1 flag
  - `pad3: f32` — padding to 68 floats

- JS offset constants:
  - `OFFSET_AI_INFLUENCE = 64`
  - `OFFSET_RESONANCE_THRESHOLD = 65`
  - `OFFSET_SYNAPTIX_ACTIVE = 66`

- Buffer allocation: `Math.ceil((68 * 4) / 256) * 256 = 512` bytes

### 2.4 New Renderer Params
Add to `this.params` in `BrainRenderer` constructor:
```javascript
aiInfluence: 0.5,
resonanceThreshold: 0.2,
```

### 2.5 New Renderer Method
```javascript
setAITensorData(float32Array) {
    this.device.queue.writeBuffer(this.aiTensorBuffer, 0, float32Array);
}
```

---

## 3. WGSL SHADER CHANGES

### 3.1 Helper Additions to `HELPERS` string

Add these functions to `HELPERS` (after `sampleSmoothedVoxelValue`):

```wgsl
fn getAIVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }
    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));
    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return aiTensor[index];
}

fn sampleSmoothedAIVoxelValue(worldPos: vec3<f32>) -> f32 {
    let step = (BRAIN_RANGE / f32(VOXEL_DIM)) * 0.45;
    let center = getAIVoxelValue(worldPos);
    let neighbors =
        getAIVoxelValue(worldPos + vec3<f32>( step, 0.0, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(-step, 0.0, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0,  step, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, -step, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, 0.0,  step)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, 0.0, -step));
    return (center * 0.5) + (neighbors * (0.5 / 6.0));
}
```

### 3.2 Vertex Shader (`vertexShader`)

Add `aiTensor` binding after `activityTensor`:
```wgsl
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
```

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

In the `main()` function, after computing `activity`, add AI sampling:
```wgsl
let aiActivity = sampleSmoothedAIVoxelValue(input.position);
```

In the `// --- GHOST MODE ---` branch (the `else` for style < 2.0 or style >= 3.0), add a SynaptiX sub-branch BEFORE the existing displacement logic:

```wgsl
// --- SYNAPTIX MODE ---
if (uniforms.style >= 4.0) {
    // Dual displacement: human breathes, AI snaps
    let humanDisp = input.normal * activity * 0.05;
    let aiDisp = input.normal * aiActivity * 0.03;
    finalPos = input.position + humanDisp + aiDisp;

    // Pass AI activity via signal field
    signalStrength = aiActivity;

    // Base color will be computed in fragment shader
    finalColor = vec3<f32>(0.0);
}
else {
    // Existing displacement logic
    let displacement = input.normal * activity * 0.05;
    finalPos = input.position + displacement;
    // ... rest of existing ghost mode logic stays here
}
```

**CRITICAL**: Wrap the existing ghost mode displacement logic inside the `else` block so it only runs when `style < 4.0`.

### 3.3 Fragment Shader (`fragmentShader`)

Add `aiTensor` binding:
```wgsl
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
```

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

Add a SynaptiX branch BEFORE the existing `style >= 3.0` check:

```wgsl
// --- SYNAPTIX MODE (Style 4.0) ---
if (uniforms.style >= 4.0) {
    let humanVal = input.activity;
    let aiVal = input.signal; // Repurposed: contains aiActivity from vertex shader
    let diff = abs(humanVal - aiVal);
    let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, diff);

    // Bichromatic base: cyan human, magenta AI
    let humanColor = vec3<f32>(0.0, 0.85, 1.0) * humanVal;
    let aiColor = vec3<f32>(1.0, 0.0, 0.85) * aiVal;

    // Blend based on aiInfluence
    var mixedColor = mix(humanColor, aiColor, uniforms.aiInfluence);

    // Resonance burst: white-gold where aligned
    mixedColor += vec3<f32>(1.0, 0.92, 0.55) * resonance * max(humanVal, aiVal) * 2.5;

    // Divergence noise: violet chaos where they differ
    let divergence = smoothstep(uniforms.resonanceThreshold * 2.0, uniforms.resonanceThreshold * 5.0, diff);
    let noise = hashNoise3(input.worldPos * 4.0 + vec3<f32>(uniforms.time * 0.6));
    mixedColor += vec3<f32>(0.7, 0.15, 0.9) * divergence * noise * 0.4;

    // Rim + glass translucency (same as organic)
    let rimAlpha = smoothstep(0.5, 1.0, rim);
    let glassAlpha = 0.04 + rimAlpha * 0.22;
    let activityAlpha = max(humanVal, aiVal) * 0.18;
    let finalAlpha = clamp(glassAlpha + activityAlpha, 0.0, 0.35);

    return vec4<f32>(mixedColor, finalAlpha);
}
```

### 3.4 Soma Vertex Shader (`somaVertexShader`)

Add `aiTensor` binding:
```wgsl
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
```

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

Add `getAIVoxelValue` and `sampleSmoothedAIVoxelValue` helpers (same as in vertexShader).

In `main_soma`, after computing `activity`, compute:
```wgsl
let aiActivity = sampleSmoothedAIVoxelValue(advectedInstancePos);
```

When `uniforms.style >= 4.0`, change soma color:
```wgsl
if (uniforms.style >= 4.0) {
    let humanColor = mix(vec3<f32>(0.2, 0.2, 0.4), vec3<f32>(0.0, 0.85, 1.0), activity);
    let aiColor = mix(vec3<f32>(0.2, 0.2, 0.4), vec3<f32>(1.0, 0.0, 0.85), aiActivity);
    output.color = mix(humanColor, aiColor, uniforms.aiInfluence);
} else {
    output.color = mix(c1, c2, activity);
}
```

### 3.5 Soma Fragment Shader (`somaFragmentShader`)

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

### 3.6 Spark Vertex Shader (`sparkVertexShader`)

Add `aiTensor` binding:
```wgsl
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
```

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

Add `getAIVoxelValue` and `sampleSmoothedAIVoxelValue` helpers.

When `uniforms.style >= 4.0`, change spark color:
```wgsl
if (uniforms.style >= 4.0) {
    let humanThermal = vec3<f32>(0.0, 0.85, 1.0) * localActivity;
    let aiThermal = vec3<f32>(1.0, 0.0, 0.85) * sampleSmoothedAIVoxelValue(anchor);
    output.color = mix(humanThermal, aiThermal, uniforms.aiInfluence);
} else {
    output.color = thermal * sparkTint;
}
```

### 3.7 Spark Fragment Shader (`sparkFragmentShader`)

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

### 3.8 Post Fragment Shader (`postFragmentShader`)

Add to `Uniforms` struct at the end:
```wgsl
aiInfluence: f32,
resonanceThreshold: f32,
synaptiXActive: f32,
pad3: f32,
```

---

## 4. UI CHANGES (index.html)

### 4.1 New Tab Button
Add after the Lighting tab button:
```html
<button class="tab-btn" data-tab="tab-synaptix">SynaptiX</button>
```

### 4.2 New Tab Pane
Add inside `.tab-content`:
```html
<div id="tab-synaptix" class="tab-pane">
    <div class="section-header expanded" data-section="synaptix-core">AI ↔ Human Mirror</div>
    <div class="section-content">
        <div class="control-group">
            <label>Visualization Style</label>
            <select id="style-mode">
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
            <input type="range" id="resonanceThreshold" min="0.0" max="1.0" step="0.01" value="0.2">
        </div>
    </div>
    <div class="section-header" data-section="synaptix-tensor">AI Tensor Source</div>
    <div class="section-content">
        <div class="control-group">
            <label>Load AI Tensor (.npy / .bin)</label>
            <input type="file" id="ai-tensor-file" accept=".npy,.bin">
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
            </select>
        </div>
        <div class="control-group">
            <button id="btn-generate-ai" type="button"
                style="width:100%;padding:8px;background:#0a1a2a;border:1px solid rgba(200,0,180,0.3);
                       border-radius:6px;color:#ddaaff;font-size:12px;cursor:pointer;">
                ✨ Generate AI Pattern
            </button>
        </div>
    </div>
</div>
```

### 4.3 Style Dropdown Update
The style dropdown exists in the Activity tab (line ~645). Keep it there AND also add it to the SynaptiX tab as shown above. The existing one should also get the new option:
```html
<option value="4">4. SynaptiX (AI ↔ Human Mirror)</option>
```

---

## 5. MAIN.JS CHANGES

### 5.1 Input/Label Map
Add to `inputs` object:
```javascript
aiInfluence: document.getElementById('aiInfluence'),
resonanceThreshold: document.getElementById('resonanceThreshold'),
```

Add to `labels` object:
```javascript
aiInfluence: document.getElementById('val-aiInfluence'),
resonanceThreshold: document.getElementById('val-resonanceThreshold'),
```

### 5.2 SynaptiX Engine Integration
Import and instantiate `SynaptiXEngine`:
```javascript
import { SynaptiXEngine } from './synaptix-engine.js';
```

After renderer initialization:
```javascript
const synaptixEngine = new SynaptiXEngine(renderer);
```

### 5.3 AI Tensor File Loading
Wire the file input:
```javascript
const aiTensorFileInput = document.getElementById('ai-tensor-file');
if (aiTensorFileInput) {
    aiTensorFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await synaptixEngine.loadTensorFile(file);
    });
}
```

### 5.4 AI Pattern Generation
Wire the pattern dropdown + generate button:
```javascript
const aiPatternSelect = document.getElementById('ai-pattern');
const btnGenerateAI = document.getElementById('btn-generate-ai');
if (btnGenerateAI && aiPatternSelect) {
    btnGenerateAI.addEventListener('click', () => {
        const pattern = aiPatternSelect.value;
        if (pattern && pattern !== 'none') {
            synaptixEngine.generatePattern(pattern);
        }
    });
}
```

### 5.5 Style Preset Update
Add SynaptiX preset to the style dropdown handler in `ui-utils.js` (or wherever the style handler is):
```javascript
4: { frequency: 3.0, smoothing: 0.85, amplitude: 0.8 }
```

### 5.6 Mini-Routine
Add a keyboard shortcut for SynaptiX demo:
```javascript
// In MINI_ROUTINES or keyboard handler
'x': [
    { type: 'style', value: 4.0 },
    { type: 'lerp', key: 'aiInfluence', value: 0.7, duration: 2.0 },
    { type: 'lerp', key: 'resonanceThreshold', value: 0.15, duration: 2.0 }
]
```

---

## 6. SYNAPTIX-ENGINE.JS (NEW MODULE)

Create `src/synaptix-engine.js`:

```javascript
const VOXEL_DIM = 32;
const VOXEL_COUNT = VOXEL_DIM ** 3;
const BRAIN_RANGE = 1.6;

export class SynaptiXEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.currentPattern = null;
    }

    setTensorData(data) {
        if (data.length !== VOXEL_COUNT) {
            console.warn(`[SynaptiX] Tensor size mismatch: expected ${VOXEL_COUNT}, got ${data.length}`);
            return;
        }
        this.renderer.setAITensorData(data);
    }

    async loadTensorFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        let data;
        if (ext === 'npy') {
            data = await this.loadNPY(file);
        } else if (ext === 'bin') {
            data = await this.loadBinary(file);
        } else {
            console.warn('[SynaptiX] Unsupported file format');
            return;
        }
        this.setTensorData(data);
        console.log('[SynaptiX] AI tensor loaded from file');
    }

    async loadBinary(file) {
        const buffer = await file.arrayBuffer();
        return new Float32Array(buffer);
    }

    async loadNPY(file) {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        if (view.getUint8(0) !== 0x93) throw new Error('Not a valid .npy file');
        const majorVersion = view.getUint8(6);
        const headerLen = majorVersion >= 2 ? view.getUint32(8, true) : view.getUint16(8, true);
        const dataOffset = 10 + headerLen;
        return new Float32Array(buffer.slice(dataOffset));
    }

    generatePattern(patternId) {
        const data = new Float32Array(VOXEL_COUNT);
        switch (patternId) {
            case 'attention-frontal':
                this._fillAttentionFrontal(data);
                break;
            case 'attention-occipital':
                this._fillAttentionOccipital(data);
                break;
            case 'attention-temporal':
                this._fillAttentionTemporal(data);
                break;
            case 'gradient-explode':
                this._fillGradientExplode(data);
                break;
            case 'embedding-space':
                this._fillEmbeddingSpace(data);
                break;
            default:
                return;
        }
        this.setTensorData(data);
        this.currentPattern = patternId;
        console.log(`[SynaptiX] Generated pattern: ${patternId}`);
    }

    _fillAttentionFrontal(data) {
        // Frontal lobe = high activity at Z > 0.5
        // Sharp, geometric, high-frequency spikes (AI "thinking")
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz > 0.3) {
                        const d = Math.sqrt(wx*wx + wy*wy + (wz-0.8)*(wz-0.8));
                        val = Math.exp(-d * d * 4.0) * (0.7 + 0.3 * Math.sin(x * 3.7 + y * 2.3));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillAttentionOccipital(data) {
        // Occipital = fast visual processing at Z < -0.5
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz < -0.3) {
                        const d = Math.sqrt(wx*wx + wy*wy + (wz+0.8)*(wz+0.8));
                        val = Math.exp(-d * d * 6.0) * (0.8 + 0.2 * Math.sin(x * 8.0 + z * 5.0));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillAttentionTemporal(data) {
        // Temporal = language, flowing patterns at |X| > 0.6
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (Math.abs(wx) > 0.4) {
                        const d = Math.sqrt((Math.abs(wx)-0.7)*(Math.abs(wx)-0.7) + wy*wy*0.5 + wz*wz*0.3);
                        val = Math.exp(-d * d * 3.0) * (0.6 + 0.4 * Math.sin(y * 2.0 + z * 4.0));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillGradientExplode(data) {
        // Chaotic high-magnitude gradient = hallucination signature
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const r = Math.sqrt(wx*wx + wy*wy + wz*wz);
                    const noise = Math.sin(x * 7.3) * Math.cos(y * 5.1) * Math.sin(z * 9.7);
                    const val = Math.exp(-r * r * 1.5) * (0.5 + 0.5 * noise);
                    data[idx++] = Math.min(1.0, Math.max(0.0, val));
                }
            }
        }
    }

    _fillEmbeddingSpace(data) {
        // Smooth, structured embedding manifold
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const val = 0.5 + 0.5 * Math.sin(wx * 3.0) * Math.cos(wy * 2.5) * Math.sin(wz * 4.0);
                    data[idx++] = Math.min(1.0, Math.max(0.0, val * 0.8));
                }
            }
        }
    }
}
```

---

## 7. CRITICAL IMPLEMENTATION NOTES

1. **Do NOT modify the compute shader or compute uniform buffer**. SynaptiX blending is purely visual and happens in the render shaders.
2. **All render pipelines must use the updated bind group layout with 3 entries**.
3. **The existing `signal` vertex output field is repurposed to carry `aiActivity` in style 4.0**. This is safe because `signal` is only used in connectome mode (style 2.0).
4. **Buffer sizes and alignments must match exactly** between JS and WGSL.
5. **The `fragmentShader` has a duplicate field bug at lines 503-504** (`fiberMaterial` and `fiberTangent` declared twice). Do NOT fix this — leave it as-is to minimize unrelated changes.
6. **Use `StrReplaceFile` for precise edits** rather than rewriting entire files where possible.
7. **Maintain the existing coding style**: camelCase variables, PascalCase classes, `// [Neuro-Weaver]` comments.
8. **The project is pure vanilla JS — no TypeScript**.

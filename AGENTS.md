# AGENTS.md — Neuro-Weaver Brain Visualization

> This file is intended for AI coding agents. It assumes the reader knows nothing about the project.

---

## 1. Project Overview

**Neuro-Weaver** is a high-performance, WebGPU-based 3D volumetric brain visualization engine. It renders a stylized, animated human brain driven by a real-time 32×32×32 tensor field. The application simulates structured neural signal flow, anatomical regions, and reactive stimuli using GPU compute shaders.

Key capabilities:
- **Four visualization styles**: Organic (surface), Cyber (wireframe), Connectome (fibers + instanced somas), and Heatmap (volumetric thermal gradient).
- **Interactive stimuli**: Click to inject signals into specific lobes (frontal, occipital, parietal, temporal, deep).
- **Routine engine**: Scripted, timed sequences of parameters, camera moves, audio, and stimuli (`RoutinePlayer`).
- **BCI tensor playback**: Stream pre-recorded or synthetic 32×32×32 neural activity frames (`TensorPlayer`).
- **AI "dreaming" mode**: ONNX Runtime integration that runs SqueezeNet inference to drive stimulus injection (`InferenceEngine`).
- **Audio reactivity**: Web Audio API microphone input that modulates amplitude and flow speed (`AudioReactor`).
- **Altitude/hypoxia simulation**: Physiological modeling of oxygen deprivation effects on neural signaling.

---

## 2. Technology Stack

| Layer | Choice |
|-------|--------|
| **Language** | Vanilla JavaScript (ES Modules). **No TypeScript.** No React/Vue. |
| **Graphics API** | WebGPU |
| **Shading Language** | WGSL (Vertex, Fragment, Compute, Post-Process) |
| **Math** | Custom `Mat4` library (`math-utils.js`), column-major |
| **Build Tool** | Vite (minimal config, dev server + bundling) |
| **ML Runtime** | ONNX Runtime Web (`onnxruntime-web`) |
| **Test/Verify** | Playwright (in deps), Python scripts for smoke tests |
| **Deployment** | Manual SFTP via `deploy.py` |

**Dependencies (`package.json`):**
- `marked` — Markdown rendering (used in narrative overlays)
- `onnxruntime-web` — ONNX inference in the browser
- `playwright` — Browser automation (verification)
- `vite` — Dev server and build

**Browser Requirements:**
- Chrome 113+ or Edge 113+ with WebGPU enabled.
- **No WebGL fallback exists.** The app will show an error on unsupported browsers.
- COOP/COEP headers are configured in `vite.config.js` for `crossOriginIsolated` (required for multi-threaded WASM).

---

## 3. Project Structure

```
brain_viz/
├── index.html              # Main HTML with control panel UI
├── main.js                 # Application bootstrap, UI wiring, keyboard shortcuts
├── brain-renderer.js       # Core WebGPU engine: device, pipelines, render loop
├── brain-geometry.js       # Procedural brain mesh + circuit grid + soma positions
├── shaders.js              # WGSL shader strings (vertex, fragment, compute, post-process)
├── math-utils.js           # Mat4 operations + easing/spline utilities
├── routine-player.js       # Timed sequence engine (extensible event system)
├── tensor-player.js        # BCI tensor frame playback + synthetic pattern generators
├── tensor-utils.js         # Lightweight `Tensor` helper class (data + shape ops)
├── inference-engine.js     # ONNX SqueezeNet wrapper for AI mode
├── audio-reactor.js        # Web Audio microphone reactivity
├── vite.config.js          # Vite config (COOP/COEP headers, ONNX exclude)
├── package.json            # npm manifest
├── deploy.py               # SFTP deployment script
├── routines/               # JSON/CSV routine data
│   ├── deep_thought.json
│   ├── altitude_simulation.json
│   ├── events.csv
│   └── fmri.csv
├── public/                 # Static assets (WASM, ONNX model)
│   ├── squeezenet1.1.onnx
│   └── ort-wasm-*.wasm
└── verification/           # Screenshots/videos from manual testing
```

### Key Module Responsibilities

- **`brain-renderer.js`** — Encapsulates the entire WebGPU state machine. Creates the device, configures the canvas, builds render/compute pipelines, manages uniform buffers, and runs `requestAnimationFrame`. Exposes `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, and `setVoxelData()`.
- **`brain-geometry.js`** — Generates a deformed UV sphere (gyri/sulci approximation) and an internal Manhattan-style circuit grid. Provides vertex buffers, index buffers, fiber line buffers, and instanced soma positions.
- **`shaders.js`** — Contains all WGSL code as exported JavaScript template strings. Includes vertex/fragment shaders for the brain surface, instanced soma shaders, compute shader for tensor physics, and post-processing shaders (chromatic aberration, grain, DoF).
- **`routine-player.js`** — Orchestrates timed events (stimulus, camera, lerp, audio, text, choice/branching). Supports sub-routines, procedural generation, CSV parsing, and an extensible handler registry.
- **`tensor-player.js`** — Generates synthetic BCI patterns (alpha waves, working memory, visual burst, seizure spread, meditation) and loads `.bin`, `.npy`, and `.csv` tensor series.
- **`main.js`** — Wires the DOM UI to the renderer, sets up keyboard shortcuts, initializes `RoutinePlayer`, `AudioReactor`, `TensorPlayer`, and `InferenceEngine`, and runs the main update loop.

---

## 4. Build and Run Commands

```bash
# Install dependencies
npm install

# Start local dev server (http://localhost:5173)
npm run dev

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview
```

**Smoke test:**
```bash
python test_run.py
```
This starts `npm run dev` in a subprocess, waits 3 seconds, and checks that `http://localhost:5173` responds.

---

## 5. Critical Architecture Details

### 5.1 Matrix Multiplication Order (Column-Major)

The project uses **column-major** memory layout to align with WGSL standards.

In `math-utils.js`, `Mat4.multiply(A, B)` computes a memory layout equivalent to the mathematical operation **B × A**.

In `brain-renderer.js`, the MVP matrix is constructed as:
```javascript
const pv = Mat4.multiply(view, projection); // result = Projection * View
const mvp = Mat4.multiply(model, pv);       // result = (Projection * View) * Model
```

This produces the correct `P * V * M` matrix for column-vector transformation.

**⚠️ Do NOT refactor the multiplication order to look "standard" (e.g., `multiply(P, V)`). It is already correct for the internal library implementation.**

### 5.2 Compute-Render Synchronization

The tensor animation relies on a Compute Shader writing to `tensorBuffer` that is immediately read by the Vertex Shader in the same frame. This is safe because WebGPU orders commands sequentially in the command encoder:

1. `beginComputePass` (writes `tensorBuffer`)
2. `end`
3. `beginRenderPass` (reads `tensorBuffer`)

**Do not reverse this order.** The `tensorBuffer` usage flags include both `STORAGE` and `COPY_DST`. In WGSL it is bound as `var<storage, read>` in the vertex stage.

When `tensorPlaybackMode` is `true` (driven by `TensorPlayer`), the compute pass is skipped and the buffer is written directly from JavaScript via `setVoxelData()`.

### 5.3 Buffer Alignment & Padding

WGSL structs require strict memory alignment. The `Uniforms` struct in `shaders.js` has explicit scalar/padding layout, and the JavaScript side writes a `Float32Array` with hardcoded offsets.

- **Render uniform buffer**: 60 floats (240 bytes), padded up to 256 bytes to satisfy WebGPU uniform alignment.
- **Compute uniform buffer**: 64 bytes fixed size.

**When adding new uniforms, you MUST manually calculate and respect WGSL alignment rules in both the shader struct and the JavaScript `Float32Array`/`DataView` writing to it.** Failure results in silent data corruption or validation errors.

### 5.4 Stimulus Injection Lifecycle

`injectStimulus(x, y, z, intensity)` in `brain-renderer.js` updates `this.stimulus.pos` and `this.stimulus.active`. These are uploaded to the compute uniform buffer in `updateUniforms()`. After upload, `stimulus.active` is auto-reset to `0.0` so it fires for exactly one frame unless re-triggered.

---

## 6. Code Style Guidelines

- **Pure JavaScript only.** Do not introduce TypeScript syntax (types, interfaces, generics) into `.js` files.
- **ES Modules everywhere.** Use `import`/`export`; no CommonJS.
- **No external frameworks.** Keep the codebase framework-free.
- **Follow existing naming:** `camelCase` for variables/functions, `PascalCase` for classes.
- **Comments:** Inline comments use `// [Neuro-Weaver]` or `// [Phase N]` tags for major subsystem changes.
- **Magic numbers:** Prefer named constants in shader strings (see `CONSTANTS` block in `shaders.js`).

---

## 7. Testing Instructions

There is **no automated unit test suite** (no Jest/Vitest configuration). Testing is manual and visual:

1. Run `npm run dev` and open the provided localhost URL in a WebGPU-capable browser.
2. Verify the brain renders and animates smoothly (~60 FPS).
3. Use the control panel to switch styles, adjust sliders, and click stimulus buttons.
4. Press keyboard keys (`1`, `2`, `3`, `4`, `5`, `6`, `d`, `e`, `j`, `a`, `m`, `n`, etc.) to trigger mini-routines.
5. Enable "Audio Reactivity" and make noise to see parameters react.
6. Enable "AI Dreaming" to verify ONNX model loading and inference.
7. Load a BCI pattern from the "BCI Tensor Playback" panel and press Play.

**Verification artifacts** are stored in `verification/` (screenshots and videos from past releases).

**Python smoke test:**
```bash
python test_run.py
```

---

## 8. Deployment Process

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Run the deployment script:
   ```bash
   python deploy.py
   ```
   This recursively uploads the `dist/` directory via SFTP to a remote server. The server credentials are hardcoded in `deploy.py` (username, host, remote path).

**Do not edit files in `dist/` directly.** Always edit source files and re-run `npm run build`.

---

## 9. Security Considerations

- **Hardcoded credentials:** `deploy.py` contains a plaintext password. Do not commit modified versions with real secrets if the repo is public.
- **Cross-Origin Isolation:** `vite.config.js` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This is required for `SharedArrayBuffer` and multi-threaded ONNX WASM, but it blocks certain cross-origin resources (e.g., external images/audio) unless they send appropriate CORS headers.
- **Microphone access:** `audio-reactor.js` requests `getUserMedia({ audio: true })`. This triggers a browser permission prompt.
- **External audio URLs:** Some routines fetch audio from external URLs (`cdn.freesound.org`). Ensure these URLs are HTTPS and CORS-enabled.
- **No input sanitization on tensor files:** `TensorPlayer` loads user-supplied `.bin`, `.npy`, and `.csv` files directly into GPU buffers. While the code checks array lengths, malformed files can cause runtime errors or garbage visualization.

---

## 10. Inherent Limitations & "Here be Dragons"

- **Repository size:** The `.git` pack is large (~32 MB) because `node_modules` was accidentally committed early in history, and large binaries (WASM, ONNX, verification media) are stored directly in the repo. **Use shallow clones:** `git clone --depth 1`. Future large binaries are tracked via Git LFS (see `.gitattributes`).
- **WebGPU only:** No fallback for older browsers or devices without WebGPU.
- **Memory management:** Geometry buffers are allocated once at startup. Window resize destroys and recreates the depth texture and render target, but **not** the geometry buffers. If mesh parameters change, buffers must be explicitly destroyed and recreated in `brain-renderer.js`.
- **Routine branching pauses the engine:** `choice` and `wait` events pause `RoutinePlayer` until user interaction or an external signal is received. Ensure UI handlers correctly call `player.resume()` or `player.triggerSignal()`.
- **ONNX WASM path fragility:** `inference-engine.js` uses Vite-specific `?url` imports for WASM files. Changing the build tool would break this.

---

## 11. Scientific Accuracy Notes

The project includes a `SCIENTIFIC_ACCURACY_REPORT.md` that evaluates the physiological models (barometric formulas, brain anatomy mapping, hypoxia vulnerability, cortisol effects, etc.). Key verified facts:
- Barometric formula and oxygen saturation calculations are correct.
- Anatomical region mappings (frontal, occipital, temporal, parietal) are spatially accurate.
- The serotonin color shift is **metaphorical**, not literal color perception.
- Cortisol-induced structural decay is grounded in research on dendritic atrophy.

When adding new physiological simulations, consult or update `SCIENTIFIC_ACCURACY_REPORT.md`.

---

## 12. Quick Reference: Adding a New Feature

1. **New shader effect?** Add WGSL code to `shaders.js`, update uniform structs, and mirror the JavaScript offset layout in `brain-renderer.js` `updateUniforms()`.
2. **New routine event type?** Register a handler in `routine-player.js` `setupDefaultHandlers()`, then emit the event from `main.js` keyboard shortcuts or JSON routines.
3. **New BCI pattern?** Add a generator method to `tensor-player.js` and register it in `BUILTIN_PATTERNS`.
4. **New UI control?** Add the HTML input to `index.html`, map it in `main.js` `initUIControls()`, and ensure `routine-player.js` can lerp it if needed.
5. **New post-processing effect?** Modify `postFragmentShader` in `shaders.js` and add the corresponding parameter to `renderer.params`.

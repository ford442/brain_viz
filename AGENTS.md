# AGENTS.md — Neuro-Weaver Brain Visualization

> This file is intended for AI coding agents. It assumes the reader knows nothing about the project.

---

## 1. Project Overview

**Neuro-Weaver** is a high-performance, WebGPU-based 3D volumetric brain visualization engine. It renders a stylized, animated human brain driven by a real-time 32×32×32 tensor field. The application simulates structured neural signal flow, anatomical regions, and reactive stimuli using GPU compute shaders.

Key capabilities:
- **Four visualization styles**: Organic (surface), Cyber (wireframe), Connectome (fibers + instanced somas), and Heatmap (volumetric thermal gradient).
- **SynaptiX comparative mode**: Dual-buffer human vs AI visualization with built-in phantom activations, resonance highlighting, and anatomical projection of non-32³ activations.
- **Interactive stimuli**: Click to inject signals into specific lobes (frontal, occipital, parietal, temporal, deep).
- **Routine engine**: Scripted, timed sequences of parameters, camera moves, audio, and stimuli (`RoutinePlayer`).
- **BCI tensor playback**: Stream pre-recorded or synthetic 32×32×32 neural activity frames (`TensorPlayer`).
- **AI "dreaming" mode**: ONNX Runtime integration that runs SqueezeNet inference to drive stimulus injection (`InferenceEngine`).
- **Audio reactivity**: Web Audio API microphone input that modulates amplitude and flow speed (`AudioReactor`).
- **Altitude/hypoxia simulation**: Physiological modeling of oxygen deprivation effects on neural signaling.
- **[Phase 1] C++ WASM engine**: Optional hybrid simulation mode — `BrainTensorEngine` (C++/Emscripten) replaces the WebGPU compute shader for tensor physics while keeping the full render pipeline intact.

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
| **[Phase 1] WASM** | Emscripten (C++ → WASM); `BrainTensorEngine` in `wasm/`; JS bridge in `src/wasm-engine.js` |
| **Test/Verify** | Playwright (in deps), Python scripts for smoke tests and visual verification |
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
├── main.js                 # Application bootstrap, UI wiring, keyboard shortcuts, mini-routines
├── brain-renderer.js       # Core WebGPU engine: device, pipelines, render loop
├── brain-geometry.js       # Procedural brain mesh + circuit grid + soma positions
├── shaders.js              # WGSL shader strings (vertex, fragment, compute, post-process)
├── math-utils.js           # Mat4 operations + easing/spline utilities
├── routine-player.js       # Timed sequence engine (extensible event system)
├── tensor-player.js        # BCI tensor frame playback + synthetic pattern generators
├── tensor-utils.js         # Lightweight `Tensor` helper class (data + shape ops)
├── wasm-engine.js          # [Phase 1] JS loader + bridge for C++ BrainTensorEngine WASM module
├── inference-engine.js     # ONNX SqueezeNet wrapper for AI mode
├── audio-reactor.js        # Web Audio microphone reactivity
├── icosahedron.js          # Icosahedron vertex/index constants (used for instanced somas)
├── vite.config.js          # Vite config (COOP/COEP headers, ONNX exclude, WASM assets)
├── package.json            # npm manifest (includes build:wasm script)
├── deploy.py               # SFTP deployment script
├── test_run.py             # Python smoke test (starts dev server, curls localhost)
├── test_compile.py         # Stub for build verification
├── test_shader.js          # Shader-related test stub
├── patch_render_test.js    # Render pipeline patch/test stub
├── fix_main.py             # Script for main.js fixes
├── wasm/                   # [Phase 1] C++ BrainTensorEngine source
│   ├── brain_tensor_engine.h    # C API declarations
│   └── brain_tensor_engine.cpp  # Full simulation implementation
├── scripts/                # Build helper scripts
│   └── build_wasm.sh       # [Phase 1] Emscripten build script (npm run build:wasm)
├── routines/               # JSON/CSV routine data
│   ├── deep_thought.json
│   ├── altitude_simulation.json
│   ├── events.csv
│   └── fmri.csv
├── public/                 # Static assets (WASM, ONNX model)
│   ├── squeezenet1.1.onnx
│   ├── ort-wasm-*.wasm
│   └── wasm/               # [Phase 1] Built WASM output (generated by npm run build:wasm)
│       ├── brain_tensor_engine.js
│       └── brain_tensor_engine.wasm
├── verification/           # Screenshots/videos + Python verification scripts
│   ├── brain_heatmap.png
│   ├── branching_deep.png
│   ├── connectome_spheres.png
│   ├── error_state.png
│   ├── math_feature.png
│   ├── oxytocin_burst.png
│   ├── serotonin_manual.png
│   ├── test_flashback.py
│   ├── test_glitch.py
│   ├── verify_adrenaline.py
│   ├── verify_ai.py
│   ├── verify_brain.py
│   ├── verify_brain_v2.py
│   ├── verify_brain_viz.py
│   ├── verify_branching.py
│   ├── verify_camera_routine.py
│   ├── verify_connectome.py
│   ├── verify_custom_audio.py
│   ├── verify_cyber.py
│   ├── verify_director_tools.py
│   ├── verify_fog.py
│   ├── verify_glitch.py
│   ├── verify_growth.py
│   ├── verify_interactive_storytelling.py
│   ├── verify_keyboard.py
│   ├── verify_math_feature.py
│   ├── verify_noradrenaline.py
│   ├── verify_oxytocin.py
│   ├── verify_routine.py
│   ├── verify_shake.py
│   ├── verify_signal.py
│   ├── verify_signal_speed.py
│   ├── verify_sparkle.py
│   ├── verify_spline.py
│   ├── verify_spline_flythrough.py
│   ├── verify_stress.py
│   ├── verify_suite.py
│   ├── verify_suite_v2.py
│   ├── verify_timeline_editor.py
│   └── verify_ui.py
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot context instructions
└── .jules/
    └── setup.sh               # Emscripten setup script
```

### Key Module Responsibilities

- **`brain-renderer.js`** — Encapsulates the entire WebGPU state machine. Creates the device, configures the canvas, builds render/compute pipelines, manages uniform buffers, and runs `requestAnimationFrame`. Exposes `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, and `setVoxelData()`.
- **`synaptix-engine.js`** — Owns AI tensor ingestion/projecting, phantom presets, frame-sequence playback, and resonance stats for SynaptiX mode.
- **`brain-geometry.js`** — Generates a deformed UV sphere (gyri/sulci approximation) and an internal Manhattan-style circuit grid. Provides vertex buffers, index buffers, fiber line buffers, and instanced soma positions.
- **`shaders.js`** — Contains all WGSL code as exported JavaScript template strings. Includes vertex/fragment shaders for the brain surface, instanced soma shaders, compute shader for tensor physics, and post-processing shaders (chromatic aberration, grain, DoF).
- **`routine-player.js`** — Orchestrates timed events (stimulus, camera, lerp, audio, text, choice/branching). Supports sub-routines, procedural generation, CSV parsing, and an extensible handler registry.
- **`tensor-player.js`** — Generates synthetic BCI patterns (alpha waves, working memory, visual burst, seizure spread, meditation) and loads `.bin`, `.npy`, and `.csv` tensor series.
- **`tensor-utils.js`** — Lightweight `Tensor` helper class providing data validation, `reshape()`, and `normalize()` operations for Float32Array-based tensors.
- **`wasm-engine.js`** — [Phase 1] JavaScript loader and bridge for the C++ `BrainTensorEngine` WASM module. Provides `WasmTensorEngine` class with `init()`, `update()`, `injectStimulus()`, `getTensorData()`, `benchmark()`, and `dispose()`. Gracefully falls back when WASM build is absent.
- **`main.js`** — Wires the DOM UI to the renderer, sets up keyboard shortcuts, initializes `RoutinePlayer`, `AudioReactor`, `TensorPlayer`, and `InferenceEngine`, and runs the main update loop. Also wires the WASM engine toggle UI.
- **`icosahedron.js`** — Static icosahedron vertex and index arrays exported as constants. Used by `brain-renderer.js` for instanced soma geometry.

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

# [Phase 1] Build C++ WASM simulation engine (requires Emscripten)
npm run build:wasm

# [Phase 1] Build WASM in debug mode (assertions + safe-heap)
npm run build:wasm:debug
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

**[Phase 1] WASM hybrid mode**: When `wasmMode` is `true`, the C++ engine runs `bte_update()` each frame and the result is uploaded via `device.queue.writeBuffer(tensorBuffer, …)` before the render pass. The WebGPU compute pass is skipped in this mode.

### 5.3 Buffer Alignment & Padding

WGSL structs require strict memory alignment. The `Uniforms` struct in `shaders.js` has explicit scalar/padding layout, and the JavaScript side writes a `Float32Array` with hardcoded offsets.

- **Render uniform buffer**: 64 floats (`RENDER_UNIFORM_FLOAT_COUNT = 64`), which is 256 bytes. This already satisfies WebGPU uniform alignment requirements, so the buffer is allocated at exactly 256 bytes.
- **Compute uniform buffer**: 80 bytes fixed size (`COMPUTE_UNIFORM_BUFFER_SIZE = 80`). The active data spans offsets 0–71 (time, voxelDim, frequency, amplitude, spikeThreshold, smoothing, style, padding, stimulusPos, stimulusActive, hypoxiaStress, metabolicRate, mitochondrialFunction, fluidActive, electricalActive, mercuryActive), with trailing padding to reach 80 bytes.

**When adding new uniforms, you MUST manually calculate and respect WGSL alignment rules in both the shader struct and the JavaScript `Float32Array`/`DataView` writing to it.** Failure results in silent data corruption or validation errors.

### 5.3a SynaptiX Uniform / Buffer Notes

- SynaptiX uses a second 32×32×32 storage buffer, `aiTensorBuffer`, alongside the human `tensorBuffer`.
- The render uniform path includes `aiInfluence`, `resonanceThreshold`, and `aiLayer`; these are mirrored from `brain-renderer.js` into the WGSL structs in `shaders.js`.
- SynaptiX rendering is enabled when `style >= 4.0`.
- Non-32³ tensors are projected in `synaptix-engine.js` using the default mapping:
  - early activations → occipital
  - lower-mid → temporal
  - upper-mid → parietal
  - deep → frontal
- Built-in "phantom" presets are code-native and do not require external assets; story routines rely on them for first-run demos.

### 5.4 Stimulus Injection Lifecycle

`injectStimulus(x, y, z, intensity)` in `brain-renderer.js` updates `this.stimulus.pos` and `this.stimulus.active`. These are uploaded to the compute uniform buffer in `updateUniforms()`. After upload, `stimulus.active` is auto-reset to `0.0` so it fires for exactly one frame unless re-triggered.

**[Phase 1] WASM mode**: when `wasmMode` is active, `injectStimulus()` also calls `wasmEngine.injectStimulus()` so that the C++ engine applies the same Gaussian pulse immediately.

### 5.5 [Phase 1] WASM Hybrid Architecture

See [`docs/wasm-engine.md`](docs/wasm-engine.md) for the full specification.  Key points:

- `WasmTensorEngine` (`src/wasm-engine.js`) lazily loads `public/wasm/brain_tensor_engine.{js,wasm}`.
- If the WASM build is absent, `init()` returns `false` and `wasmMode` stays `false` — **no breakage**.
- The C++ engine replicates every physics step from the compute shader identically (region physics, hypoxia, diffusion, fluid advection, hazards, decay).
- Memory is zero-copy: `getTensorData()` returns a `Float32Array` view directly into the WASM heap.

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
8. **[Phase 1]** After running `npm run build:wasm`, click the "Simulation Engine" toggle in the Activity tab to enable WASM mode and verify the brain continues to render correctly.

**Python smoke test:**
```bash
python test_run.py
```

**Python verification scripts** (run individually for targeted feature checks):
- `verification/verify_brain.py` — Basic brain rendering verification
- `verification/verify_brain_v2.py` — Extended rendering checks
- `verification/verify_brain_viz.py` — Full visualization pipeline check
- `verification/verify_routine.py` — Routine player event sequencing
- `verification/verify_camera_routine.py` — Camera move verification
- `verification/verify_connectome.py` — Connectome/fiber mode check
- `verification/verify_cyber.py` — Cyber/wireframe mode check
- `verification/verify_adrenaline.py` — Adrenaline stimulus routine
- `verification/verify_noradrenaline.py` — Noradrenaline stimulus routine
- `verification/verify_oxytocin.py` — Oxytocin stimulus routine
- `verification/verify_stress.py` — Stress distortion effects
- `verification/verify_shake.py` — Camera shake behavior
- `verification/verify_glitch.py` — Glitch corruption simulation
- `verification/verify_fog.py` — Volumetric fog rendering
- `verification/verify_growth.py` — Dendritic growth parameters
- `verification/verify_sparkle.py` — Synaptic sparkle effects
- `verification/verify_spline.py` — Spline interpolation paths
- `verification/verify_spline_flythrough.py` — Spline camera fly-through
- `verification/verify_branching.py` — Branching routine logic
- `verification/verify_signal.py` — Signal/wait event synchronization
- `verification/verify_signal_speed.py` — Playback speed modulation
- `verification/verify_math_feature.py` — Math/variable routine features
- `verification/verify_interactive_storytelling.py` — Choice/overlay interactions
- `verification/verify_custom_audio.py` — External audio loading
- `verification/verify_keyboard.py` — Keyboard shortcut handling
- `verification/verify_ui.py` — UI control synchronization
- `verification/verify_timeline_editor.py` — Timeline editor checks
- `verification/verify_director_tools.py` — Director tool verification
- `verification/verify_ai.py` — ONNX inference engine verification
- `verification/verify_suite.py` / `verify_suite_v2.py` — Aggregated verification suites
- `verification/test_flashback.py` — Memory flashback routine test
- `verification/test_glitch.py` — Glitch storm routine test

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

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
- **BCI playback and live devices**: Stream pre-recorded/synthetic tensors or calibrated Muse/OpenBCI EEG through the human 32×32×32 field.
- **WebXR immersive mode**: WebGL2-backed stereo VR walkthrough and tabletop AR with controller/hand tensor stimulation.
- **Double Mirror sessions**: Local-only synchronized 32³ tensor, webcam-thumbnail, microphone-feature, and note capture with strict `.nwsession` replay/scrubbing, descriptive analysis, and CSV export.
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
| **Deployment** | Manual SFTP via `scripts/deploy.py` |

**Dependencies (`package.json`):**
- `marked` — Markdown rendering (used in narrative overlays)
- `onnxruntime-web` — ONNX inference in the browser
- `playwright` — Browser automation (verification)
- `vite` — Dev server and build

**Browser Requirements:**
- Chrome 113+ or Edge 113+ with WebGPU enabled for the primary renderer.
- A WebGL2 fallback renderer is available via `?renderer=webgl` for debugging, automation, and porting work.
- COOP/COEP headers are configured in `vite.config.js` for `crossOriginIsolated` (required for multi-threaded WASM).

---

## 3. Project Structure

> The application modules below (`main.js`, `brain-renderer.js`, `shaders.js`, etc.) live under `src/`, which has grown considerably beyond this list as features shipped (additional `src/ui-*.js`, `src/routine-*.js`, `src/main-*.js` modules, and `src/brain-renderer/`, `src/geometry/`, `src/mini-routines/`, `src/routine-handlers/`, `src/shaders/`, `src/ui/` subdirectories). Treat this as a map of the core/original modules, not an exhaustive `src/` listing — use `Glob`/`Grep` or the Explore agent for a live view of everything under `src/`.

```
brain_viz/
├── index.html              # Main HTML with control panel UI
├── src/
│   ├── main.js                 # Application bootstrap, UI wiring, keyboard shortcuts, mini-routines
│   ├── brain-renderer.js       # Core WebGPU engine: device, pipelines, render loop
│   ├── brain-renderer-webgl.js # WebGL2 fallback/debug renderer
│   ├── brain-renderer-factory.js # Backend selection + fallback bootstrap
│   ├── brain-geometry.js       # Procedural brain mesh + circuit grid + soma positions
│   ├── shaders.js              # WGSL shader strings (vertex, fragment, compute, post-process)
│   ├── math-utils.js           # Mat4 operations + easing/spline utilities
│   ├── routine-player.js       # Timed sequence engine (extensible event system)
│   ├── tensor-player.js        # BCI tensor frame playback + synthetic pattern generators
│   ├── bci/                     # Live EEG adapters, DSP, tensor projection, recording/replay
│   ├── tensor-utils.js         # Lightweight `Tensor` helper class (data + shape ops)
│   ├── webxr-manager.js        # XR session, stereo rig, navigation, ray stimuli
│   ├── wasm-engine.js          # [Phase 1] JS loader + bridge for C++ BrainTensorEngine WASM module
│   ├── inference-engine.js     # ONNX SqueezeNet wrapper for AI mode
│   ├── audio-reactor.js        # Web Audio microphone reactivity
│   ├── session-format.js       # NWS1 binary codec and strict import validation
│   ├── session-recorder.js     # 10 Hz local multimodal capture + IndexedDB spill
│   ├── session-player.js       # Synchronized human-tensor replay and scrubbing
│   ├── session-analysis.js     # Occipital/audio pairing, heatmap, Pearson, CSV
│   └── icosahedron.js          # Icosahedron vertex/index constants (used for instanced somas)
├── vite.config.js          # Vite config (COOP/COEP headers, ONNX exclude, WASM assets)
├── package.json            # npm manifest (includes build:wasm script)
├── CONTRIBUTING.md         # "Where to look" map across all docs
├── wasm/                   # [Phase 1] C++ BrainTensorEngine source
│   ├── brain_tensor_engine.h    # C API declarations
│   └── brain_tensor_engine.cpp  # Full simulation implementation
├── scripts/                # Build/deploy/test helper scripts
│   ├── build_wasm.sh       # [Phase 1] Emscripten build script (npm run build:wasm)
│   ├── build_wasm_colab.sh # Colab-flavored WASM build variant
│   ├── check_wasm.sh       # Advisory prebuild check (npm run prebuild)
│   ├── deploy.py           # SFTP deployment script (canonical — see §8)
│   ├── fix_main.py         # One-off main.js repair script
│   ├── test_compile.py     # Stub for build verification
│   └── test_run.py         # Dev-server smoke test (see §4, §7)
├── tests/                  # Ad hoc test stubs (no automated suite — see §7)
│   ├── patch_render_test.js    # Render pipeline patch/test stub
│   └── test_shader.js          # Shader-related test stub
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
├── verification/           # Canonical verification tree: Python/Playwright scripts + generated screenshots
│   ├── verify_suite.py            # Runs all checks below and reports pass/fail
│   ├── verify_brain.py            # Style cycling + WebGL debug controls
│   ├── verify_stimulus.py         # Region stimulus injection
│   ├── verify_camera.py           # Camera preset + spline moves
│   ├── verify_routine.py          # Mini-routines (heartbeat, respiration, electrical)
│   ├── verify_synaptix.py         # SynaptiX AI↔Human resonance
│   ├── verify_neuromodulators.py  # Adrenaline/noradrenaline/oxytocin mini-routines
│   ├── verify_timeline_editor.py  # GUI timeline editor (open, add event)
│   ├── verify_ai_inference.py     # ONNX inference engine + live-source toggle
│   ├── verify_cinematic_fx.py     # Camera shake, chromatic aberration, grain, DoF, fog
│   ├── verify_neurochemical_fx.py # Stress/cortisol/heavy-metal, dendritic growth, sparkle
│   ├── verify_branching.py        # Choice/branching routine logic
│   ├── verify_glitch.py           # Glitch storm corruption simulation
│   ├── verify_training.py         # Neurofeedback Training Mode courses + keyboard demo baseline
│   ├── *.png                      # Screenshots generated on each run (gitignored)
│   └── verify_session.py           # Double Mirror round-trip/lifecycle verification
├── docs/                   # Architecture, roadmap, and mode-specific docs (see docs/ROADMAP.md, docs/archive/)
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot context instructions
└── .jules/
    └── setup.sh               # Emscripten setup script
```

### Key Module Responsibilities

- **`brain-renderer.js`** — Encapsulates the entire WebGPU state machine. Creates the device, configures the canvas, builds render/compute pipelines, manages uniform buffers, and runs `requestAnimationFrame`. Exposes `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, and `setVoxelData()`.
- **`brain-renderer-webgl.js`** — WebGL2 fallback/debug renderer. Reuses the same CPU geometry generation, tensor inputs, camera contract, and style state, but approximates compute/volumetric behavior on the CPU for easier inspection.
- **`brain-renderer-factory.js`** — Chooses `webgpu` or `webgl` from URL params / `localStorage`, initializes the requested backend first, and falls back only when needed.
- **`synaptix-engine.js`** — Owns AI tensor ingestion/projecting, phantom presets, frame-sequence playback, and resonance stats for SynaptiX mode.
- **`brain-geometry.js`** — Generates a deformed UV sphere (gyri/sulci approximation) and an internal Manhattan-style circuit grid. Provides vertex buffers, index buffers, fiber line buffers, and instanced soma positions.
- **`shaders.js`** — Contains all WGSL code as exported JavaScript template strings. Includes vertex/fragment shaders for the brain surface, instanced soma shaders, compute shader for tensor physics, and post-processing shaders (chromatic aberration, grain, DoF).
- **`routine-player.js`** — Orchestrates timed events (stimulus, camera, lerp, audio, text, choice/branching). Supports sub-routines, procedural generation, CSV parsing, and an extensible handler registry.
- **`tensor-player.js`** — Generates synthetic BCI patterns (alpha waves, working memory, visual burst, seizure spread, meditation) and loads `.bin`, `.npy`, and `.csv` tensor series.
- **`bci/`** — Normalizes Muse Classic/Athena and OpenBCI samples, derives alpha/beta/gamma features, projects them into the human tensor, and owns local `.nwbci` recording/replay.
- **`tensor-utils.js`** — Lightweight `Tensor` helper class providing data validation, `reshape()`, and `normalize()` operations for Float32Array-based tensors.
- **`webxr-manager.js`** — Owns immersive VR/AR session lifecycle, per-eye WebGL matrices, controller/hand input, lobe viewpoints, and routine-driven XR rig state.
- **`wasm-engine.js`** — [Phase 1] JavaScript loader and bridge for the C++ `BrainTensorEngine` WASM module. Provides `WasmTensorEngine` class with `init()`, `update()`, `injectStimulus()`, `getTensorData()`, `benchmark()`, and `dispose()`. Gracefully falls back when WASM build is absent.
- **`main.js`** — Wires the DOM UI to the renderer, sets up keyboard shortcuts, initializes `RoutinePlayer`, `AudioReactor`, `TensorPlayer`, and `InferenceEngine`, and runs the main update loop. Also wires the WASM engine toggle UI.
- **`icosahedron.js`** — Static icosahedron vertex and index arrays exported as constants. Used by `brain-renderer.js` for instanced soma geometry.
- **`training-engine.js`** — Neurofeedback Training Mode: `TrainingEngine` class, simulated 0..1 metric samplers (`calm`, `occipitalAlpha`, `flowResonance`), the `BUILTIN_COURSES` catalog (Calm Focus / Panic Recovery / Flow Sustain), streak/drift-penalty/star scoring, and `localStorage` session history. See `docs/training-mode.md`.
- **`session-recorder.js` / `session-player.js`** — Double Mirror capture and replay ownership. Recording samples the current human tensor without mutating it; playback exclusively owns the human tensor until stopped and never modifies the SynaptiX partner tensor. See `docs/session-format.md`.

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

# OpenBCI GUI UDP → browser WebSocket bridge
npm run bci:bridge

# [Phase 1] Build C++ WASM simulation engine (requires Emscripten)
npm run build:wasm

# [Phase 1] Build WASM in debug mode (assertions + safe-heap)
npm run build:wasm:debug
```

**Renderer selection:**
```bash
http://localhost:5173/?renderer=webgpu
http://localhost:5173/?renderer=webgl
```

**Smoke test:**
```bash
python3 scripts/test_run.py
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

1. Run `npm run dev` and open the provided localhost URL in a modern browser.
2. Verify the brain renders and animates smoothly (~60 FPS).
3. Use the control panel to switch styles, adjust sliders, and click stimulus buttons.
4. Press keyboard keys (`1`, `2`, `3`, `4`, `5`, `6`, `d`, `e`, `j`, `a`, `m`, `n`, etc.) to trigger mini-routines.
5. Enable "Audio Reactivity" and make noise to see parameters react.
6. Enable "AI Dreaming" to verify ONNX model loading and inference.
7. Load a BCI pattern from the "BCI Tensor Playback" panel and press Play.
8. **[Phase 1]** After running `npm run build:wasm`, click the "Simulation Engine" toggle in the Activity tab to enable WASM mode and verify the brain continues to render correctly.
9. For automation/debug passes, switch to `?renderer=webgl` and use the WebGL debug controls for wireframe, tensor-point visibility, and layer isolation.

**Python smoke test:**
```bash
python test_run.py
```

**Automated verification via WebGL fallback (recommended for CI):**
All Playwright-based verification scripts force `?renderer=webgl` for reliable headless execution. WebGPU requires `--enable-unsafe-webgpu` and SwiftShader, which frequently loses the GPU context in automated environments. The WebGL path provides deterministic screenshots and stable console behavior.

```bash
# Run the full suite
python verification/verify_suite.py

# Or run individual checks
python verification/verify_brain.py             # Style cycling + WebGL debug controls
python verification/verify_stimulus.py          # Region stimulus injection
python verification/verify_camera.py            # Camera preset + spline moves
python verification/verify_routine.py           # Mini-routines (heartbeat, respiration, electrical)
python verification/verify_synaptix.py          # SynaptiX AI↔Human resonance
python verification/verify_neuromodulators.py   # Adrenaline/noradrenaline/oxytocin mini-routines
python verification/verify_timeline_editor.py   # GUI timeline editor (open, add event)
python verification/verify_ai_inference.py      # ONNX inference engine + live-source toggle
python verification/verify_cinematic_fx.py      # Camera shake, chromatic aberration, grain, DoF, fog
python verification/verify_neurochemical_fx.py  # Stress/cortisol/heavy-metal, dendritic growth, sparkle
python verification/verify_branching.py         # Choice/branching routine logic
python verification/verify_glitch.py            # Glitch storm corruption simulation
python verification/verify_bci_device.py        # Mocked Muse GATT + OpenBCI UDP/WebSocket bridge
python verification/verify_webxr.py             # Mocked stereo XR + routine rig/raycast/fallback
python verification/verify_session.py           # NWS1 capture/replay/analysis/lifecycle checks
```

`verification/` is the single canonical verification tree (tracked in git; only generated screenshots/`__pycache__` are gitignored). There is no separate `tests/verification/` tree — it was removed as part of consolidating the two parallel suites that used to exist.

### 7.1 CI Contract

`.github/workflows/ci.yml` runs on every push/PR to `main` and gates on:

1. `npm ci`
2. `npx vite build` — frontend-only build (never `npm run build`, which shells out to `scripts/build_wasm.sh` and requires an Emscripten SDK that CI does not provision)
3. `python3 scripts/test_run.py` — dev server smoke test
4. `pip install playwright && playwright install chromium`
5. `python3 verification/verify_suite.py` — the WebGL-fallback (`?renderer=webgl`) Playwright suite described above

`node_modules` and the Playwright browser cache are cached across runs. Verification screenshots are uploaded as a build artifact when the job fails. The WASM build (`npm run build:wasm`) stays a local/manual step and is **not** a CI gate unless an Emscripten toolchain is added to the workflow later.

---

## 8. Deployment Process

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Run the deployment script:
   ```bash
   python scripts/deploy.py
   ```
   This recursively uploads the `dist/` directory via SFTP to a remote server. The server credentials are hardcoded in `scripts/deploy.py` (username, host, remote path). An unused, alternate Contabo-storage-based deploy template is preserved for reference in `docs/archive/deploy-contabo-template.py` — it is not the active deploy path.

**Do not edit files in `dist/` directly.** Always edit source files and re-run `npm run build`.

---

## 9. Security Considerations

- **Hardcoded credentials:** `scripts/deploy.py` contains a plaintext password. Do not commit modified versions with real secrets if the repo is public.
- **Cross-Origin Isolation:** `vite.config.js` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. This is required for `SharedArrayBuffer` and multi-threaded ONNX WASM, but it blocks certain cross-origin resources (e.g., external images/audio) unless they send appropriate CORS headers.
- **Microphone access:** `audio-reactor.js` requests `getUserMedia({ audio: true })`. This triggers a browser permission prompt.
- **External audio URLs:** Some routines fetch audio from external URLs (`cdn.freesound.org`). Ensure these URLs are HTTPS and CORS-enabled.
- **No input sanitization on tensor files:** `TensorPlayer` loads user-supplied `.bin`, `.npy`, and `.csv` files directly into GPU buffers. While the code checks array lengths, malformed files can cause runtime errors or garbage visualization.

---

## 10. Inherent Limitations & "Here be Dragons"

- **Repository size:** The `.git` pack is large (~32 MB) because `node_modules` was accidentally committed early in history, and large binaries (WASM, ONNX, verification media) are stored directly in the repo. **Use shallow clones:** `git clone --depth 1`. Future large binaries are tracked via Git LFS (see `.gitattributes`).
- **Backend split:** WebGPU remains the authoritative renderer. The WebGL2 fallback is a debug/reference path with simplified CPU-side simulation and shading, so visual parity is approximate rather than exact.
- **Memory management:** Geometry buffers are allocated once at startup. Window resize destroys and recreates the depth texture and render target, but **not** the geometry buffers. If mesh parameters change, buffers must be explicitly destroyed and recreated in `brain-renderer.js`.
- **Routine branching pauses the engine:** `choice` and `wait` events pause `RoutinePlayer` until user interaction or an external signal is received. Ensure UI handlers correctly call `player.resume()` or `player.triggerSignal()`.
- **ONNX WASM path fragility:** `inference-engine.js` uses Vite-specific `?url` imports for WASM files. Changing the build tool would break this.

---

## 11. Scientific Accuracy Notes

The project includes a `docs/SCIENTIFIC_ACCURACY_REPORT.md` that evaluates the physiological models (barometric formulas, brain anatomy mapping, hypoxia vulnerability, cortisol effects, etc.). Key verified facts:
- Barometric formula and oxygen saturation calculations are correct.
- Anatomical region mappings (frontal, occipital, temporal, parietal) are spatially accurate.
- The serotonin color shift is **metaphorical**, not literal color perception.
- Cortisol-induced structural decay is grounded in research on dendritic atrophy.

When adding new physiological simulations, consult or update `docs/SCIENTIFIC_ACCURACY_REPORT.md`.

---

## 12. Quick Reference: Adding a New Feature

1. **New shader effect?** Add WGSL code to `shaders.js`, update uniform structs, and mirror the JavaScript offset layout in `brain-renderer.js` `updateUniforms()`.
2. **New routine event type?** Register a handler in `routine-player.js` `setupDefaultHandlers()`, then emit the event from `main.js` keyboard shortcuts or JSON routines.
3. **New BCI pattern?** Add a generator method to `tensor-player.js` and register it in `BUILTIN_PATTERNS`.
4. **New UI control?** Add the HTML input to `index.html`, map it in `main.js` `initUIControls()`, and ensure `routine-player.js` can lerp it if needed.
5. **New post-processing effect?** Modify `postFragmentShader` in `shaders.js` and add the corresponding parameter to `renderer.params`.

---

## 13. Related Documentation

This file is the source of truth other agent-guardrail files sync from — `CLAUDE.md`, `.github/copilot-instructions.md`, and `docs/grok-agent-guide.md` should not contradict it. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full "where to look" map, and [`docs/ROADMAP.md`](docs/ROADMAP.md) for phase history, open items, and the dream backlog. Superseded planning documents live in [`docs/archive/`](docs/archive/) and should not be treated as current.

---

## Cursor Cloud specific instructions

Dependencies are refreshed automatically on startup by the update script (`npm install`, plus the Python Playwright + Chromium install used by the verification suite). The notes below are non-obvious caveats; standard commands live in §4 and §7 and `package.json`.

- **Use the WebGL renderer for all headless/automated/manual testing in this VM.** WebGPU is not available in the automation browser, so open `http://localhost:5173/?renderer=webgl`. The default `?renderer=webgpu` will show an error overlay or blank canvas here.
- **The verification suite uses Python Playwright, not the npm `playwright` dependency.** It needs `pip install playwright` and `python3 -m playwright install chromium` (both handled by the update script). Run it with `python3 verification/verify_suite.py`. Each script spawns its *own* dev server on port `5181` (`--strictPort`), so it is independent of any `npm run dev` you have running on `5173`.
- **`npm run build` is not runnable as-is** because it first runs `npm run build:wasm`, which `source`s Emscripten from `/root/emsdk/emsdk_env.sh` (not installed). The WASM engine is optional with a graceful runtime fallback — to build just the frontend bundle, run `npx vite build`. Only install/activate emsdk if you specifically need WASM hybrid mode.
- **`verification/` and `dist/` are gitignored**, so screenshots produced by the verify scripts and the Vite build output never dirty the working tree.

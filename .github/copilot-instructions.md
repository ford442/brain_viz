# Copilot Instructions for Neuro-Weaver Brain Visualization

This repository contains a high-performance WebGPU-based 3D volumetric brain visualization engine (with a WebGL2 fallback/debug renderer). The codebase is **pure JavaScript (ES Modules, no TypeScript)** and uses **Vite** as the build tool.

> This file is kept in sync with `AGENTS.md` (the source of truth) and `CLAUDE.md`. See `CONTRIBUTING.md` for the full "where to look" map and `docs/ROADMAP.md` for phase history and open items.

## Build, Test & Development Commands

```bash
# Install dependencies
npm install

# Start local dev server (http://localhost:5173)
npm run dev

# Build production bundle to dist/
npm run build

# Preview production build locally
npm run preview

# Smoke test (starts dev server, checks if localhost:5173 responds)
python3 scripts/test_run.py

# Full visual verification suite (WebGL fallback, Playwright-based)
python3 verification/verify_suite.py
```

**Note:** There is no automated unit test suite. Testing is manual and visual, plus the Playwright-based `verification/` suite described above. Verify the brain renders, animates smoothly (~60 FPS), and UI controls function correctly.

## Key Architecture & Design Patterns

### Core Components

- **`brain-renderer.js`** — Encapsulates the WebGPU state machine. Manages device creation, pipeline setup, render loop, and uniform buffer updates. Key methods: `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, `setVoxelData()`.

- **`brain-geometry.js`** — Procedurally generates a deformed UV sphere (gyri/sulci approximation) and an internal Manhattan-style circuit grid. Provides vertex, index, fiber line, and instanced soma position buffers.

- **`shaders.js`** — Contains all WGSL code as JavaScript template strings. Includes vertex, fragment, compute, and post-processing shaders for all four visualization styles (Organic, Cyber, Connectome, Heatmap).

- **`routine-player.js`** — Orchestrates timed events (stimulus, camera moves, lerp, audio, text, branching). Supports sub-routines, procedural generation, and CSV parsing.

- **`tensor-player.js`** — Generates synthetic BCI patterns and loads pre-recorded tensor series (.bin, .npy, .csv).

- **`inference-engine.js`** — ONNX Runtime integration for SqueezeNet inference (AI dreaming mode).

- **`audio-reactor.js`** — Web Audio API microphone input for real-time audio reactivity.

- **`main.js`** — Application bootstrap. Wires DOM controls, sets up keyboard shortcuts, initializes components, and runs the main update loop.

### Critical Design Principles

#### 1. **Column-Major Matrix Multiplication**

The project uses **column-major** memory layout to align with WGSL standards. In `math-utils.js`, `Mat4.multiply(A, B)` computes the mathematical operation **B × A** (not the intuitive A × B).

**Example from `brain-renderer.js`:**
```javascript
const pv = Mat4.multiply(view, projection);  // result = Projection * View
const mvp = Mat4.multiply(model, pv);        // result = (P * V) * Model
```

**⚠️ CRITICAL:** Do NOT refactor the multiplication order to look "standard." It is already correct for this library implementation.

#### 2. **Compute-Render Synchronization**

The render loop is structured to ensure tensors updated by compute shader are immediately read by vertex shader:

```
beginComputePass → write tensorBuffer → end → beginRenderPass → read tensorBuffer
```

WebGPU orders these commands sequentially, making this safe. When `tensorPlaybackMode` is true, the compute pass is skipped and buffers are written directly from `setVoxelData()`.

#### 3. **WGSL Buffer Alignment & Padding**

Uniform structs require strict memory alignment (16-byte for `vec4`/`mat4`). The `Uniforms` struct in `shaders.js` has explicit padding fields.

**When adding new uniforms:**
- Calculate WGSL struct alignment manually
- Mirror the offset layout in `updateUniforms()` when writing the `Float32Array`
- Misalignment causes silent data corruption

## Code Style Conventions

- **Pure JavaScript only.** No TypeScript syntax (types, interfaces, generics) in `.js` files.
- **ES Modules everywhere.** Use `import`/`export`; no CommonJS.
- **No external frameworks.** Keep the codebase framework-free (no React, Vue, etc.).
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes.
- **Comments:** Use `// [Neuro-Weaver]` or `// [Phase N]` tags for major subsystem changes.

## Browser & Deployment

- **WebGPU is the primary/authoritative renderer.** Chrome 113+, Edge 113+. A WebGL2 fallback renderer (`?renderer=webgl`) exists for debugging, automation, and headless CI — see `docs/webgl-fallback.md`.
- **COOP/COEP headers:** Configured in `vite.config.js` for `crossOriginIsolated` (required for multi-threaded WASM).
- **Deployment:** Manual SFTP via `scripts/deploy.py` (credentials hardcoded; do not commit with real secrets).
- **Repository size:** Large binaries (WASM, ONNX models) stored directly. Use `git clone --depth 1` for faster clones.

## Common Tasks

### Adding a New Visualization Style

1. Update the WGSL shaders in `shaders.js` (vertex/fragment/compute as needed).
2. Add a style constant to the uniforms.
3. Update the render pipeline switching logic in `brain-renderer.js`.
4. Add UI control to `index.html` and wire it in `main.js`.

### Adding a New Stimulus Region

1. Define region bounds (x, y, z coordinates) in `brain-renderer.js`.
2. Update `injectStimulus()` to handle the new region.
3. Add a button to `index.html` and wire it in `main.js`.

### Adding a New Uniform Parameter

1. Define the field in the `Uniforms` struct in `shaders.js`.
2. **Calculate and add padding manually** to maintain alignment.
3. Update `updateUniforms()` in `brain-renderer.js` with correct `Float32Array` offsets.
4. Add a UI slider to `index.html` and wire it in `main.js`.

### Testing a Shader Change

```bash
npm run dev
# Open http://localhost:5173 in a WebGPU-capable browser
# Verify the change visually in real-time
```

## Known Limitations

- **No automated tests.** Testing is manual and visual.
- **Memory management:** Geometry buffers allocated once at startup. Resizing the window recreates depth texture but not geometry buffers.
- **Routine branching pauses the engine:** `choice` and `wait` events pause the routine player until user interaction.
- **No input sanitization on tensor files:** Malformed `.bin`, `.npy`, `.csv` files can cause runtime errors or garbage visualization.

## MCP Server Configuration

The project includes Playwright for browser automation and testing. To enhance Copilot's capabilities for testing and browser-based tasks, configure the **Playwright MCP server**:

### Playwright MCP Server Setup

1. **Install Playwright CLI:**
   ```bash
   npm install -g @modelcontextprotocol/server-playwright
   ```

2. **Add to your Copilot configuration** (if applicable to your environment):
   - The Playwright MCP server enables Copilot to run browser automation tasks, take screenshots, and verify visual rendering.
   - This is particularly useful for verifying WebGPU rendering changes and UI interactions.

3. **Use with Copilot:**
   - Request Copilot to "take a screenshot" or "verify the WebGPU visualization renders correctly"
   - Ask it to automate testing workflows using Playwright methods

## References

For deeper technical context:
- **AGENTS.md** — Comprehensive AI agent guide (project overview, module responsibilities, architecture details); the source of truth this file syncs with.
- **CONTRIBUTING.md** — "Where to look" map across all docs.
- **docs/ROADMAP.md** — Phase history, open items, and dream backlog.
- **docs/DEVELOPER_CONTEXT.md** — Complexity hotspots and dependency flows.
- **docs/SCIENTIFIC_ACCURACY_REPORT.md** — Physiological models verification (barometric formulas, hypoxia, cortisol effects).

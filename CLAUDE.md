# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm install              # Install dependencies
npm run dev             # Start dev server (http://localhost:5173)
npm run build           # Build production bundle to dist/
npm run preview         # Preview production build locally
python test_run.py      # Smoke test (checks if server responds)
```

## Project Overview

**Neuro-Weaver** is a high-performance 3D volumetric brain visualization engine built with WebGPU and WGSL. It renders stylized brain animations driven by tensor data, supporting multiple visualization styles (Organic surface, Cyber wireframe, Connectome fibers, Heatmap thermal).

**Key tech:** Vanilla JavaScript (ES Modules, no TypeScript), WebGPU graphics API, WGSL compute/rendering shaders, Vite build tool.

## Architecture & Core Components

### Main Modules
- **`main.js`** — Application bootstrap. Initializes BrainRenderer, wires DOM controls, keyboard shortcuts, and runs the main update loop.
- **`brain-renderer.js`** — Core rendering engine. Manages WebGPU device/context, pipelines (render and compute), camera controls, uniforms, and the render loop. Methods: `setParams()`, `injectStimulus()`, `calmState()`, `resetActivity()`, `setVoxelData()`.
- **`brain-geometry.js`** — Procedurally generates a deformed UV sphere (mimics gyri/sulci) and a Manhattan-style internal circuit grid. Outputs vertex, index, fiber, and soma buffers.
- **`shaders.js`** — All WGSL code (vertex, fragment, compute, post-processing) as template strings for four visualization styles.
- **`routine-player.js`** — Orchestrates timed events (stimulus, camera movement, animations, audio, text, branching).
- **`tensor-player.js`** — Synthesizes BCI patterns and loads pre-recorded tensor series (.bin, .npy, .csv).
- **`inference-engine.js`** — ONNX Runtime integration for SqueezeNet inference (AI dreaming mode).
- **`audio-reactor.js`** — Web Audio API microphone input for real-time audio reactivity.

### Data Flow
```
BrainGeometry (CPU) → Float32Array → GPUBuffer (Vertex/Index/Storage)
                                     ↓
                               Compute Shader (writes tensorData)
                                     ↓
                          Render Shader (reads tensorData)
                                     ↓
                              WebGPU Canvas
```

### Render Loop (Simplified)
1. CPU: Update time and camera matrix (MVP)
2. CPU→GPU: Upload uniforms and compute parameters via `writeBuffer`
3. GPU: **Compute pass** — Update tensor data buffer (signal propagation, diffusion)
4. GPU: **Render pass** — Clear, switch pipeline based on style, draw brain/fibers
5. GPU→Canvas: Present frame

## Critical Design Principles & Hotspots

### 1. Column-Major Matrix Multiplication ⚠️
**The Issue:** The codebase uses column-major memory layout (WGSL standard). In `math-utils.js`, `Mat4.multiply(A, B)` computes the mathematical operation **B × A**, not A × B.

**Example from `brain-renderer.js`:**
```javascript
const pv = Mat4.multiply(view, projection);  // result = Projection * View
const mvp = Mat4.multiply(model, pv);        // result = (P * V) * Model
```

**Action:** **DO NOT REFACTOR** the multiplication order to look "standard." It is already correct for this library.

### 2. Compute-Render Synchronization
The tensor animation relies on a Compute Shader modifying `tensorData` that is immediately read by the Vertex Shader in the same frame. WebGPU's command encoder order guarantees this works:
```
beginComputePass() → writes tensorData → end() → beginRenderPass() → reads tensorData
```

**Action:** Preserve this order. If `tensorData` is moved to a different bind group, verify both `STORAGE` and `VERTEX` (or `READ_ONLY_STORAGE`) flags are set.

### 3. WGSL Struct Alignment & Padding
**The Issue:** WGSL structs require strict 16-byte alignment for `vec4`/`mat4` fields. The `Uniforms` struct in `shaders.js` has explicit padding fields (`padding1`, `padding2`).

**Action:** When adding uniforms:
1. Calculate WGSL struct alignment manually
2. Update the `Float32Array` offsets in `updateUniforms()` in `brain-renderer.js`
3. Misalignment causes silent data corruption

### 4. No Automated Tests
Testing is **manual and visual only**. Verify:
- Brain renders and animates smoothly (~60 FPS)
- UI controls function correctly
- Shader changes produce expected visuals in real-time

Run `npm run dev` and test in Chrome 113+/Edge 113+ (requires WebGPU support).

## Code Style & Conventions

- **Pure JavaScript.** No TypeScript syntax (types, interfaces, generics) in `.js` files.
- **ES Modules.** Use `import`/`export`; no CommonJS.
- **Naming:** `camelCase` for functions/variables, `PascalCase` for classes (e.g., `Mat4`).
- **No frameworks.** Keep the codebase framework-free (no React, Vue, Angular).
- **Comments:** Use `// [Neuro-Weaver]` or `// [Phase N]` tags for major subsystem changes.

## Browser & Environment

- **WebGPU only.** Chrome 113+, Edge 113+. No WebGL fallback.
- **No TypeScript.** Rely on JSDoc comments for type hints where useful.
- **No node_modules in git.** Run `npm install` after cloning.

## Common Tasks

### Adding a Visualization Style
1. Add shader code to `shaders.js` (vertex, fragment, compute as needed)
2. Add style constant and logic to `brain-renderer.js`
3. Add UI control to `index.html` and wire in `main.js`

### Adding a Uniform Parameter
1. Define field in `Uniforms` struct (`shaders.js`)
2. **Calculate and add padding manually** to respect WGSL alignment
3. Update `updateUniforms()` in `brain-renderer.js` with correct `Float32Array` offsets
4. Add UI slider to `index.html` and wire in `main.js`

### Adding a Brain Region Stimulus
1. Define region bounds in `brain-renderer.js` `injectStimulus()`
2. Update compute shader logic in `shaders.js` to handle the region
3. Add button to `index.html` and wire in `main.js`

### Testing Shader Changes
```bash
npm run dev
# Open http://localhost:5173 in Chrome 113+/Edge
# Verify visually in real-time
```

## Known Limitations

- **No automated unit tests.** All testing is manual/visual.
- **WebGPU only.** Strict browser requirement.
- **Memory fixed at startup.** Window resize recreates depth texture but not geometry buffers.
- **Routine branching pauses.** `choice` and `wait` events pause the routine player.
- **Large repo.** Historical node_modules and large binaries (WASM, ONNX models) increase clone size. Use `git clone --depth 1` for faster clones.

## Documentation Reference

For deeper technical details, see:
- **DEVELOPER_CONTEXT.md** — Complexity hotspots, dependency flows, inherent limitations
- **.github/copilot-instructions.md** — Comprehensive guide for AI agents
- **AGENTS.md** — Project overview and agent responsibilities
- **SCIENTIFIC_ACCURACY_REPORT.md** — Physiological models verification
- **ARCHITECTURE.md** — Detailed module breakdown

# DEVELOPER CONTEXT

## 1. High-Level Architecture & Intent

*   **Core Purpose:** This application is a 3D brain visualization tool that renders real-time, organic animations driven by tensor data. It is designed to eventually visualize EEG/BCI data but currently uses simulated tensor fields. It leverages WebGPU for high-performance compute and rendering.
*   **Tech Stack:**
    *   **Language:** Vanilla JavaScript (ES Modules). **No TypeScript**, no bundlers (except Vite for dev server), no frameworks (React/Vue).
    *   **Graphics/Compute:** WebGPU (API), WGSL (Shading Language).
    *   **Math:** Custom `Mat4` library (Column-Major).
    *   **Build Tool:** Vite (minimal config).
*   **Design Patterns:**
    *   **Renderer Pattern:** `BrainRenderer` encapsulates the entire WebGPU state machine (Device, Context, Pipelines, Loop).
    *   **Procedural Geometry:** `BrainGeometry` generates mesh data algorithmically on CPU.
    *   **Compute-to-Render Pipeline:** Data is processed in a Compute Shader (Write) and consumed by Vertex/Fragment Shaders (Read) via shared Storage Buffers.

## 2. Feature Map

*   **Entry Point:** `main.js` bootstraps the application and handles WebGPU feature detection.
*   **Rendering Engine:** `brain-renderer.js`
    *   Manages the `requestAnimationFrame` loop.
    *   Handles resizing, camera state (orbit/zoom), and Uniform updates.
    *   Configures two distinct render pipelines:
        1.  **Solid/Mesh:** For the brain surface (Organic/Cyber styles).
        2.  **Fiber/Line:** For the internal circuit grid (Connectome style).
*   **Brain Generation:** `brain-geometry.js`
    *   `generate(rows, cols)`: Creates a deformed UV sphere to mimic gyri/sulci.
    *   `generateCircuitGrid()`: Creates a "Manhattan-style" 3D grid of line segments inside the brain volume.
*   **Shaders:** `shaders.js`
    *   Contains WGSL strings for Vertex, Fragment, and Compute shaders.
    *   Implements the visual styles (Ghost, Fresnel, Digital Pulse).
*   **Math:** `math-utils.js`
    *   Provides 4x4 Matrix operations helper.
    *   **CRITICAL:** Implements matrix multiplication such that `multiply(A, B)` computes `B * A` mathematically (see Complexity Hotspots).

## 3. Complexity Hotspots (The "Complex Parts")

### A. Matrix Multiplication Order (Column-Major)
*   **The Issue:** The project uses Column-Major memory layout for matrices to align with WGSL standards.
*   **The logic:** In `math-utils.js`, `multiply(A, B)` generates a memory layout equivalent to the mathematical operation **B × A**.
*   **Impact:** In `brain-renderer.js`, the MVP matrix is constructed as:
    ```javascript
    const pv = Mat4.multiply(view, projection); // result = Projection * View
    const mvp = Mat4.multiply(model, pv);       // result = (Projection * View) * Model
    ```
    This results in the correct `P * V * M` matrix for column-vector transformation (`P * V * M * v`).
*   **Agent Note:** **DO NOT REFACTOR** the matrix multiplication order in `brain-renderer.js` to look "standard" (e.g., `multiply(P, V)`). It is already correct for the internal library implementation.

### B. Compute-Render Synchronization
*   **The Issue:** The tensor animation relies on a Compute Shader modifying a buffer (`tensorData`) that is immediately read by the Vertex Shader in the same frame.
*   **Mechanism:** This is handled implicitly by the WebGPU command encoder order:
    1.  `beginComputePass` (Writes to `tensorData`)
    2.  `end`
    3.  `beginRenderPass` (Reads `tensorData`)
*   **Agent Note:** Ensure this order is preserved. If `tensorData` is moved to a different bind group or usage type, verify `GPUBufferUsage` flags include both `STORAGE` and `VERTEX` (or `READ_ONLY_STORAGE` for the vertex shader).

### C. Buffer Alignment & Padding
*   **The Issue:** WGSL Structs require specific memory alignment (16-byte alignment for `vec4`/`mat4`, etc.).
*   **Why:** `Uniforms` structs in `shaders.js` have explicit padding (`padding1`, `padding2`).
*   **Agent Note:** When adding new uniforms, you **must** manually calculate and respect WGSL alignment rules in both the shader struct and the JavaScript `Float32Array` writing to it. Failure to do so results in silent data corruption or validation errors.

## 4. Inherent Limitations & "Here be Dragons"

*   **WebGPU Only:** The app will strictly **not work** on older browsers or devices without WebGPU support. There is no WebGL fallback.
*   **No TypeScript:** The codebase is pure JS. You must rely on JSDoc or inference. **Do not introduce TS syntax** (types, interfaces) into `.js` files.
*   **Build Artifacts:** Do not edit files in `dist/`. Edit source files and run `npm run dev` to test.
*   **Memory Management:** The application allocates buffers once at startup. Dynamic resizing of the window destroys and recreates the Depth Texture but *not* the geometry buffers. If the geometry generation parameters change, buffers must be explicitly destroyed and recreated.

## 5. Dependency Graph & Key Flows

### Critical Flow: Render Loop
1.  **Main Loop:** `requestAnimationFrame` calls `renderer.render()`.
2.  **Update State:** `time` increments, Camera Matrix (`MVP`) is recalculated (CPU).
3.  **Upload Uniforms:** `device.queue.writeBuffer` sends `Uniforms` and `ComputeUniforms` to GPU.
4.  **Compute Pass:**
    *   Shader: `computeShader`
    *   Input: `time`, `params`
    *   Output: Updates `tensorData` storage buffer (simulating signal waves).
5.  **Render Pass:**
    *   **Context:** Clears screen.
    *   **Pipeline Switch:** Checks `params.style`.
        *   If `style >= 2` (Connectome): Uses `fiberPipeline` (LineList), draws `fiberBuffer`.
        *   Else (Organic): Uses `pipeline` (TriangleList), draws `vertexBuffer` + `indexBuffer`.
    *   **Draw:** Vertex Shader reads `tensorData` to displace vertices (Organic) or color pulses (Connectome).
6.  **Present:** Canvas context automatically presents the frame.

### Data Flow
`BrainGeometry (CPU)` -> `Float32Array` -> `GPUBuffer (Vertex/Index/Storage)` -> `Shaders (GPU)`

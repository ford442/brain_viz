# Neuro-Weaver: 3D Volumetric Brain Visualization (V2.3)

"The Neuro-Weaver" is a high-performance, WebGPU-based visualization engine that renders a stylized, animated human brain driven by volumetric tensor data. It moves beyond procedural noise to simulate structured signal flow, anatomical regions, and reactive stimuli.

## 🧠 Core Features

### 1. Volumetric Tensor Engine
Unlike surface-only visualizations, this engine maintains a **32x32x32 3D Storage Buffer** representing neural activity density. A Compute Shader updates this volume in real-time, simulating diffusion, decay, and signal propagation across anatomical regions.

### 2. Visualization Styles
*   **0. Organic (Surface):** The default mode. A deformed sphere mimicking gyri and sulci, displacing vertices based on local activity.
*   **1. Cyber (Wireframe):** A digital, grid-quantized aesthetic with sharp signal decay.
*   **2. Connectome (Fibers):** Renders the internal "Manhattan-style" circuit grid.
    *   **Activity Trails:** Signals pulse and travel along fibers.
    *   **Instanced Somas:** Spheres (neurons) at grid intersections scale dynamically with local activity.
*   **3. Heatmap (Volumetric):** Renders the brain shell with a thermal gradient (Blue -> Cyan -> Red) representing aggregate volumetric activity.

### 3. Interactive Stimuli & Anatomy
*   **Region Injection:** Inject signals into specific lobes:
    *   **Frontal:** High retention (Complex thought).
    *   **Occipital:** Fast decay (Visual processing).
    *   **Temporal/Parietal:** Varied diffusion rates.
*   **Clip Plane:** Interactively slice through the mesh (Z-axis) to reveal internal structures and activity.
*   **Flow Speed:** Control the velocity of signal pulses along the connectome fibers.

## 🎮 Controls
*   **Mouse Drag:** Rotate the view.
*   **Mouse Scroll:** Zoom in/out.
*   **UI Panel:**
    *   **Style Mode:** Switch between Organic, Cyber, Connectome, Heatmap.
    *   **Clip Plane Z:** Slice the brain mesh.
    *   **Signal Flow Speed:** Adjust pulse velocity (Connectome mode).
    *   **Stimulus Buttons:** "Poke" specific brain regions or trigger a "Calm State".

## 🛠️ Technology Stack
*   **Graphics API:** WebGPU
*   **Shading Language:** WGSL (Vertex, Fragment, Compute)
*   **Language:** Vanilla JavaScript (ES Modules). No frameworks.
*   **Architecture:**
    *   `BrainRenderer`: Manages GPU device, pipelines, and render loop.
    *   `BrainGeometry`: Generates procedural brain mesh and fiber grids.
    *   `Compute Shader`: Handles physics/signal logic (Diffusion, Decay).

## 🚀 Running Locally
1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Start Dev Server:**
    ```bash
    npm run dev
    ```
3.  **Open in Browser:**
    Navigate to the URL provided (usually `http://localhost:5173`).
    *Requires a browser with WebGPU support (Chrome 113+, Edge, etc.).*

## 📜 License
MIT

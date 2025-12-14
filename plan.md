# Browser EEG + WebGPU Plan

This file captures practical recommendations for getting EEG (or multichannel time-series) into the browser, running inference on WebGPU, and options for preprocessing and model usage.

## 1) In-browser runtimes that actually map tensors to WebGPU

A) **ONNX Runtime Web (recommended for “real model inference”)**

- Package: `onnxruntime-web`
- Has a WebGPU execution provider (so ops run on WebGPU when available).
- Strengths: broad operator coverage for common CNN/Transformer inference, good performance, easy ONNX import.
- Typical flow:

  ```text
  EEG data -> Float32Array -> ort.Tensor('float32', data, dims)
  session.run({input: tensor}) -> output tensors
  ```

- What’s good for EEG: works well for CNNs over `[batch, channels, time]` or `[batch, 1, channels, time]`. Also works for transformer-style models if ops are supported.

B) **TensorFlow.js (WebGPU backend exists; ecosystem-friendly)**

- Package: `@tensorflow/tfjs` (+ WebGPU backend availability varies by version/environment).
- Strengths: great dev ergonomics, easy prototyping; training in JS possible.
- For TF models you usually either convert to TFJS format or export to ONNX and use ORT Web (ORT Web is often simpler these days).

C) **WebDNN (more niche/legacy)**

- Historically used for browser acceleration (WebGL/WebGPU-ish evolution). Today it’s less common than ORT Web or TF.js.

D) **onnx.js (historical)**

- Older ONNX-in-JS project. Today many people mean ONNX Runtime Web when they say “ONNX in browser”. If starting new, try ORT Web first.

## 2) Representing EEG as a tensor (shape conventions)

Most BCI/EEG models expect something like:

- Raw time series: `[B, C, T]`
  - `B`: batch (often 1 in real-time)
  - `C`: channels (e.g., 8/16/32/64)
  - `T`: samples per window (e.g., 256, 512, 1024)

Common CNN-friendly reshape:

- `[B, 1, C, T]` (treat as a single-channel image with height=`C`, width=`T`)

Spectrogram / time-frequency:

- `[B, C, F, W]` (channels × frequency bins × time frames)

Note: BCI models often assume fixed window sizes; in real time use a ring buffer and slice windows.

## 3) Getting EEG into the browser efficiently

Transport into the page:

- WebSerial / WebUSB / WebBluetooth (hardware-dependent)
- WebSocket from a local Python bridge (common for prototypes)
- File upload (EDF/CSV/etc.) for offline demos

Convert to tensor input:

- You nearly always end up with a `Float32Array`.
- Apply scaling / referencing so values are in a sane numeric range.
- Pack in the exact memory order your model expects (usually row-major contiguous order).

## 4) Preprocessing: CPU vs GPU (WebGPU)

BCI pipelines often need:

- bandpass / notch filtering
- re-referencing
- downsampling
- epoching/windowing
- normalization (per-channel mean/std)
- (sometimes) STFT / filter banks

In-browser reality:

- Do simple preprocessing on CPU in JS first (easy and fast enough for many cases—1–4 kHz × 32–64 ch with moderate window sizes).
- If you need very low latency or heavy transforms (STFT), you can:
  - implement them as WebGPU compute shaders, or
  - approximate them with model layers (e.g., learned Conv filterbanks) so preprocessing becomes part of model inference on WebGPU.

Common deployment trick:

- Replace explicit DSP steps with a front-end Conv1D filterbank (trained/frozen), so the runtime handles preprocessing as part of model inference.

## Do you need a model to get data into WebGPU?

No. You can:

- keep your sample buffers in JS (`Float32Array`)
- upload them to GPU buffers/textures (`GPUBuffer` / `GPUTexture`)
- run compute shaders (optional) to transform them
- render (vertex/fragment shaders) into your 3D scene

WebGPU is a compute+render API; it doesn’t require ML at all. For a first animated 3D brain / scalp map / signal viz milestone, you can be model-free.

## Mesh + colormap: how EEG values become “brain colors"

A) **Colormap as a 1D texture**

- Create a small `GPUTexture` (e.g., 256×1, `RGBA8` or `RGBA16F`) containing a colormap (viridis, turbo, etc.).
- Normalize your field to `[0,1]` and sample the colormap in the fragment shader.
- Why it matters: you get consistent scientific visualization and it’s cheap in the fragment shader.

B) **Dynamic range stabilization (critical for EEG)**

- EEG-like values jump around; mapping raw min/max each frame causes flicker. GPU-friendly tricks:
  - Use a fixed scale (e.g., ±X µV).
  - Compute a robust scale (EMA mean/std or percentile approximation) in a compute shader, then use that for normalization.
  - Apply temporal smoothing on the field: `field_t = lerp(prev, current, alpha)`.
- This is specific to biosignals: stable visualization requires temporal smoothing/normalization.

## Connectivity rendering (looks impressive; very BCI-ish)

- If you compute a connectivity matrix (correlation/coherence), you can render:
  - instanced line segments between electrode positions
  - line width/color/alpha driven by connectivity strength
  - threshold to top-N edges to keep it readable

**WebGPU specifics:**

- Use an instance buffer holding `(startPos, endPos, weight)` and update it from a compute shader each window (optional).
- Render with a camera-facing ribbon/quad mesh because native wide lines aren’t reliable across platforms.
- This maps well to EEG because “functional connectivity” is a common visualization and is GPU-friendly.

- Implementation note: compute per-channel features on CPU, upload per-channel values to GPU, and do nearest/IDW interpolation in the fragment shader for small meshes. For higher-poly meshes compute the field in a compute shader once per frame and keep the fragment shader simple.
## If you use a small model, what can it do beyond “animate the signal”?

Typical useful functions:

1) **Classification** — predict class per window (e.g., motor imagery, SSVEP frequency ID, blink detection). Use outputs to change overlays, show confidence, or trigger UI actions.

2) **Regression** — estimate continuous scores (e.g., attention, fatigue, bandpower proxies). Use to smoothly modulate shader params or drive camera/particles.

3) **Feature extraction / embeddings** — produce a 32–256 float embedding per window. Useful for clustering, similarity search, navigation of epochs, and interactive UIs.

4) **Denoising / artifact reduction** — reconstruct clean signals (harder; needs careful training data).

5) **Change-point / anomaly detection** — detect windows that differ from baseline (tiny model or pure signal processing).

## What’s useful before real EEG (model-less wins)

- GPU-accelerated signal transforms for visualization are often higher-impact early:
  - rolling RMS / envelope
  - per-channel normalization
  - bandpower estimates (theta/alpha/beta/gamma)
  - STFT / spectrograms or filterbank energies
  - coherence / correlation matrices for connectivity visuals

These are all implementable without ML and are great for building compelling, real-time visual demos.

---

If you'd like, I can:

- add example code snippets that show uploading a `Float32Array` to GPU and rendering it, or
- add an example WebAssembly/JS preprocessor and a small ONNX Web inference snippet.

--
Generated with the EEG + WebGPU checklist provided.

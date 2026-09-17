# Field Resolution

**Status:** Phase A complete (runtime `voxelDim`). Phases B–D are not started.

This document covers the neural field's grid resolution: how it is carried,
what changes it, and what is still hardcoded. `docs/tensor-physics.md` remains
the normative spec for *what the field computes*; this is about *how big the
grid is*.

---

## 1. Why this exists

The engine was permanently 32×32×32 — 32 768 voxels, 128 KiB. That was a good
decision when it was made: it kept the compute shader, the C++/WASM port, the
BCI projection, the NWS1 session format and the CI fixtures all tractable at
once. But 32 was not a *value* anywhere. It was a literal, re-declared
independently in:

- both renderer constructors
- WGSL, as `const VOXEL_DIM: u32 = 32u` pasted into every render pipeline
- `wasm/brain_tensor_engine.cpp` as `VOXEL_DIM_DEFAULT`
- `SynaptiXEngine` / `AITensorProjector` (`new Float32Array(32 ** 3)`)
- the BCI resampler's region masks
- the NWS1 manifest's `tensor.shape`
- the SynaptiX coupling model's anatomical region index lists
- the sonification lobe statistics

So the resolution could not be changed; it could only be *re-typed in nine
places and hoped for*. Anything that wanted more detail — fractal soma zoom,
traveling-wave structure, "walk into a gyrus" in XR, gyrus-scale SynaptiX
resonance — was blocked behind that, and the natural way to get it (fork
another engine at another dim) would have made the drift problem `docs/
tensor-physics.md` exists to prevent even worse.

## 2. What `voxelDim` is now

`src/voxel-dim.js` is the single source of truth:

| Export | Purpose |
|---|---|
| `DEFAULT_VOXEL_DIM` | 32. Unchanged — nothing about the default behaviour moved. |
| `SUPPORTED_VOXEL_DIMS` | `[32, 48, 64]`. Deliberately short (see below). |
| `MAX_VOXEL_DIM` | 64. What the WebGPU device is provisioned for. |
| `voxelCountFor` / `tensorByteLengthFor` / `fiberAffinityByteLengthFor` | Sizes derived from a dim, never spelled out. |
| `assertVoxelDim` / `normalizeVoxelDim` / `isSupportedVoxelDim` | Boundary validation: throw at a hard boundary (a file header, an API call), degrade at a soft one (UI). |
| `inferVoxelDim(field)` | Recovers the dim from a flat field's length, so consumers that only ever see a buffer don't need re-plumbing. |
| `resampleField(field, from, to)` | Trilinear resample, so a resolution change *continues* the simulation instead of resetting it. Returns the input reference when the dims match. |

The supported list is short on purpose:

- `dim³` must be a multiple of 64, the compute workgroup size, or the last
  partial workgroup indexes past the end of the storage buffer. 32³, 48³ and
  64³ all are; `tests/test_voxel_dim.js` asserts it for every listed dim.
- The WebGPU device's limits are fixed for its lifetime, so they are derived
  from `MAX_VOXEL_DIM` at creation. Adding a larger dim means raising that,
  which is a deliberate change, not an incidental one.

## 3. Changing resolution at runtime

`renderer.setVoxelDim(dim)` is on the shared facade
(`src/renderer-contract.js`) and implemented on both backends.

**WebGPU** (`src/brain-renderer/resolution.js`):

1. Validate the dim, then validate the *device* can hold it. A device that
   clamped its limits down is a refusal, not a silent downgrade.
2. Resample the live human and partner fields — **before** anything is
   destroyed, so a throw leaves the renderer intact.
3. Destroy and recreate the three dim-sized storage buffers (tensor, AI tensor,
   fiber directions).
4. Rebuild the geometry. The per-voxel fiber affinity map is baked at a
   specific dim; an affinity buffer at the wrong dim feeds the anisotropic
   diffusion term tract directions from the *wrong voxels*, which is a
   different simulation, not a coarser one.
5. Recreate the render and compute bind groups. A bind group captures the
   buffer it was created with, so a "resized" buffer is invisible until the
   group is rebuilt — skipping this step is the failure mode this is most
   likely to regress into, and `tests/test_voxel_dim.js` pins the ordering.
6. Re-upload the resampled fields, then replace the WASM engine (its grid is
   allocated in `bte_create(dim)`, so it cannot be reconfigured in place).

What is deliberately *not* rebuilt: the device, the pipelines, the bind group
layouts, and the uniform buffers. None of them depend on the dim — the shaders
read it from `uniforms.voxelDim` / `params.voxelDim` every frame.

**WebGL2** (`src/brain-renderer-webgl/resolution.js`) is the same shape but
simpler: there is no compute shader, and `src/physics/tensor-field.js` has
always taken `dim` as a parameter. It resamples, resizes the three arrays,
rebuilds the geometry, and releases/rebuilds the `dim³` debug point grid.

## 4. How the dimension reaches the shaders

`const VOXEL_DIM: u32 = 32u` is gone from `src/shaders/render-shared.js`. The
shared `HELPERS` block calls `voxel_dim()` instead, which is *not* defined in
`HELPERS`, because the two shader families read the dimension from different
bind groups. `render-shared.js` exports two one-line snippets:

- `VOXEL_DIM_FROM_UNIFORMS` — `uniforms.voxelDim` (render pipelines)
- `VOXEL_DIM_FROM_PARAMS` — `params.voxelDim` (the compute pipeline)

Each shader interpolates exactly one. A shader that forgets fails to compile
rather than silently indexing at 32. `tests/test_voxel_dim.js` additionally
fails the build if any shader re-declares a compile-time `VOXEL_DIM`, or calls
`voxel_dim()` without defining it from a binding it actually declares.

`voxelDim` is an `f32` in `RENDER_UNIFORM_LAYOUT` (the render uniform block is
uploaded as a `Float32Array`) and a `u32` in `COMPUTE_UNIFORM_LAYOUT`, where it
already was.

## 5. File formats

**NWS1 (Double Mirror sessions).** The manifest has always carried
`tensor.shape`, so no magic bump was needed — the field is now *read* instead
of being asserted equal to `32x32x32`. `parseSession()` returns `voxelDim`,
validates every tensor chunk's length against it, and rejects a non-cubic or
unsupported shape. `encodeTensorPayload` / `decodeTensorPayload` take the dim
explicitly and default to 32³, so sessions recorded before any of this load
unchanged. `SessionPlayer` resamples a recording into the renderer's current
resolution rather than rejecting it as a size mismatch.

**`.nwbci` (BCI recordings)** store raw electrode samples, not tensors, so they
are resolution-independent and unchanged. The `TensorResampler` that turns them
into a field takes the target dim at construction.

## 6. What is still 32³

- **The WebGL2 fallback in practice.** It works at any supported dim, but it
  steps the entire field on the CPU every frame, so 64³ is an eightfold step
  cost. See the capability matrix in `docs/webgl-fallback.md`.
- **The CI fixture.** `npm run test:golden` pins the C++ engine against the JS
  reference at 32³. That is the contract fixture, not a limit — `bte_create()`
  has always taken a dim.
- **WASM without SIMD.** `-msimd128` is not yet on. Until it is, the WASM path
  at 64³ is not expected to hold a frame budget.
- **`BrainGeometry` itself.** It is still a deformed UV sphere with Bézier
  tracts. A finer *field* does not make the *surface* finer; that is Phase C.

## 7. Roadmap (not started)

**Phase B — clipmap field.** A coarse whole-brain level plus a finer brick
around the camera or the active stimulus, rather than one global grid. Fiber
affinity has to be rebuilt per level and cached; it is the expensive part.

**Phase C — recursive zoom renderer.** Below a zoom threshold, swap the organic
mesh for a locally generated cortical patch driven by the fine brick. The
`cognitiveLoad` LoD uniform already exists and should drive the impostor
fallback. A brick atlas in a 3D texture is enough; no megatexture library.

**Phase D — heavy tooling.** WASM SIMD is a prerequisite, not an extra.
OpenVDB/NanoVDB stays out of the browser build; stay on bricks. Do not add
Three.js volume shaders — there is already a raymarch path to extend.

Collaborative rooms and a Neuro-Script exchange sit on top of a stable field
codec and are separate, later work. Do not build the marketplace first.

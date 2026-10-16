# Field Resolution

**Status:** Phase A (runtime `voxelDim`), Phase B (clipmap field: a 64³ fine
brick) and Phase C (recursive-zoom cortical patch) are done on WebGPU. Phase D
(WASM pthreads and SIMD fiber gathers for a 64³ hybrid frame, a 128³ brick, a
fine brick chunk in NWS1) is not started; its groundwork, the explicit SIMD
stencil and a measured 64³ WASM budget, is in. See §6–§9.

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
- **WASM at 64³.** `-msimd128` is on (`scripts/wasm_flags.sh`) *and* the §6.2
  stencil is an explicit SIMD kernel (`wasm/src/stencil.cpp`), so neither is
  the thing to turn on next. The step is still single-threaded and dominated by
  scalar fiber gathers and advection: measured ~85–98 ms per 64³ step against a
  16 ms frame (`npm run bench:wasm`; table and ablation in
  `docs/wasm-engine.md` → *Performance*). The hybrid path at 64³ coarse does
  not hold a frame budget (Phase D).
- **`BrainGeometry` itself.** It is still a deformed UV sphere with Bézier
  tracts. A finer *field* does not make the *surface* finer; Phase C (§8) swaps
  in a finer cortical patch where you are looking, rather than refining the
  whole mesh.
- **The coarse field's recording.** NWS1 records the coarse field only. The
  fine brick is a view-dependent refinement of it (§7), not part of the
  session; a fine-brick chunk would be a codec version bump, not a silent
  change to type 1.

## 7. Phase B — the clipmap field (done)

A coarse whole-brain level plus a finer brick around where you are looking,
rather than one finer global grid. Raising the global dim further would cost
dim³ everywhere — bandwidth, the affinity rebuild, the WebGL CPU step — to
gain detail in the one region on screen.

### 7.1 Two levels, one field

| Level | Grid | Lives in | Stepped by |
|---|---|---|---|
| 0 — coarse | `voxelDim³` (32³ default) over the whole field cube | `tensorBuffer` | the existing compute shader / CPU reference / C++ |
| 1 — fine brick | a 64³ window into a virtual 256³ lattice over the same cube | 3D textures | `src/shaders/brick-compute.js` (WebGPU only) |

Fine voxels are 0.0125 world units: 8× finer than the 32³ coarse grid, 4×
finer than 64³. Both levels place voxel `g` at `((g / latticeDim) * 2 − 1) ×
BRAIN_RANGE` (`docs/tensor-physics.md` §4.1), so they agree on where they are
whatever the coarse dim. Lattice math is in `src/clipmap/brick-layout.js`.

The fine level runs **the same §6 step** as the coarse one — not a copy:
`src/shaders/field-step.js` holds the step body once, and both
`volumetric-compute.js` and `brick-compute.js` emit it with their own
addressing hooks. The coarse shader is generated character-for-character as
it was before the split. Inside the brick, neighbours and samples read the
fine state; outside it they read the coarse field trilinearly, so the coarse
level is the fine level's boundary condition. After each step a restriction
pass averages the brick into 8³-voxel cells and a correction pass moves each
cell's mean onto the coarse field's mean over the same cell: the brick agrees
with the coarse field at the coarse scale and only adds what the coarse grid
cannot resolve. The full contract is `docs/tensor-physics.md` §11.

The nesting is **one-way**. Nothing the brick does reaches the coarse buffer,
so the coarse field — what NWS1 records, what the golden fixture pins, what
WASM and the WebGL fallback compute — is identical with or without a brick.

### 7.2 Placement and toroidal addressing

The brick centres on a focus point (`setClipmapOptions({ focus })`):

- `camera` — where the view axis meets the cortex, 0.18 world units inside the
  pial surface (the camera direction is taken into model space through the same
  model matrix `uniforms.js` builds).
- `stimulus` — the last `injectStimulus()` position.
- `auto` (default) — a stimulus injected in the last 3 s, else the camera.

It moves in whole 16³ chunks, clamped inside the lattice, with a dead zone of
±¾ chunk around its centre so a focus sitting on a chunk boundary does not
flip it every frame. Storage is toroidal: lattice voxel `g` always lives in
texel `g mod 64`, so a move keeps every texel the old and new placements share
and reseeds only the newly exposed slab from the coarse field. Render shaders
sample the brick through a *repeat* sampler for the same reason; the only place
hardware filtering would blend across the wrap is the brick's outer face, which
`brickEdgeMask()` fades to zero over ~1.5 coarse voxels first.

### 7.3 Fiber affinity per level, cached

The fine level needs tract directions at *its* resolution — a tract one coarse
voxel wide spans eight fine ones — and baking that for the whole 256³ lattice
would be ~800 MB. So:

- `BrainGeometry#buildFiberAffinityRegion()` rasterises the centerlines into
  any block of any lattice. The coarse map is the whole-lattice case (the
  refactor that introduced it is bit-identical at 32/48/64), and a block baked
  on its own is bit-identical to the same voxels of a whole-lattice bake.
- The brick bakes 16³ chunks on demand (`src/clipmap/affinity-chunks.js`),
  nearest-first to the focus, through a resumable generator inside a per-frame
  CPU budget (`jobBudgetMs`, 4 ms): a dense chunk through the corpus callosum
  takes tens of ms, a sparse one ~1.
- Chunks are cached in a byte-bounded LRU (64 MB) keyed by geometry and chunk.
  The same cache holds the coarse whole-grid maps keyed by dim, so a
  32 → 64 → 32 round trip skips its second ~1 s bake. `voxelDim` is not part
  of the tract key — changing the coarse dim neither invalidates fine chunks
  nor stops the brick (only its bind group is rebuilt; the coarse field is
  still resampled exactly as in §3).
- The atlas is one rgba32float 3D texture, 64×64×192, a 64-deep slab per tract
  slot. Slots holding real data are tracked so clears and empty chunks cost no
  upload when the slot is already zero.

### 7.4 GPU resources and passes

| Texture | Format | Size | Use |
|---|---|---|---|
| `brickStateTextureA` | rg32float | 64³ | fine state (r) + coarse at the texel (g) |
| `brickStateTextureB` | rg32float | 64³ | the same after the step, before correction |
| `brickMeansTexture` | rg32float | 8³ | restriction cell means |
| `brickRenderTexture` | rgba16float | 64³ | what render shaders sample: fine, coarse, tract weight, 1 |
| `brickAffinityTexture` | rgba32float | 64×64×192 | tract atlas |

≈ 18.9 MB in all. Encoder order per frame: coarse compute → brick compute
(step A→B, restrict B, correct B→A + render copy; three dispatches in one
pass) → scene render → post. The render copy is rgba16float because core
WebGPU can both store to and *filter* it; r32float/rg32float filtering would
need `float32-filterable`, so the brick requests no optional feature.
`deriveRequiredLimits()` sizes the 3D-texture limit for a 128³ brick
(`MAX_BRICK_DIM`) up front, as it sizes storage for `MAX_VOXEL_DIM`.

The fine brick is read by: the Heatmap raymarch (which now marches in model
space, so the volume turns with the shell, and spends `brickFineSteps` steps
inside the brick, with a per-pixel stratified offset so the switch between
coarse and fine sampling does not show as terraces); the Organic/Cyber shell's
fragment shader (per-fragment fine activity); and the cortical patch (§8).
Connectome and SynaptiX read none of it, so no brick is stepped in those styles.

### 7.5 Zoom gating, the GPU budget and `cognitiveLoad`

The brick fades in between zoom 3.25 and 2.7 (camera distance; the app boots
at 3.5) and out again on the way back. Once nothing wants it, it stops being
stepped immediately and fades out frozen.

`GPUTimer` now times every pass — `field`, `brick`, `scene`, `post` — and is
read: `getFrameTimings()` (on the shared facade) reports them, and the Activity
tab's *Field Detail (Clipmap)* HUD shows them against the budget. The budget
governor (`src/clipmap/frame-budget.js`) turns GPU time — or the rAF interval
on adapters without `timestamp-query` — into a smoothed *pressure*, and picks
a tier from `lodLoad = max(params.cognitiveLoad, pressure)`:

| Tier | Brick | Heatmap in-brick steps | Patch |
|---|---|---|---|
| full | stepped every frame | 48 | mesh + somas |
| reduced (`lodLoad` ≥ 0.4) | every other frame | 20 | point impostors |
| off (`lodLoad` ≥ 0.75) | not stepped | — | — |

Climbing back has hysteresis, a settle time, and an exponential backoff after a
budget-driven downgrade, so a brick that does not fit does not flicker on and
off. The governor reads `cognitiveLoad` and **never writes it**: it is also a
physics input (`docs/tensor-physics.md` §3.3, criticality), and a performance
governor that raised it would make the field more critical whenever the GPU was
slow. `lodLoad` is uploaded as a render uniform.

### 7.6 Backends

- **WebGPU** — everything above.
- **WebGL2** — coarse CPU reference only. `setClipmapOptions()` records options
  and returns `false`, `getClipmapState()` reports `supported: false`, and
  `getFrameTimings()` reports the frame interval and the CPU field-step time.
  Coarse `setVoxelDim()` is unchanged. See `docs/webgl-fallback.md`.
- **WASM** — never runs the brick. In hybrid mode the coarse field is stepped
  by `bte_create(dim)` on the CPU and uploaded; the brick still steps on the
  GPU around it.
- **Tensor / session playback** — the brick only interpolates the recording
  (`mode` 1) and adds no dynamics of its own.

## 8. Phase C — the recursive-zoom renderer (done)

Below zoom 2.75 (fully by 2.3), in Organic and Cyber styles, the organic mesh
inside the brick's footprint is swapped for a **cortical patch**
(`src/clipmap/cortical-patch.js`, `src/shaders/cortical-patch.js`):

- **Geometry** — the geometry's own `sampleCorticalSurface()`, sampled on a
  72×72 gnomonic grid over the brick's footprint: ~0.009 world units between
  vertices against the mesh's ~0.09, so the folds the surface function has
  always had (~0.05) are finally resolved. One implementation of the surface,
  never a WGSL port of it. Real normals from the grid, so gyri and sulci are
  lit (the mesh's normals are radial). Generated a couple of rows per frame
  inside the job budget, cached per placement.
- **Field-driven relief** — the vertex shader applies the mesh's own organic
  displacement (shared `organicSurfaceDisplace()`, so patch and mesh agree in
  the crossfade band), then lifts gyral crowns by the fine brick's activity and
  its excess over the coarse field. The relief moves because the fine field
  moves.
- **Laminar somas** — 1 400 instanced cell bodies at layer II/III, IV, V and VI
  depths under the pial surface, pyramidal cells elongated along the apical
  (surface-normal) axis, firing with the fine field at their position.
- **Hand-off** — the mesh fades out inside a cone around the patch axis
  (`patchFootprint()`), the patch fades out radially toward its rim, and the
  two ramps overlap.
- **Impostor fallback** — at the reduced tier (budget pressure or
  `cognitiveLoad` ≥ 0.4) the patch draws as camera-facing point sprites driven
  by the same brick, and the soma meshes are dropped.

No megatexture library, no Three.js volume shaders, no OpenVDB/NanoVDB: a
brick texture, a lattice and the existing raymarch.

## 9. Phase D and later (not started)

- **WASM pthreads z-slab tiling and SIMD fiber gathers** so hybrid mode holds a
  frame at 64³ coarse. The SIMD stencil and per-step hoists are done and leave
  64³ at ~85–98 ms (`docs/wasm-engine.md` → *Performance*); threads also need
  the production host to be cross-origin isolated. Never the fine brick on
  WASM.
- **A 128³ brick** (or a second brick level) — the device is already
  provisioned for it; the cost is the affinity atlas (~100 MB at rgba32float)
  and the step.
- **Dual clipmaps for SynaptiX** — a fine partner field and resonance on the
  brick.
- **NWS1** — an optional higher-rate fine-brick chunk is a codec version bump,
  never a silent change to the coarse tensor chunk.

Collaborative rooms and a Neuro-Script exchange sit on top of a stable field
codec and are separate, later work. Do not build the marketplace first.

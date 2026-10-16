# Tensor Physics — the neural field contract

> **Status**: normative. This document is the specification the volumetric
> neural field is implemented from. Three pieces of code cite it by section
> number, and two of them are held to it by a test.

| Implementation | File | Role |
| --- | --- | --- |
| WGSL compute | `src/shaders/volumetric-compute.js` | Authoritative **visual** path. Runs on the GPU for every WebGPU session. Validated by naga in `npm test`, and against the CPU reference by `npm run test:wgsl` (§9.2). |
| CPU reference (JS) | `src/physics/tensor-field.js` | Drives the WebGL2 fallback renderer, and produces the golden fixtures. |
| C++ / WASM | `wasm/brain_tensor_engine.{h,cpp}` | Hybrid CPU path. Validated against the fixtures by `npm run test:golden`. |

The WGSL step body itself lives in one place, `src/shaders/field-step.js`, and
is emitted into both GPU levels of the field: the coarse compute shader above
and the fine clipmap brick (§11), each with its own addressing.

## Why this document exists

The field used to be three hand-written simulations with three different
feature sets. `docs/wasm-engine.md` claimed the C++ engine mirrored the WGSL
shader "step for step"; in fact the C++ engine implemented a Phase 1 subset — no
`cognitiveLoad`, no `stress`, no paint radius, no fiber coupling, no criticality
cascade — and the WebGL stepper implemented a third thing that was never a port
of either. Parameters the renderer uploaded were silently dropped at the C ABI.
Nothing in CI could tell the three apart.

The rule now is: **the field is specified here, implemented twice (WGSL and the
CPU reference), and the C++ engine is a transliteration of the CPU reference
that a test keeps honest.** A change to the physics is a change to this
document first.

---

## 1. Grid and constants

| Symbol | Value | Meaning |
| --- | --- | --- |
| `BRAIN_RANGE` | `1.6` (as float32) | World-space half-extent of the cube the field occupies. |
| `dim` | `32` (`params.voxelDim`) | Side length of the cubic grid. |
| `FIBER_SLOTS` | `3` | Tract affinity slots per voxel. |
| `FIBER_STRIDE` | `12` floats | Per-voxel affinity record: 3 × `(dir.xyz, weight)`. |
| `CASCADE_GATE_WIDTH` | `0.01` | Width of the soft cascade gate (§6.5). |

Voxel `index` is `z * dim² + y * dim + x`. The field is a flat `Float32Array`
(or `std::vector<float>`) of `dim³` activity values, each clamped to `[0, 1]`.

---

## 2. Scalar helpers

- `mix(a, b, t) = a + (b - a) * t`
- `clamp01(v)` clamps to `[0, 1]`
- `smoothstep(e0, e1, x)` is the standard Hermite ramp (`t² (3 - 2t)` over the
  clamped, normalised `x`)
- `gaussianPulse(d, w) = exp(-(4 / w²) · d²)`

---

## 3. Region and hypoxia physics

### 3.1 `regionPhysics(world, style) -> (decay, diffusion, flowBias)`

Anatomical zones, tested in this order by `regionZone(world)`. **The
comparisons are evaluated in float32** — see §8.3.

| Zone | `regionZone` | Test | decay | diffusion | flowBias |
| --- | --- | --- | --- | --- | --- |
| Frontal | 1 | `wz > 0.5` | 0.998 | 0.15 | −1.0 |
| Occipital | 2 | `wz < -0.5` | 0.92 | 0.04 | 0.0 |
| Temporal | 3 | `abs(wx) > 0.8` | 0.95 | 0.10 | 0.0 |
| Parietal | 4 | `wy > 0.6` | 0.94 | 0.12 | 0.0 |
| Default | 0 | — | 0.96 | 0.10 | 0.0 |

Cyber style (`abs(style - 1) < 0.1`) then overrides all of the above with
`decay = 0.92`, `diffusion = 0.05`, `flowBias = 0`. It does not change the
zone: §3.4 still modulates a cyber-style voxel by its anatomical zone.

There is exactly one signature, and `regionPhysics` reads its zone from
`regionZone` rather than repeating the tests. The four-argument neuromodulator
variant that once lived in a parallel `src/shaders/shared.js` has been deleted;
do not reintroduce a fork of this function anywhere, in any language — §3.4 is
where neuromodulation lives, applied *on top of* this table.

### 3.2 `hypoxiaPhysics(hypoxiaStress, metabolicRate, mitochondrialFunction)`

```
decayMod     = 0.96 - hypoxiaStress * 0.08 * metabolicRate * (1 - mitochondrialFunction)
diffusionMod = max(0.01, 1 - hypoxiaStress * 0.5)
freqBoost    = hypoxiaStress * 2 * (1 - hypoxiaStress * 0.5)      // declared; unused by the field
```

### 3.3 `avalancheCriticality(cognitiveLoad, stress, fluidActive)`

```
clamp01(cognitiveLoad * 0.75 + stress * 0.9 + fluidActive * 0.35)
```

### 3.4 `neuromodulation(zone, decayRate, diffusionRate, retentionBias)`

The neuromodulator profile (`src/neuromodulators.js`, the Neuromodulator panel,
Live Input Bus sinks, routine `neuromodulator` events) acts on the §3.1 table
as three dimensionless scales. Each one is **exactly 1 at the renderer's
defaults**, so a session that never touches a neuromodulator steps the same
field, bit for bit, as before these parameters were read.

| Baseline | Value | Meaning |
| --- | --- | --- |
| `DECAY_RATE_BASELINE` | `0.96` | `decayRate` default; the Default zone's §3.1 decay. |
| `DIFFUSION_RATE_BASELINE` | `0.1` | `diffusionRate` default; the Default zone's §3.1 diffusion. |
| `RETENTION_BASELINE` | `(0.5, 0.0, 0.2, 0.2)` | `retentionBias` default: frontal, occipital, temporal, parietal. |

```
lossScale      = clamp((1 - decayRate) / (1 - DECAY_RATE_BASELINE), 0, 8)
diffusionScale = clamp(diffusionRate / DIFFUSION_RATE_BASELINE, 0, 4)
retention      = zone == 0 ? 0 : clamp(retentionBias[zone - 1] - RETENTION_BASELINE[zone - 1], -2, 2)
regionalLoss   = exp2(-retention)
```

- **`decayRate` scales loss, not retention.** It is a per-step retention
  factor in the UI (0.98 keeps trails longer than 0.96), so it acts on each
  zone's *loss* `1 - decay`: every zone keeps its §3.1 character, and the
  frontal lobe stays the most retentive. Multiplying `decay` directly would push
  the 0.998 frontal zone above 1 and turn decay into gain.
- **`retentionBias` is a per-lobe exponent on that loss.** One unit above the
  baseline halves the lobe's loss; one below doubles it. The Default zone (no
  lobe) is untouched.
- **`diffusionScale`** multiplies the zone's `diffusion` and sets how far the
  §6.3 neighbourhood mix moves toward the neighbours (`spread`, below).
- **The clamps are what keep the field from inverting.** `lossScale` and
  `regionalLoss` can only shrink a zone's decay toward 0 (§6.1 clamps it to
  `[0, 1]`), never raise it above 1; `spread` stays in `[0, 1)`; and with
  `diffusionScale ≤ 4` §6.7's `diffusion * 0.4` stays below 0.35.

The three scales are computed in **float32** in all three implementations
(§8.3). In double, a `decayRate` that arrived already rounded to float32 — from
a recording, say — would not equal the double baseline, and the identity would
come out as `1.0000005`.

`spread(m, s) = m·s / (1 + m·(s − 1))` scales the *odds* of a mix factor `m` by
`s`. It is exactly `m` at `s = 1` (`s − 1` is exactly 0, so the denominator is
exactly 1), 0 at `s = 0`, and approaches but never reaches 1 as `s` grows, so
no setting can overshoot the neighbourhood average.

The Neuromodulator panel's first profile, **Baseline (unmodulated)**, holds
exactly these values, and is what the panel applies on load; `npm test` fails
if the first profile stops being the identity. (Before §3.4 the panel opened on
Dopamine, which was harmless only because nothing read it.)

A defensible reading (see `docs/SCIENTIFIC_ACCURACY_REPORT.md`): neuromodulators
change how long activity persists and how far it spreads, and do so unevenly
across cortex. The profiles' numbers are stylised, not measured; this is a
visualisation, not a pharmacological model.

---

## 4. Addressing and sampling

- **4.1 `indexToWorld`** — `world = ((coord / dim) * 2 - 1) * BRAIN_RANGE`.
  Note the divisor is `dim`, not `dim - 1`: voxel centres sit on the lower edge
  of each cell, and the `+BRAIN_RANGE` face is not represented.
- **4.2 Nearest-voxel sample** — normalise to `[0, 1]`, reject positions outside
  that cube by returning `0` (the field does *not* clamp to the border), then
  index `floor(n * dim)` capped at `dim - 1`.
- **4.3 `sampleDirectionalActivity(center, forward, backward)`** —
  `center * 0.34 + max(f, b) * 0.46 + min(f, b) * 0.20`, where `forward` and
  `backward` are §4.2 samples at `world ± axis * voxelStep`, `axis` a unit
  vector and `voxelStep = (BRAIN_RANGE / dim) * 0.9`.
- **4.4 Trilinear sample** — used by fluid advection only, for the reason in
  §8.3.

---

## 5. Parameter contract

Every parameter the field consumes travels in the `TensorParams` block declared
once in `src/shaders/uniform-layout.js` (`COMPUTE_UNIFORM_LAYOUT`). That one
declaration generates:

- the WGSL `struct TensorParams` the compute shader interpolates,
- the `Float32Array`/`DataView` offsets `src/brain-renderer/uniforms.js` and
  `src/wasm-engine.js` write at,
- the C `BrainTensorParams` struct in `wasm/brain_tensor_params.h`, via
  `scripts/gen_wasm_params.mjs`.

The C struct carries explicit `_padN` filler because C has no
16-byte-alignment rule for `vec3`/`vec4`; the padding is computed from the WGSL
rules, never hand-written. `npm test` fails if the checked-in header is stale,
and the JS bridge refuses a `.wasm` built from an older layout at runtime rather
than reading every field at a shifted offset. It checks two things:
`bte_params_byte_size()`, and `bte_params_layout_hash()` — an FNV-1a hash of
every field's name, type and byte offset (`COMPUTE_UNIFORM_LAYOUT_HASH`). The
size alone cannot see a field removed ahead of a `vec4`, whose alignment
padding absorbs the difference; that is exactly what removing
`cognitiveDissonance` did (§6.14).

**Adding a parameter the field reads** therefore means: one entry in
`COMPUTE_UNIFORM_LAYOUT`, `node scripts/gen_wasm_params.mjs`, then read it in
all three implementations and update §6 below. There is no path by which one
implementation gains a parameter the others cannot see.

---

## 6. The step

One step reads the whole field and writes a new one; the source and destination
never alias. Stages run in this order for every voxel.

On the GPU that means two buffers: the coarse compute pass reads
`tensorBuffer` and writes `tensorScratchBuffer`, and the frame copies the
scratch back before anything else reads the field. (Until the WGSL oracle,
§9.2, was built, the shader stepped `tensorBuffer` in place, so a voxel's
neighbour reads raced with the neighbour's own write and the result depended
on dispatch order.)

### 6.1 Region physics
With `region = regionPhysics(world, style)` (§3.1) and `nm` the §3.4 scales for
`regionZone(world)`:

```
decay     = clamp01(1 - (1 - region.decay) * (nm.lossScale * nm.regionalLoss)) * hypoxia.decayMod
diffusion = region.diffusion * nm.diffusionScale * hypoxia.diffusionMod
```

At the defaults every scale is exactly 1, so `1 - (1 - region.decay)` is
`region.decay` exactly (both subtractions are exact in binary floating point
for a decay in `[0.5, 1]`), and this is the pre-neuromodulation
`region.decay * hypoxia.decayMod` to the last bit.

### 6.2 Neighbourhood
Six-neighbour reads with **clamped** (not wrapped) indices. Gradient is the
central difference `(v₊ - v₋) / 2` per axis; `avg` is the plain mean of the six.

### 6.3 Fiber-coupled anisotropic diffusion
For each tract slot with `weight >= 0.01`:

```
alongSample          = sampleDirectionalActivity along the unit tract direction
along                = abs(dot(normalize(gradient + 1e-4), tractDir))
directionalTransport += alongSample * weight * mix(0.75, 1.35, along)
isotropicLeak        -= abs(dot(gradient, tractDir)) * diffusion * weight * 0.08
crossingMix           = max(crossingMix, weight * (1 - along))
totalFiberWeight     += weight
```

Then, if any tract was present:

```
directionalTransport /= totalFiberWeight
tractBias = clamp01(totalFiberWeight * (0.7 + crossingMix * 0.55))
val  = mix(val, mix(avg, directionalTransport, tractBias),
           min(spread(clamp(0.45 + fiberCoupling * 0.35, 0, 0.92), nm.diffusionScale), 0.92))
val -= (avg - isotropicLeak) * clamp01(fiberCoupling) * 0.16
```

and otherwise `val = mix(val, avg, spread(0.7, nm.diffusionScale))`.

The mix factor is still derived from `fiberCoupling` (that is why `smoothing`
is unread, §6.14); `diffusionRate` only stretches it, through §3.4's `spread`.

### 6.4 Highway bias
With `fiberCoupling > 0`, each tract slot adds sustained transport from the two
samples §6.3 already read:

```
val += max(up, down) * weight * fiberCoupling * 0.34
val += max(val, max(up, down)) * weight * fiberCoupling * 0.12
```

plus, under SynaptiX, `max(aiUp, aiDown) * weight * aiInfluence * fiberCoupling * 0.18`.

### 6.5 Criticality cascade

```
localPeak          = max(val, the six neighbours)
avalancheThreshold = spikeThreshold * mix(1.08, 0.72, criticality)
seeded             = smoothstep(threshold, threshold + CASCADE_GATE_WIDTH, localPeak)
cascadeNoise       = 0.72 + 0.28 * hash(x, y, z, frame)
branchBias         = primary tract present ? clamp01(0.5 + 0.5 * dot(ĝ, tract₀)) : 0.5
cascade            = seeded * cascadeNoise * mix(0.18, 1, branchBias) * (0.35 + criticality * 0.85)

val        = mix(val, max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5)), clamp01(cascade))
             + cascade * branchBias * 0.48
diffusion *= mix(1, 1.32, cascade)
decay     *= mix(1, mix(0.94, 0.82, criticality), cascade)
```

The cascade is **blended by `cascade`, not gated on `cascade > 0`**. The old
gate made a continuous term discontinuous: the instant `cascade` left zero,
`val` jumped to `0.84 * localPeak`. That is a visible popping artefact on the
GPU, and it is why two CPU implementations of the same algorithm could disagree
by tenths of a unit.

### 6.6 Traveling phase wave
`phase = dot(normalisedPos, tract₀) * 6.2832` (or the +Y axis with no tract);
`val += val * (sin(phase - time * 4) * 0.5 + 0.5 - 0.5) * 0.08`.

### 6.7 Directional flow bias
Where `flowBias < -0.1` (frontal lobe) and `z < dim - 1`:
`val = mix(val, field[z + 1], diffusion * 0.4)`.

### 6.8 Fluid advection
Semi-Lagrangian, with a procedural divergence-free-ish velocity field:

```
ts = time * 2,  scale = 0.5 * fluidActive
v  = (sin(wy*3 + ts)·cos(wz*2 - ts), cos(wx*3 - ts)·sin(wz*2 + ts), sin(wx*2 + ts)·cos(wy*3 - ts)) * scale
val = mix(val, sample(world - v), min(1, fluidActive * 0.5))
```

The upstream read is **trilinear** in the CPU model and nearest-voxel in WGSL
(§8.3).

### 6.9 Stimulus injection
`sigma = stimulusRadius > 1e-4 ? stimulusRadius : 0.5` (the legacy fixed brush),
`signal = gaussianPulse(distance, sigma) * mitochondrialFunction`. Then

- **paint**: `val += stimulusActive * signal`
- **erase** (`stimulusErase > 0.5`): `val *= clamp01(1 - stimulusActive * signal)`

### 6.10 Environmental hazards
- **Electrical**: where `hash(x, y, z, frame) > 0.95`, `val += electricalActive * 5`.
- **Mercury**: posterior-biased deposit around world `(0, 0, -1.2)`,
  `val += mercuryActive * gaussianPulse(d, 1.2) * 0.5`; `decay = min(decay, 0.999)`.
- **Heavy metal**: `val = min(val, 1 - heavyMetal * 0.8)`;
  `decay = min(decay, 0.999 - heavyMetal * 0.05)`.

### 6.11 Ambient drive
The low-amplitude heartbeat that keeps the field alive between stimuli, and the
*only* consumer of `amplitude` and `frequency`:

```
radial       = |world| / BRAIN_RANGE
corticalBias = 1 - smoothstep(0.1, 0.95, radial)
val         += (sin(time * frequency) * 0.5 + 0.5 - 0.5) * amplitude * (0.02 + corticalBias * 0.04)
```

Before the contract, this term existed only in the two CPU paths — in two
different forms — while `amplitude` reached the compute shader and was read by
nothing. It is now one term in all three.

### 6.12 SynaptiX AI mirror
Active when `synaptiXActive > 0.5` and an AI tensor is present. The AI value is
re-shaped by the region's diffusion (`aiGeometricDecay = mix(1.18, 0.86, …)`),
sparsified, spiked by the voxel hash, blended into `val` by `aiInfluence`, given
a resonance burst when `|val - processedAI| < resonanceThreshold`, and damped by
a divergence term above it. See the code for the exact coefficients.

### 6.13 Decay and clamp
`next[index] = clamp01(val * decay)`.

### 6.14 Declared but not consumed

These fields are in `COMPUTE_UNIFORM_LAYOUT` and are uploaded by the renderer,
but **no implementation of the field reads them**. They are listed here so the
absence is a recorded decision rather than a discovery. None of them is a
physics parameter waiting to be wired: each is either render-side state
that shares the upload, or filler.

| Field | Note |
| --- | --- |
| `smoothing` | The field's mix factor is derived from `fiberCoupling` (§6.3). |
| `pulseSaturation` | Neuromodulator profile field. **Read by nothing** — not the field, not a render shader. The panel shows it as "not wired". |
| `trailLength` | Neuromodulator profile field. Read by the Connectome fiber shader (render uniforms), not the field. The panel shows it as "visual only". |
| `lesionCenter`, `lesionActive`, `lesionRadius` | Consumed by the render path; the field does not lesion. |
| `decimation` | Render-side. |
| `pad2`, `pad3` | Alignment filler with names. |

Wiring any of these up is a change to this document, to all three
implementations, and to the golden fixtures.

`decayRate`, `diffusionRate` and `retentionBias` used to be in this table —
uploaded on every path, driven by the Neuromodulator panel and the Live Input
Bus, and read by nothing. They are §3.4 now.

`cognitiveDissonance` was in it too, and has been **removed from the layout**
rather than specified. Nothing in the literature the app leans on gives it a
field-level meaning that would not be invented for the occasion, and the
`cognitive_dissonance` routine event already acts on the field honestly through
`stress` (§3.3 criticality); the extra parameter was a value the routine lerped
and every stepper ignored. Removing it moved every later field 4 bytes down
while leaving the struct size at 176, which is why the C ABI now carries a
layout fingerprint as well as a size (§5).

---

## 7. Fiber affinities

Each voxel carries three `(dir.xyz, weight)` records. Live renderers pass
`BrainGeometry.getFiberAffinityData()`. Slots with `weight < 0.01` are skipped.

### 7.1 Normalisation happens once, at upload

`normalizeFiberAffinities()` (JS) and `normalize_fiber_affinities()` (C++) turn
the directions into unit vectors when the buffer is uploaded, not on every
frame. This is both cheaper — the tracts are static — and necessary: sample
coordinates derived from these directions are quantised to voxel indices, so the
two implementations have to arrive at bit-identical directions.

### 7.2 The reference tract field

`makeReferenceFiberAffinities(dim)` / `bte_fill_reference_fiber_affinities()`
build a deterministic procedural tract field from the integer voxel hash alone,
so the golden test needs no binary geometry fixture. Slot 0 is the dominant
tract where one exists; slots 1 and 2 are sparse crossings. Weights are kept
clear of the `0.01` cutoff so a 1-ulp difference cannot include a tract in one
implementation and exclude it in the other.

---

## 8. Deliberate divergences from WGSL

The CPU model is not a bit-for-bit transcription of the shader. The places
they differ are listed here with the reason for each — mostly that the
GPU-convenient form cannot be reproduced consistently on two CPUs. §8.2 and
§8.4 record differences that have since been removed from all three; §8.6 is
one the WGSL oracle measured and that is still open.

### 8.1 The voxel hash
WGSL uses `fract(sin(dot(p, k)) * 43758.5453)`. That is catastrophically
ill-conditioned — a 1-ulp difference in `sin` gives a completely different
result after the multiply-and-fract — so it can never agree between two
implementations. The CPU model uses a 32-bit integer mix (`hashVoxel` /
`hash_voxel`), seeded by integer voxel coordinates and a frame counter, which is
exact in JavaScript (`Math.imul`, `>>>`) and in C++ (`uint32_t`).

Consequence: cascade noise and electrical spike placement differ between the GPU
and CPU paths. Both are noise; neither is a physical quantity.

### 8.2 The cascade gate
WGSL used `step(threshold, localPeak)`. See §6.5 — all three now use the soft
band, because a hard threshold flips on a 1-ulp difference.

(This section claimed that before it was true: the CPU paths had moved to the
soft band, and `field-step.js` still emitted `step()`. It turned up while the
WGSL oracle, §9.2, was being built — the drift that oracle exists to catch.)

### 8.3 Float32 discipline
The CPU reference computes in double, which is fine for smooth arithmetic — the
field is stored in a `Float32Array` either way, so every step re-rounds. It is
*not* fine anywhere a value feeds a discontinuous operation. Two classes of bug
came out of this and are fixed by construction:

1. **Literals.** `a * 1.6` (double) and `a * 1.6f` (C++/WGSL) scale a world
   coordinate differently in the last bits, which through `floor()` picks a
   different voxel. `BRAIN_RANGE`, the directional step scale and every
   comparison threshold in this file are held as their float32 values.
2. **Zone boundaries.** A voxel centre frequently lands exactly on a region
   boundary — `wy = 0.6` at `y = 22`, `dim = 32`. Float32 `0.6` is
   `0.6000000238…`, so `wy > 0.6` is true in double and false in float: a whole
   plane of voxels changes lobe. §3.1's comparisons are float32.

The one remaining sensitivity is the advection sample, whose coordinate comes
out of `sin`/`cos`, and no two libm implementations agree on those to the last
bit (V8 ships its own fdlibm port; Emscripten another). Through a nearest-voxel
read a 1-ulp coordinate difference becomes a whole-voxel difference in the
value; through a **trilinear** read it stays a 1-ulp difference. Hence §4.4.

### 8.4 The stimulus early-out
WGSL's `if (signal > 0.01)` was an optimisation that saved nothing measurable
and placed a hard step on the ring where the brush fades out. All three now
apply the whole Gaussian.

### 8.5 The fine level (§11) is WGSL-only
The clipmap brick runs only on the GPU. It is not a second field: it is a
one-way nested refinement of the coarse one, and nothing it computes is read
back into the coarse buffer, so the coarse field — the thing this document
specifies, the golden fixture pins, NWS1 records, and WASM and the WebGL
fallback compute — is the same whether or not a brick exists. The CPU
reference and the C++ engine therefore do not implement §11, and the fixture
stays a 32³ coarse-field fixture. (Running the brick on scalar WASM is
explicitly out of scope; see `docs/field-resolution.md` §9.)

What keeps the brick honest is that it is not a third implementation of §6:
`src/shaders/field-step.js` emits the *same* step text into both GPU levels,
and `tests/test_clipmap.js` fails if a §6 stage appears in any other shader
source.

### 8.6 Tract directions are re-normalised every step on the GPU
§7.1 normalises each tract direction once, at upload. The WebGPU renderer
uploads `BrainGeometry`'s raw affinities instead, so the WGSL step normalises
`aff.xyz + 0.0001` per slot per step (and `sampleDirectionalActivity` does it
again). On an already-unit direction that is not a no-op: it rotates it by
~1e-4, which now and then moves a §4.2 sample across a cell boundary. The WGSL
oracle (§9.2) measured this as the bulk of its worst-voxel difference
(7e-4 → 7e-5 with the re-normalisation removed) and as nothing at the lobe
scale. Closing it means the GPU uploading `normalizeFiberAffinities()` output
and the clipmap's affinity bake emitting unit directions, then dropping the
per-step `normalize` — a follow-up, not done with §3.4.

---

## 9. The golden fixture

`tests/golden-scenario.js` defines two scenarios, each 24 steps at
`dt = 0.016`, with a live paint-radius stimulus, partial hypoxia, fluid
advection, criticality drive and both hazard paths switched on, so a step that
an implementation skips shows up in the diff instead of hiding behind a zero
parameter.

| Scenario | Fixture | What it pins |
| --- | --- | --- |
| `baseline-v1` | `tensor-field-golden.{bin,json}` | Neuromodulators at their defaults. **This fixture predates §3.4 and was not regenerated**: it is the proof that the defaults are an identity. |
| `neuromod-v1` | `tensor-field-golden-neuromod.{bin,json}` | The same run with `decayRate`, `diffusionRate` and all four `retentionBias` lobes off their baselines, so §3.4 is compared between implementations rather than multiplied by 1. |

```
node scripts/gen_tensor_fixture.mjs   # regenerate (only when the spec changed)
npm test                              # JS stepper must reproduce both exactly
npm run test:golden                   # C++ engine must match both within epsilon
```

- `tests/fixtures/*.bin` — 32³ float32, little-endian.
- `tests/fixtures/*.json` — scenario, epsilon, sha256, stats.

`GOLDEN_EPSILON` is `2e-3` per voxel. The two implementations differ only in
intermediate precision and libm's last ulp, so the measured figures sit far
inside it — at the time of writing, `baseline-v1` mean `1.3e-7` and max
`7.7e-5`, `neuromod-v1` mean `1.0e-7` and max `5.0e-4`, stable across `-O0`,
`-O2` and `-O3`. A sudden jump toward the tolerance means an algorithm changed,
not that rounding got worse.

`neuromod-v1`'s larger max is one voxel, not a trend: the two agree to `9e-8`
after one step and to `9e-6` after eight, and the gap reaches `1e-4` in a single
voxel only in the last steps, where the cascade (below) amplifies rounding.

The scenario stops at 24 steps deliberately. Run long enough with criticality
drive and the field saturates into a regime where the cascade's positive
feedback is genuinely sensitive to initial conditions; pinning two
implementations there would measure chaos, not agreement.

`wasm/tests/golden_step_test.cpp` needs only a host C++17 compiler, not
Emscripten, so the contract is checkable in CI on an ordinary machine.

### 9.1 WGSL validation (naga) — in `npm test`

`tests/test_wgsl_naga.js` collects every WGSL entry-point source the modules in
`src/shaders/` export — exactly what the renderer hands
`createShaderModule()` — and runs each through the `naga` CLI, which parses and
validates it (types, uniformity, address spaces, reserved words). This catches,
in Node and without a GPU, the class of error that used to surface only as a
pipeline that failed to build in the browser.

The binary is a dev tool, not a dependency: `cargo install naga-cli` (any
recent version), or point `$NAGA` at one. When it is absent the test prints a
banner saying WGSL was **not validated** and exits 0 — the same posture as
`test:golden` without a compiler — unless `REQUIRE_NAGA=1`, which turns the
skip into a failure for CI jobs that are meant to have it.

### 9.2 WGSL vs the CPU reference — `npm run test:wgsl`

`scripts/wgsl_oracle.mjs` runs the **production** coarse compute shader
(`computeShader`, unmodified) in headless Chromium on SwiftShader's software
WebGPU adapter — Dawn, the same WebGPU implementation as Chrome — through the
Playwright dependency the verification suite already uses. It binds the
buffers exactly as `src/brain-renderer/pipelines.js` does, uploads the same
reference tract field the fixtures use (§7.2), steps, reads the field back and
compares it with `stepTensorField` over the same parameters.

A bit-identical match is not the goal and is not possible (§8.1, §8.3). The
oracle therefore runs scenarios in which the deliberate divergences are inert:

- **no hash-driven term** — criticality inputs at zero and `spikeThreshold`
  above any reachable `localPeak`, so §6.5's cascade is exactly 0 and its
  noise is never read; `electricalActive = 0`;
- **no advection** — `fluidActive = 0`, so §4.4's trilinear-vs-nearest
  difference never arises.

Everything else runs: tracts, highway bias, the phase wave, flow bias, the
paint stimulus, hypoxia, mercury, heavy metal, ambient drive, and §3.4 off its
defaults. What is left between the two paths is float32-with-possible-FMA
against double, so the oracle asserts a per-voxel bound and, separately, that
the lobe means agree — a lobe mean is what a missing or misapplied stage moves,
and noise does not.

On SwiftShader the production shader sits at relative L2 `6.8e-5` and worst
lobe-mean difference `1.2e-6`, against bounds of `3e-4` and `1e-5`. The bounds
were calibrated by breaking the shader on purpose: changing one §6.3 mix
coefficient by 1% (0.70 → 0.69) fails both (L2 `7.7e-4`, lobe `6.2e-5`), and so
does dropping §3.4 (L2 `0.46`) or stepping in place (L2 `0.12` — the race §6
describes, as it shipped). The calibration table is in
`scripts/wgsl_oracle.mjs`. The worst single voxel (`7e-4`) is a nearest-voxel
flip, mostly §8.6, and has only a loose `5e-3` ceiling.

It is a separate command, not part of `npm test`, because it needs a Chromium
build: if Playwright's browser (or `$CHROME_PATH`) is missing, or no WebGPU
adapter comes up, it prints **SKIP** with the reason and exits 0, unless
`REQUIRE_WGSL_ORACLE=1`. It never reports a pass it did not run.

---

## 10. Changing the physics

1. Edit this document.
2. Edit `src/physics/tensor-field.js` and the C++ engine in `wasm/src/`
   together — they carry the same section markers on the same steps.
3. Edit the WGSL step body in `src/shaders/field-step.js` (it reaches both the
   coarse shader and the fine brick, §11) unless §8 says the paths diverge
   there, and say so here if a new divergence is unavoidable.
4. If a new parameter is involved, add it to `COMPUTE_UNIFORM_LAYOUT` and run
   `node scripts/gen_wasm_params.mjs`.
5. `node scripts/gen_tensor_fixture.mjs`, then `npm run test:all` (which
   includes naga validation, §9.1) and `npm run test:wgsl` (§9.2).
6. Check the result visually in both renderers (`npm run dev`,
   `?renderer=webgl`). The fixture proves the implementations agree; it does not
   prove the physics is good.

---

## 11. The nested fine level (clipmap brick)

> WebGPU only (§8.5). Implementation: `src/shaders/brick-compute.js`; policy
> and placement: `src/clipmap/`; overview: `docs/field-resolution.md` §7.

The fine level is a `B³` window (`B = 64`) into a virtual `L³` lattice
(`L = 256`) over the same field cube. Voxel `g` of the lattice sits at §4.1's
position with `dim = L`. The window's lowest voxel is `o` (a multiple of 16 on
every axis, `0 ≤ o ≤ L − B`), and lattice voxel `g` is stored in texel
`g mod B`.

### 11.1 Step and boundary condition

Each step runs §6 — the identical body, `field-step.js` — for every voxel of
the window, with:

- **centre and neighbours** — the fine state for voxels inside the window;
  for a neighbour outside it, the coarse field at that neighbour's world
  position, **trilinear** over §4.1 coarse voxel positions. Neighbour indices
  clamp at the lattice edge, as §6.2's clamp at the grid edge.
- **§4.2 samples** (§4.3 directional, §6.4 highway) — the fine state inside the
  window, the coarse field trilinear outside it, 0 outside the cube.
- **§6.8 advection** — the same, clamped to the cube.
- **voxel step** — `(BRAIN_RANGE / L) · 0.9`.
- **tract affinities** — baked for the fine lattice by the same rasteriser as
  the coarse map (§7), per 16³ chunk.
- **§6.12** — the partner field is read from the coarse AI tensor, at the
  coarse dim. There is no fine partner level.

Source and destination never alias (the brick ping-pongs between two state
textures).

### 11.2 Placement changes

When the window moves, a voxel inside both the old and the new window keeps
its state (toroidal storage puts it in the same texel). A voxel the old window
did not cover — and every voxel when there was no previous window, or the
brick was idle — is **seeded** with the coarse field, trilinear at its
position, and not stepped that frame.

During tensor or session playback (`mode = 1`) every voxel is seeded every
frame: the brick refines the recording and adds no dynamics of its own.

### 11.3 Two-grid correction

After the step the window is divided into cells of `C³` fine voxels (`C = 8`,
one coarse voxel at 32³). For each cell, restriction takes the mean of the
stepped fine values `F` and the mean of the coarse field over the same voxels
`K`. Each voxel is then corrected by

```
next = clamp01(stepped + nudge · (K̃ − F̃))
```

where `K̃` and `F̃` are trilinear interpolations of the cell means at the
voxel, over cell centres, clamped to the window's own cells. `nudge` is 1 by
default (`setClipmapOptions({ nudge })`): the correction is dead-beat, so after
every step each cell's mean equals the coarse field's to within the trilinear
blend, and structure finer than a cell is not touched at all. The fine level
therefore never becomes a different simulation at the coarse scale; it only
adds what the coarse grid cannot resolve.

The correction is a smooth field of per-cell constants with non-negative
weights, so it cannot amplify any mode of the fine field. (A local low-pass
with negative side lobes — a 7-tap star, say — can: it would grow the mode at
its own tap spacing every step.)

### 11.4 What the fine level does not do

- It never writes the coarse field (§8.5).
- It is not recorded by NWS1 and not pinned by the golden fixture.
- It does not run on the CPU reference, the C++ engine or the WebGL fallback.

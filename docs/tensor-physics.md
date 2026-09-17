# Tensor Physics — the neural field contract

> **Status**: normative. This document is the specification the volumetric
> neural field is implemented from. Three pieces of code cite it by section
> number, and two of them are held to it by a test.

| Implementation | File | Role |
| --- | --- | --- |
| WGSL compute | `src/shaders/volumetric-compute.js` | Authoritative **visual** path. Runs on the GPU for every WebGPU session. |
| CPU reference (JS) | `src/physics/tensor-field.js` | Drives the WebGL2 fallback renderer, and produces the golden fixture. |
| C++ / WASM | `wasm/brain_tensor_engine.{h,cpp}` | Hybrid CPU path. Validated against the fixture by `npm run test:golden`. |

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

Anatomical zones, tested in this order. **The comparisons are evaluated in
float32** — see §8.3.

| Zone | Test | decay | diffusion | flowBias |
| --- | --- | --- | --- | --- |
| Frontal | `wz > 0.5` | 0.998 | 0.15 | −1.0 |
| Occipital | `wz < -0.5` | 0.92 | 0.04 | 0.0 |
| Temporal | `abs(wx) > 0.8` | 0.95 | 0.10 | 0.0 |
| Parietal | `wy > 0.6` | 0.94 | 0.12 | 0.0 |
| Default | — | 0.96 | 0.10 | 0.0 |

Cyber style (`abs(style - 1) < 0.1`) then overrides all of the above with
`decay = 0.92`, `diffusion = 0.05`, `flowBias = 0`.

There is exactly one signature. The four-argument neuromodulator variant that
once lived in a parallel `src/shaders/shared.js` has been deleted; do not
reintroduce a fork of this function anywhere, in any language.

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
and `bte_params_byte_size()` lets the JS bridge refuse a `.wasm` built from an
older layout at runtime rather than reading every field at a shifted offset.

**Adding a parameter the field reads** therefore means: one entry in
`COMPUTE_UNIFORM_LAYOUT`, `node scripts/gen_wasm_params.mjs`, then read it in
all three implementations and update §6 below. There is no path by which one
implementation gains a parameter the others cannot see.

---

## 6. The step

One step reads the whole field and writes a new one; the source and destination
never alias. Stages run in this order for every voxel.

### 6.1 Region physics
`decay = region.decay * hypoxia.decayMod`, `diffusion = region.diffusion * hypoxia.diffusionMod`.

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
           clamp(0.45 + fiberCoupling * 0.35, 0, 0.92))
val -= (avg - isotropicLeak) * clamp01(fiberCoupling) * 0.16
```

and otherwise `val = mix(val, avg, 0.7)`.

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
absence is a recorded decision rather than a discovery:

| Field | Note |
| --- | --- |
| `smoothing` | The field's mix factor is derived from `fiberCoupling` (§6.3). |
| `cognitiveDissonance` | Reserved. |
| `decayRate`, `diffusionRate` | Reserved for neuromodulator physics; §3.1 supplies both today. |
| `pulseSaturation`, `trailLength` | Consumed by the *render* uniforms, not the field. |
| `retentionBias` | Reserved for per-region neuromodulator retention. |
| `lesionCenter`, `lesionActive`, `lesionRadius` | Consumed by the render path; the field does not lesion. |
| `decimation` | Render-side. |
| `pad2`, `pad3` | Alignment filler with names. |

Wiring any of these up is a change to this document, to all three
implementations, and to the golden fixture.

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

The CPU model is not a bit-for-bit transcription of the shader. Four places
differ, each because the GPU-convenient form cannot be reproduced consistently
on two CPUs.

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

---

## 9. The golden fixture

`tests/golden-scenario.js` defines one scenario — 24 steps at `dt = 0.016`, with
a live paint-radius stimulus, partial hypoxia, fluid advection, criticality
drive and both hazard paths switched on, so a step that an implementation skips
shows up in the diff instead of hiding behind a zero parameter.

```
node scripts/gen_tensor_fixture.mjs   # regenerate (only when the spec changed)
npm test                              # JS stepper must reproduce it exactly
npm run test:golden                   # C++ engine must match within epsilon
```

- `tests/fixtures/tensor-field-golden.bin` — 32³ float32, little-endian.
- `tests/fixtures/tensor-field-golden.json` — scenario, epsilon, sha256, stats.

`GOLDEN_EPSILON` is `2e-3` per voxel. The two implementations differ only in
intermediate precision and libm's last ulp, so the measured figures sit far
inside it — at the time of writing, mean `1.3e-7` and max `7.7e-5`, stable
across `-O0`, `-O2` and `-O3`. A sudden jump toward the tolerance means an
algorithm changed, not that rounding got worse.

The scenario stops at 24 steps deliberately. Run long enough with criticality
drive and the field saturates into a regime where the cascade's positive
feedback is genuinely sensitive to initial conditions; pinning two
implementations there would measure chaos, not agreement.

`wasm/tests/golden_step_test.cpp` needs only a host C++17 compiler, not
Emscripten, so the contract is checkable in CI on an ordinary machine. A
WGSL-vs-CPU comparison waits on a software WGSL runner and is explicitly *not* a
prerequisite for the above.

---

## 10. Changing the physics

1. Edit this document.
2. Edit `src/physics/tensor-field.js` and `wasm/brain_tensor_engine.cpp`
   together — they carry the same section markers on the same steps.
3. Edit `src/shaders/volumetric-compute.js` unless §8 says the paths diverge
   there, and say so here if a new divergence is unavoidable.
4. If a new parameter is involved, add it to `COMPUTE_UNIFORM_LAYOUT` and run
   `node scripts/gen_wasm_params.mjs`.
5. `node scripts/gen_tensor_fixture.mjs`, then `npm run test:all`.
6. Check the result visually in both renderers (`npm run dev`,
   `?renderer=webgl`). The fixture proves the implementations agree; it does not
   prove the physics is good.

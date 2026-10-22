# SynaptiX

SynaptiX is Neuro-Weaver's shared-space visualization mode. Style 4 renders two complete brain avatars side by side: avatar A is driven by the normal simulation, playback, or BCI path, while the partner avatar can be another human tensor stream, an AI activation stream, a file, or a built-in phantom.

## Architecture

- Avatar A tensor: `tensorBuffer`
- Partner tensor: `aiTensorBuffer` (the GPU resource keeps its historical name)
- Control params: `partnerInfluence`, `couplingStrength`, `couplingWindowSeconds`, `resonanceThreshold`, `aiLayer`
- Entry points:
  - `renderer.setPartnerTensorData(...)`
  - `synaptixEngine.connectPartnerWebSocket(...)`
  - `synaptixEngine.generatePattern(...)`
  - `synaptixEngine.generatePairedPhantomFrames(...)`
  - routine event type: `synaptix`

Coupling is visual-only. It never writes partner activity into avatar A or modifies live/recorded BCI values. `aiInfluence`, `setAITensorData()`, `setTensorData()`, and `window.setLiveAIFrame()` remain deprecated compatibility aliases.

## Coupling Model

At 10 Hz, SynaptiX calculates mean activation for frontal, occipital, parietal, temporal, and deep masks. Each region's bridge strength is its positive Pearson correlation over the configured 0.5–10 second sample window, gated against near-zero activity. Negative correlation becomes divergence rather than resonance. The global coupling score is the mean of the five regional scores.

The renderer draws five curved bridges between matching anatomical anchors. Gold flow indicates coupling and empathy pulses; violet jitter indicates divergence. `partnerInfluence` controls the partner signal's visibility and bridge response, while the partner shell remains faintly visible at zero.

The deterministic render workload counter includes both avatar surfaces and all bridge vertices. The renderer exposes `getSynaptiXPerformanceStats()` and `benchmarkSynaptiX()` for the ≤2× workload and same-device median frame-time checks.

## Multi-Brain

Style 4 draws two cortices by default. Avatar A sits on the left and the
partner on the right, each at `MULTI_BRAIN_SCALE` and offset by
`±MULTI_BRAIN_OFFSET_X`. They share one camera orbit, and each samples its own
tensor: avatar A reads `tensorBuffer`, the partner reads `aiTensorBuffer`. Both
backends take the layout, the bridge anchors and the bridge geometry from
[`src/multi-brain-layout.js`](../src/multi-brain-layout.js), so they can't
drift. The layout is a CPU-side model matrix per avatar, written into that
avatar's copy of the render uniforms. It isn't a uniform field, so
`RENDER_UNIFORM_LAYOUT` is unchanged.

- `dualAvatarEnabled` (default `true`) switches between two cortices and one
  cortex with the partner as an overlay. Its UI is **Show Both Cortices** in
  the SynaptiX tab.
- The `multi_brain` routine event drives the same param. Enabling it also
  switches to style 4.
- Two cortices cost no extra simulation. Each brain keeps its own source: the
  stepper for avatar A, and a stream, file or phantom for the partner. At the
  default 32³, two meshes don't need the clipmap.

The mirror-neuron demo,
[`public/routines/mirror_neuron_reach.json`](../public/routines/mirror_neuron_reach.json),
stimulates avatar A's frontal and then parietal region (`stimulus`). A beat
later it lights the partner's matching region with `injectAIStimulus` and fires
an `empathy_pulse` across that bridge. As everywhere in SynaptiX, the echo is
staged and visual: neither field is ever written by the other.

## Anatomical Mapping

The default projector in [`src/synaptix-engine.js`](../src/synaptix-engine.js) maps non-32^3 activations into the brain volume like this:

| Activation depth | Brain region | Meaning |
| --- | --- | --- |
| early 0-25% | occipital | visual / feature extraction |
| lower-mid 25-50% | temporal | language / sequence context |
| upper-mid 50-75% | parietal | integration / attention |
| deep 75-100% | frontal | reasoning / decision pressure |

This is a storytelling default, not a neuroscientific claim of one-to-one cortical equivalence.

## Built-In Phantoms

- `aligned-prefrontal`: clean frontal agreement
- `hallucination-spike`: sparse, unstable synthetic salience
- `visual-mismatch`: occipital energy with phase divergence
- `full-resonance`: broad shared activation

Three canned sequences are available with no external files:

- `resonance`
- `hallucination`
- paired `social-coupling`

## Routine Vocabulary

SynaptiX routines can use standard routine events plus:

```json
{ "type": "synaptix", "action": "pattern", "pattern": "aligned-prefrontal" }
{ "type": "synaptix", "action": "phantom-sequence", "sequence": "resonance" }
{ "type": "synaptix", "action": "play-frames", "rate": 4 }
{ "type": "synaptix", "action": "pause-frames" }
{ "type": "synaptix", "action": "paired-phantom-sequence", "sequence": "social-coupling" }
{ "type": "multi_brain", "enabled": true, "partnerInfluence": 0.85 }
{ "type": "injectAIStimulus", "target": "parietal", "intensity": 0.8, "radius": 5 }
{ "type": "mirror_coupling", "enabled": true, "strength": 0.9, "windowSeconds": 2.0 }
{ "type": "empathy_pulse", "region": "frontal", "intensity": 1.0, "duration": 1.5 }
{ "type": "divergence_storm", "intensity": 0.8, "duration": 2.0 }
```

Examples live in:

- [`public/routines/synaptix_resonance.json`](../public/routines/synaptix_resonance.json)
- [`public/routines/synaptix_hallucination.json`](../public/routines/synaptix_hallucination.json)
- [`public/routines/synaptix_multi_brain.json`](../public/routines/synaptix_multi_brain.json)
- [`public/routines/mirror_neuron_reach.json`](../public/routines/mirror_neuron_reach.json)

All of these appear in the Routine tab's Neuro-Script gallery
([`nwroutine.md`](nwroutine.md)).

## Partner Sources

The SynaptiX tab accepts `.bin`, `.npy`, and `.csv` tensors, ONNX inference, callbacks through `window.setPartnerFrame(Float32Array)`, and WebSocket frames. The normalized WebSocket contract is one binary, little-endian Float32 frame containing exactly `32 × 32 × 32` values (131072 bytes). Invalid frames are ignored. A disconnect leaves the last valid partner frame visible and does not reconnect automatically.

This binary feed is the extension point for BCI + BCI: the existing BCI session owns avatar A, while an external bridge projects the second device into normalized partner frames. Remote rooms and relay-server behavior remain separate follow-up work ([`ROADMAP.md`](ROADMAP.md) → *Open Items*).

## Recording Your Own Activations

If you already have a true 32x32x32 float tensor:

1. Export raw float32 values as `.bin`, `.npy`, or `.csv`.
2. Load the file in the SynaptiX tab.
3. Adjust `AI Layer / Head`, `Partner Influence`, and the coupling controls.

If your source tensor is any other shape:

1. Flatten it to a 1D activation array.
2. Load it anyway.
3. SynaptiX will project it into 32^3 automatically using the mapping table above.

For token-by-token playback, concatenate multiple 32^3 frames in one file or generate frames in code and call `window.setPartnerFrame(...)`.

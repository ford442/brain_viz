# SynaptiX

SynaptiX is Neuro-Weaver's comparative visualization mode. It renders human activity and AI activity together, then colors overlap, drift, and dominance directly in the brain render path.

## Architecture

- Human tensor: `tensorBuffer`
- AI tensor: `aiTensorBuffer`
- Control params: `aiInfluence`, `resonanceThreshold`, `aiLayer`
- Entry points:
  - `renderer.setAITensorData(...)`
  - `synaptixEngine.generatePattern(...)`
  - `synaptixEngine.generatePhantomFrames(...)`
  - routine event type: `synaptix`

The comparative path is visual-only. The compute shader still owns the human tensor unless tensor playback or WASM mode overrides it.

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

Two canned sequences are available with no external files:

- `resonance`
- `hallucination`

## Routine Vocabulary

SynaptiX routines can use standard routine events plus:

```json
{ "type": "synaptix", "action": "pattern", "pattern": "aligned-prefrontal" }
{ "type": "synaptix", "action": "phantom-sequence", "sequence": "resonance" }
{ "type": "synaptix", "action": "play-frames", "rate": 4 }
{ "type": "synaptix", "action": "pause-frames" }
```

Examples live in:

- [`public/routines/synaptix_resonance.json`](../public/routines/synaptix_resonance.json)
- [`public/routines/synaptix_hallucination.json`](../public/routines/synaptix_hallucination.json)

## Recording Your Own Activations

If you already have a true 32x32x32 float tensor:

1. Export raw float32 values as `.bin`, `.npy`, or `.csv`.
2. Load the file in the SynaptiX tab.
3. Adjust `AI Layer / Head`, `AI Influence`, and `Resonance Threshold`.

If your source tensor is any other shape:

1. Flatten it to a 1D activation array.
2. Load it anyway.
3. SynaptiX will project it into 32^3 automatically using the mapping table above.

For token-by-token playback, concatenate multiple 32^3 frames in one file or generate frames in code and call `window.setLiveAIFrame(...)`.

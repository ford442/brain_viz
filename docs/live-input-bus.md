# Live Input Bus

One shared mapping table that routes a named feature from any registered live
source (mic, BCI band power, training metrics, and future MIDI/HR/OSC
sources) to a renderer param, instead of each live-data panel growing its own
one-off mapping table. This is the practical version of the roadmap items
"Neuromodulation External API", "Custom Audio-Feature Mapping Matrix",
"Adaptive Routines", and "Biofeedback Adaptive Audio" — the "Brain DJ"
endgame, generalized past audio.

It does **not** replace `AudioReactor`, `BCISession`, `TrainingEngine`, or the
audio-only `ReactivityRouter` ("Brain DJ" panel) — those keep doing what they
already do (mic capture, EEG band-power extraction + tensor projection,
course objective tracking, the classic audio->param presets). The bus adds
one more consumer on top of each: a `sample()` closure that reads their
already-updated public state.

## Architecture

- **`src/live-input-bus.js`** — `LiveInputBus` class. Framework-free, no DOM
  or hardware access of its own.
  - **Sources** (`registerSource(id, { hz, features, sample })`): a polled
    feature producer, throttled to `hz` samples/sec. `sample()` must return a
    plain `{ featureName: number, ... }` object.
  - **Mappings** (`addMapping({ source, feature, sink, scale, attack,
    release, enabled })`): routes one `source.feature` to one `sink`. `scale`
    multiplies the (attack/release-smoothed) feature value; the result is
    added as a delta on top of a baseline captured from the renderer's
    current value the first time that sink is used, so multiple mappings can
    safely share one sink and a disabled/removed mapping just stops
    contributing rather than resetting the param.
  - **Sinks**: any key in `LIVE_INPUT_SINKS` (a curated allowlist of
    `RendererParams` keys — see `src/types.js` — plus the special `'zoom'`
    camera target, applied via `renderer.setCameraParams` instead of
    `renderer.setParams`).
  - `tick(dt)` — call once per frame. Samples every due source, smooths and
    applies every enabled mapping.
  - `getFeatureValue(source, feature)` / `evaluateCondition(expr)` — read the
    latest sampled value, or evaluate a `"live.<source>.<feature> OP number"`
    condition string (see Routine integration below).
  - Mappings persist to `localStorage['neuroWeaver.liveInputBus.mappings']`;
    sources are code-registered each session, not persisted.
- **`src/main-live-input-integration.js`** — `setupLiveInputIntegration(...)`
  constructs the bus and registers its built-in sources (see Sources below).
  Attaches the bus to the routine player as `player.liveInputBus` and exposes
  `window.__liveInputDebug.bus` for headless verification.
- **`src/ui/templates/tab-live.js`** / **`src/ui-live-input-panel.js`** — the
  "Live" tab markup and its wiring (enable toggle, mapping rows, JSON
  import/export), mirroring the Reactivity Router panel's UI but reading from
  `LIVE_INPUT_SINKS` and `bus.listFeatures()` instead of a fixed audio list.
- **`src/main-update-loop.js`** — calls `liveInputBus.tick(dt)` once per RAF
  frame (own `dt` tracked the same way `TrainingEngine.update(dt)` is), after
  `AudioReactor.update()` / `ReactivityRouter.apply()` so the audio source
  reads that frame's already-refreshed features.

## Built-in sources

| Source id | Features | Sampled from |
|---|---|---|
| `audio` | `bass`, `energy`, `brightness`, `onset` | `AudioReactor.getFeatures()` |
| `bci` | `alpha`, `beta`, `gamma` | `BCISession.latestFeatures.bands` |
| `training` | `calm`, `occipitalAlpha`, `flowResonance` | `training-engine.js`'s `METRICS` samplers, independent of whether a course is running |

Add a source anywhere else in the app with:

```js
liveInputBus.registerSource('midi', {
    hz: 60,
    features: ['cc1', 'cc74'],
    sample: () => ({ cc1: latestCC1 / 127, cc74: latestCC74 / 127 }),
});
```

— that's the whole integration surface; no new `main-*-integration.js` file
and no separate mapping table.

## Mapping table shape

```jsonc
{
  "enabled": true,
  "mappings": [
    {
      "id": "live_...",
      "source": "audio",       // a registered source id
      "feature": "bass",       // one of that source's features
      "sink": "flowSpeed",     // a LIVE_INPUT_SINKS entry, or 'zoom'
      "scale": 2,               // feature value * scale = offset from baseline
      "attack": 0.05,           // seconds, smoothing time constant while rising
      "release": 0.4,           // seconds, smoothing time constant while falling
      "enabled": true
    }
  ]
}
```

Edit it live from the **Live** tab, or export/import the same JSON shape.

## Routine integration: `if:` condition sugar

Any routine event can carry an `if` field gating whether it executes, read
against the bus's most recently sampled features:

```jsonc
{ "time": 4.0, "type": "text", "message": "Alpha rising", "if": "live.bci.alpha > 0.6" }
```

`live.<feature>` (no source segment) resolves against the first registered
source that exposes that feature name. An unparsable expression, or one
naming a feature no source currently exposes, **fails open** — the event
still runs — so a typo or a not-yet-connected source never silently breaks a
routine. See `RoutinePlayer.executeEvent()` in `src/routine-player.js` and
`LiveInputBus.evaluateCondition()`.

This is condition *sugar* only — it gates a single event inline, it does not
pause the timeline the way `wait`/`signal` do.

## External ingest

Not yet implemented in this pass. The existing `npm run bci:bridge`
(`scripts/openbci_ws_bridge.mjs`) WebSocket bridge is the pattern a future
`{ t, channels: { alpha: 0.4, ... } }` live-input WebSocket source should
follow — register it as one more `liveInputBus.registerSource(...)` call, not
a new integration file.

## Safety / science

Every bus feature is a **derived visualization signal**, not a diagnostic or
therapeutic reading — the same posture as Double Mirror and Training Mode
(see `docs/SCIENTIFIC_ACCURACY_REPORT.md`). The Live tab states this
explicitly. `LIVE_INPUT_SINKS` intentionally excludes geometry-rebuild keys
other than `foldStrength` (already exposed by `ReactivityRouter`) to avoid
driving a per-frame geometry rebuild from a live feature.

## Testing

- `tests/test_live_input_bus.js` (`npm test`) — source registration/sampling,
  `hz` throttling, attack/release smoothing, multi-mapping sink accumulation,
  the `'zoom'` special case, localStorage round-trip, and
  `evaluateCondition()`'s fail-open parsing — no DOM/renderer required.
- `verification/verify_live_input_bus.py` (`python3
  verification/verify_suite.py`) — under the WebGL2 fallback: the Live tab
  renders and becomes active, adding a mapping through the UI produces a row,
  and one `LiveInputBus.tick()` with a mocked source's fixed `sample()`
  return value moves a renderer param by exactly `scale * feature`.

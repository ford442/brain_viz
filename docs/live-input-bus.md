# Live Input Bus

One shared mapping table that routes a named feature from any registered live
source (mic, BCI band power, training metrics, MIDI, heart rate and external
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
    `renderer.setParams`). `decayRate` and `diffusionRate` drive the neural
    field itself on every renderer (`docs/tensor-physics.md` §3.4, clamped so
    a large offset saturates rather than inverting the field); before that
    they were uploaded and ignored. `pulseSaturation` is still read by
    nothing (§6.14) — a mapping onto it has no visible effect.
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
| `midi` | `cc0`–`cc127`, `note` | MIDI control changes and note velocity, normalized to 0–1 |
| `hr` | `hr`, `bpm` | Bluetooth Heart Rate Measurement; `hr` maps 40–180 BPM to 0–1 and clamps, `bpm` is the raw measurement |
| `external` | packet channel names | Most recent valid WebSocket JSON packet |

Use the Live tab's MIDI and heart-rate buttons to request device access with a
user gesture. These browser APIs require a supported browser and secure context;
Bluetooth additionally requires a compatible Heart Rate Profile device. After
connecting, select the source and feature in the same mapping matrix as audio.
No device permission is requested automatically.

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

`live.<feature>` (no source segment) resolves against the first sampled
source that exposes that feature name. An unparsable expression or an
unresolved bare feature **fails open**. A qualified feature that has not been
sampled reads as zero. See `RoutinePlayer.executeEvent()` in
`src/routine-player.js` and `LiveInputBus.evaluateCondition()`.

It gates a single event inline; it does not pause the timeline. A `branch`
event can instead select an entire registered sub-routine from the same
latest sampled value. For example, the following is a `.nwroutine` package
fragment (see [the package format](nwroutine.md)):

```json
{
  "routine": [
    { "time": 5, "type": "branch", "condition": "live.hr.bpm > 90",
      "trueBranch": "higher", "falseBranch": "lower" }
  ],
  "subRoutines": {
    "higher": [{ "time": 0, "type": "text", "message": "Higher pulse", "duration": 3 }],
    "lower": [{ "time": 0, "type": "text", "message": "Lower pulse", "duration": 3 }]
  }
}
```

Connect the device and allow a measurement before the branch executes. This
is a visualization example, not an interpretation of the pulse or a medical
threshold.

## External ingest

Run `npm run external:bridge` to forward JSON UDP datagrams on
`127.0.0.1:12347` to WebSocket clients on `127.0.0.1:8767`. For example:

```sh
printf '%s' '{"t":1,"channels":{"alpha":0.4,"hr":72,"cc74":0.2}}' | nc -u -w1 127.0.0.1 12347
```

Open the app with `?renderer=webgl&external=ws%3A%2F%2F127.0.0.1%3A8767`
(or omit the renderer parameter for WebGPU). Incoming channel names become
features of the `external` source. Names start with a letter and contain only
letters, digits and underscores (up to 64 characters); `constructor` and
`prototype` are reserved. The bridge accepts up to 64 finite numeric channels
per packet, with values between -1,000,000 and 1,000,000, and packets up to
16 KiB. It also accepts the existing `type: "external"` envelope. It is
separate from the EEG-specific `npm run bci:bridge`. OSC parsing is
**deferred**: translate OSC to the JSON UDP protocol externally before using
this bridge.

The bridge has no authentication and defaults to loopback. Do not expose it
to an untrusted network; its data can drive visualization parameters.

## Safety / science

Every bus feature is a **derived visualization signal**, not a diagnostic or
therapeutic reading — the same posture as Double Mirror and Training Mode
(see `docs/SCIENTIFIC_ACCURACY_REPORT.md`). The Live tab states this
explicitly. `LIVE_INPUT_SINKS` excludes geometry-rebuild keys, including
`foldStrength` and `growth`, to avoid driving a per-frame geometry rebuild
from a live feature. Sink values are clamped to their control ranges; raw
features such as BPM remain available to conditions.

## Testing

- `tests/test_live_input_bus.js` (`npm test`) — source registration/sampling,
  `hz` throttling, attack/release smoothing, multi-mapping sink accumulation,
  the `'zoom'` special case, localStorage round-trip, and
  `evaluateCondition()` plus mocked MIDI and HR — no hardware required.
- `tests/test_live_input_safety.js` — sink bounds, invalid mappings and live
  branch conditions.
- `verification/verify_live_input_bus.py` (`python3
  verification/verify_suite.py`) — under the WebGL2 fallback: the Live tab
  renders and becomes active, adding a mapping through the UI produces a row,
  and one `LiveInputBus.tick()` with a mocked source's fixed `sample()`
  return value moves a renderer param by exactly `scale * feature`.

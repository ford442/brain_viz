# Neurofeedback Training Mode

A gamified mode where the player holds a simulated brain-state metric inside a
target band for a sustained duration to complete an objective — turning
Neuro-Weaver into an interactive neurofeedback trainer. Playable entirely
without hardware; `AudioReactor` and SynaptiX resonance stats are used
opportunistically when active, and a keyboard demo baseline exists for every
built-in course so it can be exercised in headless/CI verification.

## Architecture

- **`src/training-engine.js`** — `TrainingEngine` class, the `METRICS` sampler
  registry, and the `BUILTIN_COURSES` catalog. Framework-free; polled once per
  frame via `update(dt)`.
- **`src/routine-handlers/training.js`** — registers `training_start`,
  `training_checkpoint`, and `training_end` routine event handlers.
- **`src/ui/templates/tab-training.js`** / **`src/ui-training-panel.js`** —
  the "Training" tab markup and its wiring (course picker, progress ring,
  metric gauge, session history).
- **`src/main-training-integration.js`** — orchestration: instantiates
  `TrainingEngine`, attaches it to the `RoutinePlayer` as `player.trainingEngine`,
  and wires the keyboard demo-baseline shortcuts.

## Metrics

Metrics are sampled 0..1 from live renderer/audio/SynaptiX state — see
`METRICS` in `training-engine.js`:

| Metric | Source | Notes |
|---|---|---|
| `calm` | `1 - renderer.params.stress / 2.0` | Inverse of the existing Stress (Distortion) slider. |
| `occipitalAlpha` | `renderer.params.amplitude` / `smoothing` | Low amplitude + high smoothing (a relaxed, eyes-closed-like state) drives a simulated posterior alpha rhythm with a slow envelope wobble. |
| `flowResonance` | SynaptiX resonance stats, else `AudioReactor` energy, else `renderer.params.flowSpeed / 10` | Falls back gracefully depending on what's active. |

Extend by adding another entry to `METRICS` with a `sample(ctx)` function,
where `ctx = { renderer, audioReactor, synaptixEngine }`.

## Course JSON format

```jsonc
{
  "id": "calm-focus",              // unique string id
  "name": "Calm Focus",
  "description": "...",
  "objectives": [
    {
      "metric": "occipitalAlpha",  // key into METRICS
      "target": 0.75,              // 0..1 target value
      "tolerance": 0.15,           // +/- band around target considered "in zone"
      "duration": 20,              // seconds of continuous in-zone hold to pass
      "label": "Hold Alpha"        // shown in the UI / checkpoint events
    }
  ],
  "demoKey": "6",                  // optional: keyboard digit that auto-starts + auto-drives this course
  "demoParams": { "amplitude": 0.0, "smoothing": 0.98 }, // optional: renderer.params lerped on demoKey press
  "onSuccessRoutine": "some-sub-routine-name",  // optional: sub-routine name to auto-branch into on success
  "onFailRoutine": "some-other-sub-routine-name" // optional: sub-routine name to auto-branch into on failure
}
```

Register a course at runtime with `trainingEngine.loadCourse(courseObject)` —
any object matching this shape works, so custom/user-authored courses (e.g.
loaded from a JSON file) are a drop-in extension point.

## Scoring

- **Hold time**: while the sampled metric is inside `[target - tolerance,
  target + tolerance]`, `holdTime` accumulates at 1x; while outside, it decays
  at 1.5x (a "drift penalty") and the current streak resets. An objective
  passes once `holdTime >= duration`.
- **Streak**: continuous in-zone seconds; `bestStreak` is tracked per course
  run and surfaced in the UI.
- **Stars**: on course completion, `driftPenalty` (total seconds spent out of
  zone) is compared against the course's total objective duration — ≤5% drift
  earns 3 stars, ≤30% earns 2, anything else that still finishes earns 1.
- **Time limit**: a course auto-fails if the player hasn't finished within 4x
  the sum of all objective durations, so a session can't stall forever.
- **History**: every completed/failed run is appended to
  `localStorage['neuro_weaver_training_history']` (see `getHistory()` /
  `clearHistory()` in `training-engine.js`), capped at the most recent 20 runs.

## Routine integration

- `{ "type": "training_start", "course": "calm-focus" }` — starts a course
  from a scripted routine JSON at a specific timeline position.
- `{ "type": "training_checkpoint", ... }` — emitted automatically by
  `TrainingEngine` each time an objective is passed (also authorable directly
  in a routine as a narrative marker/text cue).
- `{ "type": "training_end", ... }` — emitted on course completion or failure;
  the default handler auto-branches into the course's `onSuccessRoutine` /
  `onFailRoutine` sub-routine (registered via `player.registerSubRoutines`) if
  one is set, giving routine authors a hook for post-course narrative beats.

## Keyboard demo baseline

Each built-in course ships a `demoKey` (digits `6`/`7`/`8` — `1`-`5` are
reserved for style-mode switching and the rest of the alphabet is already
claimed by `MINI_ROUTINES`). Pressing it starts that course and lerps the
renderer params in `demoParams` straight into the target band, so every
course is completable hands-free — this is what
`verification/verify_training.py` exercises under the WebGL2 fallback.

# Double Mirror Sessions (`.nwsession`)

Double Mirror sessions are local-first, synchronized recordings of the rendered human tensor and optional browser media features. Version 1 retains:

- one 32×32×32 human `float32` tensor snapshot per 10 Hz tick;
- optional 320×180 WebP thumbnails at 10 Hz, with JPEG fallback;
- optional microphone-derived RMS, bass, energy, brightness, and onset values at 10 Hz;
- timestamped plain-text notes and an optional mood label.

It does **not** retain continuous video, raw audio, audible audio, location, or BCI device packets. No session code uploads data or makes a network request. Camera and microphone access is requested only when its checkbox is selected, after the local-only consent checkbox is accepted. Browser permission denial aborts the recording.

## NWS1 binary envelope

All multibyte numbers are little-endian. Files larger than 512 MB are rejected.

| Offset / repetition | Field |
|---|---|
| 0 | four ASCII bytes: `NWS1` |
| 4 | `uint32` JSON manifest byte length |
| 8 | UTF-8 JSON manifest |
| repeated | `uint8 type`, `float64 relativeTimestampMs`, `uint32 payloadLength`, payload bytes |

Chunk types are:

| Type | Payload |
|---|---|
| 1 | exactly 32,768 little-endian `float32` tensor values (131,072 bytes) |
| 2 | one encoded WebP or JPEG thumbnail; MIME type is in the manifest |
| 3 | five little-endian `float32` values: `rms`, `bass`, `energy`, `brightness`, `onset` |
| 4 | UTF-8 JSON: `{ "text": string, "mood"?: string }` |

The manifest contains `format`, app name/version, ISO creation time, duration, tensor shape/dtype, nominal stream rates, visual MIME type, explicit consent selections, visual encode drop count, and per-type chunk counts. The manifest is limited to 1 MB and an individual chunk to 16 MB. Import rejects unknown magic/version, malformed JSON, unsupported tensor metadata, unknown chunk types, non-finite or negative timestamps, wrong tensor/audio lengths, and truncated or oversized headers/payloads. Chunks are sorted by relative timestamp during finalization, including thumbnails whose asynchronous encoding completes out of order.

## Capture and playback behavior

One `performance.now()` origin timestamps all modalities. Every 100 ms tick captures the current human tensor, reads audio features, and starts thumbnail encoding with the same relative timestamp. Recording is observational: it never changes simulation, BCI, TensorPlayer, WASM, or SynaptiX data. Temporary chunks spill into IndexedDB and are deleted after stop, discard, or failed finalization. Capture automatically stops at five minutes and always tears down its media tracks and audio context.

Session replay owns only the human tensor while active. Loading a session stops TensorPlayer and its WebSocket, pauses paired SynaptiX human-frame playback, disconnects live BCI, enables `tensorPlaybackMode`, and writes frames through `renderer.setVoxelData()`. The partner/SynaptiX tensor is untouched. Stop restores normal simulation; deliberately, it does not reconnect a BCI device. Each displayed modality is the latest chunk at or before the playhead. Forward note crossings emit the safe `session_note` routine event; seeking resolves the caption without replaying historical events.

## Analysis and CSV export

Audio samples pair with the nearest tensor sample only when the absolute timestamp difference is at most 50 ms. Occipital activation uses the same anatomical partition as SynaptiX. The Session tab shows a 16×16 occupancy heatmap and Pearson correlations for RMS/energy versus normalized occipital activation.

CSV contains one row per matched audio sample: `time_ms`, five audio features, `occipital_activation`, active note, mood, visual-frame index, and alignment error. Unmatched samples are omitted and text fields use standard doubled-quote CSV escaping.

These correlations are descriptive, not causal, diagnostic, or clinical. They can be shifted or distorted by the 10 Hz sampling grid, camera encoding delay, device audio processing, BCI preprocessing, browser scheduling, and sensor latency. A correlation is not evidence that a mood, sound, image, or note caused neural activity. Session files can contain sensitive biometric imagery, derived microphone measurements, brain activity, and personal writing; users should control access to downloaded files and delete them when no longer needed.

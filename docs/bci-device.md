# Live EEG / BCI Devices

Neuro-Weaver can use live Muse or OpenBCI EEG as the avatar-A 32×32×32 field. Live BCI takes ownership of that tensor while connected; the SynaptiX partner tensor remains independent and can come from another normalized human feed, a phantom, a file, or ONNX. Disconnecting restores the normal simulation.

## Muse 2 and Muse S

1. Serve Neuro-Weaver from `https://` or `localhost` in Chrome or Edge.
2. Open the **BCI** tab and select **Muse 2 / Muse S**.
3. Put the headset in pairing mode and click **Scan / Connect**.
4. Select the device in the browser chooser.

The adapter detects the protocol from the GATT characteristics:

- Muse 2 and Muse S Classic use the FE8D service with one characteristic per EEG channel.
- Muse S Athena uses characteristic `273e0013-...`, multiplexed tagged packets, and its two-stage `dc001` initialization sequence.

Muse sends raw EEG, not alpha/beta/gamma values. Neuro-Weaver applies DC removal and a 256-sample Hann FFT, then calculates alpha (8–12 Hz), beta (13–30 Hz), and gamma (30–45 Hz) power at a target rate of 10 updates per second.

Web Bluetooth requires a secure context and a user gesture for the device chooser. A `bci_connect` routine can reconnect an already-authorized device, but first-time pairing pauses on the BCI tab until the user clicks **Scan / Connect**.

## OpenBCI GUI bridge

Install dependencies and start the bundled bridge:

```bash
npm install
npm run bci:bridge
```

Defaults:

- OpenBCI GUI UDP input: `127.0.0.1:12345`
- Browser WebSocket: `ws://127.0.0.1:8765`
- Board: Cyton, 8 channels at 250 Hz

For Cyton+Daisy:

```bash
npm run bci:bridge -- --board=cyton-daisy
```

In OpenBCI GUI, open the Networking widget, select UDP, choose `TimeSeriesRaw` or `TimeSeriesFilt`, and send it to the bridge UDP address. Then select the matching board in Neuro-Weaver and click **Connect**.

The bridge accepts OpenBCI's channel-major JSON and emits this versioned WebSocket protocol:

```json
{"type":"hello","version":1,"board":"cyton","sampleRate":250,"channels":["CH1","CH2"]}
{"type":"samples","version":1,"sequence":42,"timestamp":1234.5,"data":[[1.2,2.3],[0.4,0.8]]}
```

Only localhost is bound by default. Use the bridge host flags deliberately if remote access is required.

## Calibration, mapping, and quality

The calibration wizard captures ten seconds of neutral eyes-open activity followed by ten seconds of relaxed eyes-closed activity. It stores only per-band normalization statistics in `localStorage`; it does not retain raw EEG.

Muse channel mappings follow their sensor positions. OpenBCI provides editable Cyton and Cyton+Daisy 10–20-inspired presets. Per-channel changes are saved locally. Alpha is biased toward posterior/parietal masks, beta toward frontal/parietal masks, and gamma toward temporal/deep masks.

Signal quality is an estimate derived from variance, flatline/dropout detection, clipping, and motion. It is not an impedance measurement and must not be used for diagnosis.

## Recording

Recordings remain local and use `.nwbci`, a versioned binary container containing:

- source metadata, channels, sample rate, mapping, and timestamps;
- decoded raw microvolt samples and motion;
- derived bands and quality;
- emitted 32³ tensor frames.

Chunks spool through IndexedDB during recording. Stopping stages a file, and **Download** explicitly exports it. Loading a `.nwbci` file replays the recorded tensor frames deterministically.

## Routine events

```json
{"type":"bci_connect","adapter":"muse","required":true}
{"type":"bci_connect","adapter":"openbci","url":"ws://127.0.0.1:8765"}
{"type":"bci_threshold","metric":"alpha","comparison":"above","value":0.7,"holdSeconds":5,"timeoutSeconds":30}
{"type":"bci_record","action":"start","name":"calm-session"}
{"type":"bci_record","action":"stop"}
```

Threshold metrics are `alpha`, `beta`, `gamma`, `quality`, or `motion`; an optional `channel` selects one channel. `successSignal` and `timeoutSignal` override the generated routine signal names.

## Verification

```bash
python3 verification/verify_bci_device.py
```

The verifier uses mocked Muse Classic and Athena GATT devices, asserts at least 10 tensor updates per second with render cost isolated, checks local recording, and sends OpenBCI-compatible UDP through the real Node bridge. Physical headset reliability remains a manual hardware check.

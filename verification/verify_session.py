import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5186/?renderer=webgl&openTab=session"


def wait_for_server(url: str, timeout: float = 25.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.4)
    raise RuntimeError(f"Timed out waiting for dev server: {url}")


def verify() -> None:
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5186", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(APP_URL.split("?")[0])
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#tab-session.active", timeout=15000)
            page.wait_for_function("window.__sessionDebug !== undefined", timeout=15000)

            result = page.evaluate("""async () => {
                const format = await import('/src/session-format.js');
                const analysisModule = await import('/src/session-analysis.js');
                const { SessionPlayer } = await import('/src/session-player.js');
                const { SessionRecorder } = await import('/src/session-recorder.js');
                const { RoutinePlayer } = await import('/src/routine-player.js');
                const tensor = new Float32Array(format.TENSOR_VALUE_COUNT);
                const chunks = [];
                const visualCanvas = document.createElement('canvas');
                visualCanvas.width = 2; visualCanvas.height = 2;
                visualCanvas.getContext('2d').fillRect(0, 0, 2, 2);
                const visualBlob = await new Promise((resolve) => visualCanvas.toBlob(resolve, 'image/webp'));
                const visualPayload = new Uint8Array(await visualBlob.arrayBuffer());
                for (let i = 0; i <= 300; i++) {
                    const timestamp = i * 100;
                    tensor.fill(i / 300);
                    chunks.push({ type: format.SESSION_CHUNK_TYPES.tensor, timestamp, payload: format.encodeTensorPayload(tensor) });
                    chunks.push({ type: format.SESSION_CHUNK_TYPES.audio, timestamp, payload: format.encodeAudioPayload({
                        rms: i / 300, bass: 0.2, energy: i / 300, brightness: 0.4, onset: i % 10 === 0 ? 1 : 0,
                    }) });
                    chunks.push({ type: format.SESSION_CHUNK_TYPES.visual, timestamp, payload: visualPayload });
                    if (i === 10) chunks.push({ type: format.SESSION_CHUNK_TYPES.note, timestamp, payload: format.encodeNotePayload({ text: 'comma, quote " and\\nline', mood: 'focused' }) });
                }
                const manifest = {
                    format: 'NWS1', app: { name: 'verification', version: '1' }, createdAt: new Date(0).toISOString(), durationMs: 30000,
                    tensor: { shape: [32, 32, 32], dtype: 'float32-le' }, streams: { tensorHz: 10, cameraHz: 10, audioHz: 10, visualMimeType: visualBlob.type },
                    consent: { camera: true, audio: true, localOnly: true }, droppedFrames: { visual: 0 },
                    chunkCounts: { tensor: 301, visual: 301, audio: 301, note: 1 },
                };
                const blob = format.serializeSession(manifest, chunks.reverse());
                const parsed = await format.parseSession(blob);
                const typed = (type) => parsed.chunks.filter((chunk) => chunk.type === type);
                const tensors = typed(format.SESSION_CHUNK_TYPES.tensor);
                const audios = typed(format.SESSION_CHUNK_TYPES.audio);
                const monotonic = parsed.chunks.every((chunk, index, all) => index === 0 || chunk.timestamp >= all[index - 1].timestamp);
                const fidelity = [0, 150, 300].map((index) => format.decodeTensorPayload(tensors[index].payload)[12345]);
                const report = analysisModule.analyzeSession(parsed.chunks);
                const maxAlignment = Math.max(...report.pairs.map((pair) => pair.alignmentErrorMs));
                const csv = analysisModule.sessionAnalysisToCsv(report);
                window.__bciDebug?.session.renderer.stop();
                await window.__sessionDebug.player.load(blob);
                window.__sessionDebug.player.seek(1000);
                await document.querySelector('#session-playback-frame').decode();
                const overlaySynchronized = document.querySelector('#session-playback-caption').textContent.includes('focused')
                    && document.querySelector('#session-playback-frame').src.startsWith('blob:')
                    && parseFloat(document.querySelector('#session-playback-audio > span').style.width) > 0;
                const overlayUrlsBeforeStop = window.__sessionDebug.getState().liveObjectUrls;
                window.__sessionDebug.player.stop();
                const overlayUrlsAfterStop = window.__sessionDebug.getState().liveObjectUrls;

                const fakeRenderer = { tensorPlaybackMode: false, frames: [], setVoxelData(frame) { this.frames.push(new Float32Array(frame)); } };
                const fakeTensorPlayer = { stopped: 0, disconnected: 0, stop() { this.stopped++; fakeRenderer.tensorPlaybackMode = false; }, disconnectWebSocket() { this.disconnected++; } };
                const fakeBci = { adapter: {}, source: 'bci', disconnects: 0, async disconnect() { this.disconnects++; this.adapter = null; this.source = 'simulation'; } };
                const routineRenderer = { backendType: 'webgl', isRunning: true, params: {}, setParams() {} };
                const routine = new RoutinePlayer(routineRenderer, {}, {});
                let legacyEvents = 0, subscribedEvents = 0, noteEvents = 0;
                routine.onEvent = () => legacyEvents++;
                const unsubscribe = routine.subscribe((event) => { subscribedEvents++; if (event.type === 'session_note') noteEvents++; });
                const player = new SessionPlayer(fakeRenderer, fakeTensorPlayer, fakeBci, routine);
                await player.load(blob);
                player.seek(15550);
                const scrubValue = fakeRenderer.frames.at(-1)[12345];
                player.seek(0);
                player.play(1000);
                player.update(2050);
                player.pause();
                const pausedAt = player.playheadMs;
                player.update(5000);
                player.play(5000);
                player.update(5100);
                const resumedAt = player.playheadMs;
                player.stop();
                unsubscribe();

                const positiveChunks = [], zeroChunks = [];
                for (let i = 0; i < 8; i++) {
                    const fixture = new Float32Array(format.TENSOR_VALUE_COUNT).fill(i / 7);
                    positiveChunks.push({ type: 1, timestamp: i * 100, payload: format.encodeTensorPayload(fixture) });
                    positiveChunks.push({ type: 3, timestamp: i * 100, payload: format.encodeAudioPayload({ rms: i / 7, energy: i / 7 }) });
                    zeroChunks.push({ type: 1, timestamp: i * 100, payload: format.encodeTensorPayload(fixture) });
                    zeroChunks.push({ type: 3, timestamp: i * 100, payload: format.encodeAudioPayload({ rms: 0.5, energy: 0.5 }) });
                }
                const positive = analysisModule.analyzeSession(positiveChunks).pearsonRms;
                const zero = analysisModule.analyzeSession(zeroChunks).pearsonRms;

                class MemoryStore {
                    constructor({ rejectPut = false } = {}) { this.rows = []; this.rejectPut = rejectPut; this.cleared = false; }
                    async open() {}
                    async put(chunk) { if (this.rejectPut) throw new Error('quota'); this.rows.push(chunk); }
                    async getAll() { return this.rows; }
                    async clear() { this.cleared = true; this.rows = []; }
                    close() {}
                }
                const track = { stopped: false, stop() { this.stopped = true; } };
                const stream = { getTracks: () => [track] };
                class FakeAudioContext {
                    constructor() { this.state = 'running'; this.closed = false; }
                    createAnalyser() { return { fftSize: 512, frequencyBinCount: 256, smoothingTimeConstant: 0, getByteTimeDomainData(a) { a.fill(128); }, getByteFrequencyData(a) { a.fill(32); } }; }
                    createMediaStreamSource() { return { connect() {} }; }
                    async close() { this.closed = true; FakeAudioContext.closed = true; }
                }
                let clock = 1000;
                const stores = [];
                const recorder = new SessionRecorder({ getVoxelDataSnapshot: () => new Float32Array(format.TENSOR_VALUE_COUNT).fill(0.25) }, {
                    mediaDevices: { getUserMedia: async () => stream }, AudioContextClass: FakeAudioContext,
                    storeFactory: () => { const store = new MemoryStore(); stores.push(store); return store; }, now: () => clock,
                });
                await recorder.start({ audio: true, localOnly: true });
                let repeatedStartRejected = false;
                try { await recorder.start({ localOnly: true }); } catch { repeatedStartRejected = true; }
                recorder.update(clock);
                clock += 100;
                const recorded = await recorder.stop(clock);
                const recordedParsed = await format.parseSession(recorded);
                await recorder.start({ localOnly: true });
                await recorder.discard();

                let denied = false, unavailable = false, quota = false;
                let consentRequired = false, finalizationFailure = false, autoStop = false, droppedFrame = false;
                try {
                    const consentRecorder = new SessionRecorder(fakeRenderer, { storeFactory: () => new MemoryStore() });
                    await consentRecorder.start({ localOnly: false });
                } catch { consentRequired = true; }
                try {
                    const deniedRecorder = new SessionRecorder(fakeRenderer, { mediaDevices: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } }, storeFactory: () => new MemoryStore() });
                    await deniedRecorder.start({ camera: true, localOnly: true });
                } catch { denied = true; }
                try {
                    const unavailableRecorder = new SessionRecorder(fakeRenderer, { mediaDevices: null, storeFactory: () => new MemoryStore() });
                    await unavailableRecorder.start({ audio: true, localOnly: true });
                } catch { unavailable = true; }
                const quotaRecorder = new SessionRecorder({ getVoxelDataSnapshot: () => new Float32Array(format.TENSOR_VALUE_COUNT) }, { storeFactory: () => new MemoryStore({ rejectPut: true }), now: () => 0 });
                await quotaRecorder.start({ localOnly: true });
                quotaRecorder.update(0);
                await new Promise((resolve) => setTimeout(resolve, 0));
                try { await quotaRecorder.stop(100); } catch { quota = true; }
                class FinalizationStore extends MemoryStore { async getAll() { throw new Error('finalize'); } }
                const finalRecorder = new SessionRecorder({ getVoxelDataSnapshot: () => new Float32Array(format.TENSOR_VALUE_COUNT) }, { storeFactory: () => new FinalizationStore(), now: () => 0 });
                await finalRecorder.start({ localOnly: true });
                finalRecorder.update(0);
                await new Promise((resolve) => setTimeout(resolve, 0));
                try { await finalRecorder.stop(100); } catch { finalizationFailure = true; }
                const autoRecorder = new SessionRecorder(fakeRenderer, { storeFactory: () => new MemoryStore(), now: () => 0, onAutoStop: () => { autoStop = true; } });
                await autoRecorder.start({ localOnly: true });
                autoRecorder.update(300000);
                await autoRecorder.discard();
                const dropRecorder = new SessionRecorder(fakeRenderer, { storeFactory: () => new MemoryStore() });
                dropRecorder.state = 'recording';
                dropRecorder.store = new MemoryStore();
                dropRecorder.captureContext = { drawImage() { throw new Error('encode failed'); } };
                dropRecorder.video = {};
                dropRecorder.captureVisual(0);
                await Promise.allSettled([...dropRecorder.pending]);
                droppedFrame = dropRecorder.droppedFrames === 1;

                let badMagic = false, truncated = false, oversizedChunk = false;
                try { await format.parseSession(new TextEncoder().encode('BAD!0000').buffer); } catch { badMagic = true; }
                try { await format.parseSession((await blob.arrayBuffer()).slice(0, 20)); } catch { truncated = true; }
                const base = new Uint8Array(await format.serializeSession(manifest, []).arrayBuffer());
                const malformed = new Uint8Array(base.length + 13);
                malformed.set(base);
                const malformedView = new DataView(malformed.buffer);
                malformedView.setUint8(base.length, 2);
                malformedView.setFloat64(base.length + 1, 0, true);
                malformedView.setUint32(base.length + 9, format.MAX_CHUNK_BYTES + 1, true);
                try { await format.parseSession(malformed.buffer); } catch { oversizedChunk = true; }

                return {
                    counts: { tensor: tensors.length, audio: audios.length, visual: typed(2).length, note: typed(4).length },
                    monotonic, fidelity, samples: report.sampleCount, maxAlignment, csvEscaped: csv.includes('"comma, quote "" and\\nline"'),
                    scrubValue, pausedAt, resumedAt, noteEvents, legacyEvents, subscribedEvents,
                    playbackRestored: fakeRenderer.tensorPlaybackMode === false, bciDisconnects: fakeBci.disconnects,
                    positive, zero, repeatedStartRejected, trackStopped: track.stopped, audioClosed: FakeAudioContext.closed,
                    recordedTensorCount: recordedParsed.manifest.chunkCounts.tensor, denied, unavailable, quota,
                    consentRequired, finalizationFailure, autoStop, droppedFrame,
                    badMagic, truncated, oversizedChunk, tabPresent: Boolean(document.querySelector('#tab-session.active')),
                    overlaySynchronized, overlayUrlsBeforeStop, overlayUrlsAfterStop,
                };
            }""")

            assert result["counts"] == {"tensor": 301, "audio": 301, "visual": 301, "note": 1}, result
            assert result["monotonic"] is True, result
            assert abs(result["fidelity"][0]) < 1e-7 and abs(result["fidelity"][1] - 0.5) < 1e-6 and abs(result["fidelity"][2] - 1) < 1e-7, result
            assert result["samples"] == 301 and result["maxAlignment"] <= 50, result
            assert result["csvEscaped"] is True, result
            assert abs(result["scrubValue"] - (155 / 300)) < 0.01, result
            assert result["pausedAt"] == 1050 and result["resumedAt"] == 1150, result
            assert result["noteEvents"] == 1 and result["legacyEvents"] >= 1 and result["subscribedEvents"] >= 1, result
            assert result["playbackRestored"] is True and result["bciDisconnects"] == 1, result
            assert result["positive"] > 0.99 and abs(result["zero"]) < 1e-7, result
            for key in ["repeatedStartRejected", "trackStopped", "audioClosed", "denied", "unavailable", "quota", "consentRequired", "finalizationFailure", "autoStop", "droppedFrame", "badMagic", "truncated", "oversizedChunk", "tabPresent", "overlaySynchronized"]:
                assert result[key] is True, (key, result)
            assert result["recordedTensorCount"] == 1, result
            assert result["overlayUrlsBeforeStop"] == 1 and result["overlayUrlsAfterStop"] == 0, result

            hard_errors = [entry for entry in errors if "favicon" not in entry.lower() and "404" not in entry]
            if hard_errors:
                raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))
            browser.close()
            print("Double Mirror session verification passed.")
            print(result)
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    try:
        verify()
    except Exception as exc:
        print(f"verify_session failed: {exc}")
        sys.exit(1)

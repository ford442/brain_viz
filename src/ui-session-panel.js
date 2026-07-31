import { SessionRecorder } from './session-recorder.js';
import { SessionPlayer } from './session-player.js';
import { analyzeSession, sessionAnalysisToCsv } from './session-analysis.js';

const byId = (id) => document.getElementById(id);

function formatTime(ms) {
    const value = Math.max(0, ms || 0);
    const minutes = Math.floor(value / 60000).toString().padStart(2, '0');
    const seconds = ((value % 60000) / 1000).toFixed(1).padStart(4, '0');
    return `${minutes}:${seconds}`;
}

function drawHeatmap(canvas, analysis) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(1, ...analysis.heatmap.flat());
    const cell = canvas.width / 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const value = analysis.heatmap[y][x] / max;
        ctx.fillStyle = `rgb(${Math.round(255 * value)},${Math.round(80 + 175 * value)},${Math.round(140 + 115 * (1 - value))})`;
        ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
    }
    ctx.fillStyle = '#b7d8e8';
    ctx.font = '10px sans-serif';
    ctx.fillText('audio RMS + energy →', 6, 252);
    ctx.save();
    ctx.translate(10, 190);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('occipital activation →', 0, 0);
    ctx.restore();
}

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'session-playback-overlay';
    overlay.hidden = true;
    const image = document.createElement('img');
    image.id = 'session-playback-frame';
    image.alt = 'Synchronized session thumbnail';
    const caption = document.createElement('div');
    caption.id = 'session-playback-caption';
    const meter = document.createElement('div');
    meter.id = 'session-playback-audio';
    const fill = document.createElement('span');
    meter.appendChild(fill);
    overlay.append(image, caption, meter);
    document.body.appendChild(overlay);
    return { overlay, image, caption, fill };
}

export function setupSessionPanel(renderer, tensorPlayer, bciSession, routinePlayer, synaptixEngine) {
    const status = byId('session-status');
    const preview = byId('session-camera-preview');
    const scrubber = byId('session-scrubber');
    const time = byId('session-time');
    const overlay = createOverlay();
    let sessionBlob = null;
    let analysis = null;
    let frameUrl = null;
    const liveUrls = new Set();

    const revoke = (url) => {
        if (!url) return;
        URL.revokeObjectURL(url);
        liveUrls.delete(url);
    };
    const makeUrl = (blob) => {
        const url = URL.createObjectURL(blob);
        liveUrls.add(url);
        return url;
    };

    const updateFrame = (state) => {
        if (state.stopped) {
            overlay.overlay.hidden = true;
            overlay.image.removeAttribute('src');
            revoke(frameUrl);
            frameUrl = null;
            player.lastUiVisualIndex = -1;
            return;
        }
        overlay.overlay.hidden = false;
        if (state.visual && state.visualIndex !== player.lastUiVisualIndex) {
            overlay.image.removeAttribute('src');
            revoke(frameUrl);
            frameUrl = makeUrl(new Blob([state.visual.payload], { type: player.manifest?.streams?.visualMimeType || 'image/webp' }));
            overlay.image.src = frameUrl;
            player.lastUiVisualIndex = state.visualIndex;
        } else if (!state.visual) {
            revoke(frameUrl);
            frameUrl = null;
            overlay.image.removeAttribute('src');
            player.lastUiVisualIndex = -1;
        }
        overlay.caption.textContent = state.note ? `${state.note.mood ? `${state.note.mood}: ` : ''}${state.note.text}` : '';
        overlay.fill.style.width = `${Math.round(Math.max(0, Math.min(1, state.audio?.rms || state.audio?.energy || 0)) * 100)}%`;
        scrubber.value = state.playheadMs;
        time.textContent = `${formatTime(state.playheadMs)} / ${formatTime(state.durationMs)}`;
        byId('btn-session-play').textContent = state.isPlaying ? '❚❚' : '▶';
    };

    const player = new SessionPlayer(renderer, tensorPlayer, bciSession, routinePlayer, { onFrame: updateFrame, synaptixEngine });
    const stopRecording = async () => {
        if (recorder.state !== 'recording') return;
        status.textContent = 'Finalizing local session…';
        try {
            sessionBlob = await recorder.stop();
            byId('btn-session-download').disabled = false;
            status.textContent = `Ready to download · ${recorder.counts.tensor} tensor · ${recorder.counts.visual} visual · ${recorder.counts.audio} audio · ${recorder.counts.note} notes`;
        } catch (error) {
            status.textContent = error.message;
        } finally {
            preview.style.display = 'none';
            byId('btn-session-record').disabled = false;
            byId('btn-session-record-stop').disabled = true;
        }
    };
    const recorder = new SessionRecorder(renderer, { onAutoStop: stopRecording });

    byId('btn-session-record').addEventListener('click', async () => {
        const camera = byId('session-camera').checked;
        const audio = byId('session-audio').checked;
        byId('btn-session-record').disabled = true;
        sessionBlob = null;
        byId('btn-session-download').disabled = true;
        try {
            await recorder.start({ camera, audio, localOnly: byId('session-consent').checked, videoElement: preview });
            preview.style.display = camera ? 'block' : 'none';
            byId('btn-session-record-stop').disabled = false;
            status.textContent = `Recording tensor${camera ? ' + camera' : ''}${audio ? ' + audio features' : ''}…`;
        } catch (error) {
            byId('btn-session-record').disabled = false;
            status.textContent = `Recording not started: ${error.message}`;
        }
    });
    byId('btn-session-record-stop').addEventListener('click', stopRecording);
    byId('btn-session-note').addEventListener('click', async () => {
        try {
            await recorder.addNote(byId('session-note').value, byId('session-mood').value);
            byId('session-note').value = '';
            status.textContent = 'Timestamped note added';
        } catch (error) { status.textContent = error.message; }
    });
    byId('btn-session-download').addEventListener('click', () => {
        if (!sessionBlob) return;
        const url = makeUrl(sessionBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `neuro-weaver-${new Date().toISOString().replace(/[:.]/g, '-')}.nwsession`;
        link.click();
        setTimeout(() => revoke(url), 1000);
    });

    byId('session-file').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const parsed = await player.load(file);
            analysis = analyzeSession(parsed.chunks);
            drawHeatmap(byId('session-heatmap'), analysis);
            byId('session-analysis-summary').textContent = `${analysis.sampleCount} aligned samples · Pearson r (RMS) ${analysis.pearsonRms.toFixed(3)} · r (energy) ${analysis.pearsonEnergy.toFixed(3)}`;
            byId('btn-session-csv').disabled = analysis.sampleCount === 0;
            scrubber.max = player.durationMs;
            scrubber.disabled = false;
            ['btn-session-play', 'btn-session-pause', 'btn-session-stop'].forEach((id) => { byId(id).disabled = false; });
            status.textContent = `Loaded ${parsed.chunks.length} synchronized chunks`;
        } catch (error) { status.textContent = `Import rejected: ${error.message}`; }
        event.target.value = '';
    });
    byId('btn-session-play').addEventListener('click', () => player.isPlaying ? player.pause() : player.play());
    byId('btn-session-pause').addEventListener('click', () => player.pause());
    byId('btn-session-stop').addEventListener('click', () => player.stop());
    scrubber.addEventListener('input', () => player.seek(Number(scrubber.value)));
    byId('btn-session-csv').addEventListener('click', () => {
        if (!analysis) return;
        const url = makeUrl(new Blob([sessionAnalysisToCsv(analysis)], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'neuro-weaver-session-analysis.csv';
        link.click();
        setTimeout(() => revoke(url), 1000);
    });

    const unsubscribe = routinePlayer?.subscribe((event) => {
        if (event.type === 'session_note') overlay.caption.textContent = `${event.mood ? `${event.mood}: ` : ''}${event.text || ''}`;
    });
    window.addEventListener('beforeunload', () => {
        unsubscribe?.();
        recorder.discard();
        for (const url of liveUrls) URL.revokeObjectURL(url);
        liveUrls.clear();
    }, { once: true });

    const controller = {
        recorder,
        player,
        updatePlayback: (timestamp) => player.update(timestamp),
        updateRecording: (timestamp) => recorder.update(timestamp),
        getState: () => ({ recorderState: recorder.state, playerActive: player.active, isPlaying: player.isPlaying,
            playheadMs: player.playheadMs, durationMs: player.durationMs, counts: { ...recorder.counts }, liveObjectUrls: liveUrls.size }),
        analyze: (chunks) => analyzeSession(chunks),
    };
    window.__sessionDebug = controller;
    return controller;
}

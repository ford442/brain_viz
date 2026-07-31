import { SESSION_CHUNK_TYPES, decodeAudioPayload, decodeNotePayload, decodeTensorPayload, parseSession } from './session-format.js';

function latestIndexAtOrBefore(items, timestamp) {
    let low = 0, high = items.length - 1, result = -1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (items[mid].timestamp <= timestamp) { result = mid; low = mid + 1; }
        else high = mid - 1;
    }
    return result;
}

export class SessionPlayer {
    constructor(renderer, tensorPlayer, bciSession, routinePlayer, { onFrame = null, synaptixEngine = null } = {}) {
        this.renderer = renderer;
        this.tensorPlayer = tensorPlayer;
        this.bciSession = bciSession;
        this.routinePlayer = routinePlayer;
        this.synaptixEngine = synaptixEngine;
        this.onFrame = onFrame;
        this.manifest = null;
        this.chunks = [];
        this.streams = { tensor: [], visual: [], audio: [], note: [] };
        this.playheadMs = 0;
        this.isPlaying = false;
        this.active = false;
        this.wallOrigin = 0;
        this.noteCursor = 0;
        this.lastResolved = {};
        this.routinePlayer?.registerHandler('session_note', () => {});
    }

    async load(input) {
        const parsed = await parseSession(input);
        if (!parsed.chunks.some((chunk) => chunk.type === SESSION_CHUNK_TYPES.tensor)) throw new Error('Session contains no tensor frames');
        this.stop();
        this.tensorPlayer?.stop();
        this.tensorPlayer?.disconnectWebSocket?.();
        this.synaptixEngine?.pauseFrames?.();
        if (this.bciSession?.adapter || this.bciSession?.source === 'bci') await this.bciSession.disconnect();
        this.manifest = parsed.manifest;
        this.chunks = parsed.chunks;
        this.streams = {
            tensor: parsed.chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.tensor),
            visual: parsed.chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.visual),
            audio: parsed.chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.audio),
            note: parsed.chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.note),
        };
        this.playheadMs = 0;
        this.noteCursor = 0;
        this.lastResolved = {};
        this.active = true;
        this.renderer.tensorPlaybackMode = true;
        this.resolve(false);
        return parsed;
    }

    play(timestamp = performance.now()) {
        if (!this.manifest) throw new Error('Load a session before playback');
        if (this.playheadMs >= this.durationMs) this.seek(0);
        this.active = true;
        this.renderer.tensorPlaybackMode = true;
        this.resolve(false);
        this.wallOrigin = timestamp - this.playheadMs;
        this.isPlaying = true;
    }

    pause() {
        this.isPlaying = false;
    }

    seek(ms) {
        if (!this.manifest) return;
        this.playheadMs = Math.max(0, Math.min(this.durationMs, Number(ms) || 0));
        this.noteCursor = this.streams.note.findIndex((chunk) => chunk.timestamp > this.playheadMs);
        if (this.noteCursor < 0) this.noteCursor = this.streams.note.length;
        if (this.active) this.resolve(false);
        if (this.isPlaying) this.wallOrigin = performance.now() - this.playheadMs;
    }

    stop() {
        this.isPlaying = false;
        this.active = false;
        this.playheadMs = 0;
        this.lastResolved = {};
        if (this.renderer) this.renderer.tensorPlaybackMode = false;
        this.onFrame?.({ stopped: true, playheadMs: 0, durationMs: this.durationMs });
    }

    update(timestamp = performance.now()) {
        if (!this.active) return;
        const previous = this.playheadMs;
        if (this.isPlaying) this.playheadMs = Math.min(this.durationMs, Math.max(0, timestamp - this.wallOrigin));
        this.dispatchForwardNotes(previous, this.playheadMs);
        this.resolve(true);
        if (this.isPlaying && this.playheadMs >= this.durationMs) this.pause();
    }

    dispatchForwardNotes(previous, current) {
        if (current < previous) return;
        while (this.noteCursor < this.streams.note.length && this.streams.note[this.noteCursor].timestamp <= current) {
            const chunk = this.streams.note[this.noteCursor++];
            if (chunk.timestamp > previous) this.routinePlayer?.executeEvent({ type: 'session_note', timestamp: chunk.timestamp, ...decodeNotePayload(chunk.payload) });
        }
    }

    resolve() {
        const tensorIndex = latestIndexAtOrBefore(this.streams.tensor, this.playheadMs);
        const visualIndex = latestIndexAtOrBefore(this.streams.visual, this.playheadMs);
        const audioIndex = latestIndexAtOrBefore(this.streams.audio, this.playheadMs);
        const noteIndex = latestIndexAtOrBefore(this.streams.note, this.playheadMs);
        if (tensorIndex >= 0 && tensorIndex !== this.lastResolved.tensorIndex) {
            this.renderer.setVoxelData(decodeTensorPayload(this.streams.tensor[tensorIndex].payload));
        }
        this.lastResolved = { tensorIndex, visualIndex, audioIndex, noteIndex };
        this.onFrame?.({
            playheadMs: this.playheadMs,
            durationMs: this.durationMs,
            tensorIndex,
            visualIndex,
            visual: visualIndex >= 0 ? this.streams.visual[visualIndex] : null,
            audio: audioIndex >= 0 ? decodeAudioPayload(this.streams.audio[audioIndex].payload) : null,
            note: noteIndex >= 0 ? decodeNotePayload(this.streams.note[noteIndex].payload) : null,
            isPlaying: this.isPlaying,
        });
    }

    get durationMs() {
        return Number(this.manifest?.durationMs) || 0;
    }
}

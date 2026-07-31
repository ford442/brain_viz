import {
    NWS_MAGIC, SESSION_CHUNK_TYPES, encodeAudioPayload, encodeNotePayload,
    encodeTensorPayload, serializeSession,
} from './session-format.js';

const SAMPLE_INTERVAL_MS = 100;
const MAX_DURATION_MS = 5 * 60 * 1000;

class TemporarySessionStore {
    constructor(indexedDBImpl = globalThis.indexedDB) {
        this.indexedDB = indexedDBImpl;
        this.db = null;
        this.sessionId = '';
    }

    async open(sessionId) {
        if (!this.indexedDB) throw new Error('IndexedDB is unavailable; local session recording cannot start');
        this.sessionId = sessionId;
        this.db = await new Promise((resolve, reject) => {
            const request = this.indexedDB.open('neuro-weaver-session-temp', 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('chunks')) {
                    const store = request.result.createObjectStore('chunks', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sessionId', 'sessionId');
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open session storage'));
        });
    }

    transaction(mode, action) {
        if (!this.db) return Promise.reject(new Error('Session storage is closed'));
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('chunks', mode);
            const store = transaction.objectStore('chunks');
            let result;
            try { result = action(store); } catch (error) { reject(error); return; }
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error || new Error('Session storage transaction failed'));
            transaction.onabort = () => reject(transaction.error || new Error('Session storage transaction aborted'));
        });
    }

    put(chunk) {
        return this.transaction('readwrite', (store) => store.add({ sessionId: this.sessionId, ...chunk }));
    }

    async getAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('chunks', 'readonly');
            const index = transaction.objectStore('chunks').index('sessionId');
            const request = index.getAll(this.sessionId);
            request.onsuccess = () => resolve(request.result.map(({ id, sessionId, ...chunk }) => chunk));
            request.onerror = () => reject(request.error || new Error('Could not finalize session chunks'));
        });
    }

    async clear() {
        if (!this.db) return;
        await new Promise((resolve, reject) => {
            const transaction = this.db.transaction('chunks', 'readwrite');
            const store = transaction.objectStore('chunks');
            const index = store.index('sessionId');
            const request = index.openKeyCursor(globalThis.IDBKeyRange.only(this.sessionId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                store.delete(cursor.primaryKey);
                cursor.continue();
            };
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('Could not clear temporary chunks'));
        });
    }

    close() {
        this.db?.close();
        this.db = null;
    }
}

function canvasToBlob(canvas, mimeType) {
    return new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.72));
}

export class SessionRecorder {
    constructor(renderer, {
        mediaDevices = globalThis.navigator?.mediaDevices,
        AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
        storeFactory = () => new TemporarySessionStore(),
        now = () => performance.now(),
        onAutoStop = null,
    } = {}) {
        this.renderer = renderer;
        this.mediaDevices = mediaDevices;
        this.AudioContextClass = AudioContextClass;
        this.storeFactory = storeFactory;
        this.now = now;
        this.onAutoStop = onAutoStop;
        this.state = 'idle';
        this.store = null;
        this.stream = null;
        this.audioContext = null;
        this.analyser = null;
        this.audioTimeData = null;
        this.audioFreqData = null;
        this.video = null;
        this.captureCanvas = null;
        this.captureContext = null;
        this.origin = 0;
        this.lastTick = -Infinity;
        this.pending = new Set();
        this.counts = { tensor: 0, visual: 0, audio: 0, note: 0 };
        this.droppedFrames = 0;
        this.consent = null;
        this.visualMimeType = null;
        this.storageError = null;
        this.captureError = null;
    }

    async start({ camera = false, audio = false, localOnly = false, videoElement = null } = {}) {
        if (this.state !== 'idle') throw new Error('A session recording is already active');
        if (!localOnly) throw new Error('Local-only consent is required before recording');
        if ((camera || audio) && !this.mediaDevices?.getUserMedia) throw new Error('Selected media capture APIs are unavailable');
        this.state = 'starting';
        this.consent = { camera: Boolean(camera), audio: Boolean(audio), localOnly: true };
        this.counts = { tensor: 0, visual: 0, audio: 0, note: 0 };
        this.droppedFrames = 0;
        this.visualMimeType = null;
        this.storageError = null;
        this.captureError = null;
        this.store = this.storeFactory();
        try {
            await this.store.open(`session-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            if (camera || audio) this.stream = await this.mediaDevices.getUserMedia({ video: camera, audio });
            if (camera) this.setupCamera(videoElement);
            if (audio) await this.setupAudio();
            this.origin = this.now();
            this.lastTick = -Infinity;
            this.state = 'recording';
            return true;
        } catch (error) {
            await this.cleanup(true);
            this.state = 'idle';
            throw error;
        }
    }

    setupCamera(videoElement) {
        this.video = videoElement || document.createElement('video');
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = this.stream;
        Promise.resolve(this.video.play()).catch(() => {});
        this.captureCanvas = document.createElement('canvas');
        this.captureCanvas.width = 320;
        this.captureCanvas.height = 180;
        this.captureContext = this.captureCanvas.getContext('2d', { alpha: false });
        if (!this.captureContext) throw new Error('Camera thumbnail canvas is unavailable');
    }

    async setupAudio() {
        if (!this.AudioContextClass) throw new Error('Web Audio API is unavailable');
        this.audioContext = new this.AudioContextClass();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.analyser.smoothingTimeConstant = 0.5;
        this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
        this.audioTimeData = new Uint8Array(this.analyser.fftSize);
        this.audioFreqData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    update(timestamp = this.now()) {
        if (this.state !== 'recording') return;
        const relativeTimestamp = Math.max(0, timestamp - this.origin);
        if (relativeTimestamp >= MAX_DURATION_MS) {
            this.onAutoStop?.();
            return;
        }
        if (relativeTimestamp - this.lastTick < SAMPLE_INTERVAL_MS - 0.01) return;
        this.lastTick = relativeTimestamp;
        this.captureTensor(relativeTimestamp);
        if (this.analyser) this.persist({ type: SESSION_CHUNK_TYPES.audio, timestamp: relativeTimestamp, payload: encodeAudioPayload(this.readAudioFeatures()) }, 'audio');
        if (this.captureContext) this.captureVisual(relativeTimestamp);
    }

    captureTensor(timestamp) {
        const task = Promise.resolve(this.renderer.getVoxelDataSnapshot()).then((tensor) =>
            this.persist({ type: SESSION_CHUNK_TYPES.tensor, timestamp, payload: encodeTensorPayload(tensor) }, 'tensor')
        ).catch((error) => {
            this.captureError = error;
            throw error;
        });
        this.pending.add(task);
        task.finally(() => this.pending.delete(task)).catch(() => {});
    }

    readAudioFeatures() {
        this.analyser.getByteTimeDomainData(this.audioTimeData);
        this.analyser.getByteFrequencyData(this.audioFreqData);
        let squareSum = 0, bass = 0, weighted = 0, energy = 0;
        const bassBins = Math.max(1, Math.floor(this.audioFreqData.length * 0.1));
        for (const value of this.audioTimeData) squareSum += ((value - 128) / 128) ** 2;
        for (let i = 0; i < this.audioFreqData.length; i++) {
            const value = this.audioFreqData[i] / 255;
            energy += value;
            weighted += value * (i / Math.max(1, this.audioFreqData.length - 1));
            if (i < bassBins) bass += value;
        }
        const normalizedEnergy = energy / Math.max(1, this.audioFreqData.length);
        const onset = Math.max(0, normalizedEnergy - (this.previousEnergy || 0)) * 4;
        this.previousEnergy = normalizedEnergy;
        return {
            rms: Math.min(1, Math.sqrt(squareSum / this.audioTimeData.length)),
            bass: bass / bassBins,
            energy: normalizedEnergy,
            brightness: energy > 0 ? weighted / energy : 0,
            onset: Math.min(1, onset),
        };
    }

    captureVisual(timestamp) {
        const task = (async () => {
            try {
                this.captureContext.drawImage(this.video, 0, 0, 320, 180);
                let mimeType = 'image/webp';
                let blob = await canvasToBlob(this.captureCanvas, mimeType);
                if (!blob || blob.type !== mimeType) {
                    mimeType = 'image/jpeg';
                    blob = await canvasToBlob(this.captureCanvas, mimeType);
                }
                if (!blob) throw new Error('Thumbnail encoding returned no data');
                this.visualMimeType = mimeType;
                await this.persist({ type: SESSION_CHUNK_TYPES.visual, timestamp, payload: new Uint8Array(await blob.arrayBuffer()) }, 'visual');
            } catch (error) {
                this.droppedFrames++;
                console.warn('[Session] Dropped camera thumbnail:', error);
            }
        })();
        this.pending.add(task);
        task.finally(() => this.pending.delete(task));
    }

    persist(chunk, countKey) {
        const task = this.store.put(chunk).then(() => { this.counts[countKey]++; }).catch((error) => {
            this.storageError = error;
            throw error;
        });
        this.pending.add(task);
        task.finally(() => this.pending.delete(task)).catch(() => {});
        return task;
    }

    addNote(text, mood = '', timestamp = this.now()) {
        if (this.state !== 'recording') throw new Error('Start recording before adding a note');
        const cleanText = String(text || '').trim();
        if (!cleanText) throw new Error('Note text is required');
        const relativeTimestamp = Math.max(0, timestamp - this.origin);
        return this.persist({ type: SESSION_CHUNK_TYPES.note, timestamp: relativeTimestamp, payload: encodeNotePayload({ text: cleanText, mood }) }, 'note');
    }

    async stop(timestamp = this.now()) {
        if (this.state !== 'recording') throw new Error('No session recording is active');
        this.state = 'finalizing';
        const durationMs = Math.min(MAX_DURATION_MS, Math.max(0, timestamp - this.origin));
        try {
            await Promise.all([...this.pending]);
            if (this.storageError) throw this.storageError;
            if (this.captureError) throw this.captureError;
            const chunks = await this.store.getAll();
            const manifest = {
                format: NWS_MAGIC,
                app: { name: 'Neuro-Weaver', version: '2.8' },
                createdAt: new Date().toISOString(),
                durationMs,
                tensor: { shape: [32, 32, 32], dtype: 'float32-le' },
                streams: { tensorHz: 10, cameraHz: this.consent.camera ? 10 : 0, audioHz: this.consent.audio ? 10 : 0, visualMimeType: this.visualMimeType },
                consent: this.consent,
                droppedFrames: { visual: this.droppedFrames },
                chunkCounts: { ...this.counts },
            };
            const blob = serializeSession(manifest, chunks);
            await this.cleanup(true);
            this.state = 'idle';
            return blob;
        } catch (error) {
            await this.cleanup(true);
            this.state = 'idle';
            throw new Error(`Session finalization failed: ${error.message}`);
        }
    }

    async discard() {
        await Promise.allSettled([...this.pending]);
        await this.cleanup(true);
        this.state = 'idle';
    }

    async cleanup(clearStore) {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        if (this.video) this.video.srcObject = null;
        if (this.audioContext) await Promise.resolve(this.audioContext.close()).catch(() => {});
        this.audioContext = null;
        this.analyser = null;
        if (clearStore && this.store) await this.store.clear().catch(() => {});
        this.store?.close();
        this.store = null;
    }
}

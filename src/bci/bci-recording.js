const MAGIC = new TextEncoder().encode('NWB1');
const CHUNK_TYPES = Object.freeze({ raw: 1, motion: 2, features: 3, tensor: 4 });

function encodeChunk(type, timestamp, payload) {
    const bytes = payload instanceof Uint8Array
        ? payload
        : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    const result = new Uint8Array(13 + bytes.byteLength);
    const view = new DataView(result.buffer);
    view.setUint8(0, type);
    view.setFloat64(1, timestamp, true);
    view.setUint32(9, bytes.byteLength, true);
    result.set(bytes, 13);
    return result;
}

function openDatabase(name) {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('chunks', { autoIncrement: true });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export class BCIRecorder {
    constructor() {
        this.active = false;
        this.metadata = null;
        this.memoryChunks = [];
        this.db = null;
        this.dbName = null;
        this.pending = Promise.resolve();
        this.lastBlob = null;
    }

    async start(metadata = {}) {
        await this.discard();
        this.active = true;
        this.metadata = {
            version: 1,
            createdAt: new Date().toISOString(),
            ...metadata,
        };
        this.dbName = `neuro-weaver-bci-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        try {
            this.db = await openDatabase(this.dbName);
        } catch (error) {
            console.warn('[BCI] IndexedDB unavailable; recording in memory', error);
            this.db = null;
        }
    }

    appendRaw(batch) {
        const channelCount = batch.channels.length;
        const sampleCount = batch.samples[0]?.length || 0;
        const flat = new Float32Array(2 + channelCount + channelCount * sampleCount);
        flat[0] = channelCount;
        flat[1] = sampleCount;
        for (let i = 0; i < channelCount; i++) {
            flat[2 + i] = Math.max(0, (this.metadata?.channels || batch.channels).indexOf(batch.channels[i]));
        }
        let offset = 2 + channelCount;
        for (const channel of batch.samples) {
            flat.set(channel, offset);
            offset += sampleCount;
        }
        this._append(encodeChunk(CHUNK_TYPES.raw, batch.timestamp, flat));
        if (batch.motion) {
            this._append(encodeChunk(CHUNK_TYPES.motion, batch.timestamp,
                new Float32Array([batch.motion.x, batch.motion.y, batch.motion.z])));
        }
    }

    appendFeatures(features) {
        const json = JSON.stringify({
            bands: features.bands,
            rawBands: features.rawBands,
            quality: features.quality,
            channels: features.channels,
            motion: features.motion,
        });
        this._append(encodeChunk(CHUNK_TYPES.features, features.timestamp, new TextEncoder().encode(json)));
    }

    appendTensor(timestamp, tensor) {
        this._append(encodeChunk(CHUNK_TYPES.tensor, timestamp, tensor));
    }

    async stop() {
        if (!this.active) return this.lastBlob;
        this.active = false;
        await this.pending;
        const chunks = await this._readChunks();
        const header = new TextEncoder().encode(JSON.stringify(this.metadata));
        const prefix = new Uint8Array(8 + header.length);
        prefix.set(MAGIC, 0);
        new DataView(prefix.buffer).setUint32(4, header.length, true);
        prefix.set(header, 8);
        this.lastBlob = new Blob([prefix, ...chunks], { type: 'application/octet-stream' });
        return this.lastBlob;
    }

    async discard() {
        this.active = false;
        await this.pending.catch(() => {});
        this.memoryChunks = [];
        this.metadata = null;
        this.lastBlob = null;
        if (this.db) this.db.close();
        if (this.dbName && globalThis.indexedDB) indexedDB.deleteDatabase(this.dbName);
        this.db = null;
        this.dbName = null;
        this.pending = Promise.resolve();
    }

    _append(chunk) {
        if (!this.active) return;
        if (!this.db) {
            this.memoryChunks.push(chunk);
            return;
        }
        this.pending = this.pending.then(() => new Promise((resolve, reject) => {
            const tx = this.db.transaction('chunks', 'readwrite');
            tx.objectStore('chunks').add(chunk);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        })).catch((error) => console.warn('[BCI] Could not store recording chunk', error));
    }

    async _readChunks() {
        if (!this.db) return this.memoryChunks;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('chunks', 'readonly');
            const request = tx.objectStore('chunks').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    static async parse(input) {
        const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (new TextDecoder().decode(bytes.subarray(0, 4)) !== 'NWB1') throw new Error('Invalid NWBCI recording');
        const view = new DataView(buffer);
        const headerLength = view.getUint32(4, true);
        const metadata = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength)));
        const chunks = [];
        let offset = 8 + headerLength;
        while (offset + 13 <= bytes.length) {
            const type = view.getUint8(offset);
            const timestamp = view.getFloat64(offset + 1, true);
            const length = view.getUint32(offset + 9, true);
            const payload = bytes.slice(offset + 13, offset + 13 + length);
            chunks.push({ type, timestamp, payload });
            offset += 13 + length;
        }
        return { metadata, chunks };
    }
}

export { CHUNK_TYPES };

// [Neuro-Weaver] Dependency-free Double Mirror session envelope (NWS1).
//
// [Field Resolution] Tensor chunks are dim-specific: a 32³ chunk read as 64³
// is not a coarse session, it is 8× short. The dimension therefore travels in
// the manifest (`tensor.shape`, which NWS1 has always carried) and every
// codec entry point takes it explicitly. Files written before the field was
// resolution-aware declare `[32, 32, 32]` and keep loading unchanged — the
// magic does not need a bump, because the old shape is still a valid one.
import { DEFAULT_VOXEL_DIM, assertVoxelDim, voxelCountFor } from './voxel-dim.js';

export const NWS_MAGIC = 'NWS1';
export const MAX_SESSION_BYTES = 512 * 1024 * 1024;
export const MAX_MANIFEST_BYTES = 1024 * 1024;
export const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
/**
 * Values in a default-resolution (32³) tensor chunk. Retained as a named
 * export for callers that only ever deal with the default grid; anything that
 * can see more than one resolution should use `tensorValueCountFor(dim)`.
 */
export const TENSOR_VALUE_COUNT = voxelCountFor(DEFAULT_VOXEL_DIM);

/**
 * Values in a `dim³` tensor chunk.
 * @param {number} dim
 * @returns {number}
 */
export function tensorValueCountFor(dim) {
    return voxelCountFor(assertVoxelDim(dim, 'NWS1 tensor dimension'));
}

/**
 * Reads the voxel dimension out of a parsed NWS1 manifest, rejecting anything
 * that is not a supported cubic grid.
 *
 * @param {any} manifest
 * @returns {number}
 */
export function manifestVoxelDim(manifest) {
    const shape = manifest?.tensor?.shape;
    if (!Array.isArray(shape) || shape.length !== 3) {
        throw new Error('Unsupported session manifest: tensor.shape must be [d, d, d]');
    }
    const [dx, dy, dz] = shape;
    if (dx !== dy || dy !== dz) {
        throw new Error(`Unsupported session manifest: non-cubic tensor shape ${shape.join('x')}`);
    }
    return assertVoxelDim(dx, 'NWS1 manifest tensor.shape');
}

export const SESSION_CHUNK_TYPES = Object.freeze({
    tensor: 1,
    visual: 2,
    audio: 3,
    note: 4,
});

const HEADER_BYTES = 8;
const CHUNK_HEADER_BYTES = 13;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function asBytes(payload) {
    if (payload instanceof Uint8Array) return payload;
    if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
    if (ArrayBuffer.isView(payload)) return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    throw new TypeError('Session chunk payload must be binary');
}

/**
 * @param {Float32Array} tensor
 * @param {number} [voxelDim] - Grid the tensor was captured at.
 */
export function encodeTensorPayload(tensor, voxelDim = DEFAULT_VOXEL_DIM) {
    const expected = tensorValueCountFor(voxelDim);
    if (!(tensor instanceof Float32Array) || tensor.length !== expected) {
        throw new Error(`Tensor chunks require ${expected} float32 values at ${voxelDim}³`);
    }
    const bytes = new Uint8Array(tensor.byteLength);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < tensor.length; i++) view.setFloat32(i * 4, tensor[i], true);
    return bytes;
}

/**
 * @param {ArrayBufferView|ArrayBuffer} payload
 * @param {number} [voxelDim] - Grid the chunk was written at (from the manifest).
 */
export function decodeTensorPayload(payload, voxelDim = DEFAULT_VOXEL_DIM) {
    const expected = tensorValueCountFor(voxelDim);
    const bytes = asBytes(payload);
    if (bytes.byteLength !== expected * 4) throw new Error('Invalid tensor payload length');
    const tensor = new Float32Array(expected);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < tensor.length; i++) tensor[i] = view.getFloat32(i * 4, true);
    return tensor;
}

export function encodeAudioPayload(features) {
    const bytes = new Uint8Array(20);
    const view = new DataView(bytes.buffer);
    ['rms', 'bass', 'energy', 'brightness', 'onset'].forEach((key, i) => {
        const value = Number(features?.[key]);
        view.setFloat32(i * 4, Number.isFinite(value) ? value : 0, true);
    });
    return bytes;
}

export function decodeAudioPayload(payload) {
    const bytes = asBytes(payload);
    if (bytes.byteLength !== 20) throw new Error('Invalid audio feature payload length');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const values = ['rms', 'bass', 'energy', 'brightness', 'onset'].map((_, i) => view.getFloat32(i * 4, true));
    return Object.fromEntries(['rms', 'bass', 'energy', 'brightness', 'onset'].map((key, i) => [key, values[i]]));
}

export function encodeNotePayload(note) {
    return encoder.encode(JSON.stringify({ text: String(note?.text || ''), ...(note?.mood ? { mood: String(note.mood) } : {}) }));
}

export function decodeNotePayload(payload) {
    let note;
    try { note = JSON.parse(decoder.decode(asBytes(payload))); } catch { throw new Error('Invalid note JSON payload'); }
    if (!note || typeof note.text !== 'string' || (note.mood !== undefined && typeof note.mood !== 'string')) {
        throw new Error('Invalid note payload');
    }
    return { text: note.text, ...(note.mood ? { mood: note.mood } : {}) };
}

export function serializeSession(manifest, chunks) {
    const manifestBytes = encoder.encode(JSON.stringify(manifest));
    if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error('Session manifest is too large');
    const ordered = [...chunks].sort((a, b) => a.timestamp - b.timestamp || a.type - b.type);
    let total = HEADER_BYTES + manifestBytes.byteLength;
    for (const chunk of ordered) {
        const payload = asBytes(chunk.payload);
        if (!Object.values(SESSION_CHUNK_TYPES).includes(chunk.type)) throw new Error('Unknown session chunk type');
        if (!Number.isFinite(chunk.timestamp) || chunk.timestamp < 0) throw new Error('Invalid session timestamp');
        if (payload.byteLength > MAX_CHUNK_BYTES) throw new Error('Session chunk is too large');
        total += CHUNK_HEADER_BYTES + payload.byteLength;
    }
    if (total > MAX_SESSION_BYTES) throw new Error('Session exceeds the 512 MB limit');
    const output = new Uint8Array(total);
    output.set(encoder.encode(NWS_MAGIC), 0);
    const view = new DataView(output.buffer);
    view.setUint32(4, manifestBytes.byteLength, true);
    output.set(manifestBytes, HEADER_BYTES);
    let offset = HEADER_BYTES + manifestBytes.byteLength;
    for (const chunk of ordered) {
        const payload = asBytes(chunk.payload);
        view.setUint8(offset, chunk.type);
        view.setFloat64(offset + 1, chunk.timestamp, true);
        view.setUint32(offset + 9, payload.byteLength, true);
        output.set(payload, offset + CHUNK_HEADER_BYTES);
        offset += CHUNK_HEADER_BYTES + payload.byteLength;
    }
    return new Blob([output], { type: 'application/x-neuro-weaver-session' });
}

export async function parseSession(input) {
    const size = input instanceof Blob ? input.size : input?.byteLength;
    if (!Number.isFinite(size) || size > MAX_SESSION_BYTES) throw new Error('Session exceeds the 512 MB limit');
    const buffer = input instanceof Blob ? await input.arrayBuffer() : input;
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < HEADER_BYTES) throw new Error('Truncated session header');
    const bytes = new Uint8Array(buffer);
    if (decoder.decode(bytes.subarray(0, 4)) !== NWS_MAGIC) throw new Error('Unknown session magic or version');
    const view = new DataView(buffer);
    const manifestLength = view.getUint32(4, true);
    if (manifestLength > MAX_MANIFEST_BYTES) throw new Error('Session manifest is too large');
    if (HEADER_BYTES + manifestLength > bytes.byteLength) throw new Error('Truncated session manifest');
    let manifest;
    try { manifest = JSON.parse(decoder.decode(bytes.subarray(HEADER_BYTES, HEADER_BYTES + manifestLength))); }
    catch { throw new Error('Invalid session manifest'); }
    if (manifest?.format !== NWS_MAGIC || manifest?.tensor?.dtype !== 'float32-le') {
        throw new Error('Unsupported session manifest');
    }
    // [Field Resolution] Throws on a shape this build cannot step. Old 32³
    // sessions land here unchanged.
    const voxelDim = manifestVoxelDim(manifest);
    const tensorPayloadBytes = voxelCountFor(voxelDim) * 4;
    if (!Number.isFinite(manifest.durationMs) || manifest.durationMs < 0 || manifest.durationMs > 5 * 60 * 1000) {
        throw new Error('Invalid session duration');
    }
    const chunks = [];
    let offset = HEADER_BYTES + manifestLength;
    while (offset < bytes.byteLength) {
        if (offset + CHUNK_HEADER_BYTES > bytes.byteLength) throw new Error('Truncated session chunk header');
        const type = view.getUint8(offset);
        const timestamp = view.getFloat64(offset + 1, true);
        const payloadLength = view.getUint32(offset + 9, true);
        if (!Object.values(SESSION_CHUNK_TYPES).includes(type)) throw new Error('Unknown session chunk type');
        if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('Invalid session timestamp');
        if (timestamp > manifest.durationMs + 0.01) throw new Error('Session timestamp exceeds duration');
        if (payloadLength > MAX_CHUNK_BYTES) throw new Error('Session chunk is too large');
        const payloadStart = offset + CHUNK_HEADER_BYTES;
        if (payloadStart + payloadLength > bytes.byteLength) throw new Error('Truncated session chunk payload');
        const payload = bytes.slice(payloadStart, payloadStart + payloadLength);
        if (type === SESSION_CHUNK_TYPES.tensor && payloadLength !== tensorPayloadBytes) throw new Error('Invalid tensor payload length');
        if (type === SESSION_CHUNK_TYPES.audio && payloadLength !== 20) throw new Error('Invalid audio feature payload length');
        if (type === SESSION_CHUNK_TYPES.note) decodeNotePayload(payload);
        chunks.push({ type, timestamp, payload });
        offset = payloadStart + payloadLength;
    }
    chunks.sort((a, b) => a.timestamp - b.timestamp || a.type - b.type);
    if (manifest.chunkCounts) {
        const actual = { tensor: 0, visual: 0, audio: 0, note: 0 };
        const names = Object.fromEntries(Object.entries(SESSION_CHUNK_TYPES).map(([name, type]) => [type, name]));
        for (const chunk of chunks) actual[names[chunk.type]]++;
        for (const name of Object.keys(actual)) {
            if (Number(manifest.chunkCounts[name] || 0) !== actual[name]) throw new Error('Session chunk counts do not match manifest');
        }
    }
    return { manifest, chunks, voxelDim };
}

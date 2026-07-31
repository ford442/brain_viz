import { SESSION_CHUNK_TYPES, decodeAudioPayload, decodeNotePayload, decodeTensorPayload } from './session-format.js';
import { getAnatomicalRegionMeans } from './synaptix-coupling.js';

export function pearsonCorrelation(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return 0;
    const mx = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const my = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    let covariance = 0, vx = 0, vy = 0;
    for (let i = 0; i < xs.length; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        covariance += dx * dy;
        vx += dx * dx;
        vy += dy * dy;
    }
    return vx > 0 && vy > 0 ? covariance / Math.sqrt(vx * vy) : 0;
}

function latestAtOrBefore(items, timestamp) {
    let result = null;
    for (const item of items) {
        if (item.timestamp > timestamp) break;
        result = item;
    }
    return result;
}

export function analyzeSession(chunks, maxAlignmentMs = 50) {
    const tensors = chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.tensor);
    const audio = chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.audio);
    const notes = chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.note);
    const visuals = chunks.filter((chunk) => chunk.type === SESSION_CHUNK_TYPES.visual);
    const tensorValues = tensors.map((chunk) => ({ ...chunk, occipital: getAnatomicalRegionMeans(decodeTensorPayload(chunk.payload)).occipital }));
    const pairs = [];
    for (const sample of audio) {
        let nearest = null;
        for (const tensor of tensorValues) {
            const error = Math.abs(tensor.timestamp - sample.timestamp);
            if (!nearest || error < nearest.error) nearest = { tensor, error };
        }
        if (!nearest || nearest.error > maxAlignmentMs) continue;
        const note = latestAtOrBefore(notes, sample.timestamp);
        const visual = latestAtOrBefore(visuals, sample.timestamp);
        pairs.push({
            timestamp: sample.timestamp,
            ...decodeAudioPayload(sample.payload),
            occipitalActivation: nearest.tensor.occipital,
            alignmentErrorMs: nearest.error,
            note: note ? decodeNotePayload(note.payload) : { text: '', mood: '' },
            visualFrameIndex: visual ? visuals.indexOf(visual) : -1,
        });
    }
    const rms = pairs.map((pair) => pair.rms);
    const energy = pairs.map((pair) => pair.energy);
    const occipital = pairs.map((pair) => pair.occipitalActivation);
    const grid = Array.from({ length: 16 }, () => Array(16).fill(0));
    for (const pair of pairs) {
        const audioAxis = Math.max(0, Math.min(15, Math.floor(((pair.rms + pair.energy) * 0.5) * 16)));
        const brainAxis = Math.max(0, Math.min(15, Math.floor(pair.occipitalActivation * 16)));
        grid[15 - brainAxis][audioAxis]++;
    }
    return {
        pairs,
        heatmap: grid,
        sampleCount: pairs.length,
        pearsonRms: pearsonCorrelation(rms, occipital),
        pearsonEnergy: pearsonCorrelation(energy, occipital),
    };
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function sessionAnalysisToCsv(analysis) {
    const columns = ['time_ms', 'rms', 'bass', 'energy', 'brightness', 'onset', 'occipital_activation', 'active_note', 'mood', 'visual_frame_index', 'alignment_error_ms'];
    const rows = analysis.pairs.map((pair) => [
        pair.timestamp, pair.rms, pair.bass, pair.energy, pair.brightness, pair.onset,
        pair.occipitalActivation, pair.note.text, pair.note.mood || '', pair.visualFrameIndex, pair.alignmentErrorMs,
    ].map(csvCell).join(','));
    return [columns.join(','), ...rows].join('\r\n');
}

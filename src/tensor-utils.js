export class Tensor {
    constructor(data, shape) {
        if (!(data instanceof Float32Array)) {
            throw new Error("Data must be a Float32Array");
        }
        if (!Array.isArray(shape) || shape.some(d => !Number.isInteger(d) || d <= 0)) {
            throw new Error("Shape must be an array of positive integers");
        }

        const shapeSize = shape.reduce((a, b) => a * b, 1);
        if (data.length !== shapeSize) {
            throw new Error(`Data length (${data.length}) does not match shape size (${shapeSize})`);
        }

        this.data = data;
        this.shape = shape;
    }

    get size() {
        return this.data.length;
    }

    reshape(newShape) {
        if (!Array.isArray(newShape) || newShape.some(d => !Number.isInteger(d) || d <= 0)) {
            throw new Error("New shape must be an array of positive integers");
        }
        const newSize = newShape.reduce((a, b) => a * b, 1);
        if (newSize !== this.size) {
            throw new Error(`New shape size (${newSize}) does not match current size (${this.size})`);
        }
        return new Tensor(this.data, newShape);
    }

    normalize(min = 0, max = 1) {
        const currentMin = this.data.reduce((a, b) => Math.min(a, b), Infinity);
        const currentMax = this.data.reduce((a, b) => Math.max(a, b), -Infinity);

        if (currentMin === currentMax) {
             // Avoid division by zero if all values are the same. Return a tensor of mins.
             const newData = new Float32Array(this.size).fill(min);
             return new Tensor(newData, this.shape);
        }

        const range = currentMax - currentMin;
        const targetRange = max - min;

        const newData = new Float32Array(this.size);
        for(let i = 0; i < this.size; i++) {
            newData[i] = min + ((this.data[i] - currentMin) / range) * targetRange;
        }

        return new Tensor(newData, this.shape);
    }
}

// [Neuro-Sonification] Lobe classification mirrors the anatomical regions used
// throughout the codebase (see regionCoordinatesMap in main-routine-engine.js
// and the depth-based region masks in synaptix-engine.js): frontal = +Z,
// occipital = -Z, parietal = +Y, temporal = |X| sides, deep = near-center.
const LOBE_NAMES = ['frontal', 'occipital', 'parietal', 'temporal', 'deep'];
const DEEP_RADIUS = 0.35;

function classifyVoxelLobe(wx, wy, wz) {
    const radius = Math.sqrt(wx * wx + wy * wy + wz * wz);
    if (radius < DEEP_RADIUS) return 'deep';

    const absX = Math.abs(wx);
    if (absX >= Math.abs(wy) && absX >= Math.abs(wz)) return 'temporal';
    if (wy > absX && wy >= wz) return 'parietal';
    return wz >= 0 ? 'frontal' : 'occipital';
}

/**
 * Computes mean/variance activation per anatomical lobe from a flattened
 * voxelDim^3 tensor (index = x + y*voxelDim + z*voxelDim*voxelDim, matching
 * the compute-shader/phantom-generation convention used elsewhere).
 * @param {Float32Array} tensorData
 * @param {number} voxelDim
 * @returns {Object<string, {mean: number, variance: number, count: number}>}
 */
export function computeLobeStats(tensorData, voxelDim = 32) {
    const sums = {};
    const sumSquares = {};
    const counts = {};
    for (const lobe of LOBE_NAMES) {
        sums[lobe] = 0;
        sumSquares[lobe] = 0;
        counts[lobe] = 0;
    }

    let idx = 0;
    for (let z = 0; z < voxelDim; z++) {
        const wz = (z / voxelDim) * 2.0 - 1.0;
        for (let y = 0; y < voxelDim; y++) {
            const wy = (y / voxelDim) * 2.0 - 1.0;
            for (let x = 0; x < voxelDim; x++) {
                const wx = (x / voxelDim) * 2.0 - 1.0;
                const lobe = classifyVoxelLobe(wx, wy, wz);
                const value = tensorData[idx] || 0;
                sums[lobe] += value;
                sumSquares[lobe] += value * value;
                counts[lobe] += 1;
                idx++;
            }
        }
    }

    const stats = {};
    for (const lobe of LOBE_NAMES) {
        const count = counts[lobe] || 1;
        const mean = sums[lobe] / count;
        const variance = Math.max(0, sumSquares[lobe] / count - mean * mean);
        stats[lobe] = { mean, variance, count };
    }
    return stats;
}

export { LOBE_NAMES };

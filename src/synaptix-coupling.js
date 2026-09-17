// [Field Resolution] Region membership is a function of the grid, so the index
// lists are built per dimension and memoised rather than baked once at 32³.
import { DEFAULT_VOXEL_DIM, inferVoxelDim, voxelCountFor } from './voxel-dim.js';

export const SYNAPTIX_REGIONS = ['frontal', 'occipital', 'parietal', 'temporal', 'deep'];

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function buildRegionIndices(VOXEL_DIM) {
    const regions = Object.fromEntries(SYNAPTIX_REGIONS.map((name) => [name, []]));
    for (let z = 0; z < VOXEL_DIM; z++) {
        const wz = (z / (VOXEL_DIM - 1)) * 2 - 1;
        for (let y = 0; y < VOXEL_DIM; y++) {
            const wy = (y / (VOXEL_DIM - 1)) * 2 - 1;
            for (let x = 0; x < VOXEL_DIM; x++) {
                const wx = (x / (VOXEL_DIM - 1)) * 2 - 1;
                const index = z * VOXEL_DIM * VOXEL_DIM + y * VOXEL_DIM + x;
                if (wz > 0.3) regions.frontal.push(index);
                else if (wz < -0.3) regions.occipital.push(index);
                else if (wy > 0.3) regions.parietal.push(index);
                else if (Math.abs(wx) > 0.4) regions.temporal.push(index);
                else regions.deep.push(index);
            }
        }
    }
    return regions;
}

/** @type {Map<number, Record<string, number[]>>} */
const REGION_INDEX_CACHE = new Map();

/**
 * Region -> voxel index lists for a given grid, built once per dimension.
 * @param {number} voxelDim
 */
function regionIndicesFor(voxelDim) {
    let cached = REGION_INDEX_CACHE.get(voxelDim);
    if (!cached) {
        cached = buildRegionIndices(voxelDim);
        REGION_INDEX_CACHE.set(voxelDim, cached);
    }
    return cached;
}

/**
 * @param {Float32Array} tensor
 * @param {number} [voxelDim] - Defaults to the grid implied by `tensor.length`.
 */
export function getAnatomicalRegionMeans(tensor, voxelDim = inferVoxelDim(tensor)) {
    if (!tensor || tensor.length !== voxelCountFor(voxelDim)) {
        return Object.fromEntries(SYNAPTIX_REGIONS.map((name) => [name, 0]));
    }
    const regionIndices = regionIndicesFor(voxelDim);
    const means = {};
    for (const name of SYNAPTIX_REGIONS) {
        const indices = regionIndices[name];
        let sum = 0;
        for (let i = 0; i < indices.length; i++) sum += tensor[indices[i]];
        means[name] = indices.length ? sum / indices.length : 0;
    }
    return means;
}

function positivePearson(samples, region) {
    const count = samples.length;
    if (count < 3) return 0;
    let meanA = 0;
    let meanB = 0;
    for (const sample of samples) {
        meanA += sample.avatarA[region];
        meanB += sample.partner[region];
    }
    meanA /= count;
    meanB /= count;
    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (const sample of samples) {
        const da = sample.avatarA[region] - meanA;
        const db = sample.partner[region] - meanB;
        covariance += da * db;
        varianceA += da * da;
        varianceB += db * db;
    }
    if (varianceA < 1e-7 || varianceB < 1e-7) return 0;
    const correlation = covariance / Math.sqrt(varianceA * varianceB);
    // Regional means are diluted across a full anatomical mask; normalize the
    // expected sparse activation range before gating correlation visibility.
    const energyGate = Math.sqrt(clamp01(meanA * 12) * clamp01(meanB * 12));
    return clamp01(Math.max(0, correlation) * energyGate);
}

export class SynaptiXCouplingModel {
    constructor({ windowSeconds = 2, sampleRate = 10 } = {}) {
        this.windowSeconds = windowSeconds;
        this.sampleRate = sampleRate;
        this.samples = [];
        this.lastSampleTime = -Infinity;
        this.enabled = true;
        this.strength = 1;
        this.stats = this.emptyStats();
    }

    emptyStats() {
        return {
            avatarAEnergy: 0,
            partnerEnergy: 0,
            globalCoupling: 0,
            regions: Object.fromEntries(SYNAPTIX_REGIONS.map((name) => [name, 0])),
        };
    }

    configure({ enabled, strength, windowSeconds } = {}) {
        if (enabled !== undefined) this.enabled = Boolean(enabled);
        if (strength !== undefined) this.strength = clamp01(Number(strength));
        if (windowSeconds !== undefined) {
            this.windowSeconds = Math.max(0.5, Math.min(10, Number(windowSeconds) || 2));
        }
        this.trim(this.lastSampleTime);
    }

    reset() {
        this.samples = [];
        this.lastSampleTime = -Infinity;
        this.stats = this.emptyStats();
    }

    update(timestamp, avatarA, partner) {
        // [Field Resolution] Both fields must be the same supported grid; the
        // dimension comes from their length rather than a hardcoded 32³.
        const voxelDim = inferVoxelDim(avatarA, 0);
        if (!avatarA || !partner || !voxelDim
            || avatarA.length !== voxelCountFor(voxelDim) || partner.length !== voxelCountFor(voxelDim)) {
            return this.stats;
        }
        if (timestamp - this.lastSampleTime < 1000 / this.sampleRate) return this.stats;
        this.lastSampleTime = timestamp;
        const avatarAMeans = getAnatomicalRegionMeans(avatarA, voxelDim);
        const partnerMeans = getAnatomicalRegionMeans(partner, voxelDim);
        this.samples.push({ timestamp, avatarA: avatarAMeans, partner: partnerMeans });
        this.trim(timestamp);

        const regions = {};
        let couplingSum = 0;
        let energyA = 0;
        let energyB = 0;
        for (const name of SYNAPTIX_REGIONS) {
            regions[name] = this.enabled ? positivePearson(this.samples, name) * this.strength : 0;
            couplingSum += regions[name];
            energyA += avatarAMeans[name];
            energyB += partnerMeans[name];
        }
        this.stats = {
            avatarAEnergy: clamp01(energyA / SYNAPTIX_REGIONS.length) * 100,
            partnerEnergy: clamp01(energyB / SYNAPTIX_REGIONS.length) * 100,
            globalCoupling: couplingSum / SYNAPTIX_REGIONS.length,
            regions,
        };
        return this.stats;
    }

    trim(timestamp) {
        const maxSamples = Math.max(3, Math.ceil(this.windowSeconds * this.sampleRate));
        while (this.samples.length > maxSamples) this.samples.shift();
    }
}

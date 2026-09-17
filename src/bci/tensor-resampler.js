import { DEFAULT_VOXEL_DIM, normalizeVoxelDim, voxelCountFor } from '../voxel-dim.js';

/** Voxels in the default 32³ field. Kept as a named export for existing callers. */
const VOXEL_COUNT = voxelCountFor(DEFAULT_VOXEL_DIM);

export const MUSE_CHANNEL_MAP = Object.freeze({
    TP9: 'temporalLeft',
    AF7: 'frontalLeft',
    AF8: 'frontalRight',
    TP10: 'temporalRight',
    AUX: 'deep',
    AUX1: 'deep', AUX2: 'deep', AUX3: 'deep', AUX4: 'deep',
    FPz: 'frontalLeft', AUX_R: 'temporalRight', AUX_L: 'temporalLeft', CH8: 'deep',
});

export const OPENBCI_PRESETS = Object.freeze({
    cyton: {
        CH1: 'frontalLeft', CH2: 'frontalRight', CH3: 'parietalLeft', CH4: 'parietalRight',
        CH5: 'temporalLeft', CH6: 'temporalRight', CH7: 'occipitalLeft', CH8: 'occipitalRight',
    },
    'cyton-daisy': {
        CH1: 'frontalLeft', CH2: 'frontalRight', CH3: 'parietalLeft', CH4: 'parietalRight',
        CH5: 'temporalLeft', CH6: 'temporalRight', CH7: 'occipitalLeft', CH8: 'occipitalRight',
        CH9: 'frontalLeft', CH10: 'frontalRight', CH11: 'temporalLeft', CH12: 'temporalRight',
        CH13: 'parietalLeft', CH14: 'parietalRight', CH15: 'occipitalLeft', CH16: 'occipitalRight',
    },
});

export const REGION_NAMES = Object.freeze([
    'frontalLeft', 'frontalRight', 'parietalLeft', 'parietalRight',
    'temporalLeft', 'temporalRight', 'occipitalLeft', 'occipitalRight', 'deep',
]);

const CENTERS = {
    frontalLeft: [-0.45, 0.15, 0.62], frontalRight: [0.45, 0.15, 0.62],
    parietalLeft: [-0.38, 0.62, 0.0], parietalRight: [0.38, 0.62, 0.0],
    temporalLeft: [-0.72, -0.05, 0.0], temporalRight: [0.72, -0.05, 0.0],
    occipitalLeft: [-0.35, 0.1, -0.68], occipitalRight: [0.35, 0.1, -0.68],
    deep: [0, -0.1, 0],
};

export class TensorResampler {
    /**
     * @param {Object} [mapping] - Electrode -> region map.
     * @param {number} [voxelDim] - Grid the projected tensors are emitted at.
     *   [Field Resolution] Was hardcoded 32; masks are now baked at whatever
     *   resolution the renderer is running, because a projected tensor is fed
     *   straight into `setVoxelData()` and has to match its buffer.
     */
    constructor(mapping = MUSE_CHANNEL_MAP, voxelDim = DEFAULT_VOXEL_DIM) {
        this.mapping = { ...mapping };
        this.voxelDim = normalizeVoxelDim(voxelDim);
        this.voxelCount = voxelCountFor(this.voxelDim);
        this.masks = new Map();
        for (const region of REGION_NAMES) this.masks.set(region, this._makeMask(region));
        this.posteriorMask = this._combineMasks(['occipitalLeft', 'occipitalRight', 'parietalLeft', 'parietalRight']);
        this.frontalMask = this._combineMasks(['frontalLeft', 'frontalRight', 'parietalLeft', 'parietalRight']);
        this.temporalMask = this._combineMasks(['temporalLeft', 'temporalRight', 'deep']);
    }

    setMapping(mapping) {
        this.mapping = { ...mapping };
    }

    project(features) {
        const VOXEL_DIM = this.voxelDim;
        const VOXEL_COUNT = this.voxelCount;
        const output = new Float32Array(VOXEL_COUNT);
        const quality = Math.max(0.1, features.quality || 0);
        this._accumulate(output, this.posteriorMask, (features.bands.alpha || 0) * 0.48 * quality);
        this._accumulate(output, this.frontalMask, (features.bands.beta || 0) * 0.38 * quality);
        this._accumulate(output, this.temporalMask, (features.bands.gamma || 0) * 0.32 * quality);

        for (const [channel, channelFeature] of Object.entries(features.channels || {})) {
            const mask = this.masks.get(this.mapping[channel]);
            if (!mask) continue;
            const bands = channelFeature.bands;
            const energy = (bands.alpha * 0.45 + bands.beta * 0.35 + bands.gamma * 0.2) * channelFeature.quality;
            this._accumulate(output, mask, energy * 0.7);
        }
        for (let i = 0; i < output.length; i++) output[i] = Math.min(1, output[i]);
        return output;
    }

    _makeMask(region) {
        const VOXEL_DIM = this.voxelDim;
        const VOXEL_COUNT = this.voxelCount;
        const [cx, cy, cz] = CENTERS[region];
        const sigma = region === 'deep' ? 0.42 : 0.34;
        const mask = new Float32Array(VOXEL_COUNT);
        let index = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            const wz = (z / (VOXEL_DIM - 1)) * 2 - 1;
            for (let y = 0; y < VOXEL_DIM; y++) {
                const wy = (y / (VOXEL_DIM - 1)) * 2 - 1;
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / (VOXEL_DIM - 1)) * 2 - 1;
                    const brain = wx * wx + wy * wy + wz * wz <= 1.0;
                    const d2 = (wx - cx) ** 2 + (wy - cy) ** 2 + (wz - cz) ** 2;
                    mask[index++] = brain ? Math.exp(-d2 / (2 * sigma * sigma)) : 0;
                }
            }
        }
        return mask;
    }

    _combineMasks(regions) {
        const VOXEL_DIM = this.voxelDim;
        const VOXEL_COUNT = this.voxelCount;
        const result = new Float32Array(VOXEL_COUNT);
        for (const region of regions) {
            const mask = this.masks.get(region);
            for (let i = 0; i < result.length; i++) result[i] = Math.max(result[i], mask[i]);
        }
        return result;
    }

    _accumulate(output, mask, strength) {
        if (!strength) return;
        for (let i = 0; i < output.length; i++) output[i] += mask[i] * strength;
    }
}

export { VOXEL_COUNT };

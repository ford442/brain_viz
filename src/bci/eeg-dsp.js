const DEFAULT_BANDS = Object.freeze({
    alpha: [8, 12],
    beta: [13, 30],
    gamma: [30, 45],
});

const clamp01 = (value) => Math.max(0, Math.min(1, value));

function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

function spectralPower(samples, sampleRate, bands) {
    const count = samples.length;
    let mean = 0;
    for (let i = 0; i < count; i++) mean += samples[i];
    mean /= Math.max(1, count);

    const real = new Float64Array(count);
    const imag = new Float64Array(count);
    for (let i = 0; i < count; i++) {
        const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, count - 1));
        real[i] = (samples[i] - mean) * window;
    }
    for (let i = 1, j = 0; i < count; i++) {
        let bit = count >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) [real[i], real[j], imag[i], imag[j]] = [real[j], real[i], imag[j], imag[i]];
    }
    for (let length = 2; length <= count; length <<= 1) {
        const angle = -2 * Math.PI / length;
        const stepReal = Math.cos(angle);
        const stepImag = Math.sin(angle);
        for (let start = 0; start < count; start += length) {
            let wr = 1;
            let wi = 0;
            for (let offset = 0; offset < length / 2; offset++) {
                const even = start + offset;
                const odd = even + length / 2;
                const tr = wr * real[odd] - wi * imag[odd];
                const ti = wr * imag[odd] + wi * real[odd];
                real[odd] = real[even] - tr;
                imag[odd] = imag[even] - ti;
                real[even] += tr;
                imag[even] += ti;
                const nextWr = wr * stepReal - wi * stepImag;
                wi = wr * stepImag + wi * stepReal;
                wr = nextWr;
            }
        }
    }

    const totals = Object.fromEntries(Object.keys(bands).map((name) => [name, 0]));
    for (let bin = 1; bin <= Math.floor((45 * count) / sampleRate); bin++) {
        const hz = (bin * sampleRate) / count;
        const power = (real[bin] * real[bin] + imag[bin] * imag[bin]) / (count * count);
        for (const [name, [low, high]] of Object.entries(bands)) {
            if (hz >= low && hz <= high) totals[name] += power;
        }
    }
    return totals;
}

function estimateQuality(samples, motion) {
    if (!samples.length) return 0;
    let sum = 0;
    let sumSq = 0;
    let clipped = 0;
    let changes = 0;
    for (let i = 0; i < samples.length; i++) {
        const value = samples[i];
        if (!Number.isFinite(value)) return 0;
        sum += value;
        sumSq += value * value;
        if (Math.abs(value) > 1000) clipped++;
        if (i > 0 && Math.abs(value - samples[i - 1]) > 0.01) changes++;
    }
    const mean = sum / samples.length;
    const variance = Math.max(0, sumSq / samples.length - mean * mean);
    const rms = Math.sqrt(variance);
    const amplitudeScore = rms < 0.5 ? rms / 0.5 : rms > 200 ? Math.max(0, 1 - (rms - 200) / 800) : 1;
    const clipScore = 1 - clipped / samples.length;
    const flatScore = Math.min(1, changes / Math.max(1, samples.length * 0.25));
    let motionScore = 1;
    if (motion) {
        const magnitude = Math.hypot(motion.x || 0, motion.y || 0, motion.z || 0);
        const deviation = Math.min(Math.abs(magnitude - 1), magnitude);
        motionScore = Math.max(0.25, 1 - deviation * 1.5);
    }
    return clamp01(amplitudeScore * clipScore * flatScore * motionScore);
}

export class EEGProcessor {
    constructor({ windowSize = 256, updatesPerSecond = 12, bands = DEFAULT_BANDS } = {}) {
        this.windowSize = windowSize;
        this.updatesPerSecond = updatesPerSecond;
        this.bands = bands;
        this.channelBuffers = new Map();
        this.samplesSinceFeature = 0;
        this.lastFeatureAt = 0;
        this.calibration = null;
        this.calibrationStats = null;
        this.latest = null;
    }

    reset() {
        this.channelBuffers.clear();
        this.samplesSinceFeature = 0;
        this.lastFeatureAt = 0;
        this.latest = null;
    }

    startCalibration(stage = 'neutral') {
        if (!this.calibration) this.calibration = { neutral: [], relaxed: [] };
        this.calibration.stage = stage;
    }

    finishCalibration() {
        if (!this.calibration) return null;
        const snapshots = [...this.calibration.neutral, ...this.calibration.relaxed];
        const stats = {};
        for (const band of Object.keys(this.bands)) {
            const values = snapshots.map((entry) => Math.log10(Math.max(1e-9, entry.bands[band])));
            stats[band] = {
                median: percentile(values, 0.5),
                high: percentile(values, 0.9),
            };
            if (Math.abs(stats[band].high - stats[band].median) < 0.05) {
                stats[band].high = stats[band].median + 0.25;
            }
        }
        this.calibrationStats = stats;
        this.calibration = null;
        return stats;
    }

    setCalibration(stats) {
        this.calibrationStats = stats || null;
    }

    push(batch) {
        const { channels, samples, sampleRate, timestamp, motion } = batch;
        if (!Array.isArray(channels) || !Array.isArray(samples) || channels.length !== samples.length) return null;
        let added = 0;
        channels.forEach((channel, index) => {
            const incoming = samples[index];
            if (!incoming) return;
            const buffer = this.channelBuffers.get(channel) || [];
            for (let i = 0; i < incoming.length; i++) buffer.push(incoming[i]);
            if (buffer.length > this.windowSize * 2) buffer.splice(0, buffer.length - this.windowSize * 2);
            this.channelBuffers.set(channel, buffer);
            added = Math.max(added, incoming.length);
        });
        this.samplesSinceFeature += added;
        const activeChannels = [...this.channelBuffers.keys()];
        const ready = activeChannels.every((channel) => (this.channelBuffers.get(channel)?.length || 0) >= this.windowSize);
        const now = performance.now();
        if (!ready || now - this.lastFeatureAt < 1000 / this.updatesPerSecond) return null;
        this.lastFeatureAt = now;

        const channelFeatures = {};
        const aggregateRaw = Object.fromEntries(Object.keys(this.bands).map((name) => [name, 0]));
        let qualitySum = 0;
        activeChannels.forEach((channel) => {
            const window = this.channelBuffers.get(channel).slice(-this.windowSize);
            const powers = spectralPower(window, sampleRate, this.bands);
            const quality = estimateQuality(window, motion);
            channelFeatures[channel] = { rawBands: powers, bands: {}, quality };
            qualitySum += quality;
            for (const band of Object.keys(this.bands)) aggregateRaw[band] += powers[band] / activeChannels.length;
        });

        const normalizedAggregate = {};
        for (const band of Object.keys(this.bands)) {
            normalizedAggregate[band] = this._normalizeBand(band, aggregateRaw[band]);
            for (const channel of activeChannels) {
                channelFeatures[channel].bands[band] = this._normalizeBand(band, channelFeatures[channel].rawBands[band]);
            }
        }
        const result = {
            timestamp,
            sampleRate,
            bands: normalizedAggregate,
            rawBands: aggregateRaw,
            channels: channelFeatures,
            quality: activeChannels.length ? qualitySum / activeChannels.length : 0,
            motion: motion || null,
        };
        if (this.calibration?.stage) this.calibration[this.calibration.stage].push(result);
        this.latest = result;
        return result;
    }

    _normalizeBand(band, power) {
        const value = Math.log10(Math.max(1e-9, power));
        const stats = this.calibrationStats?.[band];
        if (stats) return clamp01(0.25 + 0.65 * ((value - stats.median) / (stats.high - stats.median)));
        // Conservative microvolt-power defaults until the user calibrates.
        const defaults = { alpha: 1.2, beta: 1.0, gamma: 0.5 };
        return clamp01((value - Math.log10(defaults[band] || 1) + 1.5) / 3.0);
    }
}

export { DEFAULT_BANDS };

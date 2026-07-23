import { EEGProcessor } from './eeg-dsp.js';
import { BCIRecorder, CHUNK_TYPES } from './bci-recording.js';
import { TensorResampler, MUSE_CHANNEL_MAP, OPENBCI_PRESETS } from './tensor-resampler.js';

const CALIBRATION_KEY = 'neuro_weaver_bci_calibration';
const MAPPING_KEY = 'neuro_weaver_bci_mappings';

export class BCISession {
    constructor(renderer, tensorPlayer) {
        this.renderer = renderer;
        this.tensorPlayer = tensorPlayer;
        this.processor = new EEGProcessor();
        this.resampler = new TensorResampler();
        this.recorder = new BCIRecorder();
        this.adapter = null;
        this.source = 'simulation';
        this.status = { state: 'disconnected', message: 'No BCI device connected' };
        this.latestFeatures = null;
        this.latestTensor = null;
        this.tensorUpdateCount = 0;
        this.lastTensorTimestamp = 0;
        this.updateRate = 0;
        this._rateTimes = [];
        this.thresholds = [];
        this.onStatus = null;
        this.onFeatures = null;
        this.mappingId = 'muse';
        this.mapping = { ...MUSE_CHANNEL_MAP };
        this.recordingName = null;
        this._loadCalibration();
    }

    async connect(adapter, { mappingId = 'muse' } = {}) {
        await this.disconnect();
        this.tensorPlayer?.stop();
        this.adapter = adapter;
        this.mappingId = mappingId;
        this.mapping = this._loadMapping(mappingId, mappingId === 'cyton-daisy'
            ? OPENBCI_PRESETS['cyton-daisy']
            : mappingId === 'cyton' ? OPENBCI_PRESETS.cyton : MUSE_CHANNEL_MAP);
        this.resampler.setMapping(this.mapping);
        adapter.onSamples = (batch) => this._handleSamples(batch);
        adapter.onStatus = (status) => this._setStatus(status);
        this._setStatus({ state: 'connecting', message: 'Connecting…' });
        await adapter.connect();
        this.source = 'bci';
        this.renderer.tensorPlaybackMode = true;
        this._setStatus({ state: 'connected', message: `Connected to ${adapter.name || 'BCI device'}` });
    }

    async disconnect() {
        const adapter = this.adapter;
        this.adapter = null;
        if (adapter) await Promise.resolve(adapter.disconnect()).catch(() => {});
        if (this.source === 'bci') {
            this.source = 'simulation';
            this.renderer.tensorPlaybackMode = false;
        }
        this.processor.reset();
        this._setStatus({ state: 'disconnected', message: 'BCI disconnected; simulation restored' });
    }

    setMapping(channel, region) {
        this.mapping[channel] = region;
        this.resampler.setMapping(this.mapping);
        const all = this._readJSON(MAPPING_KEY, {});
        all[this.mappingId] = this.mapping;
        this._writeJSON(MAPPING_KEY, all);
    }

    resetMapping() {
        const preset = this.mappingId === 'cyton-daisy' ? OPENBCI_PRESETS['cyton-daisy']
            : this.mappingId === 'cyton' ? OPENBCI_PRESETS.cyton : MUSE_CHANNEL_MAP;
        this.mapping = { ...preset };
        this.resampler.setMapping(this.mapping);
        const all = this._readJSON(MAPPING_KEY, {});
        delete all[this.mappingId];
        this._writeJSON(MAPPING_KEY, all);
    }

    startCalibration(stage) {
        this.processor.startCalibration(stage);
        this._setStatus({ state: 'calibrating', message: stage === 'neutral' ? 'Calibrating: eyes open' : 'Calibrating: eyes closed' });
    }

    finishCalibration() {
        const stats = this.processor.finishCalibration();
        if (stats) this._writeJSON(CALIBRATION_KEY, stats);
        this._setStatus({ state: 'connected', message: 'Calibration complete' });
        return stats;
    }

    async startRecording(name = 'neuro-weaver-bci') {
        this.recordingName = name;
        await this.recorder.start({
            source: this.adapter?.type || 'unknown',
            device: this.adapter?.name || 'Unknown BCI',
            channels: this.adapter?.channels || [],
            sampleRate: this.adapter?.sampleRate || null,
            mapping: this.mapping,
        });
        this._setStatus({ ...this.status, recording: true });
    }

    async stopRecording() {
        const blob = await this.recorder.stop();
        this._setStatus({ ...this.status, recording: false, recordingReady: Boolean(blob) });
        return blob;
    }

    watchThreshold(options, callback) {
        this.thresholds.push({ ...options, callback, heldSince: 0, startedAt: performance.now() });
    }

    async replay(recording, { realtime = false } = {}) {
        const parsed = await BCIRecorder.parse(recording);
        const tensors = parsed.chunks.filter((chunk) => chunk.type === CHUNK_TYPES.tensor);
        if (!tensors.length) throw new Error('Recording contains no tensor frames');
        this.tensorPlayer?.stop();
        this.source = 'bci';
        this.renderer.tensorPlaybackMode = true;
        let previousTimestamp = tensors[0].timestamp;
        for (const chunk of tensors) {
            if (realtime) await new Promise((resolve) => setTimeout(resolve, Math.max(0, chunk.timestamp - previousTimestamp)));
            const tensor = new Float32Array(chunk.payload.buffer, chunk.payload.byteOffset, chunk.payload.byteLength / 4);
            this._commitTensor(new Float32Array(tensor), chunk.timestamp);
            previousTimestamp = chunk.timestamp;
        }
    }

    _handleSamples(batch) {
        if (this.adapter === null) return;
        this.recorder.appendRaw(batch);
        const features = this.processor.push(batch);
        if (!features) return;
        this.latestFeatures = features;
        this.recorder.appendFeatures(features);
        const tensor = this.resampler.project(features);
        this._commitTensor(tensor, features.timestamp);
        this._checkThresholds(features);
        this.onFeatures?.(features);
    }

    _commitTensor(tensor, timestamp) {
        if (this.source !== 'bci') return;
        this.renderer.setVoxelData(tensor);
        this.latestTensor = tensor;
        this.tensorUpdateCount++;
        this.lastTensorTimestamp = timestamp;
        const now = performance.now();
        this._rateTimes.push(now);
        while (this._rateTimes.length && this._rateTimes[0] < now - 1000) this._rateTimes.shift();
        this.updateRate = this._rateTimes.length;
        this.recorder.appendTensor(timestamp, tensor);
    }

    _checkThresholds(features) {
        const now = performance.now();
        this.thresholds = this.thresholds.filter((watcher) => {
            let value = watcher.metric === 'quality' ? features.quality
                : watcher.metric === 'motion' ? Math.min(1, Math.hypot(features.motion?.x || 0, features.motion?.y || 0, features.motion?.z || 0) / 2)
                : features.bands[watcher.metric];
            if (watcher.channel && features.channels[watcher.channel]) {
                value = watcher.metric === 'quality' ? features.channels[watcher.channel].quality
                    : features.channels[watcher.channel].bands[watcher.metric];
            }
            const passing = watcher.comparison === 'below' ? value < watcher.value : value > watcher.value;
            watcher.heldSince = passing ? (watcher.heldSince || now) : 0;
            if (watcher.heldSince && now - watcher.heldSince >= (watcher.holdSeconds || 0) * 1000) {
                watcher.callback?.({ success: true, value });
                return false;
            }
            if (watcher.timeoutSeconds && now - watcher.startedAt >= watcher.timeoutSeconds * 1000) {
                watcher.callback?.({ success: false, value, timeout: true });
                return false;
            }
            return true;
        });
    }

    _setStatus(status) {
        this.status = { ...this.status, ...status };
        if (status.state === 'disconnected' && this.source === 'bci') {
            this.source = 'simulation';
            this.renderer.tensorPlaybackMode = false;
        }
        this.onStatus?.(this.status);
    }

    _loadCalibration() {
        const calibration = this._readJSON(CALIBRATION_KEY, null);
        if (calibration) this.processor.setCalibration(calibration);
    }

    _loadMapping(id, fallback) {
        return { ...fallback, ...(this._readJSON(MAPPING_KEY, {})[id] || {}) };
    }

    _readJSON(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
    }

    _writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('[BCI] Could not persist settings', error); }
    }
}

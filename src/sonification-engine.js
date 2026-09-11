// sonification-engine.js — Neuro-Sonification: the inverse of AudioReactor.
// Where AudioReactor turns microphone input into visual reactivity,
// SonificationEngine turns live brain-activity state (tensor stats per lobe,
// neuromodulator retention bias, style, flowSpeed) into an ambient,
// continuously-generated soundscape. Requires no microphone permission.
import { computeLobeStats } from './tensor-utils.js';

export const SONIFICATION_PRESETS = {
    meditation: {
        name: 'Meditation',
        waveform: 'sine',
        baseFreq: 110,
        beatFreq: 6,       // theta range
        filterCutoff: 900,
        noiseLevel: 0.05,
        detuneScale: 4,    // cents per unit variance
        masterVolume: 0.35
    },
    'flow-hum': {
        name: 'Flow Hum',
        waveform: 'triangle',
        baseFreq: 165,
        beatFreq: 10,      // alpha range
        filterCutoff: 1400,
        noiseLevel: 0.10,
        detuneScale: 8,
        masterVolume: 0.40
    },
    'seizure-warning': {
        name: 'Seizure Warning',
        waveform: 'sawtooth',
        baseFreq: 220,
        beatFreq: 18,      // beta/gamma range, widens further with stress
        filterCutoff: 2200,
        noiseLevel: 0.25,
        detuneScale: 40,
        masterVolume: 0.50,
        tremoloRate: 8
    },
    'synaptix-dissonance': {
        name: 'SynaptiX Dissonance',
        waveform: 'sawtooth',
        baseFreq: 196,
        beatFreq: 13,      // widened toward a dissonant interval as resonance drops
        filterCutoff: 1800,
        noiseLevel: 0.18,
        detuneScale: 60,
        masterVolume: 0.45
    }
};

// Musical ratio + stereo spread per lobe layer (purely for a pleasant, spatially
// distinguishable mix — not a claim about physical stereo localization of lobes).
const LOBE_LAYERS = {
    deep:      { ratio: 0.5,    pan: -0.6 },
    temporal:  { ratio: 1.2599, pan: -0.3 },
    frontal:   { ratio: 1.0,    pan: 0.0 },
    parietal:  { ratio: 1.4983, pan: 0.3 },
    occipital: { ratio: 2.0,    pan: 0.6 }
};

const LOBE_POLL_INTERVAL_MS = 200; // GPU tensor readback is too costly per-frame

export class SonificationEngine {
    constructor(audioReactor = null) {
        this.audioReactor = audioReactor; // optional mutex/mix-bus reference
        this.audioContext = null;
        this.isActive = false;

        this.currentPreset = 'meditation';
        this.overrides = {}; // routine-driven `sonify_param` overrides

        this.masterGain = null;
        this.toneFilter = null;
        this.layers = {}; // lobe -> { osc, gain, panner }
        this.noise = null; // { source, filter, gain }
        this.binaural = null; // { oscL, oscR, panL, panR, gain }

        this.lobeStats = null;
        this._pendingSnapshot = false;
        this._lastPollTime = 0;
    }

    async start() {
        if (this.isActive) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.0001;
            this.masterGain.connect(this.audioContext.destination);

            this.toneFilter = this.audioContext.createBiquadFilter();
            this.toneFilter.type = 'lowpass';
            this.toneFilter.frequency.value = 1000;
            this.toneFilter.connect(this.masterGain);

            this._buildLobeLayers();
            this._buildNoiseBed();
            this._buildBinaural();

            this.isActive = true;
            this.setPreset(this.currentPreset);
            this.masterGain.gain.setTargetAtTime(this._presetVolume(), this.audioContext.currentTime, 0.3);

            console.log('[SonificationEngine] Started ambient soundscape generation.');
        } catch (error) {
            console.error('[SonificationEngine] Failed to start:', error);
            this.isActive = false;
        }
    }

    stop() {
        if (!this.isActive) return;
        const ctx = this.audioContext;
        const now = ctx.currentTime;

        if (this.masterGain) this.masterGain.gain.setTargetAtTime(0.0001, now, 0.1);

        const layers = this.layers;
        const noise = this.noise;
        const binaural = this.binaural;
        setTimeout(() => {
            Object.values(layers).forEach(({ osc }) => { try { osc.stop(); } catch (e) {} });
            if (noise?.source) { try { noise.source.stop(); } catch (e) {} }
            if (binaural) {
                try { binaural.oscL.stop(); } catch (e) {}
                try { binaural.oscR.stop(); } catch (e) {}
            }
            if (ctx.state !== 'closed') ctx.close();
        }, 250);

        this.layers = {};
        this.noise = null;
        this.binaural = null;
        this.masterGain = null;
        this.toneFilter = null;
        this.audioContext = null;
        this.isActive = false;
        console.log('[SonificationEngine] Stopped.');
    }

    setPreset(name) {
        const preset = SONIFICATION_PRESETS[name] ? name : 'meditation';
        this.currentPreset = preset;
        if (!this.isActive) return;

        const cfg = SONIFICATION_PRESETS[preset];
        const now = this.audioContext.currentTime;

        for (const [lobe, { osc }] of Object.entries(this.layers)) {
            osc.type = cfg.waveform;
            const ratio = LOBE_LAYERS[lobe].ratio;
            osc.frequency.setTargetAtTime(cfg.baseFreq * ratio, now, 0.2);
        }
        this.toneFilter.frequency.setTargetAtTime(cfg.filterCutoff, now, 0.2);
        if (this.noise) this.noise.gain.gain.setTargetAtTime(cfg.noiseLevel, now, 0.2);
        if (this.binaural) {
            const half = cfg.beatFreq / 2;
            this.binaural.oscL.frequency.setTargetAtTime(cfg.baseFreq - half, now, 0.2);
            this.binaural.oscR.frequency.setTargetAtTime(cfg.baseFreq + half, now, 0.2);
        }
        this.masterGain.gain.setTargetAtTime(this._presetVolume(), now, 0.3);
    }

    // Generic routine-driven override, e.g. { key: 'masterVolume', value: 0.2 }.
    setParam(key, value, duration = 0.3) {
        this.overrides[key] = value;
        if (!this.isActive) return;
        const now = this.audioContext.currentTime;
        if (key === 'masterVolume') this.masterGain.gain.setTargetAtTime(this._presetVolume(), now, duration);
        if (key === 'filterCutoff') this.toneFilter.frequency.setTargetAtTime(value, now, duration);
        if (key === 'noiseLevel' && this.noise) this.noise.gain.gain.setTargetAtTime(value, now, duration);
        if (key === 'beatFreq' && this.binaural) {
            const cfg = SONIFICATION_PRESETS[this.currentPreset];
            const half = value / 2;
            this.binaural.oscL.frequency.setTargetAtTime(cfg.baseFreq - half, now, duration);
            this.binaural.oscR.frequency.setTargetAtTime(cfg.baseFreq + half, now, duration);
        }
    }

    // Called every animation frame from the main update loop.
    update(renderer, player, synaptixEngine, timestampMs = performance.now()) {
        if (!this.isActive || !renderer) return;

        this._pollLobeStats(renderer, timestampMs);

        const cfg = SONIFICATION_PRESETS[this.currentPreset];
        const p = renderer.params || {};
        const stress = p.stress || 0;
        const cortisol = p.cortisol || 0;
        const flowSpeed = p.flowSpeed ?? 4.0;
        const amplitude = p.amplitude ?? 0.5;

        const isSynaptiX = (p.style ?? 0) >= 4.0;
        let resonance = 100;
        if (isSynaptiX && synaptixEngine?.computeResonanceStats) {
            const stats = synaptixEngine.computeResonanceStats(renderer._lastHumanTensor);
            resonance = stats?.resonance ?? 100;
        }

        const now = this.audioContext.currentTime;
        const retention = {
            frontal: p.retentionBiasX ?? 0.5,
            occipital: p.retentionBiasY ?? 0.0,
            temporal: p.retentionBiasZ ?? 0.2,
            parietal: p.retentionBiasW ?? 0.2,
            deep: 0.2
        };

        for (const [lobe, layer] of Object.entries(this.layers)) {
            const stat = this.lobeStats?.[lobe];
            const activation = stat ? Math.max(0, Math.min(1, stat.mean)) : 0;
            const variance = stat ? stat.variance : 0;
            const retentionNorm = Math.max(0, Math.min(1, (retention[lobe] + 1) / 3));

            const targetGain = 0.04 + activation * 0.5 * (0.5 + amplitude) + retentionNorm * 0.08;
            layer.gain.gain.setTargetAtTime(Math.min(0.9, targetGain), now, 0.05);

            const targetDetune = Math.min(200, variance * cfg.detuneScale * 100);
            layer.osc.detune.setTargetAtTime(targetDetune, now, 0.05);
        }

        if (this.noise) {
            const dissonanceMix = this.currentPreset === 'synaptix-dissonance' ? (1 - resonance / 100) : 0;
            const targetNoise = this.overrides.noiseLevel ?? (cfg.noiseLevel * (0.4 + stress * 1.5 + cortisol * 0.8 + dissonanceMix * 0.6));
            this.noise.gain.gain.setTargetAtTime(Math.min(0.8, targetNoise), now, 0.08);
        }

        const targetCutoff = this.overrides.filterCutoff ?? (cfg.filterCutoff * (0.5 + flowSpeed / 8));
        this.toneFilter.frequency.setTargetAtTime(Math.max(100, targetCutoff), now, 0.08);

        if (this.binaural) {
            let beatFreq = this.overrides.beatFreq ?? cfg.beatFreq;
            if (this.currentPreset === 'seizure-warning') beatFreq += stress * 30;
            if (this.currentPreset === 'synaptix-dissonance') beatFreq += (1 - resonance / 100) * 80;
            const half = beatFreq / 2;
            this.binaural.oscL.frequency.setTargetAtTime(cfg.baseFreq - half, now, 0.1);
            this.binaural.oscR.frequency.setTargetAtTime(cfg.baseFreq + half, now, 0.1);
        }
    }

    _presetVolume() {
        const cfg = SONIFICATION_PRESETS[this.currentPreset];
        const base = this.overrides.masterVolume ?? cfg.masterVolume;
        // Mix-bus behavior: duck ourselves when AudioReactor's mic-reactive mode
        // is also running so neither channel is fighting to dominate the mix.
        const mixFactor = this.audioReactor?.isActive ? 0.5 : 1.0;
        return base * mixFactor;
    }

    async _pollLobeStats(renderer, timestampMs) {
        if (this._pendingSnapshot) return;
        if (timestampMs - this._lastPollTime < LOBE_POLL_INTERVAL_MS) return;
        this._lastPollTime = timestampMs;
        this._pendingSnapshot = true;
        try {
            const snapshot = await renderer.getVoxelDataSnapshot();
            if (snapshot) this.lobeStats = computeLobeStats(snapshot, renderer.voxelDim || 32);
        } catch (e) {
            // GPU readback can fail transiently (e.g. context loss) — skip this poll.
        } finally {
            this._pendingSnapshot = false;
        }
    }

    _buildLobeLayers() {
        const ctx = this.audioContext;
        for (const [lobe, { pan }] of Object.entries(LOBE_LAYERS)) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const panner = ctx.createStereoPanner();
            gain.gain.value = 0.04;
            panner.pan.value = pan;

            osc.connect(gain);
            gain.connect(panner);
            panner.connect(this.toneFilter);
            osc.start();

            this.layers[lobe] = { osc, gain, panner };
        }
    }

    _buildNoiseBed() {
        const ctx = this.audioContext;
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.value = 0.05;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start();

        this.noise = { source, filter, gain };
    }

    _buildBinaural() {
        const ctx = this.audioContext;
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        const gain = ctx.createGain();

        oscL.type = 'sine';
        oscR.type = 'sine';
        panL.pan.value = -1;
        panR.pan.value = 1;
        gain.gain.value = 0.15;

        oscL.connect(panL);
        oscR.connect(panR);
        panL.connect(gain);
        panR.connect(gain);
        gain.connect(this.masterGain);

        oscL.start();
        oscR.start();

        this.binaural = { oscL, oscR, panL, panR, gain };
    }
}

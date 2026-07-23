import { SynaptiXCouplingModel, SYNAPTIX_REGIONS } from './synaptix-coupling.js';

const VOXEL_DIM = 32;
const VOXEL_COUNT = VOXEL_DIM ** 3;
const BRAIN_RANGE = 1.6;

/**
 * [SynaptiX] AITensorProjector — Maps transformer/ViT activation tensors into the 32³ brain volume.
 *
 * Default anatomical mapping (layer depth → brain region):
 *   Early layers  (0–25%)   → Occipital  (Z < -0.3)   — visual/feature extraction
 *   Lower-mid     (25–50%)  → Temporal   (|X| > 0.4)  — language/sequence
 *   Upper-mid     (50–75%)  → Parietal   (Y > 0.3)    — integration/attention
 *   Deep layers   (75–100%) → Frontal    (Z > 0.3)    — reasoning/decision
 *
 * Extension point: pass a custom `projectorFn(activation, layerIdx, totalLayers)` to `setProjector()`.
 */
export class AITensorProjector {
    constructor() {
        this.customProjector = null;
    }

    setProjector(fn) {
        this.customProjector = fn;
    }

    project(activation, layerIndex = 0, totalLayers = 1) {
        if (this.customProjector) {
            return this.customProjector(activation, layerIndex, totalLayers);
        }
        return this.defaultProject(activation, layerIndex, totalLayers);
    }

    defaultProject(activation, layerIndex, totalLayers) {
        // Normalize activation to Float32Array
        let flat;
        if (activation instanceof Float32Array) {
            flat = activation;
        } else if (Array.isArray(activation)) {
            flat = new Float32Array(activation);
        } else if (activation && typeof activation.length === 'number') {
            flat = new Float32Array(activation);
        } else {
            console.warn('[SynaptiX] Invalid activation type for projection');
            return new Float32Array(VOXEL_COUNT);
        }

        // Clamp and normalize activation values
        let minVal = Infinity, maxVal = -Infinity;
        for (let i = 0; i < flat.length; i++) {
            const v = flat[i];
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
        }
        const range = maxVal - minVal || 1.0;
        const normalized = new Float32Array(flat.length);
        for (let i = 0; i < flat.length; i++) {
            normalized[i] = Math.max(0.0, Math.min(1.0, (flat[i] - minVal) / range));
        }

        // Determine target region based on layer depth
        const depthRatio = totalLayers > 1 ? layerIndex / (totalLayers - 1) : 0.5;
        const result = new Float32Array(VOXEL_COUNT);

        // Fill volume: interpolate normalized activations across the target region
        // Strategy: treat activation as a 1D signal, map it onto spatial coordinates
        // within the anatomically-appropriate region via a space-filling approach.
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
            for (let y = 0; y < VOXEL_DIM; y++) {
                const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;

                    // Region mask based on layer depth
                    let regionWeight = 0.0;
                    if (depthRatio < 0.25) {
                        // Occipital: rear of brain (Z < -0.3)
                        regionWeight = Math.exp(-(Math.max(0, wz + 0.3) ** 2) * 8.0) * Math.exp(-(wx * wx + wy * wy) * 1.5);
                    } else if (depthRatio < 0.50) {
                        // Temporal: sides (|X| > 0.4)
                        regionWeight = Math.exp(-((Math.abs(wx) - 0.6) ** 2) * 6.0) * Math.exp(-(wy * wy + wz * wz) * 1.0);
                    } else if (depthRatio < 0.75) {
                        // Parietal: top (Y > 0.3)
                        regionWeight = Math.exp(-(Math.max(0, 0.3 - wy) ** 2) * 8.0) * Math.exp(-(wx * wx + wz * wz) * 1.5);
                    } else {
                        // Frontal: front (Z > 0.3)
                        regionWeight = Math.exp(-(Math.max(0, 0.3 - wz) ** 2) * 8.0) * Math.exp(-(wx * wx + wy * wy) * 1.5);
                    }

                    // Sample from normalized activation using a deterministic hash of position
                    const hash = Math.abs(
                        Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
                    ) % 1.0;
                    const actIdx = Math.floor(hash * normalized.length);
                    const actVal = normalized[actIdx];

                    result[idx++] = actVal * regionWeight;
                }
            }
        }
        return result;
    }
}

export class SynaptiXEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.currentPattern = null;
        this.projector = new AITensorProjector();
        this.fusionParticlesEnabled = true;
        this.frameSequence = [];       // Partner Float32Array frames
        this.avatarFrameSequence = []; // Optional paired avatar-A phantom frames
        this.frameIndex = 0;
        this.isPlayingFrames = false;
        this.framePlaybackRate = 4;    // frames per second
        this.lastFrameTime = 0;
        this.liveCallback = null;      // External live source callback
        this.layerCount = 1;
        this.lastSourceInfo = 'No partner tensor loaded';
        this.partnerSourceType = 'none';
        this.partnerSocket = null;
        this.couplingModel = new SynaptiXCouplingModel({ windowSeconds: 2, sampleRate: 10 });
        this.effects = { empathyPulse: null, divergenceStorm: null };
        this.resonanceStats = {        // Computed each update
            resonance: 0.0,
            humanEnergy: 0.0,
            aiEnergy: 0.0,
            avatarAEnergy: 0.0,
            partnerEnergy: 0.0,
            globalCoupling: 0.0,
            regions: Object.fromEntries(SYNAPTIX_REGIONS.map((name) => [name, 0]))
        };
    }

    setPartnerTensorData(data, sourceType = this.partnerSourceType || 'external') {
        if (data.length !== VOXEL_COUNT) {
            console.warn(`[SynaptiX] Tensor size mismatch: expected ${VOXEL_COUNT}, got ${data.length}`);
            return false;
        }
        this.renderer.setPartnerTensorData(data);
        this.partnerSourceType = sourceType;
        return true;
    }

    // Deprecated compatibility alias.
    setTensorData(data) {
        return this.setPartnerTensorData(data, 'legacy-ai');
    }

    async loadTensorFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        let payload;
        if (ext === 'npy') {
            payload = await this.loadNPY(file);
        } else if (ext === 'bin') {
            payload = await this.loadBinary(file);
        } else if (ext === 'csv') {
            payload = await this.loadCSV(file);
        } else {
            console.warn('[SynaptiX] Unsupported file format');
            return;
        }
        if (payload.frames) {
            this.loadFrameSequence(payload.frames);
            if (this.frameSequence.length > 0) {
                this.scrubToFrame(0);
            }
            this.lastSourceInfo = `Sequence loaded: ${file.name} (${this.frameSequence.length} frames)`;
            console.log(`[SynaptiX] Loaded frame sequence from file (${this.frameSequence.length} frames)`);
            return;
        }
        this.setPartnerTensorData(payload.tensor, 'file');
        this.layerCount = payload.layerCount || 1;
        this.lastSourceInfo = payload.projected
            ? `Projected activations: ${file.name} (${payload.sourceLength} values → 32^3)`
            : `Tensor loaded: ${file.name}`;
        console.log('[SynaptiX] Partner tensor loaded from file');
    }

    async loadBinary(file) {
        const buffer = await file.arrayBuffer();
        return this._parseTensorPayload(new Float32Array(buffer));
    }

    async loadNPY(file) {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        if (view.getUint8(0) !== 0x93) throw new Error('Not a valid .npy file');
        const majorVersion = view.getUint8(6);
        const headerLen = majorVersion >= 2 ? view.getUint32(8, true) : view.getUint16(8, true);
        const dataOffset = 10 + headerLen;
        return this._parseTensorPayload(new Float32Array(buffer.slice(dataOffset)));
    }

    async loadCSV(file) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const values = [];
        for (const line of lines) {
            const parts = line.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            values.push(...parts);
        }
        return this._parseTensorPayload(new Float32Array(values));
    }

    // [SynaptiX] Project an external activation tensor into the 32³ volume
    projectActivation(activation, layerIndex = 0, totalLayers = 1) {
        const projected = this.projector.project(activation, layerIndex, totalLayers);
        this.layerCount = Math.max(1, totalLayers);
        this.lastSourceInfo = `Projected external activation (${layerIndex + 1}/${this.layerCount})`;
        this.setPartnerTensorData(projected, 'ai-projection');
    }

    setProjector(fn) {
        this.projector.setProjector(fn);
    }

    // ── Frame Sequence Playback (token-level LLM trace) ──

    loadFrameSequence(frames) {
        // frames: Array<Float32Array> or Array<Array<number>>
        this.frameSequence = frames.map(f => {
            if (f instanceof Float32Array) return f;
            return new Float32Array(f);
        }).filter(f => f.length === VOXEL_COUNT);
        this.frameIndex = 0;
        this.avatarFrameSequence = [];
        this.isPlayingFrames = false;
        this.layerCount = this.frameSequence.length > 0 ? this.frameSequence.length : 1;
        console.log(`[SynaptiX] Loaded ${this.frameSequence.length} frames`);
    }

    playFrames(rate = 4) {
        this.isPlayingFrames = true;
        this.framePlaybackRate = rate;
        this.lastFrameTime = performance.now();
    }

    pauseFrames() {
        this.isPlayingFrames = false;
    }

    scrubToFrame(index) {
        if (this.frameSequence.length === 0) return;
        this.frameIndex = Math.max(0, Math.min(this.frameSequence.length - 1, Math.floor(index)));
        this.setPartnerTensorData(this.frameSequence[this.frameIndex], this.avatarFrameSequence.length ? 'paired-phantom' : 'sequence');
        if (this.avatarFrameSequence[this.frameIndex]) {
            this.renderer.tensorPlaybackMode = true;
            this.renderer.setVoxelData(this.avatarFrameSequence[this.frameIndex]);
        }
    }

    update(timestamp) {
        // Frame auto-advance
        if (this.isPlayingFrames && this.frameSequence.length > 0) {
            const dt = (timestamp - this.lastFrameTime) / 1000;
            const frameDelta = dt * this.framePlaybackRate;
            if (frameDelta >= 1.0) {
                this.frameIndex = (this.frameIndex + Math.floor(frameDelta)) % this.frameSequence.length;
                this.scrubToFrame(this.frameIndex);
                this.lastFrameTime = timestamp;
            }
        }

        // Live callback polling skeleton
        if (this.liveCallback) {
            const liveData = this.liveCallback();
            if (liveData) {
                this.setPartnerTensorData(liveData, 'callback');
            }
        }

        if ((this.renderer?.params?.style || 0) >= 4.0) {
            const stats = this.couplingModel.update(
                timestamp,
                this.renderer?._lastHumanTensor,
                this.renderer?._lastAITensor
            );
            this._syncResonanceStats(stats);
            this._updateEffects(timestamp);
            this.renderer?.setSynaptiXCoupling?.({
                ...stats,
                enabled: this.couplingModel.enabled,
                strength: this.couplingModel.strength,
                empathyPulse: this.effects.empathyPulse,
                divergenceStorm: this.effects.divergenceStorm,
            });
        }
    }

    setLiveCallback(callback) {
        this.liveCallback = callback;
        this.lastSourceInfo = callback ? 'Live callback source connected' : 'Live callback source disconnected';
    }

    setCouplingConfig(options = {}) {
        this.couplingModel.configure(options);
        if (options.windowSeconds !== undefined) {
            this.renderer.setParams({ couplingWindowSeconds: this.couplingModel.windowSeconds });
        }
        if (options.strength !== undefined) {
            this.renderer.setParams({ couplingStrength: this.couplingModel.strength });
        }
        return this.getCouplingState();
    }

    triggerEmpathyPulse({ region = 'frontal', intensity = 1, duration = 1.5 } = {}) {
        const safeRegion = SYNAPTIX_REGIONS.includes(region) ? region : 'frontal';
        const now = performance.now();
        this.effects.empathyPulse = {
            region: safeRegion,
            intensity: Math.max(0, Math.min(1, Number(intensity) || 0)),
            startedAt: now,
            endsAt: now + Math.max(0.1, Number(duration) || 1.5) * 1000,
        };
    }

    triggerDivergenceStorm({ intensity = 1, duration = 2 } = {}) {
        const now = performance.now();
        this.effects.divergenceStorm = {
            intensity: Math.max(0, Math.min(1, Number(intensity) || 0)),
            startedAt: now,
            endsAt: now + Math.max(0.1, Number(duration) || 2) * 1000,
        };
    }

    connectPartnerWebSocket(url, { WebSocketImpl = globalThis.WebSocket } = {}) {
        this.disconnectPartnerWebSocket();
        if (!WebSocketImpl) throw new Error('WebSocket is unavailable');
        const socket = new WebSocketImpl(url);
        this.partnerSocket = socket;
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
            this.partnerSourceType = 'websocket';
            this.lastSourceInfo = `Partner WebSocket connected: ${url}`;
        };
        socket.onmessage = (event) => {
            if (!(event.data instanceof ArrayBuffer) || event.data.byteLength !== VOXEL_COUNT * 4) {
                console.warn(`[SynaptiX] Ignored partner WebSocket frame: expected ${VOXEL_COUNT * 4} bytes`);
                return;
            }
            this.setPartnerTensorData(new Float32Array(event.data), 'websocket');
        };
        socket.onerror = () => {
            this.lastSourceInfo = `Partner WebSocket error: ${url}`;
        };
        socket.onclose = () => {
            if (this.partnerSocket === socket) this.partnerSocket = null;
            this.lastSourceInfo = 'Partner WebSocket disconnected; showing last frame';
        };
        return socket;
    }

    disconnectPartnerWebSocket() {
        const socket = this.partnerSocket;
        this.partnerSocket = null;
        if (socket && socket.readyState < 2) socket.close();
    }

    getCouplingState() {
        return {
            enabled: this.couplingModel.enabled,
            strength: this.couplingModel.strength,
            windowSeconds: this.couplingModel.windowSeconds,
            ...this.couplingModel.stats,
        };
    }

    // ── Resonance Stats ──

    computeResonanceStats(humanTensor) {
        if ((this.renderer?.params?.style || 0) < 4.0) return this.resonanceStats;
        if (humanTensor && this.renderer?._lastAITensor) {
            const stats = this.couplingModel.update(performance.now(), humanTensor, this.renderer._lastAITensor);
            return this._syncResonanceStats(stats);
        }
        // humanTensor: Float32Array of VOXEL_COUNT (optional, samples from renderer if omitted)
        if (!humanTensor && this.renderer?._lastHumanTensor?.length === VOXEL_COUNT) {
            humanTensor = this.renderer._lastHumanTensor;
        }

        if (!humanTensor && this.renderer && this.renderer.tensorBuffer) {
            // Can't read GPU buffer synchronously; use proxy values from params
            const blended = this.renderer.params.aiInfluence || 0;
            this.resonanceStats = {
                resonance: blended * (1.0 - (this.renderer.params.resonanceThreshold || 0.2)) * 100,
                humanEnergy: (1.0 - blended) * 100,
                aiEnergy: blended * 100
            };
            return this.resonanceStats;
        }

        if (!humanTensor || humanTensor.length !== VOXEL_COUNT) {
            return this.resonanceStats;
        }

        // Read AI tensor back from renderer (if available) or use last known
        // Note: GPU→CPU readback is async; this is a best-effort approximation
        let aiTensor = null;
        try {
            // Attempt to read from the renderer's internal state if it caches CPU-side
            if (this.renderer._lastAITensor && this.renderer._lastAITensor.length === VOXEL_COUNT) {
                aiTensor = this.renderer._lastAITensor;
            }
        } catch (e) { /* no cached tensor */ }

        if (!aiTensor) {
            this.resonanceStats = { resonance: 0, humanEnergy: 0, aiEnergy: 0 };
            return this.resonanceStats;
        }

        let sumHuman = 0, sumAI = 0, sumResonance = 0, count = 0;
        for (let i = 0; i < VOXEL_COUNT; i++) {
            const h = humanTensor[i];
            const a = aiTensor[i];
            sumHuman += h;
            sumAI += a;
            const diff = Math.abs(h - a);
            const thresh = this.renderer.params.resonanceThreshold || 0.2;
            const resonance = Math.max(0, 1.0 - diff / Math.max(thresh, 0.001));
            sumResonance += resonance;
            count++;
        }
        this.resonanceStats = {
            resonance: count > 0 ? (sumResonance / count) * 100 : 0,
            humanEnergy: count > 0 ? (sumHuman / count) * 100 : 0,
            aiEnergy: count > 0 ? (sumAI / count) * 100 : 0
        };
        return this.resonanceStats;
    }

    _syncResonanceStats(stats) {
        this.resonanceStats = {
            resonance: stats.globalCoupling * 100,
            humanEnergy: stats.avatarAEnergy,
            aiEnergy: stats.partnerEnergy,
            avatarAEnergy: stats.avatarAEnergy,
            partnerEnergy: stats.partnerEnergy,
            globalCoupling: stats.globalCoupling,
            regions: { ...stats.regions },
        };
        return this.resonanceStats;
    }

    _updateEffects(timestamp) {
        for (const key of ['empathyPulse', 'divergenceStorm']) {
            const effect = this.effects[key];
            if (effect && timestamp >= effect.endsAt) this.effects[key] = null;
        }
    }

    // ── Preset Patterns ──

    generatePattern(patternId) {
        const data = this.createPatternData(patternId);
        if (!data) return;
        this.setPartnerTensorData(data, 'phantom');
        this.currentPattern = patternId;
        console.log(`[SynaptiX] Generated pattern: ${patternId}`);
    }

    createPatternData(patternId) {
        const data = new Float32Array(VOXEL_COUNT);
        switch (patternId) {
            case 'attention-frontal':
                this._fillAttentionFrontal(data);
                break;
            case 'attention-occipital':
                this._fillAttentionOccipital(data);
                break;
            case 'attention-temporal':
                this._fillAttentionTemporal(data);
                break;
            case 'gradient-explode':
                this._fillGradientExplode(data);
                break;
            case 'embedding-space':
                this._fillEmbeddingSpace(data);
                break;
            case 'aligned-prefrontal':
                this._fillAlignedPrefrontal(data);
                break;
            case 'hallucination-spike':
                this._fillHallucinationSpike(data);
                break;
            case 'visual-mismatch':
                this._fillVisualMismatch(data);
                break;
            case 'full-resonance':
                this._fillFullResonance(data);
                break;
            default:
                return null;
        }
        return data;
    }

    generatePhantomFrames(sequenceId = 'resonance') {
        const sequences = {
            resonance: [
                'attention-occipital',
                'visual-mismatch',
                'aligned-prefrontal',
                'full-resonance'
            ],
            hallucination: [
                'attention-occipital',
                'hallucination-spike',
                'visual-mismatch',
                'hallucination-spike'
            ]
        };
        const patternIds = sequences[sequenceId] || sequences.resonance;
        const frames = patternIds
            .map((patternId) => this.createPatternData(patternId))
            .filter(Boolean);
        this.loadFrameSequence(frames);
        if (frames.length > 0) {
            this.scrubToFrame(0);
        }
        this.lastSourceInfo = `Built-in phantom sequence: ${sequenceId} (${frames.length} frames)`;
        return frames.length;
    }

    generatePairedPhantomFrames(sequenceId = 'social-coupling') {
        const avatarPatterns = sequenceId === 'social-coupling'
            ? ['attention-occipital', 'attention-temporal', 'aligned-prefrontal', 'visual-mismatch', 'full-resonance', 'aligned-prefrontal']
            : ['attention-frontal', 'attention-occipital', 'visual-mismatch', 'full-resonance'];
        const avatarFrames = avatarPatterns.map((id) => this.createPatternData(id)).filter(Boolean);
        const partnerFrames = avatarFrames.map((frame, frameIndex) => {
            const partner = new Float32Array(frame.length);
            const divergent = frameIndex === Math.max(1, avatarFrames.length - 3);
            for (let i = 0; i < frame.length; i++) {
                const noise = ((i * 1103515245 + frameIndex * 12345) >>> 16 & 255) / 255;
                partner[i] = divergent
                    ? Math.max(0, Math.min(1, (1 - frame[i]) * 0.55 + noise * 0.25))
                    : Math.max(0, Math.min(1, frame[i] * 0.9 + noise * 0.04));
            }
            return partner;
        });
        this.loadFrameSequence(partnerFrames);
        this.avatarFrameSequence = avatarFrames;
        this.couplingModel.reset();
        for (let i = 0; i < partnerFrames.length; i++) {
            this.couplingModel.update(i * (1000 / this.couplingModel.sampleRate), avatarFrames[i], partnerFrames[i]);
        }
        this._syncResonanceStats(this.couplingModel.stats);
        this.scrubToFrame(0);
        this.partnerSourceType = 'paired-phantom';
        this.currentPattern = `paired:${sequenceId}`;
        this.lastSourceInfo = `Paired phantom sequence: ${sequenceId} (${partnerFrames.length} frames)`;
        return partnerFrames.length;
    }

    _parseTensorPayload(floatArray) {
        if (floatArray.length === VOXEL_COUNT) {
            return { tensor: floatArray, layerCount: 1, projected: false, sourceLength: floatArray.length };
        }

        if (floatArray.length > VOXEL_COUNT && floatArray.length % VOXEL_COUNT === 0) {
            const frameCount = floatArray.length / VOXEL_COUNT;
            const frames = new Array(frameCount);
            for (let i = 0; i < frameCount; i++) {
                const start = i * VOXEL_COUNT;
                frames[i] = floatArray.slice(start, start + VOXEL_COUNT);
            }
            return { frames };
        }

        const projected = this.projector.project(floatArray, 0, 1);
        console.warn(`[SynaptiX] Projected non-32^3 tensor payload of size ${floatArray.length} into 32^3 brain volume`);
        return {
            tensor: projected,
            layerCount: 1,
            projected: true,
            sourceLength: floatArray.length
        };
    }

    // ── Original Patterns ──

    _fillAttentionFrontal(data) {
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz > 0.3) {
                        const d = Math.sqrt(wx*wx + wy*wy + (wz-0.8)*(wz-0.8));
                        val = Math.exp(-d * d * 4.0) * (0.7 + 0.3 * Math.sin(x * 3.7 + y * 2.3));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillAttentionOccipital(data) {
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz < -0.3) {
                        const d = Math.sqrt(wx*wx + wy*wy + (wz+0.8)*(wz+0.8));
                        val = Math.exp(-d * d * 6.0) * (0.8 + 0.2 * Math.sin(x * 8.0 + z * 5.0));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillAttentionTemporal(data) {
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (Math.abs(wx) > 0.4) {
                        const d = Math.sqrt((Math.abs(wx)-0.7)*(Math.abs(wx)-0.7) + wy*wy*0.5 + wz*wz*0.3);
                        val = Math.exp(-d * d * 3.0) * (0.6 + 0.4 * Math.sin(y * 2.0 + z * 4.0));
                    }
                    data[idx++] = Math.min(1.0, val);
                }
            }
        }
    }

    _fillGradientExplode(data) {
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const r = Math.sqrt(wx*wx + wy*wy + wz*wz);
                    const noise = Math.sin(x * 7.3) * Math.cos(y * 5.1) * Math.sin(z * 9.7);
                    const val = Math.exp(-r * r * 1.5) * (0.5 + 0.5 * noise);
                    data[idx++] = Math.min(1.0, Math.max(0.0, val));
                }
            }
        }
    }

    _fillEmbeddingSpace(data) {
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const val = 0.5 + 0.5 * Math.sin(wx * 3.0) * Math.cos(wy * 2.5) * Math.sin(wz * 4.0);
                    data[idx++] = Math.min(1.0, Math.max(0.0, val * 0.8));
                }
            }
        }
    }

    // ── [NEW] Narrative Presets ──

    _fillAlignedPrefrontal(data) {
        // Human and AI agree: strong, clean frontal lobe activation
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz > 0.2) {
                        const d = Math.sqrt(wx*wx + (wy-0.2)*(wy-0.2) + (wz-0.7)*(wz-0.7));
                        val = Math.exp(-d * d * 5.0) * 0.95;
                    }
                    data[idx++] = val;
                }
            }
        }
    }

    _fillHallucinationSpike(data) {
        // Chaotic high-frequency spikes = confabulation signature
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const noise = Math.sin(x * 13.7) * Math.cos(y * 9.3) * Math.sin(z * 17.1);
                    const r = Math.sqrt(wx*wx + wy*wy + wz*wz);
                    const val = Math.exp(-r * r * 0.8) * (0.3 + 0.7 * noise * noise);
                    data[idx++] = Math.min(1.0, Math.max(0.0, val));
                }
            }
        }
    }

    _fillVisualMismatch(data) {
        // Occipital strong, but with phase-inverted interference pattern
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    let val = 0.0;
                    if (wz < -0.2) {
                        const d = Math.sqrt(wx*wx + wy*wy + (wz+0.7)*(wz+0.7));
                        const envelope = Math.exp(-d * d * 4.0);
                        const interference = Math.sin(x * 6.0) * Math.cos(y * 6.0) * Math.sin(z * 6.0);
                        val = envelope * (0.5 + 0.5 * interference);
                    }
                    data[idx++] = Math.min(1.0, Math.max(0.0, val));
                }
            }
        }
    }

    _fillFullResonance(data) {
        // Broad, smooth activation across the whole brain = perfect alignment
        let idx = 0;
        for (let z = 0; z < VOXEL_DIM; z++) {
            for (let y = 0; y < VOXEL_DIM; y++) {
                for (let x = 0; x < VOXEL_DIM; x++) {
                    const wx = (x / VOXEL_DIM) * 2.0 - 1.0;
                    const wy = (y / VOXEL_DIM) * 2.0 - 1.0;
                    const wz = (z / VOXEL_DIM) * 2.0 - 1.0;
                    const r = Math.sqrt(wx*wx + wy*wy + wz*wz);
                    const val = Math.exp(-r * r * 2.0) * 0.85;
                    data[idx++] = val;
                }
            }
        }
    }
}

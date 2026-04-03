// tensor-player.js
// BCI Tensor Data Playback Engine for Neuro-Weaver
//
// Streams sequences of 32x32x32 activity tensors to the renderer.
// Supports: built-in synthetic patterns, binary files (.bin), numpy (.npy), CSV series.
// Future: WebSocket for real-time BCI devices.

const VOXEL_DIM = 32;
const VOXEL_COUNT = VOXEL_DIM ** 3; // 32768 floats per frame
const BRAIN_RANGE = 1.6; // World-space brain radius

export class TensorPlayer {
    constructor(renderer) {
        this.renderer = renderer;
        this.isPlaying = false;
        this.currentFrame = 0;
        this.playbackSpeed = 1.0;
        this.fps = 30;
        this.frames = [];
        this.lastFrameTime = 0;
        this.onFrameChange = null;  // callback(currentFrame, totalFrames)
        this.onPlayStateChange = null; // callback(isPlaying)

        // WebSocket for real-time BCI (future)
        this._ws = null;
        this._wsBuffer = [];
    }

    // ─── Synthetic Pattern Generators ─────────────────────────────────────────

    // Alpha Waves: 8-12 Hz posterior oscillation (occipital-parietal dominance)
    generateAlphaWaves(numFrames = 300) {
        const dim = VOXEL_DIM;
        const frames = [];
        for (let f = 0; f < numFrames; f++) {
            const data = new Float32Array(VOXEL_COUNT);
            const t = (f / numFrames) * Math.PI * 20; // ~10 full alpha cycles
            for (let z = 0; z < dim; z++)
            for (let y = 0; y < dim; y++)
            for (let x = 0; x < dim; x++) {
                const wx = (x / dim) * 2 - 1;
                const wy = (y / dim) * 2 - 1;
                const wz = (z / dim) * 2 - 1;
                // Posterior cortex: negative Z (occipital) + upper Y (parietal)
                const posterior = Math.max(0, -wz * 0.6 + wy * 0.25);
                const distance = Math.sqrt(wx*wx + wy*wy + wz*wz);
                const inBrain = distance < 1.0 ? 1.0 : 0.0;
                const wave = (Math.sin(t + wz * 3.5) * 0.5 + 0.5);
                data[z * dim * dim + y * dim + x] = posterior * wave * 0.85 * inBrain;
            }
            frames.push(data);
        }
        return frames;
    }

    // Working Memory: Sustained frontal + parietal co-activation with retrieval bursts
    generateWorkingMemory(numFrames = 300) {
        const dim = VOXEL_DIM;
        const frames = [];
        for (let f = 0; f < numFrames; f++) {
            const data = new Float32Array(VOXEL_COUNT);
            const t = f / numFrames;
            // Encoding phase (0-0.3), maintenance (0.3-0.7), retrieval burst (0.7-1.0)
            const encodeStrength = Math.max(0, 1 - t / 0.3) * (t < 0.3 ? 1 : 0);
            const maintainStrength = t > 0.3 && t < 0.7 ? 0.5 + 0.15 * Math.sin(t * 20) : 0;
            const retrieveStrength = t > 0.7 ? Math.min(1, (t - 0.7) / 0.15) : 0;

            for (let z = 0; z < dim; z++)
            for (let y = 0; y < dim; y++)
            for (let x = 0; x < dim; x++) {
                const wx = (x / dim) * 2 - 1;
                const wy = (y / dim) * 2 - 1;
                const wz = (z / dim) * 2 - 1;
                const dist = Math.sqrt(wx*wx + wy*wy + wz*wz);
                if (dist > 1.0) { data[z * dim * dim + y * dim + x] = 0; continue; }

                // Frontal (wz > 0.3): encoding + retrieval
                const frontal = Math.max(0, wz - 0.3) / 0.7;
                // Parietal (wy > 0.3, any z): maintenance hub
                const parietal = Math.max(0, wy - 0.25) / 0.75;
                // Hippocampus-like deep medial (near center, slight negative z)
                const hippo = Math.max(0, 0.3 - dist) / 0.3 * Math.max(0, -wz * 0.5);

                const activity =
                    frontal * (encodeStrength * 0.9 + retrieveStrength * 1.0) +
                    parietal * maintainStrength +
                    hippo * (encodeStrength * 0.7 + retrieveStrength * 0.8);

                data[z * dim * dim + y * dim + x] = Math.min(1, activity);
            }
            frames.push(data);
        }
        return frames;
    }

    // Visual Burst: Occipital spike spreading forward (visual processing cascade)
    generateVisualBurst(numFrames = 180) {
        const dim = VOXEL_DIM;
        const frames = [];
        for (let f = 0; f < numFrames; f++) {
            const data = new Float32Array(VOXEL_COUNT);
            const t = f / numFrames; // 0→1 over sequence
            // Burst onset at t=0.05, spreading wave front moves +Z (occipital→frontal)
            const burstT = Math.max(0, t - 0.05);
            const waveFront = -1.0 + burstT * 3.5; // Wave starts at occipital (-1.0), moves forward

            for (let z = 0; z < dim; z++)
            for (let y = 0; y < dim; y++)
            for (let x = 0; x < dim; x++) {
                const wx = (x / dim) * 2 - 1;
                const wy = (y / dim) * 2 - 1;
                const wz = (z / dim) * 2 - 1;
                const dist = Math.sqrt(wx*wx + wy*wy + wz*wz);
                if (dist > 1.0) { data[z * dim * dim + y * dim + x] = 0; continue; }

                // Wave envelope: Gaussian around the advancing wave front
                const distToWave = Math.abs(wz - waveFront);
                const envelope = Math.exp(-distToWave * distToWave * 4.0);
                // Occipital region amplifies the initial burst
                const occipitalBias = Math.max(0, -wz * 0.8) + 0.2;
                // Fades over time as the burst dissipates
                const fade = Math.max(0, 1 - t * 0.8);

                data[z * dim * dim + y * dim + x] = Math.min(1, envelope * occipitalBias * fade * 1.2);
            }
            frames.push(data);
        }
        return frames;
    }

    // Seizure Spread: Radially expanding wave from a deep-brain epicenter
    generateSeizureSpread(numFrames = 240) {
        const dim = VOXEL_DIM;
        const frames = [];
        // Epicenter: deep thalamic-like position (slightly anterior)
        const [ex, ey, ez] = [0.0, -0.1, 0.15];
        for (let f = 0; f < numFrames; f++) {
            const data = new Float32Array(VOXEL_COUNT);
            const t = f / numFrames;
            // Seizure: slow build, rapid spread, then exhaustion
            const onset = Math.min(1, t / 0.15);
            const spreadRadius = onset * 1.6; // expands to full brain
            const exhaustion = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1.0;
            const ictalFreq = 20 + t * 10; // Increasing frequency (tonic→clonic)

            for (let z = 0; z < dim; z++)
            for (let y = 0; y < dim; y++)
            for (let x = 0; x < dim; x++) {
                const wx = (x / dim) * 2 - 1;
                const wy = (y / dim) * 2 - 1;
                const wz = (z / dim) * 2 - 1;
                const dist = Math.sqrt(wx*wx + wy*wy + wz*wz);
                if (dist > 1.0) { data[z * dim * dim + y * dim + x] = 0; continue; }

                const dEpi = Math.sqrt((wx-ex)**2 + (wy-ey)**2 + (wz-ez)**2);
                // Wave ring: active at spreading frontier, with rippling behind it
                const withinSpread = dEpi < spreadRadius ? 1.0 : 0.0;
                const waveRing = Math.exp(-Math.pow(dEpi - spreadRadius * 0.85, 2) * 8.0);
                const ictalOscillation = (Math.sin(t * ictalFreq * Math.PI * 2 + dEpi * 5.0) * 0.5 + 0.5);
                const activity = (waveRing * 0.9 + withinSpread * ictalOscillation * 0.6) * onset * exhaustion;

                data[z * dim * dim + y * dim + x] = Math.min(1, activity);
            }
            frames.push(data);
        }
        return frames;
    }

    // Meditation / Slow-Wave: Synchronized low-frequency whole-brain rhythm
    generateMeditation(numFrames = 360) {
        const dim = VOXEL_DIM;
        const frames = [];
        for (let f = 0; f < numFrames; f++) {
            const data = new Float32Array(VOXEL_COUNT);
            const t = (f / numFrames) * Math.PI * 8; // ~4 slow cycles (delta/theta)
            for (let z = 0; z < dim; z++)
            for (let y = 0; y < dim; y++)
            for (let x = 0; x < dim; x++) {
                const wx = (x / dim) * 2 - 1;
                const wy = (y / dim) * 2 - 1;
                const wz = (z / dim) * 2 - 1;
                const dist = Math.sqrt(wx*wx + wy*wy + wz*wz);
                if (dist > 1.0) { data[z * dim * dim + y * dim + x] = 0; continue; }

                // Slow coherent wave with slight radial phase offset (synchrony)
                const phase = dist * 1.5; // Small phase delay from center outward
                const wave = Math.sin(t - phase) * 0.5 + 0.5;
                // Default-mode network bias: medial + midline structures
                const medial = Math.max(0, 0.4 - Math.abs(wx)) / 0.4;
                const activity = wave * (0.3 + medial * 0.5);

                data[z * dim * dim + y * dim + x] = Math.min(1, activity * 0.8);
            }
            frames.push(data);
        }
        return frames;
    }

    // ─── Data Loaders ──────────────────────────────────────────────────────────

    // Load raw binary: sequence of Float32Arrays packed contiguously
    // Format: [frame0: 32768 floats][frame1: 32768 floats]...
    async loadBinary(file) {
        const buffer = await file.arrayBuffer();
        const all = new Float32Array(buffer);
        const numFrames = Math.floor(all.length / VOXEL_COUNT);
        const frames = [];
        for (let i = 0; i < numFrames; i++) {
            frames.push(all.slice(i * VOXEL_COUNT, (i + 1) * VOXEL_COUNT));
        }
        return frames;
    }

    // Load NumPy .npy file (float32, shape [N, 32, 32, 32] or [N, 32768])
    async loadNPY(file) {
        const buffer = await file.arrayBuffer();
        const view = new DataView(buffer);
        // NPY magic: \x93NUMPY
        if (view.getUint8(0) !== 0x93) throw new Error('Not a valid .npy file');
        const majorVersion = view.getUint8(6);
        const headerLen = majorVersion >= 2
            ? view.getUint32(8, true)
            : view.getUint16(8, true);
        const dataOffset = 10 + headerLen;
        const dataBuffer = buffer.slice(dataOffset);
        const all = new Float32Array(dataBuffer);
        const numFrames = Math.floor(all.length / VOXEL_COUNT);
        const frames = [];
        for (let i = 0; i < numFrames; i++) {
            frames.push(all.slice(i * VOXEL_COUNT, (i + 1) * VOXEL_COUNT));
        }
        return frames;
    }

    // Load the existing fmri.csv format: time, frontal, parietal, occipital, temporal, deep
    // Interpolates into smooth tensor frames at this.fps
    async loadCSVSeries(file) {
        const text = await file.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const vals = line.split(',');
            const row = {};
            headers.forEach((h, i) => { row[h] = parseFloat(vals[i]); });
            return row;
        });
        if (rows.length < 2) throw new Error('CSV needs at least 2 time points');

        const totalDuration = rows[rows.length - 1].time;
        const numFrames = Math.ceil(totalDuration * this.fps);
        const frames = [];

        const regionPositions = {
            frontal:  [0.0, 0.0, 1.2],
            parietal: [0.0, 1.0, 0.0],
            occipital:[0.0, 0.0, -1.2],
            temporal: [1.0, 0.0, 0.0],
            deep:     [0.0, 0.0, 0.0],
        };

        for (let f = 0; f < numFrames; f++) {
            const t = (f / numFrames) * totalDuration;
            // Find surrounding rows and interpolate
            let r0 = rows[0], r1 = rows[1];
            for (let i = 0; i < rows.length - 1; i++) {
                if (rows[i].time <= t && rows[i + 1].time >= t) {
                    r0 = rows[i]; r1 = rows[i + 1]; break;
                }
            }
            const alpha = r1.time > r0.time ? (t - r0.time) / (r1.time - r0.time) : 0;

            const data = new Float32Array(VOXEL_COUNT);
            const dim = VOXEL_DIM;

            for (const [region, pos] of Object.entries(regionPositions)) {
                const intensity = (r0[region] || 0) * (1 - alpha) + (r1[region] || 0) * alpha;
                if (intensity < 0.02) continue;
                const [cx, cy, cz] = pos;
                // Gaussian blob at region position
                for (let z = 0; z < dim; z++)
                for (let y = 0; y < dim; y++)
                for (let x = 0; x < dim; x++) {
                    const wx = (x / dim) * 2 * BRAIN_RANGE - BRAIN_RANGE;
                    const wy = (y / dim) * 2 * BRAIN_RANGE - BRAIN_RANGE;
                    const wz = (z / dim) * 2 * BRAIN_RANGE - BRAIN_RANGE;
                    const d2 = (wx-cx)**2 + (wy-cy)**2 + (wz-cz)**2;
                    const blob = Math.exp(-d2 / (0.35 * 0.35));
                    const idx = z * dim * dim + y * dim + x;
                    data[idx] = Math.min(1, data[idx] + blob * intensity);
                }
            }
            frames.push(data);
        }
        return frames;
    }

    // ─── Playback Controls ─────────────────────────────────────────────────────

    loadFrames(frames) {
        this.frames = frames;
        this.currentFrame = 0;
        this.lastFrameTime = 0;
        this.onFrameChange?.(0, frames.length);
    }

    play() {
        if (!this.frames.length) return;
        this.isPlaying = true;
        this.renderer.tensorPlaybackMode = true;
        this.lastFrameTime = performance.now();
        this.onPlayStateChange?.(true);
    }

    pause() {
        this.isPlaying = false;
        this.onPlayStateChange?.(false);
    }

    stop() {
        this.isPlaying = false;
        this.currentFrame = 0;
        this.renderer.tensorPlaybackMode = false; // Re-enable compute shader physics
        this.onPlayStateChange?.(false);
        this.onFrameChange?.(0, this.frames.length);
    }

    seek(frameIndex) {
        this.currentFrame = Math.max(0, Math.min(this.frames.length - 1, frameIndex));
        if (this.frames.length && this.renderer.tensorPlaybackMode) {
            this.renderer.setVoxelData(this.frames[this.currentFrame]);
        }
        this.onFrameChange?.(this.currentFrame, this.frames.length);
    }

    setSpeed(multiplier) {
        this.playbackSpeed = Math.max(0.1, Math.min(8.0, multiplier));
    }

    // Call this every animation frame from main.js
    update(timestamp) {
        if (!this.isPlaying || !this.frames.length) return;
        const elapsed = timestamp - this.lastFrameTime;
        const frameInterval = 1000 / (this.fps * this.playbackSpeed);
        if (elapsed >= frameInterval) {
            this.renderer.setVoxelData(this.frames[this.currentFrame]);
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            this.lastFrameTime = timestamp;
            this.onFrameChange?.(this.currentFrame, this.frames.length);
        }
    }

    // ─── Real-time WebSocket BCI (future hookup) ───────────────────────────────

    connectWebSocket(url) {
        this._ws = new WebSocket(url);
        this._ws.binaryType = 'arraybuffer';
        this._ws.onopen = () => console.log('[TensorPlayer] WebSocket connected:', url);
        this._ws.onmessage = (event) => {
            const data = new Float32Array(event.data);
            if (data.length === VOXEL_COUNT) {
                // Real-time: inject immediately without buffering
                this.renderer.tensorPlaybackMode = true;
                this.renderer.setVoxelData(data);
            }
        };
        this._ws.onerror = (e) => console.error('[TensorPlayer] WebSocket error:', e);
        this._ws.onclose = () => {
            console.log('[TensorPlayer] WebSocket closed');
            this.renderer.tensorPlaybackMode = false;
        };
    }

    disconnectWebSocket() {
        if (this._ws) { this._ws.close(); this._ws = null; }
        this.renderer.tensorPlaybackMode = false;
    }

    get totalFrames() { return this.frames.length; }
    get frameIndex() { return this.currentFrame; }
}

// ─── Built-in pattern catalog ──────────────────────────────────────────────────

export const BUILTIN_PATTERNS = [
    {
        id: 'alpha-waves',
        label: 'Alpha Waves (8-12 Hz)',
        description: 'Posterior oscillation — eyes closed, relaxed wakefulness',
        generate: (player) => player.generateAlphaWaves(300),
        suggestedMode: 0, // Organic glass shell shows it beautifully
    },
    {
        id: 'working-memory',
        label: 'Working Memory Task',
        description: 'Encoding → maintenance → retrieval sequence in frontal-parietal network',
        generate: (player) => player.generateWorkingMemory(300),
        suggestedMode: 3, // Heatmap shows sustained activity well
    },
    {
        id: 'visual-burst',
        label: 'Visual Processing Cascade',
        description: 'Occipital burst propagating forward through visual pathway',
        generate: (player) => player.generateVisualBurst(180),
        suggestedMode: 0,
    },
    {
        id: 'seizure-spread',
        label: 'Seizure Spread (Ictal)',
        description: 'Radially expanding ictal wave from deep-brain epicenter',
        generate: (player) => player.generateSeizureSpread(240),
        suggestedMode: 3, // Heatmap dramatic for seizure
    },
    {
        id: 'meditation',
        label: 'Meditation / Slow-Wave',
        description: 'Synchronized low-frequency whole-brain coherence (delta/theta)',
        generate: (player) => player.generateMeditation(360),
        suggestedMode: 0,
    },
];

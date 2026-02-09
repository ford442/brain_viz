// audio-reactor.js
// Handles Web Audio API integration for reactive brain visualization

export class AudioReactor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;
        this.isActive = false;
        this.stream = null;

        // Configuration
        this.fftSize = 512;
        this.smoothingTimeConstant = 0.8;

        // Analysis State
        this.bass = 0;
        this.mid = 0;
        this.treble = 0;
        this.volume = 0;

        // Beat Detection
        this.beatThreshold = 1.1; // Multiplier for average energy
        this.beatDecay = 0.05;
        this.lastBeatTime = 0;
    }

    async start() {
        if (this.isActive) return;

        try {
            // Initialize Audio Context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            // Request Microphone Access
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create Analyzer
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;

            // Connect Source
            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);

            // Buffer for frequency data
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.isActive = true;
            console.log("[AudioReactor] Started listening to microphone.");
        } catch (error) {
            console.error("[AudioReactor] Failed to start audio:", error);
            alert("Microphone access denied or not supported.");
            this.isActive = false;
        }
    }

    stop() {
        if (!this.isActive) return;

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isActive = false;
        console.log("[AudioReactor] Stopped.");
    }

    update(renderer) {
        if (!this.isActive || !this.analyser) return;

        // Get Frequency Data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Analyze Bands (Simple Average)
        const bufferLength = this.analyser.frequencyBinCount;
        let bassSum = 0, midSum = 0, trebleSum = 0;

        // Ranges (Approximate for 512 FFT)
        const bassRange = Math.floor(bufferLength * 0.1); // Low frequencies
        const midRange = Math.floor(bufferLength * 0.5);  // Mid frequencies

        for (let i = 0; i < bufferLength; i++) {
            const val = this.dataArray[i] / 255.0; // Normalize 0-1
            if (i < bassRange) {
                bassSum += val;
            } else if (i < midRange) {
                midSum += val;
            } else {
                trebleSum += val;
            }
        }

        this.bass = bassSum / bassRange;
        this.mid = midSum / (midRange - bassRange);
        this.treble = trebleSum / (bufferLength - midRange);
        this.volume = (this.bass + this.mid + this.treble) / 3;

        // --- MAP TO RENDERER ---

        // 1. Bass drives Amplitude (Overall pulse strength)
        // Scale: 0.2 (base) + bass * 1.5 (dynamic)
        const targetAmp = 0.2 + (this.bass * 2.0);
        // Smooth transition
        renderer.params.amplitude += (targetAmp - renderer.params.amplitude) * 0.1;

        // 2. Mid drives Flow Speed (Signal velocity)
        // Scale: 2.0 (base) + mid * 8.0 (dynamic)
        const targetSpeed = 2.0 + (this.mid * 8.0);
        renderer.params.flowSpeed += (targetSpeed - renderer.params.flowSpeed) * 0.1;

        // 3. Treble drives Stimulus Injection (Sparks)
        const now = performance.now();
        if (this.treble > 0.4 && (now - this.lastBeatTime > 100)) { // Threshold & Debounce
             // Inject at random cortex location
             // Cortex is roughly surface of brain
             const r = 1.0 + Math.random() * 0.2;
             const theta = Math.random() * Math.PI * 2;
             const phi = Math.random() * Math.PI;

             const x = r * Math.sin(phi) * Math.cos(theta);
             const y = r * Math.sin(phi) * Math.sin(theta);
             const z = r * Math.cos(phi);

             // Intensity based on treble peak
             renderer.injectStimulus(x, y, z, this.treble * 2.0);
             this.lastBeatTime = now;
        }
    }
}

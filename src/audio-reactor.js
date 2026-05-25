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

        // Raw Analysis State
        this.rawBass = 0;
        this.rawMid = 0;
        this.rawTreble = 0;
        this.rawVolume = 0;

        // Central Reactivity Bus (Normalized + Smoothed Features)
        this.features = {
            bass: 0,
            energy: 0,
            brightness: 0,
            onset: 0
        };

        // Onset / Beat Detection
        this.previousEnergy = 0;
        this.lastBeatTime = 0;
    }

    async start() {
        if (this.isActive) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();

            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;

            this.source = this.audioContext.createMediaStreamSource(this.stream);
            this.source.connect(this.analyser);

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

    getFeatures() {
        return this.features;
    }

    update(renderer, player) {
        if (!this.isActive || !this.analyser) return;

        // Get Frequency Data
        this.analyser.getByteFrequencyData(this.dataArray);

        const bufferLength = this.analyser.frequencyBinCount;
        let bassSum = 0, midSum = 0, trebleSum = 0;

        const bassRange = Math.floor(bufferLength * 0.1);
        const midRange = Math.floor(bufferLength * 0.5);

        for (let i = 0; i < bufferLength; i++) {
            const val = this.dataArray[i] / 255.0;
            if (i < bassRange) {
                bassSum += val;
            } else if (i < midRange) {
                midSum += val;
            } else {
                trebleSum += val;
            }
        }

        this.rawBass = bassSum / bassRange;
        this.rawMid = midSum / (midRange - bassRange);
        this.rawTreble = trebleSum / (bufferLength - midRange);
        this.rawVolume = (this.rawBass + this.rawMid + this.rawTreble) / 3;

        // --- CENTRAL REACTIVITY BUS (Smoothed) ---
        const SMOOTHING = 0.2;

        this.features.bass = this.features.bass + (this.rawBass - this.features.bass) * SMOOTHING;
        this.features.energy = this.features.energy + (this.rawVolume - this.features.energy) * SMOOTHING;

        const rawBrightness = this.rawVolume > 0 ? (this.rawTreble / this.rawVolume) * 0.5 : 0;
        this.features.brightness = this.features.brightness + (Math.min(1.0, rawBrightness) - this.features.brightness) * SMOOTHING;

        // Onset Detection
        const energyDelta = this.rawVolume - this.previousEnergy;
        const rawOnset = energyDelta > 0.05 ? energyDelta * 5.0 : 0;

        if (rawOnset > this.features.onset) {
            this.features.onset = Math.min(1.0, rawOnset);
        } else {
            this.features.onset += (0 - this.features.onset) * 0.15; // Fast decay
        }

        this.previousEnergy = this.rawVolume;
    }
}
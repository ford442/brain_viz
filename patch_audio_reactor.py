import re

with open('src/audio-reactor.js', 'r') as f:
    content = f.read()

# Replace the constructor to add new features
new_constructor = """    constructor() {
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

        // Normalized and Smoothed Features (Central Reactivity Bus)
        this.features = {
            bass: 0,
            energy: 0,
            brightness: 0,
            onset: 0
        };

        // Beat Detection
        this.beatThreshold = 1.1; // Multiplier for average energy
        this.beatDecay = 0.05;
        this.lastBeatTime = 0;

        // Onset Detection
        this.previousEnergy = 0;
    }"""

content = re.sub(r'    constructor\(\) \{.*?\n    }', new_constructor, content, flags=re.DOTALL)

# Add getFeatures method
get_features_method = """
    getFeatures() {
        return this.features;
    }

    update(renderer, player) {"""

content = content.replace("    update(renderer, player) {", get_features_method)

# Update the analysis loop
analysis_logic = """    update(renderer, player) {
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

        this.rawBass = bassSum / bassRange;
        this.rawMid = midSum / (midRange - bassRange);
        this.rawTreble = trebleSum / (bufferLength - midRange);
        this.rawVolume = (this.rawBass + this.rawMid + this.rawTreble) / 3;

        // --- CENTRAL REACTIVITY BUS FEATURE EXTRACTION ---
        const SMOOTHING = 0.2; // Exponential moving average factor

        // 1. Bass (low frequency energy)
        this.features.bass += (this.rawBass - this.features.bass) * SMOOTHING;

        // 2. Energy (overall volume/intensity)
        this.features.energy += (this.rawVolume - this.features.energy) * SMOOTHING;

        // 3. Brightness (high frequency content relative to energy)
        const rawBrightness = this.rawVolume > 0 ? (this.rawTreble / this.rawVolume) * 0.5 : 0;
        this.features.brightness += (Math.min(1.0, rawBrightness) - this.features.brightness) * SMOOTHING;

        // 4. Onset (sudden changes/beats)
        const energyDelta = this.rawVolume - this.previousEnergy;
        const rawOnset = energyDelta > 0.05 ? energyDelta * 5.0 : 0; // Spike on sudden increase

        // Onset decays quickly, spikes instantly
        if (rawOnset > this.features.onset) {
            this.features.onset = Math.min(1.0, rawOnset);
        } else {
            this.features.onset += (0 - this.features.onset) * 0.1; // Fast decay
        }

        this.previousEnergy = this.rawVolume;

        // We comment out the direct mapping here because Phase 3 Step 3 handles it in main.js
        // But we leave altitude/hypoxia intact as requested, but modified to use features
        /*
        // --- ALTITUDE/HYPOXIA AUDIO REACTIVITY ---
        // Only activate altitude reactivity when altitude is already elevated
        if (renderer.params.altitude > 2000) {
            const altitudeFromBass = this.features.bass * 4000;
            const targetAlt = Math.min(8000, 2000 + altitudeFromBass);
            renderer.params.altitude += (targetAlt - renderer.params.altitude) * 0.05;
            renderer.updateAltitudeState();

            const metabolicFromTreble = 1.0 + (this.features.brightness * 0.8);
            renderer.params.metabolicRate += (metabolicFromTreble - renderer.params.metabolicRate) * 0.1;

            const oxygenRecovery = 1.0 - (this.features.energy * 0.3);
            const newMitochondrial = Math.max(0.3, oxygenRecovery * renderer.params.mitochondrialFunction);
            renderer.params.mitochondrialFunction += (newMitochondrial - renderer.params.mitochondrialFunction) * 0.1;
        }
        */
    }
}"""

content = re.sub(r'    update\(renderer, player\).*?^}', analysis_logic, content, flags=re.DOTALL|re.MULTILINE)

with open('src/audio-reactor.js', 'w') as f:
    f.write(content)

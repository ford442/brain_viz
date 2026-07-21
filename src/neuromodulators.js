// src/neuromodulators.js
// Predefined neuromodulator profiles that control signal diffusion, decay, and regional retention

export const DEFAULT_PROFILES = {
    'dopamine': {
        name: 'Dopamine',
        color: '#ffaa00', // Gold/Orange
        diffusionRate: 0.1,
        decayRate: 0.95,
        pulseSaturation: 1.2,
        trailLength: 1.5,
        retentionBias: { frontal: 1.0, occipital: -0.2, temporal: 0.5, parietal: 0.2 } // X, Y, Z, W
    },
    'serotonin': {
        name: 'Serotonin',
        color: '#00aaff', // Cyan/Blue
        diffusionRate: 0.15,
        decayRate: 0.98,
        pulseSaturation: 0.8,
        trailLength: 2.0,
        retentionBias: { frontal: 0.8, occipital: 0.2, temporal: 0.4, parietal: 0.6 }
    },
    'acetylcholine': {
        name: 'Acetylcholine',
        color: '#ff00aa', // Magenta/Purple
        diffusionRate: 0.05,
        decayRate: 0.92,
        pulseSaturation: 1.5,
        trailLength: 1.0,
        retentionBias: { frontal: 0.5, occipital: 0.8, temporal: 1.0, parietal: 0.5 }
    },
    'gaba': {
        name: 'GABA',
        color: '#00ffaa', // Mint/Green
        diffusionRate: 0.2,
        decayRate: 0.85,
        pulseSaturation: 0.5,
        trailLength: 0.5,
        retentionBias: { frontal: 0.0, occipital: 0.0, temporal: 0.0, parietal: 0.0 }
    }
};

export function getCustomProfile() {
    try {
        const saved = localStorage.getItem('neuromodulator_custom');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Could not read custom neuromodulator profile from localStorage', e);
    }

    // Default custom profile matches a balanced baseline
    return {
        name: 'Custom',
        color: '#ffffff',
        diffusionRate: 0.1,
        decayRate: 0.96,
        pulseSaturation: 1.0,
        trailLength: 1.0,
        retentionBias: { frontal: 0.5, occipital: 0.0, temporal: 0.2, parietal: 0.2 }
    };
}

export function saveCustomProfile(profile) {
    try {
        localStorage.setItem('neuromodulator_custom', JSON.stringify(profile));
    } catch (e) {
        console.warn('Could not save custom neuromodulator profile to localStorage', e);
    }
}

// [Neuro-Weaver] Mini routines data, part 1 of 2 (split from mini-routines.js for file-size limits)
export const MINI_ROUTINES_PART1 = {
    ',': [ // Pupillary Dilation Simulation
        { time: 0.0, type: 'text', message: 'Simulating Pupillary Dilation', duration: 4.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'camera', target: 'frontal', duration: 2.0, ease: 'sineInOut' },
        { time: 1.0, type: 'pupillary_dilation', intensity: 1.5, duration: 4.0, message: 'Dilation and Light Rush...' },
        { time: 5.0, type: 'pupillary_dilation', intensity: 0.0, duration: 3.0, message: 'Constricting...' },
        { time: 8.0, type: 'text', message: 'Vision Normalized', duration: 3.0 },
        { time: 8.0, type: 'calm' }
    ],

    '~': [ // Stroke / Localized Brain Damage
        { time: 0.0, type: 'text', message: 'Simulating Localized Brain Damage (Stroke)', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'camera', target: 'frontal-lobe', duration: 2.0 },
        { time: 0.0, type: 'stroke_lesion', target: 'frontal', intensity: 1.0, radius: 0.8, duration: 5.0 },
        { time: 5.0, type: 'text', message: 'Tissue necrosis stabilized.', duration: 2.0 },
        { time: 7.0, type: 'calm' }
    ],


    'W': [ // Dynamic Weather Simulation
        { time: 0.0, type: 'text', message: 'Storm Approaching: Modulating Weather', duration: 4.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0, ease: 'sineInOut' },
        { time: 2.0, type: 'dynamic_weather', intensity: 2.5, duration: 6.0, message: 'High Fog & Low Light...' },
        { time: 10.0, type: 'dynamic_weather', intensity: 1.0, duration: 6.0, message: 'Clearing up...' },
        { time: 16.0, type: 'calm' },
        { time: 16.0, type: 'text', message: 'Weather Normalized', duration: 3.0 }
    ],


    'X': [ // Neurotransmitter Depletion
        { time: 0.0, type: 'text', message: 'Simulating Neurotransmitter Depletion', duration: 4.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0, ease: 'sineInOut' },
        { time: 1.0, type: 'neurotransmitter_depletion', intensity: 0.9, duration: 8.0, message: 'Gradual mesh decimation...' },
        { time: 12.0, type: 'neurotransmitter_depletion', intensity: 0.0, duration: 4.0, message: 'Recovering...' },
        { time: 16.0, type: 'text', message: 'Network Restored', duration: 3.0 },
        { time: 17.0, type: 'calm' }
    ],
    'F': [ // Flow State Synchronization
        { time: 0.0, type: 'text', message: 'Entering Flow State', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome view
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0, ease: 'sineInOut' },
        { time: 2.0, type: 'flow_state', intensity: 1.5, duration: 4.0, message: 'Neural Synchronization...' },
        { time: 8.0, type: 'calm' },
        { time: 8.0, type: 'text', message: 'Flow State Concluded', duration: 3.0 }
    ],

    'E': [ // Visual Cortex Edge Detection Filter
        { time: 0.0, type: 'text', message: 'Visual Cortex Processing', duration: 3.0 },
        { time: 0.0, type: 'neuromodulator', profile: 'acetylcholine' },
        { time: 0.0, type: 'visual_cortex_filter', intensity: 1.0, duration: 1.5, ease: 'cubicOut' },
        { time: 0.0, type: 'camera', target: 'occipital', duration: 2.0, ease: 'sineInOut' },

        { time: 4.0, type: 'visual_cortex_filter', intensity: 0.0, duration: 2.0, ease: 'sineInOut' },
        { time: 4.0, type: 'neuromodulator', profile: 'dopamine' },
        { time: 6.0, type: 'calm' }
    ],

    'Z': [ // Clip Plane / Internal Reveal Showcase
        { time: 0.0, type: 'text', message: 'Internal Reveal: Deep Slice', duration: 4.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome view
        { time: 0.0, type: 'camera', target: 'frontal', duration: 1.0 },
        { time: 1.0, type: 'clip', sliceZ: 0.0, duration: 3.0, ease: 'sineInOut' }, // Slice inwards to center
        { time: 1.0, type: 'camera', target: 'occipital', duration: 4.0, avoidCollision: true }, // Orbit while slicing
        { time: 5.0, type: 'text', message: 'Memory Consolidation Revealed', duration: 3.0 },
        { time: 5.0, type: 'serotonin', intensity: 1.2, duration: 2.0 }, // Serotonin glow on the exposed internal
        { time: 8.0, type: 'clip', sliceZ: 2.0, duration: 3.0, ease: 'sineInOut' }, // Restore volume
        { time: 8.0, type: 'camera', target: 'global', duration: 2.0 }
    ],

    'O': [
        { type: 'camera', target: 'occipital', duration: 1.0, ease: 'sineInOut', avoidCollision: false },
        { type: 'camera', target: 'frontal', duration: 3.0, ease: 'sineInOut', avoidCollision: true }, // Will trigger pathfinding and FOV bump
        { type: 'text', message: 'Dynamic FOV Shift', duration: 3.0 }
    ],

    'K': [
        { time: 0.0, type: 'text', message: 'Memory Formation Sequence', duration: 4.0 },
        { time: 0.0, type: 'camera', target: 'temporal-lobe', duration: 3.0, ease: 'sineInOut' },
        { time: 1.0, type: 'memory_formation', intensity: 2.5, duration: 4.0 },
        { time: 5.0, type: 'camera', target: 'global', duration: 3.0, ease: 'sineInOut' }
    ],

    'Y': [
        { time: 0.0, type: 'text', message: 'Memory Formation Sequence', duration: 4.0 },
        { time: 0.0, type: 'camera', target: 'temporal-lobe', duration: 3.0, ease: 'sineInOut' },
        { time: 1.0, type: 'memory_formation', intensity: 2.5, duration: 4.0 },
        { time: 5.0, type: 'camera', target: 'global', duration: 3.0, ease: 'sineInOut' }
    ],

    'x': [
        { time: 0.0, type: 'text', message: 'SynaptiX Showcase', duration: 2.0 },
        { time: 0.0, type: 'synaptix', action: 'phantom-sequence', sequence: 'resonance', aiInfluence: 0.68, resonanceThreshold: 0.16, sourceInfo: 'Built-in SynaptiX resonance phantoms' },
        { time: 0.1, type: 'camera', target: 'overview', duration: 1.2 },
        { time: 0.2, type: 'stimulus', target: 'occipital', intensity: 0.9 },
        { time: 0.7, type: 'stimulus', target: 'frontal', intensity: 0.9 },
        { time: 1.2, type: 'camera', target: 'frontal-lobe', duration: 1.8 },
        { time: 1.2, type: 'lerp', key: 'aiInfluence', value: 0.82, duration: 2.5 },
        { time: 1.2, type: 'lerp', key: 'resonanceThreshold', value: 0.12, duration: 2.5 },
        { time: 2.6, type: 'synaptix', action: 'play-frames', rate: 3 },
        { time: 3.4, type: 'camera', target: 'occipital-lobe', duration: 1.6 },
        { time: 4.8, type: 'synaptix', action: 'pause-frames' },
        { time: 4.8, type: 'synaptix', action: 'pattern', pattern: 'full-resonance', aiInfluence: 0.9, resonanceThreshold: 0.08, sourceInfo: 'Built-in SynaptiX full resonance phantom' },
        { time: 4.9, type: 'camera', target: 'close-up', duration: 1.8 },
        { time: 5.4, type: 'text', message: 'Human and synthetic activations converge.', duration: 2.2 }
    ],
    'X': [ // Marker Event Showcase
        { time: 0.0, type: 'text', message: 'Marker Event Test', duration: 2.0 },
        { time: 0.5, type: 'marker', label: 'Marker Alpha' },
        { time: 1.5, type: 'marker', label: 'Marker Beta' },
        { time: 2.5, type: 'marker', label: 'Marker Gamma' }
    ],

    'H': [ // Heartbeat Pulse
        { time: 0.0, type: 'text', message: 'Heartbeat Simulation', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome style for visible pulses
        { time: 0.0, type: 'heartbeat', intensity: 1.0, duration: 1.0 },
        { time: 1.5, type: 'heartbeat', intensity: 1.0, duration: 1.0 },
        { time: 3.0, type: 'heartbeat', intensity: 1.0, duration: 1.0 },
        { time: 4.5, type: 'calm' }
    ],
    'R': [ // Respiration Cycle
        { time: 0.0, type: 'text', message: 'Respiration Cycle: Inhale', duration: 1.6 },
        { time: 0.0, type: 'respiration', intensity: 1.0, duration: 4.0 },
        { time: 1.6, type: 'text', message: 'Exhale...', duration: 2.4 },
        { time: 4.5, type: 'calm' }
    ],

    'E': [ // Electrical Exposure (High voltage, rapid chaotic firing, harsh audio)
        { time: 0.0, type: 'text', message: 'HAZARD: ELECTRICAL EXPOSURE', duration: 2.5 },
        { time: 0.0, type: 'style', value: 1 }, // Cyber/Wireframe style
        { time: 0.0, type: 'shake', intensity: 0.3, duration: 2.0 }, // Intense shaking
        { time: 0.0, type: 'lerp', key: 'sparkle', value: 1.0, duration: 0.1 }, // Flash on
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 25.0, duration: 0.1 }, // Hyper-fast signals
        { time: 0.0, type: 'sound', frequency: 60, oscType: 'sawtooth', duration: 2.0, volume: 0.8 }, // 60Hz Electrical Hum
        { time: 0.2, type: 'stimulus', target: 'frontal', intensity: 10.0 },
        { time: 0.5, type: 'stimulus', target: 'occipital', intensity: 10.0 },
        { time: 0.8, type: 'stimulus', target: 'parietal', intensity: 10.0 },
        { time: 1.1, type: 'glitch', intensity: 2.0, autoRestore: true }, // System glitching from voltage
        { time: 2.5, type: 'calm' },
        { time: 2.5, type: 'text', message: 'Voltage Stabilized', duration: 1.5 }
    ],
    'M': [ // Vapor/Mercury Exposure (Sluggish, toxic, disorienting)
        { time: 0.0, type: 'text', message: 'HAZARD: NEUROTOXIC VAPOR DETECTED', duration: 4.0 },
        { time: 0.0, type: 'style', value: 3 }, // Heatmap mode
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 0.5, duration: 3.0, ease: 'quadOut' }, // Extremely sluggish signals
        { time: 0.0, type: 'lerp', key: 'smoothing', value: 0.98, duration: 3.0 }, // Overly blurred/washed out
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 0.7, duration: 3.0 }, // Sickly color shift
        { time: 0.0, type: 'sound', frequency: 90, oscType: 'sine', duration: 5.0, volume: 0.6 }, // Low, disorienting throb
        { time: 0.0, type: 'cinematic', aberration: 1.5, grain: 0.8, duration: 3.0 }, // Dizzy/nauseous visual distortion
        { time: 2.0, type: 'lerp', key: 'amplitude', value: 0.1, duration: 2.0 }, // Weakened signal strength
        { time: 5.0, type: 'calm' },
        { time: 5.0, type: 'cinematic', aberration: 0.0, grain: 0.0, duration: 2.0 },
        { time: 5.0, type: 'text', message: 'Toxicity Clearing...', duration: 2.0 }
    ],



    'K': [ // ATP Energy Depletion
        { time: 0.0, type: 'text', message: 'ATP Energy Depletion', duration: 3.0 },
        { time: 0.0, type: 'atp_depletion', intensity: 1.0, duration: 6.0 }
    ],
    'W': [ // Sensory Overload
        { time: 0.0, type: 'text', message: 'Sensory Overload Detected...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 1 }, // Cyber
        { time: 0.0, type: 'sound', frequency: 1500, oscType: 'sawtooth', duration: 4.0, volume: 0.6 },
        { time: 0.0, type: 'sensory_overload', intensity: 1.5, duration: 4.0 },
        { time: 4.0, type: 'text', message: 'System Recovering...', duration: 2.0 },
        { time: 6.0, type: 'calm' },
        { time: 6.0, type: 'style', value: 0 }
    ],
    'z': [ // Default Mode Network
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'camera', target: 'isometric', duration: 2.0 },
        { time: 0.0, type: 'dmn', intensity: 1.0, duration: 4.0 },
        { time: 0.1, type: 'text', message: 'Entering Default Mode Network (Idle)', duration: 4.0 },
        { time: 4.5, type: 'style', value: 0 } // Revert to Organic
    ],

    '1': [ // Surprise
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'param', key: 'frequency', value: 12.0 },
        { time: 0.0, type: 'param', key: 'amplitude', value: 2.0 },
        { time: 0.0, type: 'camera', zoom: 2.5, ease: 'backOut' }, // Zoom in with bounce
        { time: 0.0, type: 'sound', frequency: 880, oscType: 'square', duration: 0.2, volume: 0.8 }, // [Phase 2] Audio Event
        { time: 0.1, type: 'stimulus', target: 'deep', intensity: 8.0 },
        { time: 0.5, type: 'lerp', key: 'amplitude', value: 0.5, duration: 1.5, ease: 'quadOut' }
    ],
    '2': [ // Calm
        { time: 0.0, type: 'calm' }, // Helper to reset params
        { time: 0.0, type: 'lerp', key: 'frequency', value: 0.5, duration: 2.0 },
        { time: 0.0, type: 'camera', target: 'global' } // Reset cam
    ],
    '3': [ // Scan
        { time: 0.0, type: 'param', key: 'sliceZ', value: -1.5 },
        { time: 0.0, type: 'camera', target: 'parietal' },
        { time: 0.5, type: 'lerp', key: 'sliceZ', value: 1.5, duration: 4.0 },
        { time: 5.0, type: 'param', key: 'sliceZ', value: 2.0 } // Reset slice
    ],
    '4': [ // Serotonin Surge
        { time: 0.0, type: 'text', message: 'Serotonin Flood...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'serotonin', intensity: 2.0, duration: 3.0 },
        { time: 3.0, type: 'text', message: 'Serotonin stabilized.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    '5': [ // Epiphany (Sparkles)
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'text', message: 'EUREKA MOMENT!', duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'sparkle', value: 1.0, duration: 0.2, ease: 'cubicOut' }, // Flash on
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 20.0, duration: 0.5, ease: 'quadIn' }, // Rush
        { time: 0.5, type: 'lerp', key: 'sparkle', value: 0.0, duration: 2.0, ease: 'quadOut' }, // Fade out
        { time: 0.5, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 3.0, ease: 'quadOut' } // Slow down
    ],
    '6': [ // Cortisol Structural Decay
        { time: 0.0, type: 'text', message: 'Cortisol Spike Detected', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome mode to see breakdown
        { time: 0.0, type: 'lerp', key: 'cortisol', value: 1.0, duration: 3.0, ease: 'quadIn' },
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 0.8, duration: 3.0 }, // Shift to warning colors
        { time: 0.0, type: 'sound', frequency: 100, oscType: 'sawtooth', duration: 3.0, volume: 0.8 },
        { time: 3.0, type: 'text', message: 'Structural Integrity Compromised', duration: 2.0 },
        { time: 3.0, type: 'shake', intensity: 0.05, duration: 2.0 },
        { time: 5.0, type: 'text', message: 'Recovering...', duration: 2.0 },
        { time: 5.0, type: 'lerp', key: 'cortisol', value: 0.0, duration: 4.0, ease: 'quadOut' },
        { time: 5.0, type: 'lerp', key: 'colorShift', value: 0.0, duration: 4.0 },
        { time: 9.0, type: 'calm' }
    ],
    'P': [ // Panic Attack (Moved from 6)
        { time: 0.0, type: 'text', message: 'PANIC!', duration: 1.0 },
        { time: 0.0, type: 'style', value: 1 }, // Cyber/Glitch
        { time: 0.0, type: 'shake', intensity: 0.1, duration: 4.0 },
        { time: 0.0, type: 'stress', intensity: 1.5, duration: 2.0, ease: 'quadOut' },
        { time: 2.0, type: 'stress', intensity: 0.0, duration: 2.0, ease: 'quadInOut' }, // Big shake
        { time: 0.0, type: 'sound', frequency: 150, oscType: 'sawtooth', duration: 4.0, volume: 0.6 }, // Low rumble
        { time: 0.0, type: 'cinematic', aberration: 1.0, duration: 0.2 }, // [Phase 7] Aberration spike
        { time: 0.0, type: 'cinematic', grain: 0.8, duration: 0.5 }, // [Phase 7] Grain spike
        { time: 0.0, type: 'lerp', key: 'frequency', value: 15.0, duration: 0.5 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 20.0, duration: 0.5 },
        { time: 0.5, type: 'lerp', key: 'colorShift', value: 1.0, duration: 0.1 }, // Flash Red
        { time: 0.5, type: 'sound', frequency: 600, oscType: 'square', duration: 0.1, volume: 0.5 }, // Beep
        { time: 0.6, type: 'lerp', key: 'colorShift', value: 0.0, duration: 0.1 },
        { time: 0.7, type: 'lerp', key: 'colorShift', value: 1.0, duration: 0.1 },
        { time: 0.7, type: 'sound', frequency: 600, oscType: 'square', duration: 0.1, volume: 0.5 }, // Beep
        { time: 0.8, type: 'lerp', key: 'colorShift', value: 0.0, duration: 0.1 },
        { time: 1.0, type: 'stimulus', target: 'deep', intensity: 5.0 },
        { time: 2.0, type: 'cinematic', aberration: 0.0, grain: 0.0, duration: 2.0 },
        { time: 4.0, type: 'calm' },
        { time: 4.0, type: 'text', message: 'Stabilizing...', duration: 2.0 }
    ],
};

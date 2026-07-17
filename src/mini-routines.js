export const MINI_ROUTINES = {

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

    'k_dup': [
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
        { time: 0.0, type: 'text', message: 'Warning: Regional ATP Depletion', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome style to clearly see pulses
        { time: 0.0, type: 'camera', target: 'frontal-lobe', duration: 2.0, ease: 'sineInOut' },
        { time: 0.0, type: 'atp_depletion', intensity: 1.5, duration: 8.0 },

        { time: 3.5, type: 'text', message: 'Cascading shutdown...', duration: 2.0 },
        { time: 3.5, type: 'camera', target: 'overview', duration: 3.0, ease: 'quadOut' },

        { time: 6.0, type: 'text', message: 'Global Energy Crash', duration: 3.0 },

        { time: 9.0, type: 'text', message: 'Energy levels restoring...', duration: 2.0 },
        { time: 10.0, type: 'calm' }
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
    '7': [ // Top View
        { time: 0.0, type: 'camera', target: 'top', duration: 1.5, ease: 'quadInOut' },
        { time: 0.0, type: 'text', message: 'Dorsal View', duration: 1.5 }
    ],
    '8': [ // Bottom View
        { time: 0.0, type: 'camera', target: 'bottom', duration: 1.5, ease: 'quadInOut' },
        { time: 0.0, type: 'text', message: 'Ventral View', duration: 1.5 }
    ],
    '9': [ // Isometric View
        { time: 0.0, type: 'camera', target: 'iso', duration: 1.5, ease: 'quadInOut' },
        { time: 0.0, type: 'text', message: 'Isometric Projection', duration: 1.5 }
    ],
    'g': [ // Volumetric Fog Demo
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'text', message: 'Atmospheric Depth...', duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'fogDensity', value: 0.5, duration: 2.0, ease: 'quadOut' },
        { time: 3.0, type: 'lerp', key: 'fogDensity', value: 0.0, duration: 2.0, ease: 'quadIn' }
    ],
    'f': [ // CSS Filter Demo
        { time: 0.0, type: 'text', message: 'Applying CSS Filters...', duration: 2.0 },
        { time: 0.0, type: 'cssFilter', filter: 'blur(5px) sepia(0.8)' },
        { time: 2.0, type: 'text', message: 'High Contrast', duration: 2.0 },
        { time: 2.0, type: 'cssFilter', filter: 'contrast(200%) hue-rotate(90deg)' },
        { time: 4.0, type: 'text', message: 'Inverted', duration: 2.0 },
        { time: 4.0, type: 'cssFilter', filter: 'invert(100%)' },
        { time: 6.0, type: 'calm' },
        { time: 6.0, type: 'cssFilter', filter: 'none' },
        { time: 6.0, type: 'text', message: 'Filters Removed', duration: 2.0 }
    ],
    '0': [ // Microscope (DoF Demo)
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'text', message: 'Microscopic Analysis', duration: 2.0 },
        { time: 0.0, type: 'camera', target: 'deep', zoom: 8.0, duration: 2.0, ease: 'quadOut' },
        { time: 0.0, type: 'lerp', key: 'aperture', value: 0.5, duration: 1.0 },
        { time: 0.0, type: 'lerp', key: 'focus', value: 0.15, duration: 2.0 }, // Start close focus
        { time: 2.0, type: 'lerp', key: 'focus', value: 0.25, duration: 3.0, ease: 'sineInOut' }, // Rack focus
        { time: 5.0, type: 'lerp', key: 'aperture', value: 0.0, duration: 1.0 }, // Clear up
        { time: 5.0, type: 'camera', zoom: 3.5, duration: 2.0 } // Reset Zoom
    ],
    '-': [ // Deep Breathing (Parameter Interpolation Demo)
        { time: 0.0, type: 'text', message: 'Inhale...', duration: 3.0 },
        { time: 0.0, type: 'lerp', key: 'growth', value: 1.0, duration: 3.0, ease: 'sineInOut' },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 8.0, duration: 3.0, ease: 'sineInOut' },
        { time: 0.0, type: 'lerp', key: 'amplitude', value: 1.0, duration: 3.0, ease: 'sineInOut' },
        { time: 3.0, type: 'text', message: 'Exhale...', duration: 4.0 },
        { time: 3.0, type: 'lerp', key: 'growth', value: 0.5, duration: 4.0, ease: 'sineInOut' },
        { time: 3.0, type: 'lerp', key: 'flowSpeed', value: 2.0, duration: 4.0, ease: 'sineInOut' },
        { time: 3.0, type: 'lerp', key: 'amplitude', value: 0.2, duration: 4.0, ease: 'sineInOut' },
        { time: 7.0, type: 'text', message: 'Centered', duration: 2.0 },
        { time: 7.0, type: 'calm' }
    ],
    '=': [ // Exponential Easing Demo
        { time: 0.0, type: 'text', message: 'Exponential Easing...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 20.0, duration: 2.0, ease: 'expoInOut' },
        { time: 0.0, type: 'lerp', key: 'amplitude', value: 1.5, duration: 2.0, ease: 'expoInOut' },
        { time: 2.0, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 2.0, ease: 'expoInOut' },
        { time: 2.0, type: 'lerp', key: 'amplitude', value: 0.5, duration: 2.0, ease: 'expoInOut' },
        { time: 4.0, type: 'calm' }
    ],
    'l': [ // Dynamic Lighting Demo
        { time: 0.0, type: 'text', message: 'Lights Out', duration: 2.0 },
        { time: 0.0, type: 'light', ambient: 0.0, dirIntensity: 0.0, duration: 2.0, ease: 'quadOut' },
        { time: 2.5, type: 'text', message: 'Sunrise', duration: 3.0 },
        { time: 2.5, type: 'light', dirX: 1.0, dirY: 0.5, dirZ: 1.0, dirIntensity: 2.0, ambient: 0.1, duration: 3.0, ease: 'sineInOut' },
        { time: 6.0, type: 'text', message: 'High Noon', duration: 2.0 },
        { time: 6.0, type: 'light', dirX: 0.0, dirY: 1.0, dirZ: 0.0, dirIntensity: 3.0, ambient: 0.3, duration: 2.0, ease: 'quadInOut' },
        { time: 8.5, type: 'text', message: 'Sunset', duration: 3.0 },
        { time: 8.5, type: 'light', dirX: -1.0, dirY: 0.2, dirZ: 0.5, dirIntensity: 1.5, ambient: 0.05, duration: 3.0, ease: 'sineInOut' },
        { time: 12.0, type: 'text', message: 'Default Lights', duration: 2.0 },
        { time: 12.0, type: 'light', dirX: 1.0, dirY: 1.0, dirZ: 1.0, dirIntensity: 0.8, ambient: 0.2, duration: 2.0 }
    ],
    '!': [ // Glitch Storm (moved from G)
        { time: 0.0, type: 'text', message: 'DATA CORRUPTION DETECTED', duration: 2.0 },
        { time: 0.0, type: 'glitch', intensity: 1.0, autoRestore: false },
        { time: 0.2, type: 'glitch', intensity: 1.5, autoRestore: true },
        { time: 0.5, type: 'glitch', intensity: 2.0, autoRestore: false },
        { time: 0.8, type: 'glitch', intensity: 1.2, autoRestore: true },
        { time: 1.2, type: 'glitch', intensity: 2.5, autoRestore: false },
        { time: 1.5, type: 'text', message: 'SYSTEM REBOOTING...', duration: 2.0 },
        { time: 2.5, type: 'calm' },
        { time: 2.5, type: 'cinematic', aberration: 0.0, grain: 0.0, duration: 0.5 }
    ],
    'm': [ // Memory Flashback
        { time: 0.0, type: 'flashback', message: 'MEMORY FRAGMENT #42', intensity: 1.5 },
        { time: 0.0, type: 'haptic', duration: 200 },
        { time: 0.0, type: 'sound', frequency: 1200, oscType: 'sine', duration: 0.5, volume: 0.3 }, // High pitch ring
        { time: 0.8, type: 'flashback', message: 'ERROR: TRAUMA DETECTED', intensity: 2.0 },
        { time: 0.8, type: 'haptic', duration: [100, 50, 100] }, // Haptic pattern
        { time: 0.8, type: 'sound', frequency: 150, oscType: 'sawtooth', duration: 0.5, volume: 0.7 }, // Error buzz
        { time: 2.0, type: 'calm' },
        { time: 2.0, type: 'text', message: 'Memory Suppressed', duration: 2.0 }
    ],
    'd': [ // Dopamine Burst
        { time: 0.0, type: 'text', message: 'Dopamine Rush', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'dopamine', intensity: 1.2, duration: 3.0 },
        { time: 3.0, type: 'text', message: 'Baseline restored.', duration: 2.0 },
        { time: 4.0, type: 'calm' }
    ],


    'B': [ // Endocannabinoid Flow
        { time: 0.0, type: 'text', message: 'Endocannabinoid Release: Flow & Appetite', duration: 4.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'endocannabinoid', duration: 5.0 },
        { time: 6.0, type: 'text', message: 'Baseline restored.', duration: 2.0 },
        { time: 7.0, type: 'calm' }
    ],
    'j': [ // Melatonin Sleep Onset
        { time: 0.0, type: 'text', message: 'Melatonin Release: Sleep Onset', duration: 4.0 },
        { time: 0.0, type: 'style', value: 0 }, // Organic
        { time: 0.0, type: 'melatonin', duration: 5.0 },
        { time: 6.0, type: 'calm' },
        { time: 6.0, type: 'text', message: 'Deep Sleep', duration: 2.0 }
    ],
    'U': [ // Sleep Deprivation
        { time: 0.0, type: 'text', message: 'Sleep Deprivation Simulation Initiated...', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'sleep_deprivation', intensity: 1.0, duration: 10.0 },
        { time: 10.0, type: 'text', message: 'Critical Fatigue Level Reached', duration: 2.0 },
        { time: 13.0, type: 'calm' }
    ],
    'J': [ // Visual Cortex Fatigue (Dynamic LoD)
        { time: 0.0, type: 'text', message: 'High Cognitive Load Detected', duration: 3.0 },
        { time: 0.0, type: 'cognitive_load', intensity: 0.8, duration: 5.0 },
        { time: 3.0, type: 'text', message: 'Visual Cortex Fatigue: Lowering Resolution', duration: 3.0 },
        { time: 8.0, type: 'text', message: 'Recovering...', duration: 2.0 },
        { time: 8.0, type: 'cognitive_load', intensity: 0.0, duration: 4.0 },
        { time: 12.0, type: 'calm' }
    ],
    'e': [ // Endorphin Rush
        { time: 0.0, type: 'text', message: 'Endorphin Rush: Immunity to Stress', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'stress', intensity: 2.0, duration: 0.0 }, // simulate prior stress
        { time: 0.0, type: 'shake', intensity: 0.1, duration: 0.0 }, // simulate prior shake
        { time: 1.0, type: 'text', message: 'Releasing Endorphins...', duration: 2.0 },
        { time: 1.0, type: 'endorphin', duration: 4.0 },
        { time: 5.0, type: 'calm' }
    ],
    'u': [ // Noradrenaline Spike
        { time: 0.0, type: 'text', message: 'Noradrenaline Spike: Global Alertness!', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'sound', frequency: 1200, oscType: 'square', duration: 0.3, volume: 0.6 },
        { time: 0.0, type: 'noradrenaline', intensity: 1.5, duration: 3.0 },
        { time: 3.0, type: 'text', message: 'Alertness returning to baseline.', duration: 2.0 },
        { time: 4.0, type: 'calm' }
    ],
    'a': [ // Adrenaline Surge
        { time: 0.0, type: 'text', message: 'Adrenaline Surge!', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'sound', frequency: 800, oscType: 'sawtooth', duration: 0.5, volume: 0.8 },
        { time: 0.0, type: 'adrenaline', intensity: 1.5, duration: 4.0 },
        { time: 4.0, type: 'text', message: 'Stabilized.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    'c': [ // Custom Audio Support
        { time: 0.0, type: 'text', message: 'Playing External Audio', duration: 2.0 },
        { time: 0.0, type: 'sound', url: 'https://cdn.freesound.org/previews/339/339809_5923383-lq.mp3', volume: 0.8 },
        { time: 0.0, type: 'style', value: 3 }, // Heatmap
        { time: 0.0, type: 'lerp', key: 'growth', value: 1.0, duration: 1.0, ease: 'quadOut' },
        { time: 2.0, type: 'calm' }
    ],
    't': [ // Time Warp (Time Dilation Demo)
        { time: 0.0, type: 'text', message: 'Time Dilation: Bullet Time', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 10.0, duration: 0.5 },
        { time: 0.0, type: 'speed', value: 0.1, duration: 2.0, ease: 'quadOut' }, // Slow down time
        { time: 1.0, type: 'text', message: 'Time Dilation: Fast Forward', duration: 2.0 },
        { time: 1.0, type: 'speed', value: 3.0, duration: 2.0, ease: 'quadIn' }, // Speed up time
        { time: 3.0, type: 'text', message: 'Time Dilation: Normal', duration: 2.0 },
        { time: 3.0, type: 'speed', value: 1.0, duration: 1.0, ease: 'linear' }, // Back to normal
        { time: 4.0, type: 'calm' }
    ],
    'k_dup': [
        { time: 0.0, type: 'text', message: 'Memory Formation Sequence', duration: 4.0 },
        { time: 0.0, type: 'camera', target: 'temporal-lobe', duration: 3.0, ease: 'sineInOut' },
        { time: 1.0, type: 'memory_formation', intensity: 2.5, duration: 4.0 },
        { time: 5.0, type: 'camera', target: 'global', duration: 3.0, ease: 'sineInOut' }
    ],

    'x': [ // Advanced Time Modulation Demo
        { time: 0.0, type: 'text', message: 'Advanced Time Dilation: Modulate Speed...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 15.0, duration: 1.0 },
        { time: 0.0, type: 'modulate_speed', targetSpeed: 0.2, duration: 3.0, ease: 'sineInOut' },
        { time: 3.0, type: 'text', message: 'Time Rebounding...', duration: 2.0 },
        { time: 3.0, type: 'modulate_speed', targetSpeed: 4.0, duration: 2.0, ease: 'quadIn' },
        { time: 5.0, type: 'text', message: 'Time Stabilized.', duration: 2.0 },
        { time: 5.0, type: 'modulate_speed', targetSpeed: 1.0, duration: 2.0, ease: 'quadOut' },
        { time: 7.0, type: 'calm' }
    ],
    'p': [ // Spline Path Demo
        { time: 0.0, type: 'text', message: 'Spline Interpolation...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', path: [10.0, 1.0, 20.0, 0.5, 4.0], duration: 5.0, ease: 'linear' },
        { time: 0.0, type: 'lerp', key: 'amplitude', path: [1.5, 0.2, 2.0, 0.1, 0.5], duration: 5.0, ease: 'linear' },
        { time: 5.0, type: 'calm' },
        { time: 5.0, type: 'text', message: 'Spline Complete', duration: 2.0 }
    ],
    'v': [ // Spline Camera Fly-Through Demo
        { time: 0.0, type: 'text', message: 'Spline Camera Fly-Through...', duration: 5.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'camera', path: ['frontal', 'temporal', 'occipital', 'parietal', 'frontal'], duration: 10.0, ease: 'linear' },
        { time: 10.0, type: 'calm' },
        { time: 10.0, type: 'text', message: 'Fly-Through Complete', duration: 2.0 }
    ],
    'L': [ // Lobe Tour Demo
        { time: 0.0, type: 'text', message: 'Lobe Tour: Frontal Lobe', duration: 3.0 },
        { time: 0.0, type: 'camera', target: 'frontal-lobe', duration: 3.0, ease: 'quadInOut' },
        { time: 4.0, type: 'text', message: 'Lobe Tour: Parietal Lobe', duration: 3.0 },
        { time: 4.0, type: 'camera', target: 'parietal-lobe', duration: 3.0, ease: 'quadInOut' },
        { time: 8.0, type: 'text', message: 'Lobe Tour: Occipital Lobe', duration: 3.0 },
        { time: 8.0, type: 'camera', target: 'occipital-lobe', duration: 3.0, ease: 'quadInOut' },
        { time: 12.0, type: 'text', message: 'Lobe Tour: Cerebellum', duration: 3.0 },
        { time: 12.0, type: 'camera', target: 'cerebellum', duration: 3.0, ease: 'quadInOut' },
        { time: 16.0, type: 'text', message: 'Lobe Tour: Left Temporal Lobe', duration: 3.0 },
        { time: 16.0, type: 'camera', target: 'temporal-lobe-left', duration: 3.0, ease: 'quadInOut' },
        { time: 20.0, type: 'text', message: 'Lobe Tour: Right Temporal Lobe', duration: 3.0 },
        { time: 20.0, type: 'camera', target: 'temporal-lobe-right', duration: 3.0, ease: 'quadInOut' },
        { time: 24.0, type: 'camera', target: 'global', duration: 3.0, ease: 'quadOut' }
    ],
    'G': [ // GSR Sync Demo
        { time: 0.0, type: 'text', message: 'Galvanic Skin Response (GSR) Sync', duration: 2.0 },
        { time: 0.0, type: 'gsr_sync', intensity: 1.5, duration: 4.0 },
        { time: 5.0, type: 'gsr_sync', intensity: 0.0, duration: 3.0 },
        { time: 8.0, type: 'text', message: 'GSR Baseline Restored', duration: 2.0 },
        { time: 9.0, type: 'calm' }
    ],

    'V': [ // HRV Glitch Sync Demo
        { time: 0.0, type: 'text', message: 'HRV Glitch Sync Initiated...', duration: 3.0 },
        { time: 0.0, type: 'hrv_sync', intensity: 0.5, duration: 2.0 },
        { time: 2.0, type: 'hrv_sync', intensity: 1.5, duration: 0.5, ease: 'expoInOut' },
        { time: 3.0, type: 'text', message: 'Heart Rate Variability Spiking', duration: 3.0 },
        { time: 3.0, type: 'hrv_sync', intensity: 2.0, duration: 2.0, ease: 'backOut' },
        { time: 6.0, type: 'hrv_sync', intensity: 0.0, duration: 4.0, ease: 'sineInOut' },
        { time: 6.0, type: 'text', message: 'HRV Stabilized', duration: 4.0 },
        { time: 10.0, type: 'calm' }
    ],
    'i': [ // Interactive Visual Overlays Demo
        { time: 0.0, type: 'text', message: 'Interactive Overlay Initiated...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 1 }, // Cyber
        { time: 2.0, type: 'overlay', content: '<h3>SYSTEM HALTED</h3><p>Awaiting user confirmation to proceed with deep scan.</p>', interactive: true, buttonText: 'Authorize Scan' },
        { time: 2.0, type: 'text', message: 'Waiting for Authorization...', duration: 0.0 },
        { time: 2.5, type: 'text', message: 'Authorization Accepted. Scanning...', duration: 3.0 },
        { time: 2.5, type: 'style', value: 2 }, // Connectome
        { time: 2.5, type: 'camera', target: 'deep', duration: 2.0, ease: 'quadInOut' },
        { time: 5.5, type: 'calm' },
        { time: 5.5, type: 'camera', target: 'global', duration: 2.0, ease: 'quadOut' }
    ],
    'b': [ // Branching Demo
        { time: 0.0, type: 'text', message: 'Evaluating Brain State...', duration: 2.0 },
        { time: 2.0, type: 'branch', condition: 'Math.random() > 0.5', trueBranch: 'branch_calm', falseBranch: 'branch_panic' }
    ],
    'branch_calm': [
        { time: 0.0, type: 'text', message: 'State: CALM', duration: 2.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'calm' }
    ],
    'branch_panic': [
        { time: 0.0, type: 'text', message: 'State: PANIC', duration: 2.0 },
        { time: 0.0, type: 'style', value: 1 },
        { time: 0.0, type: 'shake', intensity: 0.1, duration: 2.0 }
    ],
    's': [ // Stress Spike
        { time: 0.0, type: 'text', message: 'Stress Level Critical', duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'stress', value: 1.0, duration: 2.0, ease: 'quadOut' },
        { time: 2.0, type: 'lerp', key: 'stress', value: 0.0, duration: 3.0, ease: 'quadInOut' },
        { time: 5.0, type: 'calm' }
    ],
    'w': [ // Math/Variables Demo
        { time: 0.0, type: 'text', message: 'Initializing Variables...', duration: 2.0 },
        { time: 0.0, type: 'state', key: 'loopCount', value: 0 },
        { time: 0.0, type: 'state', key: 'baseIntensity', value: 1.5 },
        { time: 2.0, type: 'call', routine: 'math_loop' }
    ],
    'math_loop': [
        { time: 0.0, type: 'math', operator: 'add', var1: 'state.loopCount', var2: 1, target: 'state.loopCount' },
        { time: 0.0, type: 'math', operator: 'mul', var1: 'state.baseIntensity', var2: 'state.loopCount', target: 'state.currentIntensity' },
        { time: 0.0, type: 'text', message: 'Loop $state.loopCount! Intensity: $state.currentIntensity', duration: 1.5 },
        { time: 0.0, type: 'stimulus', target: 'deep', intensity: '$state.currentIntensity' },
        { time: 2.0, type: 'branch', condition: () => window.playerState.loopCount < 3, trueBranch: 'math_loop', falseBranch: 'math_end' }
    ],
    'math_end': [
        { time: 0.0, type: 'text', message: 'Math Sequence Complete', duration: 2.0 },
        { time: 0.0, type: 'calm' }
    ],
    'S': [ // Wait/Signal Demo
        { time: 0.0, type: 'text', message: 'Waiting for User Signal (Press Space)...', duration: 0.0 },
        { time: 0.0, type: 'style', value: 1 },
        { time: 0.0, type: 'wait', signal: 'continue_scan' },
        { time: 0.0, type: 'text', message: 'Signal Received! Proceeding...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'camera', target: 'deep', duration: 2.0, ease: 'quadInOut' },
        { time: 3.0, type: 'calm' },
        { time: 3.0, type: 'camera', target: 'global', duration: 2.0, ease: 'quadOut' }
    ],
    'o': [ // Orbit/Avoid Collision Demo
        { time: 0.0, type: 'text', message: 'Linear Transition (Clipping)', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'camera', target: 'frontal', duration: 0.5 },
        { time: 2.0, type: 'camera', target: 'occipital', duration: 3.0, ease: 'linear' },
        { time: 6.0, type: 'text', message: 'Pathfinding Transition (Arcing)', duration: 3.0 },
        { time: 6.0, type: 'camera', target: 'frontal', duration: 0.5 },
        { time: 7.0, type: 'camera', target: 'occipital', duration: 4.0, avoidCollision: true, ease: 'quadInOut' },
        { time: 12.0, type: 'calm' },
        { time: 12.0, type: 'camera', target: 'global', duration: 2.0 }
    ],
    'q': [ // Interactive Neuro-Storytelling Demo
        { time: 0.0, type: 'text', message: 'Entering Simulation...', duration: 2.0 },
        { time: 0.0, type: 'camera', target: 'frontal', duration: 2.0, ease: 'quadOut' },
        { time: 0.0, type: 'style', value: 1 },
        { time: 2.0, type: 'choice', message: 'Anomalous signal detected in the temporal lobe. How to proceed?', choices: [
            { text: 'Investigate Signal', branch: 'q_investigate' },
            { text: 'Suppress Signal', branch: 'q_suppress' },
            { text: 'Ignore', branch: 'q_ignore' }
        ]}
    ],
    'q_investigate': [
        { time: 0.0, type: 'text', message: 'Focusing sensors...', duration: 2.0 },
        { time: 0.0, type: 'camera', target: 'temporal', duration: 2.0, ease: 'sineInOut' },
        { time: 0.0, type: 'style', value: 2 },
        { time: 2.0, type: 'stimulus', target: 'temporal', intensity: 3.0 },
        { time: 2.5, type: 'text', message: 'Memory fragment recovered.', duration: 3.0 },
        { time: 6.0, type: 'calm' },
        { time: 6.0, type: 'camera', target: 'global', duration: 2.0 }
    ],
    'q_suppress': [
        { time: 0.0, type: 'text', message: 'Initiating suppression protocol...', duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 0.5, duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'amplitude', value: 0.1, duration: 2.0 },
        { time: 0.0, type: 'colorShift', value: 0.5, duration: 2.0 },
        { time: 2.0, type: 'text', message: 'Signal stabilized.', duration: 3.0 },
        { time: 5.0, type: 'calm' },
        { time: 5.0, type: 'camera', target: 'global', duration: 2.0 }
    ],
    'q_ignore': [
        { time: 0.0, type: 'text', message: 'Signal ignored. Continuing normal operation.', duration: 2.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 2.0, type: 'calm' },
        { time: 2.0, type: 'camera', target: 'global', duration: 2.0 }
    ],
        'k': [ // Binaural Beats Demo
            { time: 0.0, type: 'text', message: 'Inducing Gamma Waves (40Hz)', duration: 5.0 },
            { time: 0.0, type: 'binaural', baseFrequency: 200, beatFrequency: 40, duration: 5.0, volume: 0.5 },
            { time: 0.0, type: 'style', value: 2 },
            { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 15.0, duration: 2.0 },
            { time: 5.0, type: 'text', message: 'Inducing Theta Waves (6Hz)', duration: 5.0 },
            { time: 5.0, type: 'binaural', baseFrequency: 150, beatFrequency: 6, duration: 5.0, volume: 0.5 },
            { time: 5.0, type: 'lerp', key: 'flowSpeed', value: 2.0, duration: 2.0 },
            { time: 10.0, type: 'calm' }
        ],
    'y': [ // Oxytocin Burst
        { time: 0.0, type: 'text', message: 'Oxytocin Release: Bonding & Trust', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'sound', frequency: 528, oscType: 'sine', duration: 3.0, volume: 0.4 }, // 528Hz Love Frequency
        { time: 0.0, type: 'oxytocin', intensity: 1.5, duration: 4.0 },
        { time: 4.0, type: 'text', message: 'Connection established.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    'Y': [ // Parameter Interpolation/Easing Feature Demo
        { time: 0.0, type: 'text', message: 'Smooth Interpolation Demo...', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 25.0, duration: 1.0, ease: 'expoInOut' },
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 0.8, duration: 1.0, ease: 'expoInOut' },
        { time: 2.0, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 2.0, ease: 'expoInOut' },
        { time: 2.0, type: 'lerp', key: 'colorShift', value: 0.0, duration: 2.0, ease: 'expoInOut' },
        { time: 5.0, type: 'calm' }
    ],
    'r': [ // Acetylcholine Memory Consolidation
        { time: 0.0, type: 'text', message: 'Acetylcholine Release: Memory Consolidation', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'acetylcholine', intensity: 1.5, duration: 4.0 },
        { time: 4.0, type: 'text', message: 'Memory solidified.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    'h': [ // GABA Deceleration
        { time: 0.0, type: 'text', message: 'GABA Release: Decelerating Pulses...', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'gaba', intensity: 1.5, duration: 4.0 },
        { time: 5.0, type: 'text', message: 'System Relaxed.', duration: 2.0 },
        { time: 6.0, type: 'lerp', key: 'playbackSpeed', value: 1.0, duration: 2.0, ease: 'quadInOut' },
        { time: 6.0, type: 'calm' }
    ],
    'N': [ // Myelin Sheath Degradation
        { time: 0.0, type: 'text', message: 'Simulating Myelin Sheath Degradation...', duration: 4.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'myelin_degradation', intensity: 1.0, duration: 12.0 },
        { time: 12.0, type: 'text', message: 'Severe Neurodegeneration Reached', duration: 4.0 }
    ],
    'n': [ // Neuro-Cinema: Dramatic animated mode-shifting narrative
        { time: 0.0,  type: 'text',   message: 'Neural Deep Scan — Initializing', duration: 3.0 },
        { time: 0.0,  type: 'style',  value: 0 },
        { time: 0.0,  type: 'camera', target: 'global', duration: 1.5 },
        { time: 0.0,  type: 'lerp',   key: 'flowSpeed', value: 3.0, duration: 1.0 },
        { time: 0.5,  type: 'stimulus', target: 'deep', intensity: 2.0 },
        { time: 1.5,  type: 'stimulus', target: 'frontal', intensity: 1.5 },
        { time: 2.5,  type: 'text',   message: 'Organic cortex mapped — switching to fiber view', duration: 3.5 },
        { time: 3.0,  type: 'mode-transition', toMode: 2, duration: 2.0, ease: 'sineInOut' },
        { time: 3.0,  type: 'lerp',   key: 'flowSpeed', value: 10.0, duration: 2.0, ease: 'quadIn' },
        { time: 4.0,  type: 'stimulus', target: 'temporal', intensity: 2.0 },
        { time: 4.5,  type: 'stimulus', target: 'parietal', intensity: 2.0 },
        { time: 5.5,  type: 'text',   message: 'Connectome active — propagation cascade', duration: 3.5 },
        { time: 7.0,  type: 'camera', target: 'deep', zoom: 5.0, duration: 2.0, ease: 'quadOut' },
        { time: 8.5,  type: 'text',   message: 'Thermal gradient — metabolic demand', duration: 3.5 },
        { time: 9.0,  type: 'mode-transition', toMode: 3, duration: 2.5, ease: 'sineInOut' },
        { time: 9.0,  type: 'stimulus', target: 'frontal', intensity: 3.0 },
        { time: 10.0, type: 'camera', target: 'global', duration: 2.0, ease: 'quadOut' },
        { time: 11.5, type: 'stimulus', target: 'occipital', intensity: 2.5 },
        { time: 12.0, type: 'text',   message: 'Returning to surface — scan complete', duration: 3.5 },
        { time: 13.0, type: 'mode-transition', toMode: 0, duration: 2.5, ease: 'sineInOut' },
        { time: 13.0, type: 'lerp',   key: 'flowSpeed', value: 4.0, duration: 2.0 },
        { time: 15.5, type: 'calm' },
        { time: 15.5, type: 'text',   message: 'Scan complete.', duration: 2.0 }
    ],
    'A': [ // Altitude Ascent (climb to 5,500m with progression)
        { time: 0.0, type: 'text', message: 'Ascending to High Altitude...', duration: 3.0 },
        { time: 0.0, type: 'camera', target: 'iso', duration: 2.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome to see degradation
        { time: 0.0, type: 'lerp', key: 'altitude', value: 5500, duration: 8.0, ease: 'quadIn' },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 2.0, duration: 8.0 }, // Slowed cognition
        { time: 1.0, type: 'stimulus', target: 'frontal', intensity: 1.5 }, // Frontal impact
        { time: 2.0, type: 'stimulus', target: 'temporal', intensity: 1.0 },
        { time: 3.0, type: 'stimulus', target: 'parietal', intensity: 0.8 },
        { time: 8.0, type: 'text', message: 'Severe Hypoxia Detected', duration: 2.0 },
        { time: 8.0, type: 'cinematic', grain: 0.6, duration: 2.0 } // Perceptual fog
    ],
    'D': [ // Descent (recovery to sea level)
        { time: 0.0, type: 'text', message: 'Descending to Sea Level...', duration: 4.0 },
        { time: 0.0, type: 'lerp', key: 'altitude', value: 0, duration: 8.0, ease: 'quadOut' },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 8.0, ease: 'quadOut' },
        { time: 0.0, type: 'lerp', key: 'grain', value: 0.0, duration: 8.0 },
        { time: 8.0, type: 'text', message: 'Oxygen Saturation Restored', duration: 2.0 },
        { time: 8.0, type: 'calm' }
    ],
    'H': [ // Hypoxic Crisis (acute severe altitude)
        { time: 0.0, type: 'text', message: 'HYPOXIC CRISIS!', duration: 1.5 },
        { time: 0.0, type: 'param', key: 'altitude', value: 8500 }, // Extreme
        { time: 0.0, type: 'shake', intensity: 0.2, duration: 5.0 },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 1.0, duration: 2.0 }, // Shutdown
        { time: 0.0, type: 'lerp', key: 'aberration', value: 1.5, duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'grain', value: 0.9, duration: 2.0 },
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 1.0, duration: 1.0 }, // Cyanotic shift
        { time: 2.0, type: 'stimulus', target: 'deep', intensity: 2.0 }, // Emergency response
        { time: 5.0, type: 'text', message: 'Initiating Emergency Descent...', duration: 2.0 },
        { time: 5.0, type: 'lerp', key: 'altitude', value: 0, duration: 6.0, ease: 'quadOut' },
        { time: 5.0, type: 'lerp', key: 'shake', value: 0.0, duration: 6.0 },
        { time: 11.0, type: 'calm' }
    ],
    'I': [ // Inflammatory Response (Histamine)
        { time: 0.0, type: 'text', message: 'Histamine Release: Inflammatory Response', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'histamine', target: 'frontal', intensity: 1.5, duration: 4.0 },
        { time: 0.5, type: 'immune_migration', intensity: 1.2, duration: 3.5 },
        { time: 4.0, type: 'text', message: 'Inflammation subsiding.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    'C': [ // Glial Cell Cleanup
        { time: 0.0, type: 'text', message: 'Activating Glial Cells: Cleanup Process', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'histamine', target: 'frontal', intensity: 1.0, duration: 0.0 }, // Pre-existing inflammation
        { time: 1.0, type: 'glial_cleanup', intensity: 1.5, duration: 5.0 },
        { time: 1.5, type: 'immune_migration', intensity: 1.8, duration: 4.5 },
        { time: 6.0, type: 'text', message: 'Tissue repaired.', duration: 2.0 },
        { time: 7.0, type: 'calm' }
    ],
    'F': [ // Procedural Volumetric Fluid Dynamics
        { time: 0.0, type: 'text', message: 'Initiating Volumetric Fluid Dynamics...', duration: 3.0 },
        { time: 0.0, type: 'style', value: 3 }, // Heatmap to see density
        { time: 0.0, type: 'fluid', intensity: 1.5, duration: 4.0, ease: 'sineInOut' },
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 0.8, duration: 4.0 }, // Shift to liquid colors
        { time: 4.0, type: 'text', message: 'Neurotransmitter diffusion active.', duration: 3.0 },
        { time: 7.0, type: 'text', message: 'Stabilizing fluid flow...', duration: 2.0 },
        { time: 7.0, type: 'fluid', intensity: 0.0, duration: 3.0, ease: 'quadOut' },
        { time: 7.0, type: 'lerp', key: 'colorShift', value: 0.0, duration: 3.0 },
        { time: 10.0, type: 'calm' }
    ],
    'T': [ // Transcranial Magnetic Stimulation
        { time: 0.0, type: 'text', message: 'Targeted Neuro-Stimulation (TMS)', duration: 3.0 },
        { time: 0.0, type: 'camera', target: 'frontal', duration: 1.0 },
        { time: 1.0, type: 'tms_distortion', target: 'frontal-lobe', intensity: 2.0, radius: 0.35, duration: 1.5 },
        { time: 2.0, type: 'tms_distortion', target: 'parietal-lobe', intensity: 2.0, radius: 0.35, duration: 1.5 },
        { time: 3.0, type: 'tms_distortion', target: 'occipital-lobe', intensity: 2.0, radius: 0.35, duration: 1.5 },
        { time: 5.0, type: 'camera', target: 'global', duration: 2.0 },
        { time: 7.0, type: 'calm' }
    ],

    'A': [ // Auditory Hallucination
        { time: 0.0, type: 'text', message: 'Auditory Hallucination: Temporal Lobe Flashes', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'camera', target: 'temporal-lobe', duration: 2.0 },
        { time: 0.5, type: 'auditory_hallucination', flashes: 15, duration: 4.0, intensity: 2.5 },
        { time: 5.0, type: 'text', message: 'Hallucination Subsided.', duration: 2.0 },
        { time: 6.0, type: 'camera', target: 'global', duration: 2.0 },
        { time: 6.0, type: 'calm' }
    ],
    '[': [ // Synaptic Binding Kinetics
        { time: 0.0, type: 'text', message: 'Synaptic Binding Kinetics Initiated', duration: 2.0 },
        { time: 0.0, type: 'synapse_kinetics', intensity: 1.0, duration: 2.0, ease: 'cubicOut' },
        { time: 3.0, type: 'synapse_kinetics', intensity: 0.0, duration: 2.0, ease: 'sineInOut' }
    ],

    'Q': [ // Neuroplasticity Sprouting
        { time: 0.0, type: 'text', message: 'Neuroplasticity: Forming New Connections', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'neuroplasticity', intensity: 2.0, duration: 5.0 },
        { time: 5.0, type: 'text', message: 'Connections established.', duration: 2.0 },
        { time: 6.0, type: 'calm' }
    ],
    '+': [ // Dendritic Growth Animation
        { time: 0.0, type: 'text', message: 'Dendritic Growth Initiated', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0 },
        { time: 1.0, type: 'dendritic_growth', intensity: 1.8, duration: 4.0 },
        { time: 5.0, type: 'text', message: 'New Pathways Formed', duration: 2.0 },
        { time: 7.0, type: 'dendritic_growth', intensity: 1.0, duration: 3.0 },
        { time: 10.0, type: 'calm' }
    ],
    '*': [ // Synchronized Firing Patterns
        { time: 0.0, type: 'text', message: 'Synchronized Multi-Region Burst', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'sync_burst', duration: 5.0, intensity: 2.0, rate: 0.5 },
        { time: 6.0, type: 'calm' }
    ],
    '#': [ // Psychedelic Visuals
        { time: 0.0, type: 'text', message: 'Initiating Psychedelic Visuals', duration: 3.0 },
        { time: 0.0, type: 'style', value: 0 },
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0 },
        { time: 1.0, type: 'psychedelic_trip', intensity: 1.0, duration: 5.0, message: 'Morphing Geometry...' },
        { time: 7.0, type: 'psychedelic_trip', intensity: 0.0, duration: 4.0, message: 'Fading...' },
        { time: 11.0, type: 'text', message: 'Visuals Normalized', duration: 2.0 },
        { time: 11.0, type: 'calm' }
    ],

    '?': [ // Cognitive Dissonance Simulation
        { time: 0.0, type: 'text', message: 'Inducing Cognitive Dissonance...', duration: 4.0 },
        { time: 0.0, type: 'style', value: 3 }, // Heatmap
        { time: 0.0, type: 'camera', target: 'global', duration: 2.0 },
        { time: 1.0, type: 'cognitive_dissonance', intensity: 2.5, duration: 6.0 },
        { time: 7.0, type: 'text', message: 'Resolving conflict...', duration: 2.0 },
        { time: 7.0, type: 'cognitive_dissonance', intensity: 0.0, duration: 3.0 },
        { time: 10.0, type: 'calm' }
    ],

    '^': [ // Signal Trails
        { time: 0.0, type: 'text', message: 'Simulating Long Signal Trails', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome mode to see trails well
        { time: 0.0, type: 'camera', target: 'overview', duration: 2.0 },
        { time: 1.0, type: 'signal_trails', intensity: 3.0, duration: 4.0, message: 'Increasing pulse decay tail length...' },
        { time: 7.0, type: 'signal_trails', intensity: 1.0, duration: 3.0, message: 'Restoring normal signal speed...' },
        { time: 10.0, type: 'calm' }
    ]
};

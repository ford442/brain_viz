// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]
import { AudioReactor } from './audio-reactor.js';   // [NEW]
import { TensorPlayer, BUILTIN_PATTERNS } from './tensor-player.js'; // [BCI]

// [Phase 3] Keyboard Triggered Routines
const MINI_ROUTINES = {
    'E': [ // Electrical Exposure
        { time: 0.0, type: 'text', message: 'Electrical Exposure Warning', duration: 2.0 },
        { time: 0.0, type: 'style', value: 1 }, // Cyber
        { time: 0.0, type: 'electrical', intensity: 0.8, duration: 5.0 },
        { time: 5.0, type: 'calm' }
    ],
    'M': [ // Mercury Exposure
        { time: 0.0, type: 'text', message: 'Mercury Exposure Warning', duration: 2.0 },
        { time: 0.0, type: 'style', value: 3 }, // Heatmap
        { time: 0.0, type: 'mercury', intensity: 0.8, duration: 5.0 },
        { time: 5.0, type: 'calm' }
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
    'G': [ // Glitch Storm
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
    'V': [ // Spline Camera Map Fly-Through Demo
        { time: 0.0, type: 'text', message: 'Spline Camera Map Fly-Through...', duration: 5.0 },
        { time: 0.0, type: 'style', value: 2 },
        { time: 0.0, type: 'camera', path: ['cortex-top', 'right-hemisphere', 'brainstem', 'left-hemisphere', 'overview'], duration: 10.0, ease: 'linear' },
        { time: 10.0, type: 'calm' },
        { time: 10.0, type: 'text', message: 'Map Fly-Through Complete', duration: 2.0 }
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
        { time: 2.0, type: 'branch', condition: () => Math.random() > 0.5, trueBranch: 'branch_calm', falseBranch: 'branch_panic' }
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
        { time: 4.0, type: 'text', message: 'Inflammation subsiding.', duration: 2.0 },
        { time: 5.0, type: 'calm' }
    ],
    'C': [ // Glial Cell Cleanup
        { time: 0.0, type: 'text', message: 'Activating Glial Cells: Cleanup Process', duration: 3.0 },
        { time: 0.0, type: 'style', value: 2 }, // Connectome
        { time: 0.0, type: 'histamine', target: 'frontal', intensity: 1.0, duration: 0.0 }, // Pre-existing inflammation
        { time: 1.0, type: 'glial_cleanup', intensity: 1.5, duration: 5.0 },
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
    ]
};

class FilterUIOverlay {
    constructor(canvas) {
        this.canvas = canvas;
    }

    applyFilter(filterString) {
        if (this.canvas) {
            this.canvas.style.filter = filterString;
        }
    }
}

async function init() {
    // Main script updated for neuro-script cycle.
    const canvas = document.getElementById('canvas');
    const filterOverlay = new FilterUIOverlay(canvas);
    const errorDiv = document.getElementById('error');
    
    // UI Elements
    const inputs = {
        frequency: document.getElementById('freq'),
        amplitude: document.getElementById('amp'),
        spikeThreshold: document.getElementById('thresh'),
        smoothing: document.getElementById('smooth'),
        sliceZ: document.getElementById('clip'),
        flowSpeed: document.getElementById('speed'),
        colorShift: document.getElementById('shift'), // [Phase 5]
        sparkle: document.getElementById('sparkle'), // [Phase 5]
        growth: document.getElementById('growth'), // [Phase 6]
        shake: document.getElementById('shake'), // [Phase 2]
        stress: document.getElementById('stress'), // [Phase 2] Stress Distortion
        cortisol: document.getElementById('cortisol'), // [Phase 5] Cortisol Decay
        fluidActive: document.getElementById('fluidActive'), // [Phase 6] Fluid Dynamics
        fogDensity: document.getElementById('fogDensity'),
        aberration: document.getElementById('aberration'), // [Phase 7]
        grain: document.getElementById('grain'), // [Phase 7]
        focus: document.getElementById('focus'), // [Phase 7]
        aperture: document.getElementById('aperture'), // [Phase 7]
        ambientLight: document.getElementById('ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('lightDirZ'), // [Phase 2]
        altitude: document.getElementById('altitude'), // Altitude/Hypoxia
        oxygen: document.getElementById('oxygen'), // Altitude/Hypoxia (read-only)
        metabolicRate: document.getElementById('metabolic'), // Altitude/Hypoxia
        style: document.getElementById('style-mode')
    };
    
    const labels = {
        frequency: document.getElementById('val-freq'),
        amplitude: document.getElementById('val-amp'),
        spikeThreshold: document.getElementById('val-thresh'),
        smoothing: document.getElementById('val-smooth'),
        sliceZ: document.getElementById('val-clip'),
        flowSpeed: document.getElementById('val-speed'),
        colorShift: document.getElementById('val-shift'), // [Phase 5]
        sparkle: document.getElementById('val-sparkle'), // [Phase 5]
        growth: document.getElementById('val-growth'), // [Phase 6]
        shake: document.getElementById('val-shake'), // [Phase 2]
        stress: document.getElementById('val-stress'), // [Phase 2] Stress Distortion
        cortisol: document.getElementById('val-cortisol'), // [Phase 5] Cortisol Decay
        fluidActive: document.getElementById('val-fluidActive'), // [Phase 6] Fluid Dynamics
        fogDensity: document.getElementById('val-fogDensity'),
        aberration: document.getElementById('val-aberration'), // [Phase 7]
        grain: document.getElementById('val-grain'), // [Phase 7]
        focus: document.getElementById('val-focus'), // [Phase 7]
        aperture: document.getElementById('val-aperture'), // [Phase 7]
        ambientLight: document.getElementById('val-ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('val-dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('val-lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('val-lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('val-lightDirZ'), // [Phase 2]
        altitude: document.getElementById('val-altitude'), // Altitude/Hypoxia
        oxygen: document.getElementById('val-oxygen'), // Altitude/Hypoxia (read-only)
        metabolicRate: document.getElementById('val-metabolic') // Altitude/Hypoxia
    };
    
    if (!navigator.gpu) {
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = 'Your browser does not support WebGPU. Please use Chrome 113+ or Edge 113+ with WebGPU enabled.';
        errorDiv.classList.add('visible');
        return;
    }
    
    try {
        const renderer = new BrainRenderer(canvas);
        await renderer.initialize();
        
        // --- 1. SETUP ROUTINE PLAYER ---
        // Define explicit regions for easy scripting and better camera angles
        const regionCoordinatesMap = {
            'frontal': [0, 0, 1.2],
            'occipital': [0, 0, -1.2],
            'parietal': [0, 1.0, 0],
            'temporal': [1.0, 0, 0],
            'deep': [0, 0, 0]
        };

        // Define a map of camera coordinates to easily jump to specific views
        const cameraCoordinatesMap = {
            'overview': { rotation: { x: 0.5, y: -0.5 }, zoom: 4.0 },
            'close-up': { rotation: { x: 0.1, y: 0.1 }, zoom: 1.5 },
            'scan': { rotation: { x: 0.8, y: 0.2 }, zoom: 3.0 },
            'cortex-top': { rotation: { x: 1.5, y: 0 }, zoom: 3.0 },
            'brainstem': { rotation: { x: -0.5, y: 3.14 }, zoom: 2.5 },
            'left-hemisphere': { rotation: { x: 0, y: 1.57 }, zoom: 3.5 },
            'right-hemisphere': { rotation: { x: 0, y: -1.57 }, zoom: 3.5 }
        };

        // Initialize RoutinePlayer, ensuring it expects the BrainRenderer instance
        // [Integration Check] Verified `init()` flow is not broken
        const player = new RoutinePlayer(renderer, regionCoordinatesMap, cameraCoordinatesMap);
        // Integration verified: RoutinePlayer instantiated safely without breaking init flow
        console.log("[Neuro-Script Initialization Cycle] Routine Engine Instantiated.");

        // [Safety Handling] Hook up WebGPU device lost promise for player fallback
        if (renderer.device && renderer.device.lost) {
            renderer.device.lost.then((lostEventInfo) => {
                console.error("[Main Logic] WebGPU Context Lost event intercepted. Stopping all routines safely.", lostEventInfo);
                if (player) player.stop();
            });
        }
        window.playerState = player.state; // Share state with global window for inline logic

        // [Phase 10] Persistent Style Lock — routines cannot override the dropdown selection
        player.registerHandler('style', () => {});
        player.registerHandler('mode-transition', () => {});

        // [Phase 3] Extensible Event System Demo
        // Register a custom 'debug' handler to demonstrate the new V2.9 architecture
        player.registerHandler('debug', (evt) => {
             console.log(`%c[Routine Debug] ${evt.message}`, 'color: #ff00ff; font-weight: bold;');
        });

        // [Phase 2] Register Mini-Routines for recursive 'call' support
        player.registerSubRoutines(MINI_ROUTINES);

        const audioReactor = new AudioReactor();

        // --- KEYBOARD TRIGGERS ---
        document.addEventListener('keydown', (e) => {
            // Signal triggering (Spacebar)
            if (e.code === 'Space') {
                e.preventDefault();
                if (player.waitingForSignal === 'continue_scan') {
                    player.triggerSignal('continue_scan');
                }
            }

            const routine = MINI_ROUTINES[e.key];
            if (routine) {
                console.log(`[Main] Triggering Mini-Routine: ${e.key}`);
                player.playNow(routine);
            }
        });

        // Keyboard Legend FAB + Panel
        const fabHelp = document.createElement('button');
        fabHelp.className = 'fab-help';
        fabHelp.innerHTML = '?';
        fabHelp.title = 'Keyboard Shortcuts';
        document.body.appendChild(fabHelp);

        const legendPanel = document.createElement('div');
        legendPanel.className = 'legend-panel';
        legendPanel.innerHTML = `
            <h3>Keyboard Shortcuts</h3>
            <div class="legend-section">
                <div class="legend-section-title">Views</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">7</span><span>Top View</span></div>
                    <div class="legend-item"><span class="legend-key">8</span><span>Bottom View</span></div>
                    <div class="legend-item"><span class="legend-key">9</span><span>Isometric</span></div>
                </div>
            </div>
            <div class="legend-section">
                <div class="legend-section-title">States</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">1</span><span>Surprise</span></div>
                    <div class="legend-item"><span class="legend-key">2</span><span>Calm</span></div>
                    <div class="legend-item"><span class="legend-key">3</span><span>Scan</span></div>
                    <div class="legend-item"><span class="legend-key">4</span><span>Serotonin</span></div>
                    <div class="legend-item"><span class="legend-key">5</span><span>Epiphany</span></div>
                    <div class="legend-item"><span class="legend-key">6</span><span>Panic</span></div>
                </div>
            </div>
            <div class="legend-section">
                <div class="legend-section-title">Neurochemical</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">d</span><span>Dopamine</span></div>
                    <div class="legend-item"><span class="legend-key">e</span><span>Endorphin</span></div>
                    <div class="legend-item"><span class="legend-key">y</span><span>Oxytocin</span></div>
                    <div class="legend-item"><span class="legend-key">r</span><span>Acetylcholine</span></div>
                    <div class="legend-item"><span class="legend-key">h</span><span>GABA</span></div>
                    <div class="legend-item"><span class="legend-key">j</span><span>Melatonin</span></div>
                    <div class="legend-item"><span class="legend-key">a</span><span>Adrenaline</span></div>
                    <div class="legend-item"><span class="legend-key">u</span><span>Noradrenaline</span></div>
                    <div class="legend-item"><span class="legend-key">B</span><span>Endocannabinoid</span></div>
                </div>
            </div>
            <div class="legend-section">
                <div class="legend-section-title">Systems</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">E</span><span>Electrical</span></div>
                    <div class="legend-item"><span class="legend-key">M</span><span>Mercury</span></div>
                    <div class="legend-item"><span class="legend-key">I</span><span>Inflammation</span></div>
                    <div class="legend-item"><span class="legend-key">C</span><span>Glial Cleanup</span></div>
                    <div class="legend-item"><span class="legend-key">F</span><span>Fluid Dynamics</span></div>
                </div>
            </div>
            <div class="legend-section">
                <div class="legend-section-title">Cinematic</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">0</span><span>Focus</span></div>
                    <div class="legend-item"><span class="legend-key">-</span><span>Breathe</span></div>
                    <div class="legend-item"><span class="legend-key">l</span><span>Lighting</span></div>
                    <div class="legend-item"><span class="legend-key">g</span><span>Fog</span></div>
                    <div class="legend-item"><span class="legend-key">f</span><span>Filters</span></div>
                    <div class="legend-item"><span class="legend-key">v</span><span>Fly-Through</span></div>
                    <div class="legend-item"><span class="legend-key">V</span><span>Map Fly-Through</span></div>
                    <div class="legend-item"><span class="legend-key">i</span><span>Interactive</span></div>
                </div>
            </div>
            <div class="legend-section">
                <div class="legend-section-title">Advanced</div>
                <div class="legend-row">
                    <div class="legend-item"><span class="legend-key">t</span><span>Time Warp</span></div>
                    <div class="legend-item"><span class="legend-key">x</span><span>Time Modulation</span></div>
                    <div class="legend-item"><span class="legend-key">p</span><span>Spline</span></div>
                    <div class="legend-item"><span class="legend-key">w</span><span>Math / Variables</span></div>
                    <div class="legend-item"><span class="legend-key">q</span><span>Choice</span></div>
                    <div class="legend-item"><span class="legend-key">G</span><span>Glitch</span></div>
                    <div class="legend-item"><span class="legend-key">S</span><span>Signal</span></div>
                    <div class="legend-item"><span class="legend-key">m</span><span>Memory</span></div>
                    <div class="legend-item"><span class="legend-key">b</span><span>Branch</span></div>
                    <div class="legend-item"><span class="legend-key">o</span><span>Orbit Avoid</span></div>
                    <div class="legend-item"><span class="legend-key">c</span><span>Custom Audio</span></div>
                    <div class="legend-item"><span class="legend-key">k</span><span>Binaural</span></div>
                    <div class="legend-item"><span class="legend-key">n</span><span>Neuro-Cinema</span></div>
                    <div class="legend-item"><span class="legend-key">z</span><span>Default Mode</span></div>
                </div>
            </div>
        `;
        document.body.appendChild(legendPanel);

        let legendOpen = false;
        const legendStorageKey = 'neuro_weaver_legend_seen';

        function toggleLegend(forceState) {
            legendOpen = forceState !== undefined ? forceState : !legendOpen;
            if (legendOpen) {
                legendPanel.classList.add('open');
            } else {
                legendPanel.classList.remove('open');
            }
        }

        fabHelp.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLegend();
        });

        document.addEventListener('click', (e) => {
            if (legendOpen && !legendPanel.contains(e.target) && e.target !== fabHelp) {
                toggleLegend(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && legendOpen) {
                toggleLegend(false);
            }
        });

        // Auto-open on first visit
        try {
            if (!localStorage.getItem(legendStorageKey)) {
                localStorage.setItem(legendStorageKey, 'true');
                toggleLegend(true);
            }
        } catch (e) {}
        // [Phase 4] Narrative Overlay
        const narrative = document.createElement('div');
        narrative.id = 'narrative-overlay';
        Object.assign(narrative.style, {
            position: 'absolute',
            bottom: '15%',
            width: '100%',
            textAlign: 'center',
            color: 'rgba(200, 240, 255, 0.95)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '22px',
            letterSpacing: '1px',
            textShadow: '0 0 10px rgba(0,150,255,0.6), 0 0 40px rgba(0,100,200,0.3)',
            pointerEvents: 'none',
            transition: 'opacity 1.0s ease-in-out',
            opacity: '0',
            zIndex: '100'
        });
        const narrativeText = document.createElement('span');
        narrativeText.id = 'narrative-text';
        narrative.appendChild(narrativeText);
        const narrativeCursor = document.createElement('span');
        narrativeCursor.id = 'narrative-cursor';
        narrativeCursor.textContent = '|';
        narrativeCursor.style.color = '#00e5e5';
        narrativeCursor.style.fontWeight = '100';
        narrativeCursor.style.display = 'none';
        narrative.appendChild(narrativeCursor);
        document.body.appendChild(narrative);

        // [Phase 2] Interactive Visual Overlay Container
        const visualOverlay = document.createElement('div');
        visualOverlay.id = 'visual-overlay';
        Object.assign(visualOverlay.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 20, 40, 0.9)',
            border: '2px solid #00aaff',
            padding: '20px 40px',
            borderRadius: '10px',
            color: '#fff',
            fontFamily: 'monospace',
            textAlign: 'center',
            display: 'none',
            zIndex: '300',
            boxShadow: '0 0 20px rgba(0, 150, 255, 0.5)'
        });
        document.body.appendChild(visualOverlay);

        // Sync UI when routine executes events
        let narrativeTimeout = null;
        let typeInterval = null;

        player.onEvent = (event) => {
             if (event.type === 'choice') {
                 if (event.choices) {
                     let html = `<h3>${event.message || 'Make a choice:'}</h3><div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">`;
                     event.choices.forEach((c, idx) => {
                         html += `<button id="choice-btn-${idx}" style="padding: 10px 20px; background: #0055aa; color: white; border: none; cursor: pointer; border-radius: 4px; font-family: monospace; font-size: 14px;">${c.text}</button>`;
                     });
                     html += `</div>`;

                     visualOverlay.innerHTML = html;
                     visualOverlay.style.display = 'block';

                     event.choices.forEach((c, idx) => {
                         const btn = document.getElementById(`choice-btn-${idx}`);
                         if (btn) {
                             btn.onmouseover = () => btn.style.background = '#0077ff';
                             btn.onmouseout = () => btn.style.background = '#0055aa';
                             btn.onclick = () => {
                                 visualOverlay.style.display = 'none';

                                 // Apply state updates if present
                                 if (c.stateUpdates) {
                                     for (const [key, val] of Object.entries(c.stateUpdates)) {
                                         player.state[key] = val;
                                     }
                                 }

                                 // Execute branch if present
                                 if (c.branch && player.subRoutines[c.branch]) {
                                     console.log(`[UI] Branching to: ${c.branch}`);
                                     // We use playNow which resets the current routine to the branch
                                     player.playNow(player.subRoutines[c.branch]);
                                 } else {
                                     // Just resume if no branch
                                     player.resume();
                                 }
                             };
                         }
                     });
                 }
             }
             if (event.type === 'overlay') {
                 if (event.content) {
                     visualOverlay.innerHTML = event.content;
                     visualOverlay.style.display = 'block';

                     if (event.interactive) {
                         player.pause();
                         const btn = document.createElement('button');
                         btn.textContent = event.buttonText || 'Continue';
                         Object.assign(btn.style, {
                             marginTop: '20px', padding: '10px 20px', background: '#0055aa',
                             color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px',
                             fontFamily: 'monospace', fontSize: '14px'
                         });
                         btn.onmouseover = () => btn.style.background = '#0077ff';
                         btn.onmouseout = () => btn.style.background = '#0055aa';
                         btn.onclick = () => {
                             visualOverlay.style.display = 'none';
                             player.resume();
                         };
                         visualOverlay.appendChild(btn);
                     } else if (event.duration) {
                         setTimeout(() => {
                             visualOverlay.style.display = 'none';
                         }, event.duration * 1000);
                     }
                 } else {
                     visualOverlay.style.display = 'none';
                 }
             }
             if (event.type === 'cssFilter') {
                 if (event.filter) {
                     filterOverlay.applyFilter(event.filter);
                 }
             }
             if (event.type === 'text') {
                 if (event.message) {
                     // Simple Markdown parsing for bold, italic, and links
                     let htmlMessage = event.message
                         .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold
                         .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic
                         .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#00aaff;">$1</a>'); // Links

                     // Strip tags for typing
                     const tmp = document.createElement('div');
                     tmp.innerHTML = htmlMessage;
                     const plainText = tmp.textContent || '';

                     if (narrativeTimeout) clearTimeout(narrativeTimeout);
                     if (typeInterval) clearInterval(typeInterval);

                     narrative.style.opacity = '1';
                     narrativeText.textContent = '';
                     narrativeCursor.style.display = 'inline';

                     let i = 0;
                     const maxTypingTime = event.duration ? (event.duration * 1000) / 2 : Infinity;
                     const interval = plainText.length > 0 && maxTypingTime !== Infinity
                         ? Math.min(30, Math.floor(maxTypingTime / plainText.length))
                         : 30;

                     typeInterval = setInterval(() => {
                         i++;
                         narrativeText.textContent = plainText.substring(0, i);
                         if (i >= plainText.length) {
                             clearInterval(typeInterval);
                             typeInterval = null;
                             narrativeText.innerHTML = htmlMessage;
                             narrativeCursor.style.display = 'none';
                         }
                     }, interval);

                     // Optional: Auto-fade if duration is provided
                     if (event.duration) {
                         narrativeTimeout = setTimeout(() => {
                             narrative.style.opacity = '0';
                             narrativeTimeout = null;
                         }, event.duration * 1000);
                     }
                 } else {
                     narrative.style.opacity = '0';
                     narrativeText.textContent = '';
                     narrativeCursor.style.display = 'none';
                     if (narrativeTimeout) {
                         clearTimeout(narrativeTimeout);
                         narrativeTimeout = null;
                     }
                     if (typeInterval) {
                         clearInterval(typeInterval);
                         typeInterval = null;
                     }
                 }
             }
             if (event.type === 'param') {
                 if (inputs[event.key]) inputs[event.key].value = event.value;
                 if (labels[event.key]) labels[event.key].textContent = event.value.toFixed(2);
             }
             if (event.type === 'calm') {
                 // Calm state modifies amplitude, frequency, smoothing
                 // We should sync them if they are in the renderer params
                 ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'cortisol', 'fluidActive', 'fogDensity', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
                    if (inputs[k]) inputs[k].value = renderer.params[k];
                    if (labels[k]) labels[k].textContent = renderer.params[k].toFixed(2);
                 });
             }
             if (event.type === 'reset') {
                 // Reset might clear buffers but usually doesn't change params,
                 // but if it did, we'd sync here.
             }
             if (event.type === 'speed') {
                 const speedSlider = document.getElementById('routine-speed');
                 const speedLabel = document.getElementById('routine-speed-label');
                 if (speedSlider) speedSlider.value = event.value;
                 if (speedLabel) speedLabel.textContent = `Speed: ${event.value.toFixed(1)}x`;
             }
        };

        // --- UI FOR ROUTINE ---
        const controls = document.getElementById('controls');

        const routineContainer = document.createElement('div');
        routineContainer.style.marginTop = "10px";
        routineContainer.style.paddingTop = "10px";
        routineContainer.style.borderTop = "1px solid #444";

        // Transport Bar
        const transportBar = document.createElement('div');
        transportBar.style.display = 'flex';
        transportBar.style.alignItems = 'center';
        transportBar.style.gap = '6px';
        transportBar.style.marginBottom = '8px';

        const btnSkip = document.createElement('button');
        btnSkip.innerHTML = '⏮';
        btnSkip.title = 'Skip Forward';
        btnSkip.style.width = '32px';
        btnSkip.style.height = '32px';
        btnSkip.style.padding = '0';
        btnSkip.style.fontSize = '14px';
        btnSkip.style.display = 'flex';
        btnSkip.style.alignItems = 'center';
        btnSkip.style.justifyContent = 'center';

        const btnPlay = document.createElement('button');
        btnPlay.innerHTML = '▶';
        btnPlay.title = 'Play / Pause';
        btnPlay.style.width = '32px';
        btnPlay.style.height = '32px';
        btnPlay.style.padding = '0';
        btnPlay.style.fontSize = '14px';
        btnPlay.style.display = 'flex';
        btnPlay.style.alignItems = 'center';
        btnPlay.style.justifyContent = 'center';

        const btnStop = document.createElement('button');
        btnStop.innerHTML = '⏹';
        btnStop.title = 'Stop';
        btnStop.style.width = '32px';
        btnStop.style.height = '32px';
        btnStop.style.padding = '0';
        btnStop.style.fontSize = '14px';
        btnStop.style.display = 'flex';
        btnStop.style.alignItems = 'center';
        btnStop.style.justifyContent = 'center';

        const btnLoop = document.createElement('button');
        btnLoop.innerHTML = '🔁';
        btnLoop.title = 'Toggle Loop';
        btnLoop.style.width = '32px';
        btnLoop.style.height = '32px';
        btnLoop.style.padding = '0';
        btnLoop.style.fontSize = '14px';
        btnLoop.style.display = 'flex';
        btnLoop.style.alignItems = 'center';
        btnLoop.style.justifyContent = 'center';
        btnLoop.style.opacity = '0.5';

        const statusDot = document.createElement('span');
        statusDot.style.width = '8px';
        statusDot.style.height = '8px';
        statusDot.style.borderRadius = '50%';
        statusDot.style.background = '#445566';
        statusDot.style.display = 'inline-block';
        statusDot.style.flexShrink = '0';

        const timeDisplay = document.createElement('span');
        timeDisplay.textContent = "00:00 / 00:00";
        timeDisplay.style.fontFamily = "'JetBrains Mono', monospace";
        timeDisplay.style.fontSize = '12px';
        timeDisplay.style.color = '#00e5e5';
        timeDisplay.style.marginLeft = 'auto';
        timeDisplay.style.marginRight = '4px';

        const btnGen = document.createElement('button');
        btnGen.innerHTML = '🎲';
        btnGen.title = 'Procedural Generation';
        btnGen.style.width = '32px';
        btnGen.style.height = '32px';
        btnGen.style.padding = '0';
        btnGen.style.fontSize = '14px';
        btnGen.style.display = 'flex';
        btnGen.style.alignItems = 'center';
        btnGen.style.justifyContent = 'center';

        transportBar.appendChild(btnSkip);
        transportBar.appendChild(btnPlay);
        transportBar.appendChild(btnStop);
        transportBar.appendChild(btnLoop);
        transportBar.appendChild(statusDot);
        transportBar.appendChild(timeDisplay);
        transportBar.appendChild(btnGen);
        routineContainer.appendChild(transportBar);

        // Progress bar
        const progressTrack = document.createElement('div');
        progressTrack.style.width = '100%';
        progressTrack.style.height = '3px';
        progressTrack.style.background = 'rgba(100,150,200,0.2)';
        progressTrack.style.borderRadius = '2px';
        progressTrack.style.marginBottom = '10px';
        progressTrack.style.overflow = 'hidden';

        const progressFill = document.createElement('div');
        progressFill.style.height = '100%';
        progressFill.style.width = '0%';
        progressFill.style.background = 'linear-gradient(90deg, #00e5e5, #00ffaa)';
        progressFill.style.transition = 'width 0.1s linear';
        progressTrack.appendChild(progressFill);
        routineContainer.appendChild(progressTrack);

        // Playback Speed Control
        const speedDiv = document.createElement('div');
        speedDiv.style.marginTop = "5px";
        speedDiv.style.marginBottom = "10px";
        speedDiv.style.display = "flex";
        speedDiv.style.alignItems = "center";
        speedDiv.style.gap = "10px";
        speedDiv.style.fontSize = "12px";

        const speedLabel = document.createElement('span');
        speedLabel.id = "routine-speed-label";
        speedLabel.textContent = "Speed: 1.0x";
        speedLabel.style.minWidth = "70px";
        speedLabel.style.fontFamily = "'JetBrains Mono', monospace";
        speedLabel.style.color = "#00e5e5";

        const speedSlider = document.createElement('input');
        speedSlider.type = "range";
        speedSlider.id = "routine-speed";
        speedSlider.min = "0.1";
        speedSlider.max = "5.0";
        speedSlider.step = "0.1";
        speedSlider.value = "1.0";
        speedSlider.style.flex = "1";

        speedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            player.setPlaybackSpeed(val);
            speedLabel.textContent = `Speed: ${val.toFixed(1)}x`;
        });

        speedDiv.appendChild(speedLabel);
        speedDiv.appendChild(speedSlider);
        routineContainer.appendChild(speedDiv);

        // Load Custom Routine (styled label + hidden input)
        const fileWrapper = document.createElement('div');
        fileWrapper.style.marginTop = "8px";

        const fileLabel = document.createElement('label');
        fileLabel.textContent = "Load Custom Routine (.json / .csv)";
        fileLabel.dataset.tooltip = "Load a custom routine script (.json or .csv)";
        fileLabel.style.display = 'inline-block';
        fileLabel.style.width = '100%';
        fileLabel.style.padding = '6px 10px';
        fileLabel.style.background = '#1a1a2e';
        fileLabel.style.border = '1px solid #445566';
        fileLabel.style.borderRadius = '6px';
        fileLabel.style.color = '#aabbcc';
        fileLabel.style.fontFamily = "'Inter', sans-serif";
        fileLabel.style.fontWeight = '600';
        fileLabel.style.fontSize = '11px';
        fileLabel.style.cursor = 'pointer';
        fileLabel.style.textAlign = 'center';
        fileLabel.style.transition = 'all 0.2s ease';
        fileLabel.style.marginBottom = '6px';

        fileLabel.addEventListener('mouseenter', () => {
            fileLabel.style.transform = 'translateY(-1px)';
            fileLabel.style.filter = 'brightness(1.2)';
        });
        fileLabel.addEventListener('mouseleave', () => {
            fileLabel.style.transform = 'translateY(0)';
            fileLabel.style.filter = 'brightness(1)';
        });

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json, .csv';
        fileInput.style.display = 'none';

        fileLabel.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                const text = evt.target.result;
                if (file.name.toLowerCase().endsWith('.csv')) {
                    try {
                        player.loadRoutineFromCSV(text, false);
                        player.play();
                        console.log(`[Main] Loaded custom CSV routine: ${file.name}`);
                    } catch (err) {
                        console.error("Invalid CSV:", err);
                        alert("Failed to parse routine CSV.");
                    }
                } else {
                    try {
                        const routineData = JSON.parse(text);
                        player.loadRoutine(routineData, false);
                        player.play();
                        console.log(`[Main] Loaded custom routine: ${file.name}`);
                    } catch (err) {
                        console.error("Invalid JSON:", err);
                        alert("Failed to parse routine JSON.");
                    }
                }
            };
            reader.readAsText(file);
        });

        fileWrapper.appendChild(fileLabel);
        fileWrapper.appendChild(fileInput);
        routineContainer.appendChild(fileWrapper);

        // Event Listeners
        let isLoading = false;
        let loopActive = false;

        btnPlay.onclick = async () => {
            if (player.isPlaying) {
                player.pause();
            } else {
                if (player.routine.length === 0) {
                     isLoading = true;
                     btnPlay.innerHTML = "⏳";
                     await player.loadRoutineFromFile('/routines/deep_thought.json', loopActive);
                     isLoading = false;
                     player.play();
                } else {
                    if (player.lastPauseTime > 0) {
                        player.resume();
                    } else {
                        player.play();
                    }
                }
            }
        };

        btnStop.onclick = () => player.stop();

        btnSkip.onclick = () => {
            if (player.routine.length === 0) return;
            const skipAmount = 5.0;
            const target = Math.min(player.elapsedTime + skipAmount, player.duration);
            while (player.cursor < player.routine.length && player.routine[player.cursor].time <= target) {
                player.cursor++;
            }
            player.elapsedTime = target;
        };

        btnGen.onclick = () => {
             player.generateProceduralRoutine();
             player.play();
        };

        btnLoop.onclick = () => {
            loopActive = !loopActive;
            player.loop = loopActive;
            btnLoop.style.opacity = loopActive ? '1' : '0.5';
        };

        // Status dot pulse animation style injection
        const pulseStyle = document.createElement('style');
        pulseStyle.textContent = `
            @keyframes pulse-cyan {
                0% { box-shadow: 0 0 0 0 rgba(0, 229, 229, 0.7); }
                70% { box-shadow: 0 0 0 6px rgba(0, 229, 229, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 229, 229, 0); }
            }
            .status-pulse {
                animation: pulse-cyan 1.5s infinite;
            }
        `;
        document.head.appendChild(pulseStyle);

        controls.appendChild(routineContainer);

        // -----------------------------
        // [BCI] Tensor Data Player Panel
        // -----------------------------
        const tensorPlayer = new TensorPlayer(renderer);

        const bciContainer = document.createElement('div');
        bciContainer.style.marginTop = '10px';
        bciContainer.style.paddingTop = '10px';
        bciContainer.style.borderTop = '1px solid #444';

        const bciTitle = document.createElement('div');
        bciTitle.textContent = 'BCI Tensor Playback';
        bciTitle.dataset.tooltip = "Stream pre-recorded 32×32×32 neural tensor frames";
        bciTitle.style.color = '#00ffaa';
        bciTitle.style.fontSize = '12px';
        bciTitle.style.fontWeight = 'bold';
        bciTitle.style.marginBottom = '6px';
        bciContainer.appendChild(bciTitle);

        // Built-in pattern selector
        const bciPatternSelect = document.createElement('select');
        bciPatternSelect.style.width = '100%';
        bciPatternSelect.style.marginBottom = '5px';
        bciPatternSelect.dataset.tooltip = "Select a built-in BCI pattern to simulate";
        bciPatternSelect.style.background = '#1a2a3a';
        bciPatternSelect.style.color = '#ddd';
        bciPatternSelect.style.border = '1px solid #444';
        bciPatternSelect.style.padding = '3px';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '— Built-in Patterns —';
        bciPatternSelect.appendChild(defaultOpt);
        BUILTIN_PATTERNS.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.label;
            opt.title = p.description;
            bciPatternSelect.appendChild(opt);
        });
        bciContainer.appendChild(bciPatternSelect);

        // Transport row
        const bciTransport = document.createElement('div');
        bciTransport.style.display = 'flex';
        bciTransport.style.gap = '4px';
        bciTransport.style.marginBottom = '5px';

        const bciPlay = document.createElement('button');
        bciPlay.textContent = '▶';
        bciPlay.title = 'Play BCI data';
        bciPlay.style.flex = '1';
        bciPlay.style.background = '#005522';
        bciPlay.style.color = '#00ffaa';

        const bciPause = document.createElement('button');
        bciPause.textContent = '⏸';
        bciPause.title = 'Pause';
        bciPause.style.flex = '1';
        bciPause.style.background = '#334';

        const bciStop = document.createElement('button');
        bciStop.textContent = '⏹';
        bciStop.title = 'Stop & restore physics';
        bciStop.style.flex = '1';
        bciStop.style.background = '#330011';
        bciStop.style.color = '#ff5566';

        bciTransport.appendChild(bciPlay);
        bciTransport.appendChild(bciPause);
        bciTransport.appendChild(bciStop);
        bciContainer.appendChild(bciTransport);

        // Speed control
        const bciSpeedRow = document.createElement('div');
        bciSpeedRow.style.display = 'flex';
        bciSpeedRow.style.gap = '8px';
        bciSpeedRow.style.alignItems = 'center';
        bciSpeedRow.style.fontSize = '11px';
        bciSpeedRow.style.color = '#aaa';
        bciSpeedRow.style.marginBottom = '5px';

        const bciSpeedLabel = document.createElement('span');
        bciSpeedLabel.textContent = '1.0×';
        bciSpeedLabel.style.minWidth = '32px';

        const bciSpeedSlider = document.createElement('input');
        bciSpeedSlider.type = 'range';
        bciSpeedSlider.min = '0.1';
        bciSpeedSlider.max = '4.0';
        bciSpeedSlider.step = '0.1';
        bciSpeedSlider.value = '1.0';
        bciSpeedSlider.style.flex = '1';
        bciSpeedSlider.addEventListener('input', (e) => {
            const v = parseFloat(e.target.value);
            tensorPlayer.setSpeed(v);
            bciSpeedLabel.textContent = v.toFixed(1) + '×';
        });

        bciSpeedRow.appendChild(document.createTextNode('Speed: '));
        bciSpeedRow.appendChild(bciSpeedSlider);
        bciSpeedRow.appendChild(bciSpeedLabel);
        bciContainer.appendChild(bciSpeedRow);

        // Frame scrubber + counter
        const bciScrubRow = document.createElement('div');
        bciScrubRow.style.display = 'flex';
        bciScrubRow.style.gap = '6px';
        bciScrubRow.style.alignItems = 'center';
        bciScrubRow.style.marginBottom = '5px';

        const bciScrubber = document.createElement('input');
        bciScrubber.type = 'range';
        bciScrubber.min = '0';
        bciScrubber.max = '1';
        bciScrubber.value = '0';
        bciScrubber.style.flex = '1';

        const bciFrameLabel = document.createElement('span');
        bciFrameLabel.textContent = '0/0';
        bciFrameLabel.style.fontSize = '10px';
        bciFrameLabel.style.color = '#888';
        bciFrameLabel.style.minWidth = '48px';

        bciScrubber.addEventListener('input', (e) => {
            tensorPlayer.seek(parseInt(e.target.value));
        });

        bciScrubRow.appendChild(bciScrubber);
        bciScrubRow.appendChild(bciFrameLabel);
        bciContainer.appendChild(bciScrubRow);

        // File loader (custom .bin / .npy / .csv)
        const bciFileLabel = document.createElement('label');
        bciFileLabel.textContent = 'Load tensor file (.bin / .npy / .csv)';
        bciFileLabel.style.fontSize = '11px';
        bciFileLabel.style.color = '#888';
        bciContainer.appendChild(bciFileLabel);

        const bciFileInput = document.createElement('input');
        bciFileInput.type = 'file';
        bciFileInput.accept = '.bin,.npy,.csv';
        bciFileInput.style.width = '100%';
        bciFileInput.style.color = '#aaa';
        bciFileInput.style.fontSize = '11px';
        bciFileInput.style.marginTop = '3px';
        bciContainer.appendChild(bciFileInput);

        controls.appendChild(bciContainer);

        // TensorPlayer callbacks
        tensorPlayer.onFrameChange = (frame, total) => {
            bciFrameLabel.textContent = `${frame}/${total}`;
            if (total > 1) {
                bciScrubber.max = total - 1;
                bciScrubber.value = frame;
            }
        };
        tensorPlayer.onPlayStateChange = (playing) => {
            bciPlay.textContent = playing ? '⏸' : '▶';
            bciPlay.style.background = playing ? '#005588' : '#005522';
        };

        // BCI transport button handlers
        let bciGenerating = false;
        const loadAndPlayPattern = async (patternId) => {
            const pattern = BUILTIN_PATTERNS.find(p => p.id === patternId);
            if (!pattern) return;
            if (bciGenerating) return;
            bciGenerating = true;
            bciPlay.textContent = '⏳';
            bciPlay.disabled = true;
            try {
                const frames = await Promise.resolve(pattern.generate(tensorPlayer));
                tensorPlayer.loadFrames(frames);
                tensorPlayer.play();
            } finally {
                bciGenerating = false;
                bciPlay.disabled = false;
            }
        };

        bciPlay.onclick = async () => {
            if (tensorPlayer.isPlaying) {
                tensorPlayer.pause();
            } else if (tensorPlayer.totalFrames > 0) {
                tensorPlayer.play();
            } else {
                const patternId = bciPatternSelect.value;
                if (patternId) {
                    await loadAndPlayPattern(patternId);
                } else {
                    // Default: alpha waves
                    await loadAndPlayPattern('alpha-waves');
                    bciPatternSelect.value = 'alpha-waves';
                }
            }
        };

        bciPause.onclick = () => tensorPlayer.pause();
        bciStop.onclick = () => {
            tensorPlayer.stop();
            bciScrubber.value = 0;
        };

        bciPatternSelect.addEventListener('change', async (e) => {
            if (!e.target.value) return;
            await loadAndPlayPattern(e.target.value);
        });

        bciFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                let frames;
                if (file.name.endsWith('.npy')) {
                    frames = await tensorPlayer.loadNPY(file);
                } else if (file.name.endsWith('.csv')) {
                    frames = await tensorPlayer.loadCSVSeries(file);
                } else {
                    frames = await tensorPlayer.loadBinary(file);
                }
                tensorPlayer.loadFrames(frames);
                tensorPlayer.play();
                bciPatternSelect.value = ''; // deselect built-in
            } catch (err) {
                console.error('[TensorPlayer] Failed to load file:', err);
                alert('Failed to load tensor file: ' + err.message);
            }
        });

        // -----------------------------

        const inferenceEngine = new InferenceEngine();

        // [Existing AI Button Code preserved...]
        let aiMode = false;
        let aiEnabled = false;
        let aiLoading = false;
        const aiToggle = document.createElement('button');
        aiToggle.textContent = 'Enable AI "Dreaming"';
        aiToggle.dataset.tooltip = "Enable AI-driven SqueezeNet inference to auto-inject stimuli";
        aiToggle.style.background = '#424';
        aiToggle.style.borderColor = '#d0d';
        aiToggle.style.color = '#eaffea';
        aiToggle.style.marginTop = "5px";
        aiToggle.onclick = async () => {
            if (aiLoading) return;

            if (!aiMode && !aiEnabled) {
                aiLoading = true;
                aiToggle.disabled = true;
                aiToggle.textContent = 'Loading AI Model...';

                try {
                    aiEnabled = await inferenceEngine.initialize();
                } finally {
                    aiLoading = false;
                    aiToggle.disabled = false;
                }

                if (!aiEnabled) {
                    aiToggle.textContent = 'AI Load Failed - Retry';
                    aiToggle.style.background = '#533';
                    aiToggle.title = inferenceEngine.lastError?.message || 'Check the browser console and network tab for ONNX runtime asset loading errors.';
                    return;
                }
            }

            aiMode = !aiMode;
            aiToggle.title = '';
            aiToggle.textContent = aiMode ? 'Disable AI Mode' : 'Enable AI "Dreaming"';
            aiToggle.style.background = aiMode ? '#626' : '#424';
            // Stop routine if AI starts
            if(aiMode) player.stop();
        };
        controls.appendChild(aiToggle);

        // [Audio Reactivity Button]
        const audioBtn = document.createElement('button');
        audioBtn.textContent = 'Enable Audio Reactivity 🎤';
        audioBtn.dataset.tooltip = "Use microphone input to modulate neural activity amplitude";
        audioBtn.style.background = '#442';
        audioBtn.style.borderColor = '#dd4';
        audioBtn.style.color = '#ff9';
        audioBtn.style.marginTop = "5px";
        audioBtn.onclick = async () => {
            if (!audioReactor.isActive) {
                await audioReactor.start();
                audioBtn.textContent = 'Disable Audio Reactivity 🔇';
                audioBtn.style.background = '#662';
            } else {
                audioReactor.stop();
                audioBtn.textContent = 'Enable Audio Reactivity 🎤';
                audioBtn.style.background = '#442';
            }
        };
        controls.appendChild(audioBtn);

        initUIControls(renderer, inputs, labels); // [Reuse existing function]

        initRangeTooltips(controls); // [Custom range tooltip helper]
        initTooltips(); // [Phase 9] Contextual tooltip system

        // [Director Mode]
        const directorLabels = initDirectorTools(renderer, player);

        // UI & Audio Loop
        const updateLoop = (timestamp) => {
            // 0. BCI Tensor Playback
            tensorPlayer.update(timestamp);

            // 1. Audio Reactivity
            if (audioReactor.isActive) {
                audioReactor.update(renderer);
                // Sync UI sliders
                if(inputs.amplitude) inputs.amplitude.value = renderer.params.amplitude;
                if(labels.amplitude) labels.amplitude.textContent = renderer.params.amplitude.toFixed(2);
                if(inputs.flowSpeed) inputs.flowSpeed.value = renderer.params.flowSpeed;
                if(labels.flowSpeed) labels.flowSpeed.textContent = renderer.params.flowSpeed.toFixed(2);
            }

            // 2. Routine Status Dot
            const routineDot = document.getElementById('routine-status-dot');
            if (routineDot) {
                if (player.isPlaying) {
                    routineDot.classList.add('active');
                } else {
                    routineDot.classList.remove('active');
                }
            }

            // 3. Transport UI Update
            if (player.isPlaying) {
                if (!isLoading) btnPlay.innerHTML = "⏸";
                statusDot.style.background = '#00e5e5';
                statusDot.classList.add('status-pulse');
            } else {
                if (!isLoading) btnPlay.innerHTML = "▶";
                statusDot.classList.remove('status-pulse');
                statusDot.style.background = (player.lastPauseTime > 0) ? '#ffaa00' : '#445566';
            }

            // Time Format
            const fmt = (t) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };
            timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;

            // Progress bar
            const progressPercent = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;
            progressFill.style.width = `${progressPercent}%`;

            // 3. Director Tools Update
            if (directorLabels) {
                directorLabels.RotX.textContent = renderer.rotation.x.toFixed(3);
                directorLabels.RotY.textContent = renderer.rotation.y.toFixed(3);
                directorLabels.Zoom.textContent = renderer.zoom.toFixed(2);
            }

            requestAnimationFrame(updateLoop);
        };
        requestAnimationFrame(updateLoop);

        // AI Loop
        const classMap = new Float32Array(1000 * 3);
        for(let i=0; i<3000; i++) classMap[i] = (Math.random() - 0.5) * 2.0;

        const runAI = async () => {
            if (aiMode && aiEnabled) {
                const topK = await inferenceEngine.runInference();
                if (topK) {
                    topK.forEach(item => {
                        const idx = item.index;
                        const strength = item.value * 0.5;
                        renderer.injectStimulus(classMap[idx*3], classMap[idx*3+1], classMap[idx*3+2], strength);
                    });
                }
            }
            setTimeout(runAI, 100);
        };
        runAI();

        renderer.start();
        console.log('Renderer started');

    } catch (error) {
        console.error('Failed to initialize:', error);
        const msg = document.getElementById('error-message');
        if (msg) msg.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('visible');
    }
}

// [Include your existing initUIControls function here unchanged]
function initUIControls(renderer, uiInputs, uiLabels) {
    // [Neuro-Weaver] Sync UI State with Renderer Params
    const syncParam = (paramKey, paramValue) => {
        const floatVal = parseFloat(paramValue);
        renderer.setParams({ [paramKey]: floatVal });
        if (uiLabels[paramKey]) uiLabels[paramKey].textContent = floatVal.toFixed(2);
    };

    // Attach listeners to all inputs
    Object.keys(uiInputs).forEach(key => {
        const inputEl = uiInputs[key];
        if (!inputEl) return;
        syncParam(key, inputEl.value);
        if (inputEl.tagName === 'SELECT') return;
        inputEl.addEventListener('input', (evt) => syncParam(key, evt.target.value));
    });

    const styleDropdown = document.getElementById('style-mode');
    if (styleDropdown) {
        styleDropdown.addEventListener('change', (evt) => {
            const selectedStyle = parseFloat(evt.target.value);
            renderer.setParams({ style: selectedStyle });
            // Style presets...
            const stylePresets = {
                3: { amplitude: 1.0, smoothing: 0.95 },
                2: { frequency: 8.0, smoothing: 0.2, amplitude: 1.5 },
                1: { frequency: 5.0, smoothing: 0.5 },
                0: { frequency: 2.0, smoothing: 0.9 }
            };
            const activePreset = stylePresets[selectedStyle] || stylePresets[0];
            Object.keys(activePreset).forEach(pKey => {
                renderer.setParams({ [pKey]: activePreset[pKey] });
                if(uiInputs[pKey]) uiInputs[pKey].value = activePreset[pKey];
                syncParam(pKey, activePreset[pKey]);
            });
            // [Phase 10] Mode-change toast
            const controls = document.getElementById('controls');
            if (controls) {
                let toast = controls.querySelector('.mode-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.className = 'mode-toast';
                    controls.appendChild(toast);
                }
                const modeName = styleDropdown.options[styleDropdown.selectedIndex].text.replace(/^\d+\.\s*/, '');
                toast.textContent = `Mode: ${modeName}`;
                toast.classList.add('show');
                clearTimeout(toast._hideTimer);
                toast._hideTimer = setTimeout(() => toast.classList.remove('show'), 1000);
            }
        });
    }

    // Altitude/Hypoxia Special Handler
    const altitudeInput = document.getElementById('altitude');
    if (altitudeInput) {
        altitudeInput.addEventListener('input', (evt) => {
            const altVal = parseFloat(evt.target.value);
            renderer.setParams({ altitude: altVal });
            renderer.updateAltitudeState();

            // Update UI labels
            const val = uiInputs.altitude;
            if (labels.altitude) labels.altitude.textContent = altVal.toFixed(0);
            if (labels.oxygen) labels.oxygen.textContent = renderer.params.oxygenLevel.toFixed(2);
            if (labels.metabolicRate) labels.metabolicRate.textContent = renderer.params.metabolicRate.toFixed(2);

            // Sync read-only oxygen slider
            if (uiInputs.oxygen) uiInputs.oxygen.value = renderer.params.oxygenLevel;
        });
    }

    // [Neuro-Weaver] Stimulus Button Event Listeners
    // Maps UI buttons to 3D brain coordinates for injection
    const regions = [
        { id: 'stim-frontal', pos: [0, 0, 1.2] },   // Frontal Lobe
        { id: 'stim-occipital', pos: [0, 0, -1.2] }, // Occipital Lobe
        { id: 'stim-parietal', pos: [0, 1.0, 0] },   // Parietal Lobe
        { id: 'stim-temporal', pos: [1.0, 0, 0] },   // Temporal Lobe
        { id: 'stim-deep', pos: [0, 0, 0] }          // Deep Structures
    ];

    regions.forEach(region => {
        const btn = document.getElementById(region.id);
        if (btn) {
            btn.addEventListener('click', () => {
                // Inject stimulus at region coordinates with intensity 1.0
                renderer.injectStimulus(region.pos[0], region.pos[1], region.pos[2], 1.0);
                flashButton(btn);
            });
        }
    });

    document.getElementById('stim-random')?.addEventListener('click', () => {
        renderer.injectStimulus((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 1.0);
        flashButton(document.getElementById('stim-random'));
    });

    document.getElementById('stim-electrical')?.addEventListener('click', () => {
        const intensity = parseFloat(document.getElementById('hazard-intensity').value) / 100.0;
        const duration = parseFloat(document.getElementById('hazard-duration').value);
        renderer.injectElectrical(intensity, duration);
        flashButton(document.getElementById('stim-electrical'));
    });

    document.getElementById('stim-mercury')?.addEventListener('click', () => {
        const intensity = parseFloat(document.getElementById('hazard-intensity').value) / 100.0;
        const duration = parseFloat(document.getElementById('hazard-duration').value);
        renderer.injectMercury(intensity, duration);
        flashButton(document.getElementById('stim-mercury'));
    });

    document.getElementById('stim-calm')?.addEventListener('click', () => {
        renderer.calmState();
        flashButton(document.getElementById('stim-calm'));
        glowRegionButtons();
        ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'cortisol', 'fluidActive', 'fogDensity', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
            if(uiInputs[k]) uiInputs[k].value = renderer.params[k];
            syncParam(k, renderer.params[k]);
        });
    });

    document.getElementById('stim-reset')?.addEventListener('click', () => renderer.resetActivity());
}

function initDirectorTools(renderer, player) {
    const container = document.createElement('div');
    container.id = 'director-tools';
    Object.assign(container.style, {
        position: 'absolute',
        bottom: '10px',
        left: '20px',
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid #0055aa',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#00aaff',
        zIndex: '200'
    });

    const title = document.createElement('div');
    title.textContent = "DIRECTOR MODE";
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    title.style.color = '#fff';
    container.appendChild(title);

    const labels = {};
    ['RotX', 'RotY', 'Zoom'].forEach(key => {
        const div = document.createElement('div');
        div.style.marginBottom = '2px';
        const label = document.createElement('span');
        label.textContent = `${key}: `;
        label.style.color = '#aaa';
        const val = document.createElement('span');
        val.textContent = '0.00';
        val.style.color = '#0ff';

        div.appendChild(label);
        div.appendChild(val);
        container.appendChild(div);
        labels[key] = val;
    });

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 Copy State';
    Object.assign(copyBtn.style, {
        marginTop: '8px',
        background: '#004488',
        border: '1px solid #0066cc',
        color: 'white',
        cursor: 'pointer',
        width: '100%'
    });

    copyBtn.onclick = () => {
        if (player) {
            player.logCameraState();
        } else {
            console.warn("Player not available for logging");
        }

        const origText = copyBtn.textContent;
        copyBtn.textContent = '✅ Logged to Console';
        setTimeout(() => copyBtn.textContent = origText, 1500);
    };
    container.appendChild(copyBtn);

    document.body.appendChild(container);
    return labels;
}

function initTooltips() {
    let tooltip = document.getElementById('nw-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'nw-tooltip';
        document.body.appendChild(tooltip);
    }

    let showTimeout = null;
    let currentTarget = null;

    const hide = () => {
        if (showTimeout) { clearTimeout(showTimeout); showTimeout = null; }
        currentTarget = null;
        tooltip.classList.remove('visible');
    };

    const position = (target) => {
        const rect = target.getBoundingClientRect();
        const ttRect = tooltip.getBoundingClientRect();
        let top = rect.top + window.scrollY - ttRect.height - 8;
        let left = rect.left + window.scrollX + (rect.width / 2) - (ttRect.width / 2);
        // Flip to below if too close to top
        if (top < window.scrollY + 10) {
            top = rect.bottom + window.scrollY + 8;
        }
        // Clamp horizontal
        left = Math.max(8, Math.min(left, window.innerWidth - ttRect.width - 8));
        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    };

    const show = (target) => {
        const text = target.dataset.tooltip || target.title || '';
        if (!text) return;
        tooltip.textContent = text;
        tooltip.style.display = 'block';
        // Force layout so we can measure
        void tooltip.offsetWidth;
        position(target);
        tooltip.classList.add('visible');
    };

    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-tooltip], [title]');
        if (!target) { hide(); return; }
        if (target === currentTarget) return;
        hide();
        currentTarget = target;
        showTimeout = setTimeout(() => show(target), 400);
    });

    document.body.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-tooltip], [title]');
        if (target && target === currentTarget) {
            hide();
        }
    });

    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
}

function flashButton(btn) {
    if (!btn) return;
    btn.classList.remove('flashing');
    void btn.offsetWidth;
    btn.classList.add('flashing');
    setTimeout(() => btn.classList.remove('flashing'), 600);
}

function glowRegionButtons() {
    document.querySelectorAll('.btn-region').forEach(btn => {
        btn.classList.remove('calm-glow');
        void btn.offsetWidth;
        btn.classList.add('calm-glow');
        setTimeout(() => btn.classList.remove('calm-glow'), 800);
    });
}

function initRangeTooltips(container) {
    if (!container) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'range-tooltip';
    Object.assign(tooltip.style, {
        position: 'absolute',
        display: 'none',
        pointerEvents: 'none',
        zIndex: '1000',
        background: 'rgba(0, 20, 40, 0.9)',
        color: '#00ffaa',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        padding: '2px 6px',
        borderRadius: '4px',
        border: '1px solid rgba(0, 229, 229, 0.3)',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s ease'
    });
    document.body.appendChild(tooltip);

    const ranges = container.querySelectorAll('input[type="range"]');
    ranges.forEach(range => {
        const show = () => {
            tooltip.textContent = range.value;
            tooltip.style.display = 'block';
            tooltip.style.opacity = '1';
            positionTooltip(range);
        };
        const hide = () => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.style.opacity === '0') tooltip.style.display = 'none';
            }, 150);
        };
        const positionTooltip = (r) => {
            const rect = r.getBoundingClientRect();
            const min = parseFloat(r.min || 0);
            const max = parseFloat(r.max || 100);
            const val = parseFloat(r.value || 0);
            const percent = max === min ? 0 : (val - min) / (max - min);
            const thumbWidth = 14;
            const thumbCenter = percent * (rect.width - thumbWidth) + thumbWidth / 2;
            const tooltipRect = tooltip.getBoundingClientRect();
            const top = rect.top + window.scrollY - tooltipRect.height - 6;
            const left = rect.left + window.scrollX + thumbCenter - (tooltipRect.width / 2);
            tooltip.style.top = `${top}px`;
            tooltip.style.left = `${left}px`;
        };

        range.addEventListener('input', () => {
            show();
            positionTooltip(range);
        });
        range.addEventListener('mouseenter', show);
        range.addEventListener('mouseleave', hide);
        range.addEventListener('focus', show);
        range.addEventListener('blur', hide);
    });
}

init();
// End of main

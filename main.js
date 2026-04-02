// Main application entry point
// Neuro-Weaver V2.8 Implementation - With Routine Engine
import { BrainRenderer } from './brain-renderer.js';
import { InferenceEngine } from './inference-engine.js';
import { RoutinePlayer } from './routine-player.js'; // [NEW]
import { AudioReactor } from './audio-reactor.js';   // [NEW]

// [Phase 3] Keyboard Triggered Routines
const MINI_ROUTINES = {
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
        { time: 0.0, type: 'lerp', key: 'colorShift', value: 1.0, duration: 2.0, ease: 'sineInOut' },
        { time: 0.0, type: 'lerp', key: 'flowSpeed', value: 8.0, duration: 2.0, ease: 'cubicIn' },
        { time: 3.0, type: 'lerp', key: 'colorShift', value: 0.0, duration: 3.0, ease: 'sineInOut' },
        { time: 3.0, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 3.0, ease: 'quadOut' }
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
    'g': [ // Glitch Storm
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
    's': [ // Wait/Signal Demo
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
        aberration: document.getElementById('aberration'), // [Phase 7]
        grain: document.getElementById('grain'), // [Phase 7]
        focus: document.getElementById('focus'), // [Phase 7]
        aperture: document.getElementById('aperture'), // [Phase 7]
        ambientLight: document.getElementById('ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('lightDirZ'), // [Phase 2]
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
        aberration: document.getElementById('val-aberration'), // [Phase 7]
        grain: document.getElementById('val-grain'), // [Phase 7]
        focus: document.getElementById('val-focus'), // [Phase 7]
        aperture: document.getElementById('val-aperture'), // [Phase 7]
        ambientLight: document.getElementById('val-ambientLight'), // [Phase 2]
        dirIntensity: document.getElementById('val-dirIntensity'), // [Phase 2]
        lightDirX: document.getElementById('val-lightDirX'), // [Phase 2]
        lightDirY: document.getElementById('val-lightDirY'), // [Phase 2]
        lightDirZ: document.getElementById('val-lightDirZ') // [Phase 2]
    };
    
    if (!navigator.gpu) {
        errorDiv.textContent = 'WebGPU is not supported in this browser.';
        errorDiv.style.display = 'block';
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
            'scan': { rotation: { x: 0.8, y: 0.2 }, zoom: 3.0 }
        };

        // Initialize RoutinePlayer, ensuring it expects the BrainRenderer instance
        const player = new RoutinePlayer(renderer, regionCoordinatesMap, cameraCoordinatesMap);
        console.log("[Neuro-Script Initialization Cycle] Routine Engine Instantiated.");

        // [Safety Handling] Hook up WebGPU device lost promise for player fallback
        if (renderer.device && renderer.device.lost) {
            renderer.device.lost.then((lostEventInfo) => {
                console.error("[Main Logic] WebGPU Context Lost event intercepted. Stopping all routines safely.", lostEventInfo);
                if (player) player.stop();
            });
        }
        window.playerState = player.state; // Share state with global window for inline logic

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

        // Legend UI
        const legend = document.createElement('div');
        legend.id = 'keyboard-legend';
        legend.style.position = 'absolute';
        legend.style.bottom = '10px';
        legend.style.right = '10px';
        legend.style.background = 'rgba(0, 0, 0, 0.7)';
        legend.style.color = '#fff';
        legend.style.padding = '8px';
        legend.style.fontFamily = 'monospace';
        legend.style.fontSize = '12px';
        legend.style.pointerEvents = 'none';
        legend.innerHTML = 'Keys: 1=Surprise, 2=Calm, 3=Scan, 4=Serotonin, 5=Epiphany, 6=Cortisol, P=Panic, 7-9=Views, 0=Focus, -=Breathe, l=Lighting, g=Glitch, m=Memory, c=Custom Audio, t=Time Warp, p=Spline, v=Fly-Through, i=Interactive, b=Branch, w=Math/Vars, s=Signal, o=Orbit Avoid, q=Choice, f=Filters';
        document.body.appendChild(legend);

        // [Phase 4] Narrative Overlay
        const narrative = document.createElement('div');
        narrative.id = 'narrative-overlay';
        Object.assign(narrative.style, {
            position: 'absolute',
            bottom: '15%',
            width: '100%',
            textAlign: 'center',
            color: 'rgba(220, 240, 255, 0.9)',
            fontFamily: '"Courier New", monospace',
            fontSize: '24px',
            textShadow: '0 0 10px rgba(0, 150, 255, 0.8)',
            pointerEvents: 'none',
            transition: 'opacity 1.0s ease-in-out',
            opacity: '0',
            zIndex: '100'
        });
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

                     narrative.innerHTML = htmlMessage;
                     narrative.style.opacity = '1';

                     if (narrativeTimeout) clearTimeout(narrativeTimeout);

                     // Optional: Auto-fade if duration is provided
                     if (event.duration) {
                         narrativeTimeout = setTimeout(() => {
                             narrative.style.opacity = '0';
                             narrativeTimeout = null;
                         }, event.duration * 1000);
                     }
                 } else {
                     narrative.style.opacity = '0';
                     if (narrativeTimeout) {
                         clearTimeout(narrativeTimeout);
                         narrativeTimeout = null;
                     }
                 }
             }
             if (event.type === 'style') {
                 if (inputs.style) inputs.style.value = event.value;
             }
             if (event.type === 'param') {
                 if (inputs[event.key]) inputs[event.key].value = event.value;
                 if (labels[event.key]) labels[event.key].textContent = event.value.toFixed(2);
             }
             if (event.type === 'calm') {
                 // Calm state modifies amplitude, frequency, smoothing
                 // We should sync them if they are in the renderer params
                 ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
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

        // Transport Controls
        const transportDiv = document.createElement('div');
        transportDiv.style.display = 'flex';
        transportDiv.style.gap = '5px';
        transportDiv.style.marginBottom = '5px';

        const btnPlay = document.createElement('button');
        btnPlay.textContent = '▶ Play';
        btnPlay.style.flex = '2';
        btnPlay.style.background = "#0055aa";
        btnPlay.style.color = "white";

        const btnStop = document.createElement('button');
        btnStop.textContent = '⏹';
        btnStop.style.flex = '1';
        btnStop.style.background = "#aa2222";

        // [Phase 3] Procedural Generation Button
        const btnGen = document.createElement('button');
        btnGen.textContent = '🎲';
        btnGen.title = "Generate Random Routine";
        btnGen.style.flex = '0.5';
        btnGen.style.background = "#5522aa";

        transportDiv.appendChild(btnPlay);
        transportDiv.appendChild(btnStop);
        transportDiv.appendChild(btnGen);
        routineContainer.appendChild(transportDiv);

        // Transport Info (Time + Loop)
        const infoDiv = document.createElement('div');
        infoDiv.style.display = 'flex';
        infoDiv.style.justifyContent = 'space-between';
        infoDiv.style.alignItems = 'center';
        infoDiv.style.marginBottom = '10px';
        infoDiv.style.fontSize = '12px';
        infoDiv.style.color = '#aaa';

        const timeDisplay = document.createElement('span');
        timeDisplay.textContent = "00:00 / 00:00";

        const loopLabel = document.createElement('label');
        loopLabel.style.display = 'flex';
        loopLabel.style.alignItems = 'center';
        loopLabel.style.gap = '5px';
        loopLabel.style.margin = '0';

        const chkLoop = document.createElement('input');
        chkLoop.type = 'checkbox';
        chkLoop.style.width = 'auto'; // Reset width from CSS

        loopLabel.appendChild(chkLoop);
        loopLabel.appendChild(document.createTextNode('Loop'));

        infoDiv.appendChild(timeDisplay);
        infoDiv.appendChild(loopLabel);
        routineContainer.appendChild(infoDiv);

        // [Phase 2] Playback Speed Control
        const speedDiv = document.createElement('div');
        speedDiv.style.marginTop = "5px";
        speedDiv.style.marginBottom = "10px";
        speedDiv.style.display = "flex";
        speedDiv.style.alignItems = "center";
        speedDiv.style.gap = "10px";
        speedDiv.style.fontSize = "12px";
        speedDiv.style.color = "#aaa";

        const speedLabel = document.createElement('span');
        speedLabel.id = "routine-speed-label";
        speedLabel.textContent = "Speed: 1.0x";
        speedLabel.style.minWidth = "70px";

        const speedSlider = document.createElement('input');
        speedSlider.type = "range";
        speedSlider.id = "routine-speed"; // For verification
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

        // Event Listeners
        let isLoading = false;
        btnPlay.onclick = async () => {
            if (player.isPlaying) {
                player.pause();
            } else {
                // If no routine loaded, load default
                if (player.routine.length === 0) {
                     isLoading = true;
                     btnPlay.textContent = "⏳ Loading...";
                     await player.loadRoutineFromFile('routines/deep_thought.json', chkLoop.checked);
                     isLoading = false;
                     player.play();
                } else {
                    // Resume if paused, otherwise Play
                    if (player.lastPauseTime > 0) {
                        player.resume();
                    } else {
                        player.play();
                    }
                }
            }
        };

        btnStop.onclick = () => player.stop();

        // [Phase 3] Procedural Generation Handler
        btnGen.onclick = () => {
             player.generateProceduralRoutine();
             player.play();
        };

        chkLoop.onchange = () => {
            player.loop = chkLoop.checked;
        };

        // [New] JSON Loader Input
        const fileLabel = document.createElement('label');
        fileLabel.textContent = "Load Custom Routine (.json / .csv)";
        fileLabel.style.marginTop = "10px";
        routineContainer.appendChild(fileLabel);

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json, .csv';
        fileInput.style.color = "#aaa";
        fileInput.style.marginTop = "5px";
        fileInput.style.width = "100%";

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

        routineContainer.appendChild(fileInput);
        controls.appendChild(routineContainer);

        // -----------------------------

        const inferenceEngine = new InferenceEngine();
        const aiEnabled = await inferenceEngine.initialize();

        // [Existing AI Button Code preserved...]
        let aiMode = false;
        const aiToggle = document.createElement('button');
        aiToggle.textContent = 'Enable AI "Dreaming"';
        aiToggle.style.background = '#424';
        aiToggle.style.borderColor = '#d0d';
        aiToggle.style.color = '#eaffea';
        aiToggle.style.marginTop = "5px";
        aiToggle.onclick = () => {
            aiMode = !aiMode;
            aiToggle.textContent = aiMode ? 'Disable AI Mode' : 'Enable AI "Dreaming"';
            aiToggle.style.background = aiMode ? '#626' : '#424';
            // Stop routine if AI starts
            if(aiMode) player.stop();
        };
        controls.appendChild(aiToggle);

        // [Audio Reactivity Button]
        const audioBtn = document.createElement('button');
        audioBtn.textContent = 'Enable Audio Reactivity 🎤';
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

        // [Director Mode]
        const directorLabels = initDirectorTools(renderer, player);

        // UI & Audio Loop
        const updateLoop = () => {
            // 1. Audio Reactivity
            if (audioReactor.isActive) {
                audioReactor.update(renderer);
                // Sync UI sliders
                if(inputs.amplitude) inputs.amplitude.value = renderer.params.amplitude;
                if(labels.amplitude) labels.amplitude.textContent = renderer.params.amplitude.toFixed(2);
                if(inputs.flowSpeed) inputs.flowSpeed.value = renderer.params.flowSpeed;
                if(labels.flowSpeed) labels.flowSpeed.textContent = renderer.params.flowSpeed.toFixed(2);
            }

            // 2. Transport UI Update
            if (player.isPlaying) {
                btnPlay.textContent = "⏸ Pause";
                btnPlay.style.background = "#aa8800";
            } else {
                if (!isLoading) {
                    btnPlay.textContent = (player.lastPauseTime > 0) ? "▶ Resume" : "▶ Play";
                    btnPlay.style.background = (player.lastPauseTime > 0) ? "#00aa55" : "#0055aa";
                }
            }

            // Time Format
            const fmt = (t) => {
                const m = Math.floor(t / 60).toString().padStart(2, '0');
                const s = Math.floor(t % 60).toString().padStart(2, '0');
                return `${m}:${s}`;
            };
            timeDisplay.textContent = `${fmt(player.currentTime)} / ${fmt(player.duration)}`;

            // 3. Director Tools Update
            if (directorLabels) {
                directorLabels.RotX.textContent = renderer.rotation.x.toFixed(3);
                directorLabels.RotY.textContent = renderer.rotation.y.toFixed(3);
                directorLabels.Zoom.textContent = renderer.zoom.toFixed(2);
            }

            requestAnimationFrame(updateLoop);
        };
        updateLoop();

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
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.style.display = 'block';
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
            });
        }
    });

    document.getElementById('stim-random')?.addEventListener('click', () => {
        renderer.injectStimulus((Math.random()-0.5)*2, (Math.random()-0.5)*2, (Math.random()-0.5)*2, 1.0);
    });

    document.getElementById('stim-calm')?.addEventListener('click', () => {
        renderer.calmState();
        ['amplitude', 'frequency', 'smoothing', 'colorShift', 'sparkle', 'shake', 'stress', 'aberration', 'grain', 'focus', 'aperture', 'ambientLight', 'dirIntensity', 'lightDirX', 'lightDirY', 'lightDirZ'].forEach(k => {
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

init();
// End of main

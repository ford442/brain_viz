export function generateNarrativeRoutine(theme, useLLM = false) {
    if (useLLM) {
        // Future placeholder for actual LLM endpoint call
        console.warn('[AI Narrative] LLM generation requested, but not fully implemented. Falling back to templates.');
    }

    const lowercaseTheme = theme.toLowerCase();

    if (lowercaseTheme.includes('anxiety')) {
        return [
            { time: 0, type: 'text', message: 'Generating Narrative: Anxiety Spike', duration: 3.0 },
            { time: 0, type: 'cortisol', intensity: 1.8, duration: 6.0 },
            { time: 1.0, type: 'text', message: 'Heart rate increasing...', duration: 2.0 },
            { time: 1.5, type: 'cognitive_dissonance', intensity: 1.5, duration: 5.0 },
            { time: 3.0, type: 'text', message: 'Racing thoughts detected.', duration: 2.0 }
        ];
    } else if (lowercaseTheme.includes('eureka')) {
        return [
            { time: 0, type: 'text', message: 'Generating Narrative: Eureka Moment', duration: 3.0 },
            { time: 0, type: 'eureka_moment', intensity: 2.0, duration: 5.0 },
            { time: 1.5, type: 'text', message: 'Sudden insight...', duration: 2.0 },
            { time: 3.0, type: 'text', message: 'Neural pathways synchronized.', duration: 2.0 }
        ];
    } else if (lowercaseTheme.includes('flow state')) {
        return [
            { time: 0, type: 'text', message: 'Generating Narrative: Entering Flow State', duration: 3.0 },
            { time: 0, type: 'binaural', targetBrainwave: 'alpha', duration: 8.0, transitionDuration: 2.0 },
            { time: 2.0, type: 'text', message: 'Task engagement optimal.', duration: 2.0 },
            { time: 2.0, type: 'acetylcholine', duration: 4.0 },
            { time: 4.0, type: 'text', message: 'Loss of self-consciousness...', duration: 3.0 }
        ];
    }

    // Default generic theme
    return [
        { time: 0, type: 'text', message: `Generating Narrative: ${theme}`, duration: 3.0 },
        { time: 2.0, type: 'text', message: 'Processing neural signals...', duration: 2.0 },
        { time: 4.0, type: 'text', message: 'Narrative generation complete.', duration: 2.0 }
    ];
}
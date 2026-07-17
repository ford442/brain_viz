// [Phase 3] Procedural Generation for RoutinePlayer

import { Easing } from './math-utils.js';

export function buildProceduralRoutine(regions, duration = 30.0, intensity = 1.0) {
    const routine = [];
    const numEvents = Math.floor(duration * 0.5 * intensity); // ~1 event every 2 seconds

    // Helper to pick random element
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const rand = (min, max) => Math.random() * (max - min) + min;

    // Use available regions or defaults
    const regionNames = Object.keys(regions).length > 0 ? Object.keys(regions) : ['frontal', 'occipital', 'parietal', 'temporal', 'deep'];
    const styles = [0, 1, 2, 3];
    const easeFuncs = Object.keys(Easing);

    // Initial Setup
    routine.push({ time: 0.0, type: 'text', message: 'Procedural Sequence Initiated', duration: 2.0 });
    routine.push({ time: 0.0, type: 'style', value: pick(styles) });
    routine.push({ time: 0.0, type: 'camera', target: 'global', duration: 2.0 });

    let currentTime = 0.0;

    for (let i = 0; i < numEvents; i++) {
        currentTime += rand(1.0, 4.0);
        if (currentTime > duration) break;

        const eventType = pick(['stimulus', 'camera', 'style', 'lerp', 'text']);

        if (eventType === 'stimulus') {
            routine.push({
                time: currentTime,
                type: 'stimulus',
                target: pick(regionNames),
                intensity: rand(0.5, 1.5) * intensity
            });
        } else if (eventType === 'camera') {
             routine.push({
                time: currentTime,
                type: 'camera',
                target: pick(regionNames), // Use region names as camera targets
                duration: rand(1.0, 3.0),
                ease: pick(easeFuncs)
            });
        } else if (eventType === 'style') {
            routine.push({
                time: currentTime,
                type: 'style',
                value: pick(styles)
            });
            routine.push({
                 time: currentTime,
                 type: 'text',
                 message: 'Style Shift',
                 duration: 1.0
            });
        } else if (eventType === 'lerp') {
            const param = pick(['flowSpeed', 'amplitude', 'frequency', 'colorShift', 'sparkle']);
            let val = 0;
            if (param === 'flowSpeed') val = rand(1.0, 10.0);
            if (param === 'amplitude') val = rand(0.2, 1.5);
            if (param === 'frequency') val = rand(1.0, 8.0);
            if (param === 'colorShift') val = rand(0.0, 1.0);
            if (param === 'sparkle') val = rand(0.0, 1.0);

            routine.push({
                time: currentTime,
                type: 'lerp',
                key: param,
                value: val,
                duration: rand(1.0, 3.0),
                ease: pick(easeFuncs)
            });
        }
    }

    // End with calm
    routine.push({ time: duration, type: 'calm' });
    routine.push({ time: duration, type: 'text', message: 'Sequence Complete', duration: 2.0 });

    return routine.sort((a, b) => a.time - b.time);
}

// Extracted from main.js — Neurofeedback Training Mode wiring.
import { TrainingEngine, BUILTIN_COURSES } from './training-engine.js';
import { setupTrainingPanel } from './ui-training-panel.js';

export function setupTrainingIntegration(renderer, player, audioReactor, synaptixEngine, bciSession) {
    const trainingEngine = new TrainingEngine(renderer, audioReactor, synaptixEngine, player, bciSession);
    player.trainingEngine = trainingEngine;

    setupTrainingPanel(trainingEngine);

    // Keyboard demo baseline: each built-in course plays without any hardware or
    // mouse interaction — press its digit key to start the course and drive its
    // metric straight into the target band via the existing lerp/param pipeline.
    document.addEventListener('keydown', (e) => {
        const tag = (e.target && e.target.tagName) || '';
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
        if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

        const course = BUILTIN_COURSES.find((c) => c.demoKey === e.key);
        if (!course) return;

        trainingEngine.startCourse(course.id);
        for (const [key, value] of Object.entries(course.demoParams || {})) {
            player.startLerp({ key, value, duration: 1.5, ease: 'sineInOut' });
        }
        console.log(`[Training] Keyboard demo baseline triggered for '${course.name}' (key '${e.key}')`);
    });

    return trainingEngine;
}

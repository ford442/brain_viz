import { createDefaultHandlers } from '../src/routine-handlers.js';
import { RoutinePlayer } from '../src/routine-player.js';

function runTest() {
    console.log("Starting verification for neuro-inflammation (histamine handler)...");

    // Mock for startLerp
    const lerps = {};
    const params = {};

    const mockRenderer = {
        setParams: (p) => {
            Object.assign(params, p);
        },
        params: {}
    };

    const mockPlayer = new RoutinePlayer(mockRenderer);

    // Trigger neuro_inflammation event
    const handler = mockPlayer.handlers.get('neuro_inflammation');
    if (!handler) {
        console.error("FAIL: 'neuro_inflammation' handler not found.");
        process.exit(1);
    }

    // Mock executeEvent to capture sub-events
    const executedEvents = [];
    mockPlayer.executeEvent = (evt) => {
        executedEvents.push(evt.type);
        if (evt.type === 'stimulus' || evt.type === 'immune_migration' || evt.type === 'text') return;

        const h = mockPlayer.handlers.get(evt.type);
        if (h) h(evt);
    }

    // Call the handler directly
    handler({ type: 'neuro_inflammation', intensity: 1.5, duration: 4.0, target: 'frontal' });

    // Check immediate parameters set by setParams via histamine cascade
    if (params.colorShift === undefined || params.growth === undefined) {
         console.error("FAIL: 'colorShift' or 'growth' not set via setParams.");
         process.exit(1);
    }

    const expectedColorShift = 0.8 * 1.5;
    const expectedGrowth = 1.2 * 1.5;

    // Tolerance for float comparison
    const EPSILON = 0.001;

    if (Math.abs(params.colorShift - expectedColorShift) > EPSILON) {
        console.error(`FAIL: Expected colorShift ~${expectedColorShift}, got ${params.colorShift}`);
        process.exit(1);
    }

    if (Math.abs(params.growth - expectedGrowth) > EPSILON) {
        console.error(`FAIL: Expected growth ~${expectedGrowth}, got ${params.growth}`);
        process.exit(1);
    }

    console.log("SUCCESS: Neuro-inflammation simulation is already implemented correctly.");
    console.log(`Verified 'colorShift' (redness) set to ${params.colorShift} and 'growth' (swelling) set to ${params.growth}.`);
}

runTest();

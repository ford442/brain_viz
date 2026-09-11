import { RoutinePlayer } from '../src/routine-player.js';

function assert(condition, message) {
    if (!condition) {
        console.error(`Assertion failed: ${message}`);
        process.exit(1);
    }
}

// Mock Math/DOM dependencies for Node testing environment
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = clearTimeout;
global.window = {};

// Mock Renderer
class MockRenderer {
    constructor() {
        this.isDestroyed = false;
        this.backendType = 'webgpu';
        this.device = { isLost: false };
        this.isContextLost = false;
        this.isRunning = true;
        this.params = { flowSpeed: 4.0, amplitude: 0.5, sparkle: 0.0, colorShift: 0.0 };
    }
    setParams(p) { Object.assign(this.params, p); }
}

async function runTests() {
    console.log("Running CSD Event Test...");

    let renderer = new MockRenderer();
    let player = new RoutinePlayer(renderer, {}, {});

    let executed = false;

    // We expect the csd handler to exist
    const csdHandler = player.handlers.get('csd');
    assert(csdHandler !== undefined, "csd handler should be registered");

    // execute handler
    csdHandler({ type: 'csd', intensity: 1.0, duration: 2.0 });

    // The handler should trigger lerps on amplitude, sparkle, flowSpeed, and colorShift.
    assert(player.activeLerps.length === 4, "Should have 4 active lerps for initial wave");

    console.log("CSD verification tests passed.");
}

runTests();

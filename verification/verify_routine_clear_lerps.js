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
        this.params = { flowSpeed: 1.0 };
    }
    setParams(p) { Object.assign(this.params, p); }
}

async function runTests() {
    console.log("Running RoutinePlayer clearLerps Tests...");

    let renderer = new MockRenderer();
    let player = new RoutinePlayer(renderer, {}, {});

    player.activeLerps.push({ key: 'flowSpeed', endVal: 5.0, duration: 1.0, elapsed: 0.0 });
    player.activeTasks.push({ action: 'delayedEffect' });

    assert(player.activeLerps.length === 1, "activeLerps should have 1 item");
    assert(player.activeTasks.length === 1, "activeTasks should have 1 item");

    player.clearLerps();

    assert(player.activeLerps.length === 0, "activeLerps should be cleared");
    assert(player.activeTasks.length === 0, "activeTasks should be cleared");

    console.log("All clearLerps tests passed successfully.");
}

runTests();

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
    console.log("Running RoutinePlayer Timing & Safety Tests...");

    // Test 1: WebGPU context loss safety
    console.log("Test 1: WebGPU context loss degrades gracefully...");
    let renderer = new MockRenderer();
    let player = new RoutinePlayer(renderer, {}, {});
    player.routine = [{ time: 1.0, type: 'marker' }]; // Ensure routine has length to avoid early return
    player.play();
    assert(player.isPlaying === true, "Player should be playing");

    // Simulate device context loss
    renderer.isContextLost = true;
    player.tick();
    assert(player.isPlaying === false, "Player should stop playing on context loss");
    console.log("Test 1 passed.");

    // Test 2: TimeDebt catch-up logic
    console.log("Test 2: TimeDebt cap limits frame jump...");
    renderer = new MockRenderer();
    player = new RoutinePlayer(renderer, {}, {});
    player.routine = [{ time: 10.0, type: 'marker' }];

    player.play();
    let initialTime = player.elapsedTime;

    // Fake a 250ms stall (0.250 seconds)
    const initialNow = performance.now();
    player.lastFrameTime = initialNow - 250;

    // Override performance.now to return initialNow so delta is exactly 250ms
    const originalNow = performance.now;
    global.performance.now = () => initialNow;

    player.tick();

    // MAX_FRAME_DT is 0.1 (100ms cap) in routine-player.js
    assert(Math.abs(player.elapsedTime - (initialTime + 0.1)) < 0.001,
        `Elapsed time should only increase by 0.1 (capped), got ${player.elapsedTime}`);
    assert(Math.abs(player.timeDebt - 0.15) < 0.001,
        `Time debt should accumulate the remaining 0.15, got ${player.timeDebt}`);

    console.log("Test 2 passed.");

    // Restore performance.now
    global.performance.now = originalNow;
    console.log("All tests passed successfully.");
}

runTests();

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
    console.log("Running RoutinePlayer Easing Tests...");

    let renderer = new MockRenderer();
    let player = new RoutinePlayer(renderer, {}, {});

    // Set player playing so tick() progresses
    player.isPlaying = true;

    // We will test the startLerp function
    player.startLerp({
        key: 'flowSpeed',
        value: 5.0,
        duration: 1.0,
        ease: 'linear'
    });

    // advance time and manually process lerps
    player.processLerps(0.5); // 0.5s passed (linear interpolation)

    console.log("Current flowSpeed:", renderer.params.flowSpeed);
    assert(renderer.params.flowSpeed > 1.0 && renderer.params.flowSpeed < 5.0, "Lerp should be progressing");
    assert(Math.abs(renderer.params.flowSpeed - 3.0) < 0.001, "Linear ease should be at midpoint");

    // complete lerp
    player.processLerps(0.6); // > 1.0 total
    assert(renderer.params.flowSpeed === 5.0, "Lerp should end at target value");

    console.log("All easing tests passed successfully.");
}

runTests();

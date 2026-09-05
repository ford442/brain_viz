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
    console.log("Running RoutinePlayer Extensibility Tests...");

    let renderer = new MockRenderer();
    let player = new RoutinePlayer(renderer, {}, {});

    let customEventTriggered = false;
    let customEventValue = null;

    player.registerHandler('my_custom_event', (evt) => {
        customEventTriggered = true;
        customEventValue = evt.payload;
    });

    player.executeEvent({ type: 'my_custom_event', payload: 42 });

    assert(customEventTriggered === true, "Custom event handler should have been triggered");
    assert(customEventValue === 42, "Custom event handler should have received the payload");

    console.log("All extensibility tests passed successfully.");
}

runTests();

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

// Stands in for src/paint-controller.js's PaintController — this test
// exercises the routine-handler wiring (registerPaintHandlers), not the
// real pointer/raycast/DOM logic, which needs a browser (see verify_paint.py).
class MockPaintController {
    constructor() {
        this.enabled = false;
        this.erase = false;
        this.brush = { radius: 0.35, intensity: 0.8, decayHalfLife: 1.2 };
        this.enableCalls = 0;
        this.disableCalls = 0;
        this.snapshots = [];
        this.restoreCalls = [];
    }
    enable() { this.enabled = true; this.enableCalls++; }
    disable() { this.enabled = false; this.disableCalls++; }
    setBrush({ radius, intensity, decayHalfLife } = {}) {
        if (radius !== undefined) this.brush.radius = radius;
        if (intensity !== undefined) this.brush.intensity = intensity;
        if (decayHalfLife !== undefined) this.brush.decayHalfLife = decayHalfLife;
    }
    setEraseMode(erase) { this.erase = erase; }
    async snapshot(label) {
        const entry = { label, timestamp: 0 };
        this.snapshots.push(entry);
        return entry;
    }
    async restoreSnapshot(indexOrLabel) {
        this.restoreCalls.push(indexOrLabel);
        return true;
    }
}

async function runTests() {
    console.log("Running Paint Energy routine handler tests...");

    const renderer = new MockRenderer();
    const player = new RoutinePlayer(renderer, {}, {});
    const paintController = new MockPaintController();
    player.paintController = paintController;

    // paint_enable should enable the controller and forward brush settings
    player.executeEvent({ type: 'paint_enable', radius: 0.5, intensity: 1.2, decayHalfLife: 2.0, erase: true });
    assert(paintController.enableCalls === 1, "paint_enable should call enable()");
    assert(paintController.enabled === true, "paintController should be enabled");
    assert(paintController.brush.radius === 0.5, "paint_enable should forward brush radius");
    assert(paintController.brush.intensity === 1.2, "paint_enable should forward brush intensity");
    assert(paintController.brush.decayHalfLife === 2.0, "paint_enable should forward decayHalfLife");
    assert(paintController.erase === true, "paint_enable should forward erase mode");

    // paint_disable
    player.executeEvent({ type: 'paint_disable' });
    assert(paintController.disableCalls === 1, "paint_disable should call disable()");
    assert(paintController.enabled === false, "paintController should be disabled");

    // paint_snapshot (capture)
    player.executeEvent({ type: 'paint_snapshot', label: 'checkpoint-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(paintController.snapshots.length === 1, "paint_snapshot should capture a snapshot");
    assert(paintController.snapshots[0].label === 'checkpoint-1', "paint_snapshot should forward the label");

    // paint_snapshot (restore)
    player.executeEvent({ type: 'paint_snapshot', restore: 'checkpoint-1' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert(paintController.restoreCalls.length === 1, "paint_snapshot with restore should call restoreSnapshot()");
    assert(paintController.restoreCalls[0] === 'checkpoint-1', "restoreSnapshot should receive the restore target");

    // Handlers should no-op gracefully without a paintController attached
    player.paintController = undefined;
    player.executeEvent({ type: 'paint_enable' });
    player.executeEvent({ type: 'paint_disable' });
    player.executeEvent({ type: 'paint_snapshot' });

    console.log("All Paint Energy routine handler tests passed successfully.");
}

runTests();

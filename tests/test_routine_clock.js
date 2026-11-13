// tests/test_routine_clock.js
// [Neuro-Weaver] RoutinePlayer's routine clock (player.after) and its WebGPU
// device-loss halt. Headless: a mock renderer, a hand-driven clock, no rAF loop.
import assert from 'node:assert/strict';

let now = 0;
globalThis.performance = /** @type {any} */ ({ now: () => now });
globalThis.requestAnimationFrame = /** @type {any} */ (() => 0); // tick() is driven by hand below
globalThis.cancelAnimationFrame = () => {};
globalThis.window = /** @type {any} */ ({});

const { RoutinePlayer } = await import('../src/routine-player.js');

function makeRenderer() {
    return {
        backendType: 'webgpu',
        // A live GPUDevice: `lost` is a Promise that has not settled. It is
        // always truthy, so it must never be read as "the device is lost".
        device: { lost: new Promise(() => {}) },
        isContextLost: false,
        isDestroyed: false,
        isRunning: true,
        params: { amplitude: 0.5 },
        setParams(p) { Object.assign(this.params, p); },
    };
}

/** Advance the hand-driven clock by `sec` in 50 ms ticks. */
function advance(player, sec) {
    for (let t = 0; t < sec - 1e-9; t += 0.05) {
        now += 50;
        player.tick();
    }
}

// A long marker keeps the routine alive while tasks run.
const ROUTINE = [{ time: 0, type: 'marker' }, { time: 10, type: 'marker' }];

// 1. A live device (unsettled `lost` Promise) keeps playing.
{
    const player = new RoutinePlayer(/** @type {any} */ (makeRenderer()));
    player.routine = ROUTINE.slice();
    player.play();
    advance(player, 0.5);
    assert.equal(player.isPlaying, true, 'a pending device.lost Promise must not halt the routine');
    assert.ok(player.currentTime > 0.4, 'routine time must advance');
}

// 2. isContextLost (set by handleDeviceLost) halts it.
{
    const renderer = makeRenderer();
    const player = new RoutinePlayer(/** @type {any} */ (renderer));
    player.routine = ROUTINE.slice();
    player.play();
    advance(player, 0.1);
    renderer.isContextLost = true;
    advance(player, 0.1);
    assert.equal(player.isPlaying, false, 'isContextLost must halt the routine');
}

// 3. after() runs on routine time: it waits through a pause.
{
    const player = new RoutinePlayer(/** @type {any} */ (makeRenderer()));
    player.routine = ROUTINE.slice();
    player.play();
    let fired = 0;
    player.after(0.3, () => fired++);
    advance(player, 0.1);
    player.pause();
    now += 5000; // 5 s of wall-clock time while paused
    player.resume();
    assert.equal(fired, 0, 'a routine-clock task must not fire during a pause');
    advance(player, 0.3);
    assert.equal(fired, 1, 'the task fires once its routine-time delay has elapsed');
}

// 4. stop() drops ordinary tasks but flushes cleanup tasks.
{
    const player = new RoutinePlayer(/** @type {any} */ (makeRenderer()));
    player.routine = ROUTINE.slice();
    player.play();
    let effect = 0;
    let restored = 0;
    player.after(1, () => effect++);
    player.after(1, () => restored++, { cleanup: true });
    player.stop();
    assert.equal(effect, 0, 'stop() cancels an ordinary task');
    assert.equal(restored, 1, 'stop() runs a cleanup task so restore effects never stick');
    assert.equal(player.activeTasks.length, 0);
}

console.log('test_routine_clock: ok');

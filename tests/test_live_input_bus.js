// tests/test_live_input_bus.js
// [Live Input Bus] Pins the mapping-table contract: a source's sampled
// feature reaches a renderer param sink scaled and smoothed, multiple
// mappings can share a sink, mappings round-trip through localStorage, and
// RoutinePlayer's `if: "live.…"` condition sugar parses the same features.

import assert from 'node:assert/strict';

// Node has no `localStorage` global before v22 (and it's not guaranteed
// available here); live-input-bus.js only touches it inside try/catch calls
// made explicitly below, so a trivial in-memory shim is enough.
globalThis.localStorage = {
    _store: new Map(),
    getItem(key) { return this._store.has(key) ? this._store.get(key) : null; },
    setItem(key, value) { this._store.set(key, String(value)); },
    removeItem(key) { this._store.delete(key); },
};

const { LiveInputBus, LIVE_INPUT_SINKS, createMapping } = await import('../src/live-input-bus.js');

function makeRenderer() {
    return {
        zoom: 5,
        params: { flowSpeed: 4, colorShift: 0 },
        setParams(patch) { Object.assign(this.params, patch); },
        setCameraParams(patch) { if (patch.zoom !== undefined) this.zoom = patch.zoom; },
    };
}

// --- 1. Source registration & sampling ---------------------------------

{
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    bus.registerSource('audio', { hz: 1000, features: ['bass', 'energy'], sample: () => ({ bass: 0.5, energy: 0.2 }) });

    assert.deepEqual(
        bus.listFeatures(),
        [{ source: 'audio', feature: 'bass' }, { source: 'audio', feature: 'energy' }]
    );

    bus.tick(1 / 60, 0);
    assert.equal(bus.getFeatureValue('audio', 'bass'), 0.5);
    assert.equal(bus.getFeatureValue('audio', 'missing'), 0, 'unknown feature reads as 0');
    assert.equal(bus.getFeatureValue('unknown-source', 'bass'), 0, 'unknown source reads as 0');

    assert.throws(() => bus.registerSource('bad', { features: [] }), /needs a sample/);
}

// --- 2. hz throttling: a slow source only re-samples on its own period -----

{
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    let calls = 0;
    let value = 0;
    bus.registerSource('slow', { hz: 1, features: ['x'], sample: () => { calls++; return { x: value }; } });

    value = 1;
    bus.tick(0, 0);       // t=0ms: first sample always due
    value = 2;
    bus.tick(0.05, 100);  // t=100ms: period is 1000ms, not due yet
    assert.equal(bus.getFeatureValue('slow', 'x'), 1, 'sample held until the source\'s hz period elapses');
    assert.equal(calls, 1);

    value = 3;
    bus.tick(0.05, 1100); // t=1100ms: >= 1000ms since last sample, due again
    assert.equal(bus.getFeatureValue('slow', 'x'), 3);
    assert.equal(calls, 2);
}

// --- 3. Mapping applies scale, attack/release smoothing, and offsets from
//        a baseline captured on first use (multiple mappings can share a sink) ---

{
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    let bass = 0;
    let energy = 0;
    bus.registerSource('audio', { hz: 1000, features: ['bass', 'energy'], sample: () => ({ bass, energy }) });

    const mapping = bus.addMapping({ source: 'audio', feature: 'bass', sink: 'flowSpeed', scale: 2, attack: 0.001, release: 0.001 });
    assert.ok(LIVE_INPUT_SINKS.includes(mapping.sink));

    const baselineFlowSpeed = renderer.params.flowSpeed; // 4

    bass = 1;
    // Large dt relative to the 0.001s time constant fully settles the smoother.
    bus.tick(1, 1000);
    assert.ok(Math.abs(renderer.params.flowSpeed - (baselineFlowSpeed + 1 * 2)) < 1e-6,
        `expected flowSpeed to settle near baseline + scale*feature, got ${renderer.params.flowSpeed}`);

    // A second mapping onto the same sink accumulates additively.
    bus.addMapping({ source: 'audio', feature: 'energy', sink: 'flowSpeed', scale: 1, attack: 0.001, release: 0.001 });
    energy = 0.5;
    bus.tick(1, 2000);
    assert.ok(Math.abs(renderer.params.flowSpeed - (baselineFlowSpeed + 1 * 2 + 0.5 * 1)) < 1e-6,
        'a second mapping onto the same sink should add to, not replace, the first');

    // 'zoom' is special-cased through setCameraParams instead of setParams.
    bus.addMapping({ source: 'audio', feature: 'bass', sink: 'zoom', scale: 1, attack: 0.001, release: 0.001 });
    const baselineZoom = renderer.zoom;
    bus.tick(1, 3000);
    assert.ok(Math.abs(renderer.zoom - (baselineZoom + 1)) < 1e-6);

    // Disabling a mapping stops it from contributing on the next tick.
    bus.updateMapping(mapping.id, { enabled: false });
    bass = 0;
    bus.tick(1, 4000);
    assert.ok(Math.abs(renderer.params.flowSpeed - (baselineFlowSpeed + 0.5 * 1)) < 1e-6,
        'disabled mapping should stop contributing');
}

// --- 4. localStorage round-trip -----------------------------------------

{
    localStorage.removeItem('neuroWeaver.liveInputBus.mappings');
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    bus.registerSource('audio', { hz: 60, features: ['bass'], sample: () => ({ bass: 0 }) });
    bus.enabled = false;
    bus.addMapping({ source: 'audio', feature: 'bass', sink: 'sparkle', scale: 3, attack: 0.1, release: 0.5, enabled: false });
    bus.saveToLocalStorage();

    const restored = new LiveInputBus(renderer);
    const loaded = restored.loadFromLocalStorage();
    assert.ok(loaded);
    assert.equal(restored.enabled, false);
    assert.equal(restored.mappings.length, 1);
    assert.equal(restored.mappings[0].sink, 'sparkle');
    assert.equal(restored.mappings[0].scale, 3);
    assert.equal(restored.mappings[0].enabled, false);

    const fresh = new LiveInputBus(renderer);
    localStorage.removeItem('neuroWeaver.liveInputBus.mappings');
    assert.equal(fresh.loadFromLocalStorage(), false, 'no persisted mappings yet');
}

// --- 5. createMapping falls back to a valid sink for a bad value -----------

{
    const mapping = createMapping({ sink: 'not-a-real-sink' });
    assert.equal(mapping.sink, LIVE_INPUT_SINKS[0]);
}

// --- 6. evaluateCondition: RoutinePlayer's `if: "live.…"` sugar -----------

{
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    bus.registerSource('bci', { hz: 1000, features: ['alpha'], sample: () => ({ alpha: 0.7 }) });
    bus.tick(0, 0);

    assert.equal(bus.evaluateCondition('live.bci.alpha > 0.6'), true);
    assert.equal(bus.evaluateCondition('live.bci.alpha < 0.6'), false);
    assert.equal(bus.evaluateCondition('live.alpha >= 0.7'), true, 'bare feature name resolves against any source that has it');
    assert.equal(bus.evaluateCondition('live.nope > 0.1'), true, 'unresolvable feature fails open');
    assert.equal(bus.evaluateCondition('not an expression'), true, 'unparsable expression fails open');
    assert.equal(bus.evaluateCondition(42), true, 'non-string input fails open');
}

console.log('Live Input Bus tests passed.');

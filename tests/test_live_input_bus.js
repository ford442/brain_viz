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
const { LiveMidiSource } = await import('../src/live-midi-source.js');
const { LiveHrSource } = await import('../src/live-hr-source.js');

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

// --- 7. MIDI: permissions, channels, note-off, hotplug and cleanup --------
{
    class Input extends EventTarget {
        constructor() { super(); this.state = 'connected'; }
        send(...bytes) {
            const event = new Event('midimessage');
            event.data = Uint8Array.from(bytes);
            this.dispatchEvent(event);
        }
    }
    const first = new Input();
    const second = new Input();
    const access = { inputs: new Map([['first', first]]), onstatechange: null };
    const source = new LiveMidiSource(async () => access);
    await source.connect();
    first.send(0xb2, 0, 127);
    first.send(0xbf, 127, 64);
    first.send(0x92, 60, 127);
    first.send(0x92, 61, 64);
    assert.equal(source.sample().cc0, 1);
    assert.equal(source.sample().cc127, 64 / 127);
    assert.equal(source.sample().note, 64 / 127);
    first.send(0x82, 61, 0);
    assert.equal(source.sample().note, 1);
    first.send(0x92, 60, 0);
    assert.equal(source.sample().note, 0);
    first.send(0xb0, 4); // truncated packet ignored
    access.inputs.set('second', second);
    access.onstatechange();
    second.send(0xb0, 0, 32);
    assert.equal(source.sample().cc0, 32 / 127);
    second.state = 'disconnected';
    access.onstatechange();
    assert.equal(source.sample().cc0, 1);
    source.disconnect();
    first.send(0xb0, 0, 127);
    assert.equal(source.sample().cc0, 0);
    assert.equal(access.onstatechange, null);
    const denied = new LiveMidiSource(async () => { throw new Error('denied'); });
    await assert.rejects(denied.connect(), /denied/);
    assert.match(denied.status, /denied/);
}

// --- 8. BLE heart rate formats, bus mapping, errors and disconnect -------
{
    class Characteristic extends EventTarget {
        async startNotifications() { return this; }
        async stopNotifications() { return this; }
        send(bytes) {
            this.value = new DataView(Uint8Array.from(bytes).buffer);
            this.dispatchEvent(new Event('characteristicvaluechanged'));
        }
    }
    const characteristic = new Characteristic();
    const device = new EventTarget();
    device.name = 'Mock strap';
    device.gatt = {
        connected: false,
        async connect() { this.connected = true; return this; },
        async getPrimaryService(name) {
            assert.equal(name, 'heart_rate');
            return { async getCharacteristic(id) {
                assert.equal(id, 'heart_rate_measurement');
                return characteristic;
            } };
        },
        disconnect() { this.connected = false; },
    };
    let requested;
    const source = new LiveHrSource({ requestDevice: async (options) => { requested = options; return device; } });
    await source.connect();
    assert.deepEqual(requested.filters, [{ services: ['heart_rate'] }]);
    characteristic.send([0, 110]);
    assert.deepEqual(source.sample(), { bpm: 110, hr: 0.5 });
    characteristic.send([1, 0x2c, 0x01]);
    assert.deepEqual(source.sample(), { bpm: 300, hr: 1 });
    characteristic.send([1, 0]);
    assert.equal(source.sample().bpm, 300, 'truncated measurement ignored');
    characteristic.send([0, 110]);
    const renderer = makeRenderer();
    const bus = new LiveInputBus(renderer);
    bus.registerSource('hr', { hz: source.hz, features: source.features, sample: () => source.sample() });
    bus.addMapping({ source: 'hr', feature: 'hr', sink: 'flowSpeed', scale: 2 });
    bus.tick(1, 0);
    assert.equal(renderer.params.flowSpeed, 5);
    assert.equal(bus.evaluateCondition('live.hr.bpm > 90'), true);
    device.dispatchEvent(new Event('gattserverdisconnected'));
    assert.deepEqual(source.sample(), { bpm: 0, hr: 0 });
    characteristic.send([0, 150]);
    assert.equal(source.sample().bpm, 0);
    const denied = new LiveHrSource({ requestDevice: async () => { throw new Error('denied'); } });
    await assert.rejects(denied.connect(), /denied/);
    assert.match(denied.status, /denied/);
}

// --- 9. External packets expose only valid numeric channels --------------
{
    const { setupLiveInputIntegration } = await import('../src/main-live-input-integration.js');
    const windowMock = new EventTarget();
    windowMock.location = { search: '?external=wss%3A%2F%2Fexample.test%2Flive' };
    globalThis.window = windowMock;
    let socket;
    globalThis.WebSocket = class {
        constructor(url) { assert.equal(url, 'wss://example.test/live'); socket = this; }
    };
    const bus = setupLiveInputIntegration(makeRenderer(), {}, { getFeatures: () => ({}) }, null, null, null);
    let changes = 0;
    windowMock.addEventListener('live-input-features-changed', () => changes++);
    socket.onmessage({ data: JSON.stringify({ channels: {
        cc74: 0.4, bpm: 105, bad: '1', 'invalid.name': 0.5, constructor: 1,
    } }) });
    const source = bus.sources.get('external');
    assert.ok(source.features.includes('cc74'));
    assert.ok(source.features.includes('bpm'));
    assert.ok(!source.features.includes('bad'));
    assert.ok(!source.features.includes('invalid.name'));
    assert.ok(!source.features.includes('constructor'));
    assert.equal(source.sample().bpm, 105);
    assert.equal(changes, 1);
    socket.onmessage({ data: '{' });
    socket.onmessage({ data: JSON.stringify({ channels: [] }) });
    assert.equal(source.sample().bpm, 105);
    socket.onmessage({ data: JSON.stringify({ channels: { cc74: 0.2 } }) });
    assert.equal(source.sample().cc74, 0.2);
    assert.equal(changes, 1, 'known channels do not repeatedly rebuild the UI');
    delete globalThis.window;
    delete globalThis.WebSocket;
}

console.log('Live Input Bus tests passed.');

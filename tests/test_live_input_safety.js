import assert from 'node:assert/strict';
import { LiveInputBus, LIVE_INPUT_SINKS } from '../src/live-input-bus.js';
import { registerNarrativeFlowHandlers } from '../src/routine-handlers/narrative-flow.js';

const bounds = {
    zoom: [2, 10], colorShift: [0, 1], sparkle: [0, 1], amplitude: [0, 2],
    flowSpeed: [0, 10], decayRate: [0.8, 1], diffusionRate: [0, 0.5],
    pulseSaturation: [0, 3], trailLength: [0, 5], pointCloudDensity: [0, 2],
    fiberCoupling: [0, 1], resonanceThreshold: [0.05, 0.5], aiLayer: [0, 63],
    shake: [0, 0.5], aberration: [0, 2], grain: [0, 1], fogDensity: [0, 0.5],
    stress: [0, 2], cortisol: [0, 1],
};
assert.deepEqual([...LIVE_INPUT_SINKS].sort(), Object.keys(bounds).sort());
assert.ok(!LIVE_INPUT_SINKS.includes('growth') && !LIVE_INPUT_SINKS.includes('foldStrength'));

function setup(sink = 'sparkle') {
    const writes = [];
    const renderer = {
        zoom: 5, params: Object.fromEntries(Object.entries(bounds).map(([key, [min, max]]) => [key, (min + max) / 2])),
        setParams: (patch) => writes.push(patch),
        setCameraParams: (patch) => writes.push(patch),
    };
    const bus = new LiveInputBus(renderer);
    let sample = 1;
    bus.registerSource('hr', { hz: 1000, features: ['bpm'], sample: () => ({ bpm: sample }) });
    const mapping = bus.addMapping({ source: 'hr', feature: 'bpm', sink, scale: 1000 });
    return { bus, mapping, writes, setSample: (v) => { sample = v; } };
}

for (const [sink, [min, max]] of Object.entries(bounds)) {
    const { bus, mapping, writes } = setup(sink);
    bus.tick(1, 0);
    assert.equal(writes.at(-1)[sink], max, `${sink} upper bound`);
    bus.updateMapping(mapping.id, { scale: -1000 });
    bus.tick(1, 2);
    assert.equal(writes.at(-1)[sink], min, `${sink} lower bound`);
}

{
    const { bus, mapping, writes, setSample } = setup();
    bus.addMapping({ source: 'hr', feature: 'bpm', sink: 'sparkle', scale: 1000 });
    bus.tick(1, 0);
    assert.equal(writes.at(-1).sparkle, 1, 'combined mappings are bounded');
    bus.clear();
    bus.loadFromMappings([{ sink: 'growth' }, { sink: 'foldStrength' }, { sink: '__proto__' }]);
    bus.tick(1, 2);
    assert.equal(bus.mappings.length, 0, 'old unsafe and invalid mappings are discarded');
    const invalid = bus.addMapping({ sink: 'growth' });
    const invalidBefore = writes.length;
    bus.updateMapping(invalid.id, { enabled: true });
    bus.tick(1, 3);
    assert.equal(writes.length, invalidBefore, 'invalid new mapping is not routed to fallback zoom');
    bus.clear();
    bus.mappings.push(mapping);
    bus.updateMapping(mapping.id, { sink: 'growth' });
    const before = writes.length;
    bus.tick(1, 4);
    mapping.sink = '__proto__';
    bus.tick(1, 6);
    assert.equal(writes.length, before, 'updated or directly mutated sinks cannot bypass allowlist');
    mapping.sink = 'sparkle';
    for (const patch of [{ scale: NaN }, { scale: Infinity }, { attack: NaN }, { release: Infinity }]) {
        Object.assign(mapping, { scale: 1, attack: 0.05, release: 0.4 }, patch);
        bus.tick(1, 8);
    }
    Object.assign(mapping, { scale: 1, attack: 0.05, release: 0.4 });
    let timestamp = 10;
    for (const raw of [NaN, Infinity, -Infinity, '1']) {
        setSample(raw);
        bus.tick(1, timestamp);
        timestamp += 2;
    }
    assert.equal(writes.length, before, 'invalid numeric inputs cannot reach the renderer');
    setSample(0.1);
    bus.renderer.params.sparkle = NaN;
    bus.resetBaselines();
    bus.tick(1, timestamp);
    assert.equal(writes.length, before, 'invalid baselines are never sent');
    bus.renderer.params.sparkle = 0.5;
    bus.tick(1, timestamp + 2);
    assert.ok(Number.isFinite(writes.at(-1).sparkle), 'a corrected baseline can recover');
}

{
    const { bus, setSample } = setup('flowSpeed');
    setSample(100);
    bus.tick(1, 0);
    assert.equal(bus.getFeatureValue('hr', 'bpm'), 100, 'raw BPM is not normalized or clamped');
    assert.equal(bus.evaluateCondition('live.hr.bpm > 90'), true);
    const played = [];
    const player = { liveInputBus: bus, state: { ready: false }, subRoutines: { yes: 'yes', no: 'no' }, playNow: (routine) => played.push(routine) };
    const handlers = new Map();
    registerNarrativeFlowHandlers(handlers, player);
    const branch = (condition) => handlers.get('branch')({ condition, trueBranch: 'yes', falseBranch: 'no' });
    branch('live.hr.bpm > 90');
    setSample(80);
    bus.tick(1, 2);
    branch('live.hr.bpm > 90');
    branch('state.ready');
    branch(() => true);
    branch(false);
    player.liveInputBus = null;
    branch('live.hr.bpm > 90');
    assert.deepEqual(played, ['yes', 'no', 'no', 'yes', 'no', 'yes']);
}

console.log('Live Input safety tests passed.');

// tests/test_multi_brain.js
// [Multi-Brain] Pins src/multi-brain-layout.js, the one copy of the
// two-cortex layout both renderer backends draw from: when the second cortex
// shows, where each cortex sits, and that the bridges join mirrored anchors
// on the facing sides.

import assert from 'node:assert/strict';
import {
  avatarLocalMatrices,
  forEachBridgeVertex,
  isMultiBrainActive,
  BRIDGE_ANCHORS,
  BRIDGE_MAX_VERTICES,
  BRIDGE_SEGMENTS,
  MULTI_BRAIN_OFFSET_X,
  MULTI_BRAIN_SCALE,
} from '../src/multi-brain-layout.js';
import { RoutinePlayer } from '../src/routine-player.js';
import { indexToWorld } from '../src/physics/tensor-field.js';

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

// --- 1. Gate -------------------------------------------------------------

assert.equal(isMultiBrainActive({ style: 4 }), true, 'style 4 defaults to two cortices');
assert.equal(isMultiBrainActive({ style: 4, dualAvatarEnabled: false }), false);
assert.equal(isMultiBrainActive({ style: 3, dualAvatarEnabled: true }), false, 'only SynaptiX has a partner tensor');
assert.equal(isMultiBrainActive({}), false);

// --- 2. Avatar transforms (column-major: translation in 12..14) ----------

{
  const { avatarA, partner } = avatarLocalMatrices();
  close(avatarA[12], -MULTI_BRAIN_OFFSET_X, 'avatar A sits left');
  close(partner[12], MULTI_BRAIN_OFFSET_X, 'partner sits right');
  for (const m of [avatarA, partner]) {
    close(m[0], MULTI_BRAIN_SCALE, 'scale x');
    close(m[5], MULTI_BRAIN_SCALE, 'scale y');
    close(m[10], MULTI_BRAIN_SCALE, 'scale z');
    close(m[13], 0, 'no y offset');
    close(m[14], 0, 'no z offset');
  }
}

// --- 3. Bridges ------------------------------------------------------------

{
  const vertices = [];
  const count = forEachBridgeVertex({}, 0, (position, color) => vertices.push({ position: [...position], color: [...color] }));
  assert.equal(count, BRIDGE_MAX_VERTICES);
  assert.equal(vertices.length, BRIDGE_MAX_VERTICES);

  // Each bridge is BRIDGE_SEGMENTS line segments from A's anchor to the
  // partner's X-mirrored anchor.
  Object.values(BRIDGE_ANCHORS).forEach((anchor, i) => {
    const first = vertices[i * BRIDGE_SEGMENTS * 2].position;
    const last = vertices[(i + 1) * BRIDGE_SEGMENTS * 2 - 1].position;
    close(first[0], -MULTI_BRAIN_OFFSET_X + anchor[0] * MULTI_BRAIN_SCALE, 'bridge starts on avatar A');
    close(last[0], MULTI_BRAIN_OFFSET_X - anchor[0] * MULTI_BRAIN_SCALE, 'bridge ends on the partner');
    close(first[0], -last[0], 'bridge endpoints are mirror images');
    close(first[1], last[1], 'endpoints level');
  });

  // Idle bridges keep a faint floor; full coupling is bright gold.
  close(vertices[0].color[0], 0.05, 'idle glow floor');
  const coupled = [];
  forEachBridgeVertex({ regions: { frontal: 1 } }, 0, (p, color) => coupled.push([...color]));
  assert.deepEqual(coupled[0].map(v => +v.toFixed(3)), [1, 0.82, 0.35]);
}

// --- 4. injectAIStimulus lands where the region is ----------------------
// The partner-side stimulus the mirror-neuron demo uses. Its world -> voxel
// mapping must invert docs/tensor-physics.md §4.1, or lobe targets fall off
// the grid and only 'deep' (the origin) ever draws.

{
  const regions = { frontal: [0, 0, 1.2], parietal: [0, 1.0, 0], deep: [0, 0, 0] };
  let written = null;
  const renderer = {
    voxelDim: 32,
    params: {},
    setParams() {},
    synaptixEngine: { setTensorData(data) { written = data; } },
  };
  const player = new RoutinePlayer(renderer, regions, {});
  for (const [name, target] of Object.entries(regions)) {
    player.executeEvent({ time: 0, type: 'injectAIStimulus', target: name, intensity: 0.8, radius: 4 });
    let peak = -1;
    let peakIndex = -1;
    written.forEach((v, i) => { if (v > peak) { peak = v; peakIndex = i; } });
    assert.ok(peak > 0.5, `${name}: blob drawn inside the grid (peak ${peak})`);
    const world = indexToWorld(peakIndex, 32, [0, 0, 0]);
    const dist = Math.hypot(world[0] - target[0], world[1] - target[1], world[2] - target[2]);
    assert.ok(dist < 0.15, `${name}: peak at [${world.map(v => v.toFixed(2))}] is ${dist.toFixed(2)} from the region`);
  }

  player.executeEvent({ time: 0, type: 'injectAIStimulus', target: 'parietal', intensity: 0 });
  assert.ok(written.every(v => v === 0), 'intensity 0 clears the partner field (not a full-strength blob)');
}

console.log('test_multi_brain passed');

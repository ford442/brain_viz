import assert from 'node:assert/strict';
import { BrainGeometry } from '../src/brain-geometry.js';
import { vertexShader, fragmentShader, fiberVertexShader, fiberFragmentShader } from '../src/shaders.js';

const geometry = new BrainGeometry();
geometry.generate(24, 24);

const fibers = geometry.getFiberData();
const metadata = geometry.getFiberDataWithMetadata();

assert.ok(fibers.length > 0, 'fibers should be generated');
assert.ok(metadata.length > 0, 'fiber metadata should be generated');
assert.equal(
  metadata.length / 4,
  fibers.length / 3,
  'fiber metadata must align 1:1 with fiber vertices'
);

let minRadius = Number.POSITIVE_INFINITY;
let maxRadius = 0;
let minMyelin = Number.POSITIVE_INFINITY;
let maxMyelin = 0;

for (let i = 0; i < metadata.length; i += 4) {
  const radius = metadata[i + 0];
  const myelin = metadata[i + 2];
  assert.ok(radius > 0, `radius must be > 0 (got ${radius})`);
  assert.ok(myelin >= 0 && myelin <= 1, `myelin must be in [0,1] (got ${myelin})`);
  minRadius = Math.min(minRadius, radius);
  maxRadius = Math.max(maxRadius, radius);
  minMyelin = Math.min(minMyelin, myelin);
  maxMyelin = Math.max(maxMyelin, myelin);
}

assert.ok(maxRadius > minRadius * 1.5, 'fibers should have clear radius hierarchy');
assert.ok(maxMyelin > minMyelin + 0.2, 'fibers should have distinct myelin levels');

assert.ok(fiberVertexShader.includes('effectiveMyelin'), 'fiber vertex shader should use myelin in connectome shading');
assert.ok(fiberVertexShader.includes('conductionSpeed'), 'fiber vertex shader should vary pulse conduction speed');
assert.ok(fiberFragmentShader.includes('glowLuma'), 'fiber fragment shader should derive alpha from hierarchical fiber brightness');

console.log('test_shader passed');

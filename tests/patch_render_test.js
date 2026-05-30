import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rendererSource = readFileSync(new URL('../src/brain-renderer.js', import.meta.url), 'utf8');

assert.ok(
  rendererSource.includes('this.fiberMetaBuffer = this.createBuffer(geometry.getFiberDataWithMetadata()'),
  'renderer should upload fiber metadata to a dedicated GPU vertex buffer'
);
assert.ok(
  rendererSource.includes("primitive: { topology: 'triangle-list' }"),
  'fiber pipeline should render thickened ribbon geometry as triangles'
);
assert.ok(
  rendererSource.includes('renderPass.setVertexBuffer(1, this.fiberMetaBuffer);'),
  'fiber render pass should bind metadata buffer at slot 1'
);
assert.ok(
  rendererSource.includes('myelin_degradation'),
  'renderer params should expose myelin degradation control'
);

console.log('patch_render_test passed');

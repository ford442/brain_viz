// tests/test_camera_framing.js
// [Camera] The default view frames the whole brain. Projects the real generated
// mesh through the app's own Mat4 at the fit distance, for several aspects, and
// pins the old hard-coded 3.5 as the regression it was.

import assert from 'node:assert/strict';
import { BrainGeometry } from '../src/brain-geometry.js';
import { Mat4 } from '../src/math-utils.js';
import {
  BRAIN_BOUNDING_RADIUS, CAMERA_ZOOM_MAX, applyCameraFramingMethods, fitCameraDistance, framingRadius,
} from '../src/camera-framing.js';

const FOV = Math.PI / 4;

const geometry = new BrainGeometry();
geometry.generate(80, 50);
const verts = geometry.getVertexData();

// The constant must actually enclose the mesh (and not be wildly loose).
let maxR = 0;
for (let i = 0; i < verts.length; i += 3) maxR = Math.max(maxR, Math.hypot(verts[i], verts[i + 1], verts[i + 2]));
assert.ok(BRAIN_BOUNDING_RADIUS >= maxR, `bounding radius ${BRAIN_BOUNDING_RADIUS} < mesh ${maxR}`);
assert.ok(BRAIN_BOUNDING_RADIUS <= maxR * 1.05, `bounding radius ${BRAIN_BOUNDING_RADIUS} is loose vs ${maxR}`);

/** Largest |NDC| over every vertex, under every rotation the user can reach by dragging. */
function worstNdc(zoom, aspect) {
  const proj = Mat4.perspective(FOV, aspect, 0.1, 100);
  const view = Mat4.lookAt([0, 0, zoom], [0, 0, 0], [0, 1, 0]);
  const pv = Mat4.multiply(view, proj);
  let worst = 0;
  for (const rx of [0, 0.3, Math.PI / 2]) {
    for (const ry of [0, 1, 2, 3]) {
      const mvp = Mat4.multiply(Mat4.multiply(Mat4.rotateX(rx), Mat4.rotateY(ry)), pv);
      for (let i = 0; i < verts.length; i += 3) {
        const [x, y, z] = [verts[i], verts[i + 1], verts[i + 2]];
        const w = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
        const nx = (mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12]) / w;
        const ny = (mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13]) / w;
        worst = Math.max(worst, Math.abs(nx), Math.abs(ny));
      }
    }
  }
  return worst;
}

assert.ok(worstNdc(3.5, 16 / 9) > 1, 'regression: zoom 3.5 should crop the brain');
for (const aspect of [16 / 9, 4 / 3, 1, 3 / 4]) {
  const zoom = fitCameraDistance({ radius: BRAIN_BOUNDING_RADIUS, fov: FOV, aspect });
  const worst = worstNdc(zoom, aspect);
  assert.ok(worst < 1, `aspect ${aspect.toFixed(2)}: brain clipped at fit zoom ${zoom.toFixed(2)} (|ndc|=${worst.toFixed(3)})`);
  assert.ok(worst > 0.7, `aspect ${aspect.toFixed(2)}: brain too small at fit zoom (|ndc|=${worst.toFixed(3)})`);
}

// Narrower viewports need more distance; the result is clamped to the zoom range.
assert.ok(fitCameraDistance({ radius: 1.68, fov: FOV, aspect: 0.5 }) > fitCameraDistance({ radius: 1.68, fov: FOV, aspect: 2 }));
assert.equal(fitCameraDistance({ radius: 1.68, fov: FOV, aspect: 0.01 }), CAMERA_ZOOM_MAX);
// Two cortices are wider than one.
assert.ok(framingRadius({ style: 4 }) > framingRadius({ style: 0 }));

// Auto-framing follows resizes until something else writes targetZoom.
class Fake {
  constructor() {
    this.canvas = { width: 1600, height: 900 };
    this.params = {};
    this.targetFov = FOV;
    this.zoom = 3.5; this.targetZoom = 3.5;
    this.autoFrame = true; this.autoFrameZoom = NaN;
  }
}
applyCameraFramingMethods(Fake);
const r = new Fake();
r.syncAutoFrame();
const wide = r.targetZoom;
assert.equal(r.zoom, wide, 'first frame snaps, no glide from 3.5');
assert.ok(wide > 3.5);
r.canvas.width = 600; r.syncAutoFrame();
assert.ok(r.targetZoom > wide, 'narrower canvas reframes');
r.targetZoom = 2.5; r.syncAutoFrame();            // wheel / routine / XR
assert.equal(r.targetZoom, 2.5, 'external zoom hands control over');
r.canvas.width = 1600; r.syncAutoFrame();
assert.equal(r.targetZoom, 2.5, 'and stays handed over after a resize');
r.frameBrain();
assert.equal(r.targetZoom, wide, 'frameBrain() re-enters auto-framing');

console.log('test_camera_framing passed');

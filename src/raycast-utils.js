// [Neuro-Weaver] Desktop mouse raycast: screen pixel <-> brain-local coords.
//
// The desktop camera is a fixed lookAt([0,0,zoom], [0,0,0], [0,1,0]) — the
// *brain* rotates via model = Mat4.multiply(rotateX(rotation.x), rotateY(rotation.y))
// (see brain-renderer/uniforms.js updateUniforms()). Because the camera never
// rotates, a screen ray can be built directly in world space with no camera
// inverse, and because `model` is a pure rotation (orthonormal), its inverse
// is simply its transpose — no general 4x4 inversion needed.
//
// screenToBrainCoords() and brainToScreenCoords() are exact inverses of each
// other and both mirror the renderer's own MVP construction, so they stay
// correct if the camera/projection setup ever changes.
import { Mat4, raySphere } from './math-utils.js';

// Radius of the sphere used for hit-testing against the brain mesh. Mirrors
// webxr-manager.js's VR raycast (1.55 * model.scale, with scale=1 on desktop).
export const PAINT_HIT_RADIUS = 1.55;

// Coordinates painted into the tensor volume are clamped the same as
// injectStimulus()'s own BOUNDARY_LIMIT (defense in depth).
const BRAIN_COORD_LIMIT = 1.6;

function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return len === 0 ? [0, 0, 0] : [v[0] / len, v[1] / len, v[2] / len];
}

// Applies a column-major Float32Array(16) to a point/direction. `w` should be
// 1 for points (translation applies) and 0 for directions (translation is
// ignored) — all callers here use w=1 since every matrix involved is either
// translation-free (the model rotation) or expects a point (the full MVP).
function transformPoint(m, [x, y, z, w = 1]) {
    return [
        m[0] * x + m[4] * y + m[8] * z + m[12] * w,
        m[1] * x + m[5] * y + m[9] * z + m[13] * w,
        m[2] * x + m[6] * y + m[10] * z + m[14] * w,
        m[3] * x + m[7] * y + m[11] * z + m[15] * w,
    ];
}

// Matches the `model` construction in brain-renderer/uniforms.js exactly
// (camera shake is a render-only jitter, intentionally not reproduced here).
function getModelMatrix(renderer) {
    return Mat4.multiply(Mat4.rotateX(renderer.rotation.x), Mat4.rotateY(renderer.rotation.y));
}

/**
 * Raycasts from a screen pixel into brain-local coordinates, or returns null
 * if the ray misses the brain's hit-test sphere.
 * @param {*} renderer - BrainRenderer or BrainRendererWebGL (needs .zoom, .fov, .rotation.x/.y)
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX - mouse/pointer clientX
 * @param {number} clientY - mouse/pointer clientY
 * @returns {[number, number, number] | null}
 */
export function screenToBrainCoords(renderer, canvas, clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const aspect = canvas.width / canvas.height;
    const tanHalfFov = Math.tan(renderer.fov / 2);

    // Camera has no rotation, so view-space direction === world-space direction.
    const origin = [0, 0, renderer.zoom];
    const direction = normalize([ndcX * tanHalfFov * aspect, ndcY * tanHalfFov, -1]);

    const hit = raySphere(origin, direction, [0, 0, 0], PAINT_HIT_RADIUS);
    if (!hit) return null;

    // model maps brain-local -> world; it's a pure rotation, so transpose == inverse.
    const modelInverse = Mat4.transpose(getModelMatrix(renderer));
    const [lx, ly, lz] = transformPoint(modelInverse, [hit[0], hit[1], hit[2], 1]);

    return [
        Math.max(-BRAIN_COORD_LIMIT, Math.min(BRAIN_COORD_LIMIT, lx)),
        Math.max(-BRAIN_COORD_LIMIT, Math.min(BRAIN_COORD_LIMIT, ly)),
        Math.max(-BRAIN_COORD_LIMIT, Math.min(BRAIN_COORD_LIMIT, lz)),
    ];
}

/**
 * Projects a brain-local point into screen pixel coordinates, or returns
 * null if the point is behind the camera. Used for the paint brush cursor
 * preview — the exact inverse of screenToBrainCoords().
 * @param {*} renderer
 * @param {HTMLCanvasElement} canvas
 * @param {[number, number, number]} brainPos
 * @returns {[number, number] | null}
 */
export function brainToScreenCoords(renderer, canvas, brainPos) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const aspect = canvas.width / canvas.height;
    const projection = Mat4.perspective(renderer.fov, aspect, 0.1, 100.0);
    const view = Mat4.lookAt([0, 0, renderer.zoom], [0, 0, 0], [0, 1, 0]);
    const model = getModelMatrix(renderer);

    // Mirrors brain-renderer/uniforms.js exactly: pv = view*projection (math),
    // mvp = model*pv (math). Do not reorder (see CLAUDE.md).
    const pv = Mat4.multiply(view, projection);
    const mvp = Mat4.multiply(model, pv);

    const clip = transformPoint(mvp, [brainPos[0], brainPos[1], brainPos[2], 1]);
    if (clip[3] <= 0.0001) return null; // behind the camera

    const ndcX = clip[0] / clip[3];
    const ndcY = clip[1] / clip[3];
    return [
        rect.left + (ndcX * 0.5 + 0.5) * rect.width,
        rect.top + (1 - (ndcY * 0.5 + 0.5)) * rect.height,
    ];
}

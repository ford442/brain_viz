// @ts-check
// [Neuro-Weaver] Multi-Brain layout: where the two cortices sit in SynaptiX
// (style 4) and the five bridges drawn between them. One copy for both
// backends — the WebGPU uniforms/bridges and the WebGL draw/bridge buffers
// all used to retype these numbers. docs/synaptix.md → "Multi-Brain".
//
// Layout is a CPU-side model transform per avatar (no uniform-layout entry):
// each avatar's MVP/model matrix goes into its own copy of the render
// uniforms (avatarAUniformBuffer / partnerUniformBuffer on WebGPU).

import { Mat4 } from './math-utils.js';

/** Half the distance between the two cortex centres, in model units. */
export const MULTI_BRAIN_OFFSET_X = 1.05;
/** Uniform scale applied to each cortex so both fit the single-brain framing. */
export const MULTI_BRAIN_SCALE = 0.62;

/**
 * Bridge anchors in one cortex's local space, mirrored in X for the partner
 * so each bridge runs between the facing hemispheres of matching regions.
 * Keys match SYNAPTIX_REGIONS (src/synaptix-coupling.js).
 */
export const BRIDGE_ANCHORS = Object.freeze({
    frontal: [0.55, 0.2, 0.72],
    occipital: [0.55, 0.0, -0.72],
    parietal: [0.52, 0.68, 0.0],
    temporal: [0.66, -0.22, 0.05],
    deep: [0.42, 0.0, 0.0],
});
export const BRIDGE_SEGMENTS = 16;
/** Line-list vertices for all bridges (2 per segment). */
export const BRIDGE_MAX_VERTICES = Object.keys(BRIDGE_ANCHORS).length * BRIDGE_SEGMENTS * 2;

/**
 * Whether the renderer should draw two cortices this frame.
 * @param {{ style?: number, dualAvatarEnabled?: boolean }} params
 */
export function isMultiBrainActive(params) {
    return (params.style || 0) >= 4.0 && (params.dualAvatarEnabled ?? true);
}

/**
 * Local (pre-rotation) transforms for avatar A (left, the simulated/human
 * field) and the partner (right). Compose with the shared orbit:
 * `Mat4.multiply(local, model)` — column-major, see CLAUDE.md §1.
 */
export function avatarLocalMatrices() {
    return {
        avatarA: Mat4.composeTranslationScale(-MULTI_BRAIN_OFFSET_X, 0, 0, MULTI_BRAIN_SCALE),
        partner: Mat4.composeTranslationScale(MULTI_BRAIN_OFFSET_X, 0, 0, MULTI_BRAIN_SCALE),
    };
}

/**
 * Walk the bridge polylines for the current coupling state, calling `emit`
 * once per line-list vertex. Both backends pack the result into their own
 * vertex layout; the geometry and colour are defined only here.
 *
 * @param {any} state - renderer.synaptixCouplingState ({ regions, empathyPulse, divergenceStorm })
 * @param {number} now - performance.now()
 * @param {(position: number[], color: [number, number, number]) => void} emit
 * @returns {number} vertices emitted
 */
export function forEachBridgeVertex(state, now, emit) {
    const regions = state?.regions || {};
    const empathy = state?.empathyPulse;
    const storm = state?.divergenceStorm?.intensity || 0;
    let vertex = 0;
    for (const [name, anchor] of Object.entries(BRIDGE_ANCHORS)) {
        let coupling = Math.max(0, Math.min(1, regions[name] || 0));
        if (empathy?.region === name) {
            const phase = Math.max(0, Math.min(1, (now - empathy.startedAt) / (empathy.endsAt - empathy.startedAt)));
            coupling = Math.max(coupling, Math.sin(phase * Math.PI) * empathy.intensity);
        }
        const glow = Math.max(0.05, coupling * (1 - storm * 0.65));
        /** @type {[number, number, number]} */
        const color = [glow + storm * 0.35, glow * 0.82 + storm * 0.05, glow * 0.35 + storm * 0.65];
        const start = [-MULTI_BRAIN_OFFSET_X + anchor[0] * MULTI_BRAIN_SCALE, anchor[1] * MULTI_BRAIN_SCALE, anchor[2] * MULTI_BRAIN_SCALE];
        const end = [MULTI_BRAIN_OFFSET_X - anchor[0] * MULTI_BRAIN_SCALE, anchor[1] * MULTI_BRAIN_SCALE, anchor[2] * MULTI_BRAIN_SCALE];
        let previous = start;
        for (let segment = 1; segment <= BRIDGE_SEGMENTS; segment++) {
            const t = segment / BRIDGE_SEGMENTS;
            const lift = Math.sin(t * Math.PI) * (0.18 + coupling * 0.28);
            const jitter = storm * 0.08 * Math.sin(segment * 4.7 + now * 0.012 + vertex);
            const point = [
                start[0] + (end[0] - start[0]) * t,
                start[1] + lift + jitter,
                start[2] + (end[2] - start[2]) * t + jitter * 0.5,
            ];
            emit(previous, color);
            vertex++;
            emit(point, color);
            vertex++;
            previous = point;
        }
    }
    return vertex;
}

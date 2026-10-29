// @ts-check
// [Neuro-Weaver] Camera framing: the distance at which the whole brain fits the
// viewport. Shared by both renderer backends (a mixin, like pathway-renderer.js)
// so the default view cannot drift between them.
import { isMultiBrainActive, MULTI_BRAIN_OFFSET_X, MULTI_BRAIN_SCALE } from './multi-brain-layout.js';

/**
 * Radius of the sphere (about the origin) that encloses the generated cortex
 * mesh at default params, measured from BrainGeometry#generate(80, 50): the
 * farthest vertex is ~1.68 from the origin (baseRadius 1.5 plus the fold relief).
 */
export const BRAIN_BOUNDING_RADIUS = 1.68;

/** Breathing room around the bounding sphere (1.12 = 12% of the fit distance). */
export const FRAMING_MARGIN = 1.12;

/** Zoom clamp shared with setCameraParams() and the wheel handler. */
export const CAMERA_ZOOM_MIN = 2;
export const CAMERA_ZOOM_MAX = 10;

/**
 * Sentinel a camera preset or routine event can use for "whatever fits the
 * whole brain right now". Resolved with `renderer.getFitZoom()` by routine-camera.
 */
export const FIT_ZOOM = 'fit';

/**
 * Camera distance from the origin at which a sphere of `radius` fits entirely
 * inside the frustum. The sphere is tangent to the narrower of the vertical and
 * horizontal half-angles, so portrait viewports are limited by width.
 * @param {{radius: number, fov: number, aspect: number, margin?: number}} p
 */
export function fitCameraDistance({ radius, fov, aspect, margin = FRAMING_MARGIN }) {
    const halfV = fov / 2;
    const halfH = Math.atan(Math.tan(halfV) * Math.max(aspect, 1e-3));
    const dist = (radius * margin) / Math.sin(Math.min(halfV, halfH));
    return Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, dist));
}

/** Bounding-sphere radius of what is on screen (both cortices in SynaptiX multi-brain). */
export function framingRadius(params) {
    return isMultiBrainActive(params)
        ? MULTI_BRAIN_OFFSET_X + MULTI_BRAIN_SCALE * BRAIN_BOUNDING_RADIUS
        : BRAIN_BOUNDING_RADIUS;
}

/** @param {Function} Target BrainRenderer or BrainRendererWebGL */
export function applyCameraFramingMethods(Target) {
    /** Zoom that fits the whole brain at the current FOV and canvas aspect. */
    Target.prototype.getFitZoom = function() {
        const aspect = Math.max(1, this.canvas.width) / Math.max(1, this.canvas.height);
        return fitCameraDistance({ radius: framingRadius(this.params), fov: this.targetFov, aspect });
    };

    /** Frame the whole brain and keep it framed through resizes until something else moves the zoom. */
    Target.prototype.frameBrain = function() {
        this.autoFrame = true;
        this.autoFrameZoom = NaN;
        this.syncAutoFrame();
    };

    /**
     * Per-frame hook (called before the zoom is smoothed). While auto-framing,
     * track the fit distance as the canvas, FOV or layout change. Anything else
     * that writes `targetZoom` — wheel, routine, XR rig, reactivity router —
     * makes it differ from what we last wrote, and that hands control over.
     */
    Target.prototype.syncAutoFrame = function() {
        if (!this.autoFrame) return;
        if (this.autoFrameZoom !== undefined && !Number.isNaN(this.autoFrameZoom)
            && this.targetZoom !== this.autoFrameZoom) {
            this.autoFrame = false;
            return;
        }
        const fit = this.getFitZoom();
        const first = Number.isNaN(this.autoFrameZoom);
        this.targetZoom = fit;
        this.autoFrameZoom = fit;
        if (first) this.zoom = fit; // no zoom-in glide on the initial frame
    };
}

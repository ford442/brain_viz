// [Neuro-Weaver] Paint Energy: click-drag brush painting of activation
// energy onto the brain, replacing the old always-on naive screen-plane
// injector that used to live in main-routine-engine.js.
//
// Owns pointer handling, brush state, the raycast-driven paint stroke loop,
// the on-screen brush cursor preview, and full-tensor snapshot/restore (used
// by the `paint_snapshot` routine event for scripted replay).
import { screenToBrainCoords, brainToScreenCoords } from './raycast-utils.js';

const DEFAULT_BRUSH = { radius: 0.35, intensity: 0.8, decayHalfLife: 1.2 };

export class PaintController {
    /**
     * @param {*} renderer - BrainRenderer or BrainRendererWebGL
     * @param {HTMLCanvasElement} canvas
     * @param {*} player - RoutinePlayer (used for player.state.paintSnapshots)
     */
    constructor(renderer, canvas, player) {
        this.renderer = renderer;
        this.canvas = canvas;
        this.player = player;

        this.enabled = false;
        this.erase = false;
        this.brush = { ...DEFAULT_BRUSH };
        this.isPainting = false;
        this.lastHit = null;

        this._strokeFrameHandle = null;
        this._cursorFrameHandle = null;
        this._cursorEl = this._createCursorElement();

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        // Pointer Events cover mouse, touch, and pen with one listener set.
        // Always attached, no-op while !enabled, so enabling/disabling paint
        // mode never needs to add/remove listeners.
        canvas.addEventListener('pointerdown', this._onPointerDown);
        canvas.addEventListener('pointermove', this._onPointerMove);
        canvas.addEventListener('pointerup', this._onPointerUp);
        canvas.addEventListener('pointerleave', this._onPointerUp);
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.renderer.paintModeActive = true; // guards WebGL orbit-drag handlers
        this._startCursorLoop();
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.renderer.paintModeActive = false;
        this.isPainting = false;
        this._stopStroke();
        this._stopCursorLoop();
        this._cursorEl.hidden = true;
    }

    setBrush({ radius, intensity, decayHalfLife } = {}) {
        if (radius !== undefined && !Number.isNaN(radius)) this.brush.radius = Math.max(0.01, radius);
        if (intensity !== undefined && !Number.isNaN(intensity)) this.brush.intensity = Math.max(0.0, intensity);
        if (decayHalfLife !== undefined && !Number.isNaN(decayHalfLife)) this.brush.decayHalfLife = Math.max(0.01, decayHalfLife);
    }

    setEraseMode(erase) {
        this.erase = Boolean(erase);
    }

    // Documented as a full reset (not paint-scoped): painted energy shares
    // the same tensor field as region-stimulus buttons, TMS, and routines,
    // so there is no way to selectively undo only painted strokes.
    clearPaint() {
        this.renderer.resetActivity();
    }

    async snapshot(label) {
        const tensor = await this.renderer.getVoxelDataSnapshot();
        if (!this.player.state.paintSnapshots) this.player.state.paintSnapshots = [];
        const entry = { label: label ?? null, timestamp: performance.now(), tensor };
        this.player.state.paintSnapshots.push(entry);
        return entry;
    }

    async restoreSnapshot(indexOrLabel) {
        const list = this.player.state.paintSnapshots || [];
        let entry = null;
        if (typeof indexOrLabel === 'number') {
            entry = list[indexOrLabel] || null;
        } else {
            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].label === indexOrLabel) { entry = list[i]; break; }
            }
        }
        if (!entry) {
            console.warn(`[PaintController] No snapshot found for "${indexOrLabel}"`);
            return false;
        }
        this.renderer.setVoxelData(entry.tensor);
        return true;
    }

    _onPointerDown(e) {
        if (!this.enabled) return;
        this.isPainting = true;
        this.canvas.setPointerCapture?.(e.pointerId);
        this._updateHit(e);
        this._startStroke();
    }

    _onPointerMove(e) {
        if (!this.enabled) return;
        this._updateHit(e);
    }

    _onPointerUp() {
        this.isPainting = false;
        this._stopStroke();
    }

    _updateHit(e) {
        this.lastHit = screenToBrainCoords(this.renderer, this.canvas, e.clientX, e.clientY);
    }

    // Both renderers only consume stimulus.active once per render frame, so
    // a stroke must re-inject every frame while painting (unlike the old
    // prototype, which only injected every ~10px of mouse movement).
    _startStroke() {
        if (this._strokeFrameHandle) return;
        const tick = () => {
            if (!this.isPainting || !this.enabled) { this._strokeFrameHandle = null; return; }
            if (this.lastHit) {
                const [x, y, z] = this.lastHit;
                this.renderer.injectStimulus(
                    x, y, z, this.brush.intensity, 0.0,
                    this.brush.radius, this.erase, this.brush.decayHalfLife
                );
            }
            this._strokeFrameHandle = requestAnimationFrame(tick);
        };
        this._strokeFrameHandle = requestAnimationFrame(tick);
    }

    _stopStroke() {
        if (this._strokeFrameHandle) {
            cancelAnimationFrame(this._strokeFrameHandle);
            this._strokeFrameHandle = null;
        }
    }

    _createCursorElement() {
        const el = document.createElement('div');
        el.id = 'paint-brush-cursor';
        Object.assign(el.style, {
            position: 'fixed',
            left: '0px',
            top: '0px',
            pointerEvents: 'none',
            border: '2px solid rgba(0,229,229,0.9)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 8px rgba(0,229,229,0.55)',
            zIndex: '50',
        });
        el.hidden = true;
        document.body.appendChild(el);
        return el;
    }

    _startCursorLoop() {
        if (this._cursorFrameHandle) return;
        const tick = () => {
            if (!this.enabled) { this._cursorFrameHandle = null; return; }
            this._updateCursorVisual();
            this._cursorFrameHandle = requestAnimationFrame(tick);
        };
        this._cursorFrameHandle = requestAnimationFrame(tick);
    }

    _stopCursorLoop() {
        if (this._cursorFrameHandle) {
            cancelAnimationFrame(this._cursorFrameHandle);
            this._cursorFrameHandle = null;
        }
    }

    // True world-space-projected brush footprint: projects the raycast hit
    // and a radius-offset point through the renderer's actual MVP each
    // frame, so the on-screen circle tracks brush size as the brain
    // rotates/zooms (see raycast-utils.js brainToScreenCoords).
    _updateCursorVisual() {
        if (!this.lastHit) { this._cursorEl.hidden = true; return; }
        const center = brainToScreenCoords(this.renderer, this.canvas, this.lastHit);
        if (!center) { this._cursorEl.hidden = true; return; }
        const edge = brainToScreenCoords(this.renderer, this.canvas, [
            this.lastHit[0] + this.brush.radius, this.lastHit[1], this.lastHit[2]
        ]);
        const pixelRadius = edge ? Math.hypot(edge[0] - center[0], edge[1] - center[1]) : 20;

        this._cursorEl.hidden = false;
        this._cursorEl.style.left = `${center[0]}px`;
        this._cursorEl.style.top = `${center[1]}px`;
        this._cursorEl.style.width = `${pixelRadius * 2}px`;
        this._cursorEl.style.height = `${pixelRadius * 2}px`;
        this._cursorEl.style.borderColor = this.erase ? 'rgba(255,102,102,0.9)' : 'rgba(0,229,229,0.9)';
        this._cursorEl.style.boxShadow = this.erase
            ? '0 0 8px rgba(255,102,102,0.55)'
            : '0 0 8px rgba(0,229,229,0.55)';
    }

    destroy() {
        this.disable();
        this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this.canvas.removeEventListener('pointermove', this._onPointerMove);
        this.canvas.removeEventListener('pointerup', this._onPointerUp);
        this.canvas.removeEventListener('pointerleave', this._onPointerUp);
        this._cursorEl.remove();
    }
}

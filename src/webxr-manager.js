// [Neuro-Weaver] WebGL-first WebXR companion. WebGPU remains the authoritative
// desktop renderer until a broadly available WebGPU XR layer exists.
const LOBE_PRESETS = ['global', 'frontal', 'occipital', 'temporal', 'parietal', 'deep'];

const PRESET_CAMERA = {
    global: { rotation: { x: 0.3, y: 0 }, zoom: 3.5 },
    frontal: { rotation: { x: 0.1, y: 0 }, zoom: 3.0 },
    occipital: { rotation: { x: 0.2, y: Math.PI }, zoom: 3.0 },
    temporal: { rotation: { x: 0, y: -Math.PI / 2 }, zoom: 3.2 },
    parietal: { rotation: { x: 1.0, y: 0 }, zoom: 3.2 },
    deep: { rotation: { x: 0.3, y: 0.3 }, zoom: 2.0 },
};

function multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            out[column * 4 + row] =
                a[0 * 4 + row] * b[column * 4 + 0] +
                a[1 * 4 + row] * b[column * 4 + 1] +
                a[2 * 4 + row] * b[column * 4 + 2] +
                a[3 * 4 + row] * b[column * 4 + 3];
        }
    }
    return out;
}

function translation(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function scale(value) {
    return new Float32Array([value, 0, 0, 0, 0, value, 0, 0, 0, 0, value, 0, 0, 0, 0, 1]);
}

function rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function raySphere(origin, direction, center, radius) {
    const ox = origin[0] - center[0];
    const oy = origin[1] - center[1];
    const oz = origin[2] - center[2];
    const b = ox * direction[0] + oy * direction[1] + oz * direction[2];
    const c = ox * ox + oy * oy + oz * oz - radius * radius;
    const discriminant = b * b - c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const distance = -b - root > 0 ? -b - root : -b + root;
    if (distance <= 0) return null;
    return [
        origin[0] + direction[0] * distance,
        origin[1] + direction[1] * distance,
        origin[2] + direction[2] * distance,
    ];
}

export class WebXRManager {
    constructor(renderer, player = null) {
        this.renderer = renderer;
        this.player = player;
        this.session = null;
        this.referenceSpace = null;
        this.mode = null;
        this.isPresenting = false;
        this.support = { vr: false, ar: false };
        this.status = 'Checking XR support…';
        this.onStatus = null;
        this.frameCount = 0;
        this.presetIndex = 0;
        this.paintingSources = new Set();
        this.rig = { position: [0, 0, 3.5], pitch: 0.3, yaw: 0, preset: 'global' };
        this._rendererWasRunning = false;
        this._boundFrame = (time, frame) => this._onXRFrame(time, frame);
    }

    async checkSupport() {
        if (!navigator.xr) {
            this.status = 'WebXR is unavailable in this browser or context.';
            this._emitStatus();
            return this.support;
        }
        const [vr, ar] = await Promise.all([
            navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
            navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
        ]);
        this.support = { vr, ar };
        this.status = vr || ar ? 'XR device detected.' : 'No immersive XR session is available.';
        this._emitStatus();
        return this.support;
    }

    async enter(mode = 'immersive-vr') {
        if (this.isPresenting) return true;
        if (!navigator.xr) throw new Error('WebXR is unavailable.');
        if (this.renderer.backendType !== 'webgl' || !this.renderer.gl) {
            throw new Error('XR currently requires the WebGL2 renderer. Switch renderer and try again.');
        }

        const session = await navigator.xr.requestSession(mode, {
            optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        try {
            const gl = this.renderer.gl;
            await gl.makeXRCompatible?.();
            const layer = new XRWebGLLayer(session, gl, { alpha: mode === 'immersive-ar', antialias: true });
            session.updateRenderState({ baseLayer: layer, depthNear: 0.05, depthFar: 100 });
            this.referenceSpace = await session.requestReferenceSpace('local-floor')
                .catch(() => session.requestReferenceSpace('local'));
        } catch (error) {
            await session.end().catch(() => {});
            throw error;
        }
        this.session = session;
        this.renderer.xrSession = session;
        this.renderer.xrPresenting = true;
        this.mode = mode;
        this.isPresenting = true;
        this.frameCount = 0;
        this._rendererWasRunning = this.renderer.isRunning;
        this.renderer.stop();
        if (this.player?.isPlaying) {
            this.player.cancelScheduledTick();
            this.player.scheduleTick();
        }
        session.addEventListener('end', () => this._handleEnd());
        session.addEventListener('select', (event) => this.injectFromInput(event.inputSource, event.frame, 1.5));
        session.addEventListener('selectstart', (event) => this.paintingSources.add(event.inputSource));
        session.addEventListener('selectend', (event) => this.paintingSources.delete(event.inputSource));
        session.addEventListener('squeeze', () => this.teleportToNextPreset());
        this.status = mode === 'immersive-ar' ? 'AR tabletop session active.' : 'Immersive VR session active.';
        this._emitStatus();
        session.requestAnimationFrame(this._boundFrame);
        return true;
    }

    async end() {
        if (this.session) await this.session.end();
    }

    teleportToPreset(name) {
        const preset = PRESET_CAMERA[name];
        if (!preset) return false;
        this.presetIndex = Math.max(0, LOBE_PRESETS.indexOf(name));
        this.rig.preset = name;
        this.renderer.setCameraParams(preset);
        this.status = `XR viewpoint: ${name}`;
        this._emitStatus();
        return true;
    }

    teleportToNextPreset() {
        this.presetIndex = (this.presetIndex + 1) % LOBE_PRESETS.length;
        this.teleportToPreset(LOBE_PRESETS[this.presetIndex]);
    }

    injectFromInput(inputSource, frame, intensity = 1.0) {
        if (!inputSource?.targetRaySpace || !frame || !this.referenceSpace) return false;
        const pose = frame.getPose(inputSource.targetRaySpace, this.referenceSpace);
        if (!pose) return false;
        const matrix = pose.transform.matrix;
        const origin = [matrix[12], matrix[13], matrix[14]];
        const direction = [-matrix[8], -matrix[9], -matrix[10]];
        const model = this._getModelState();
        const hit = raySphere(origin, direction, model.center, 1.55 * model.scale);
        if (!hit) return false;
        const local = this._worldToBrain(hit, model);
        this.renderer.injectStimulus(local[0], local[1], local[2], intensity);
        return true;
    }

    _onXRFrame(timestamp, frame) {
        if (!this.session || !this.isPresenting) return;
        this.session.requestAnimationFrame(this._boundFrame);
        const pose = frame.getViewerPose(this.referenceSpace);
        if (!pose) return;
        const layer = this.session.renderState.baseLayer;
        const gl = this.renderer.gl;
        this.renderer.beginXRFrame(timestamp);
        this._updateRigState();
        this._updateInput(frame);
        const modelMatrix = this._getModelMatrix();

        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
        gl.clearColor(0.01, 0.02, 0.04, this.mode === 'immersive-ar' ? 0 : 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (const view of pose.views) {
            const viewport = layer.getViewport(view);
            const viewModel = multiply(view.transform.inverse.matrix, modelMatrix);
            const mvp = multiply(view.projectionMatrix, viewModel);
            this.renderer.drawXRView(mvp, viewport);
        }
        this.frameCount++;
    }

    _updateInput(frame) {
        for (const inputSource of this.session.inputSources || []) {
            const axes = inputSource.gamepad?.axes || [];
            const x = Math.abs(axes[2] || axes[0] || 0) > 0.15 ? (axes[2] || axes[0]) : 0;
            const y = Math.abs(axes[3] || axes[1] || 0) > 0.15 ? (axes[3] || axes[1]) : 0;
            if (x) this.renderer.targetRotation.y += x * 0.025;
            if (y) this.renderer.targetZoom = Math.max(1.4, Math.min(6, this.renderer.targetZoom + y * 0.025));
            if (this.paintingSources.has(inputSource)) this.injectFromInput(inputSource, frame, inputSource.hand ? 0.7 : 1.0);
        }
    }

    _updateRigState() {
        const pitch = this.renderer.rotation.x;
        const yaw = this.renderer.rotation.y;
        const distance = this.renderer.zoom;
        this.rig.pitch = pitch;
        this.rig.yaw = yaw;
        this.rig.position = [
            Math.sin(yaw) * Math.cos(pitch) * distance,
            Math.sin(pitch) * distance,
            Math.cos(yaw) * Math.cos(pitch) * distance,
        ];
    }

    _getModelState() {
        const isAR = this.mode === 'immersive-ar';
        return {
            center: isAR ? [0, 0.15, -0.65] : [0, 1.45, -Math.max(1.1, this.renderer.zoom * 0.62)],
            scale: isAR ? 0.18 : 0.72,
            pitch: this.renderer.rotation.x,
            yaw: this.renderer.rotation.y,
        };
    }

    _getModelMatrix() {
        const state = this._getModelState();
        let model = translation(...state.center);
        model = multiply(model, rotateY(state.yaw));
        model = multiply(model, rotateX(state.pitch));
        return multiply(model, scale(state.scale));
    }

    _worldToBrain(point, state) {
        let x = (point[0] - state.center[0]) / state.scale;
        let y = (point[1] - state.center[1]) / state.scale;
        let z = (point[2] - state.center[2]) / state.scale;
        const cy = Math.cos(state.yaw);
        const sy = Math.sin(state.yaw);
        [x, z] = [cy * x - sy * z, sy * x + cy * z];
        const cx = Math.cos(state.pitch);
        const sx = Math.sin(state.pitch);
        [y, z] = [cx * y + sx * z, -sx * y + cx * z];
        return [x, y, z];
    }

    _handleEnd() {
        const resumeRoutine = Boolean(this.player?.isPlaying);
        if (resumeRoutine) this.player.cancelScheduledTick();
        this.session = null;
        this.renderer.xrSession = null;
        this.renderer.xrPresenting = false;
        this.referenceSpace = null;
        this.isPresenting = false;
        this.paintingSources.clear();
        this.status = 'XR session ended.';
        this._emitStatus();
        if (this._rendererWasRunning && !this.renderer.isRunning) this.renderer.start();
        if (resumeRoutine) this.player.scheduleTick();
    }

    _emitStatus() {
        this.onStatus?.({ status: this.status, support: { ...this.support }, presenting: this.isPresenting, mode: this.mode });
    }
}

export { LOBE_PRESETS };

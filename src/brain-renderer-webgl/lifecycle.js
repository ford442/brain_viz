export function applyLifecycleMethods(Klass) {
    Object.assign(Klass.prototype, {
        beginXRFrame(timestamp) {
            if (this.geometryDirty && (!this.lastGeometryRebuildTime || timestamp - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
                this.buildAndUploadGeometry();
            }
            this.updateAltitudeState();
            this.time += 0.016;
            if (!this.tensorPlaybackMode) this.updateTensorSimulation();
            this.updateDynamicBuffers();
            this.updateCameraState();
        },

        drawXRView(mvp, viewport) {
            const gl = this.gl;
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
            this.drawScene(mvp);
        },

        render() {
            if (!this.isRunning) return;
            if (this.geometryDirty && (!this.lastGeometryRebuildTime || performance.now() - this.lastGeometryRebuildTime >= this.geometryRebuildIntervalMs)) {
                this.buildAndUploadGeometry();
            }

            this.resize();
            this.updateAltitudeState();
            this.time += 0.016;
            if (!this.tensorPlaybackMode) {
                this.updateTensorSimulation();
            }
            this.updateDynamicBuffers();
            const mvp = this.updateMatrices();

            const gl = this.gl;
            gl.clearColor(0.01, 0.02, 0.04, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            this.drawScene(mvp);

            this.frameHandle = requestAnimationFrame(() => this.render());
        },

        setVoxelData(float32Array) {
            if (!float32Array || float32Array.length !== this.voxelCount) {
                return;
            }
            this._lastHumanTensor.set(float32Array);
        },

        getVoxelDataSnapshot() {
            return new Float32Array(this._lastHumanTensor);
        },

        setPartnerTensorData(float32Array) {
            if (!float32Array || float32Array.length !== this.voxelCount) {
                return;
            }
            this._lastAITensor.set(float32Array);
            return true;
        },

        setAITensorData(float32Array) {
            return this.setPartnerTensorData(float32Array);
        },

        setSynaptiXCoupling(state) {
            this.synaptixCouplingState = state;
        },

        start() {
            this.isRunning = true;
            this.render();
        },

        stop() {
            this.isRunning = false;
            if (this.frameHandle) {
                cancelAnimationFrame(this.frameHandle);
                this.frameHandle = null;
            }
        },
    });
}

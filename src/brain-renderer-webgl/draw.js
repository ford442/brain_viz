import { Mat4 } from '../math-utils.js';

export function applyDrawMethods(Klass) {
    Object.assign(Klass.prototype, {
        updateCameraState() {
            this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
            this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
            this.zoom += (this.targetZoom - this.zoom) * 0.1;
            this.fov += (this.targetFov - this.fov) * 0.1;
            this.camera.zoom = this.zoom;
        },

        updateMatrices() {
            this.updateCameraState();
            const aspect = Math.max(1, this.canvas.width) / Math.max(1, this.canvas.height);
            const projection = Mat4.perspective(this.fov, aspect, 0.1, 100.0);
            const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);
            let shakeX = 0.0;
            let shakeY = 0.0;
            if (this.params.shake > 0.001) {
                shakeX = (Math.random() - 0.5) * this.params.shake;
                shakeY = (Math.random() - 0.5) * this.params.shake;
            }
            const model = Mat4.multiply(Mat4.rotateX(this.rotation.x + shakeX), Mat4.rotateY(this.rotation.y + shakeY));
            const pv = Mat4.multiply(view, projection);
            return Mat4.multiply(model, pv);
        },

        drawMesh(mvp, wireframe = false, vao = null) {
            const gl = this.gl;
            gl.useProgram(this.meshProgram);
            const uMvp = gl.getUniformLocation(this.meshProgram, 'uMvp');
            const uPointSize = gl.getUniformLocation(this.meshProgram, 'uPointSize');
            gl.uniformMatrix4fv(uMvp, false, mvp);
            gl.uniform1f(uPointSize, 1.0);
            gl.bindVertexArray(vao || (wireframe ? this.wireVao : this.meshVao));
            gl.drawElements(wireframe ? gl.LINES : gl.TRIANGLES, wireframe ? this.wireIndexCount : this.baseIndices.length, gl.UNSIGNED_INT, 0);
        },

        drawBridges(mvp) {
            if (!this.bridgeVertexCount) return;
            const gl = this.gl;
            gl.useProgram(this.meshProgram);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProgram, 'uMvp'), false, mvp);
            gl.uniform1f(gl.getUniformLocation(this.meshProgram, 'uPointSize'), 1.0);
            gl.bindVertexArray(this.bridgeVao);
            gl.drawArrays(gl.LINES, 0, this.bridgeVertexCount);
        },

        drawFibers(mvp) {
            const gl = this.gl;
            gl.useProgram(this.meshProgram);
            const uMvp = gl.getUniformLocation(this.meshProgram, 'uMvp');
            const uPointSize = gl.getUniformLocation(this.meshProgram, 'uPointSize');
            gl.uniformMatrix4fv(uMvp, false, mvp);
            gl.uniform1f(uPointSize, 1.0);
            gl.bindVertexArray(this.fiberVao);
            gl.lineWidth(1);
            gl.drawArrays(gl.LINES, 0, this.baseFiberVertices.length / 3);
        },

        drawPoints(mvp, vao, count) {
            const gl = this.gl;
            gl.useProgram(this.pointProgram);
            const uMvp = gl.getUniformLocation(this.pointProgram, 'uMvp');
            gl.uniformMatrix4fv(uMvp, false, mvp);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.POINTS, 0, count);
        },

        drawScene(mvp) {
            const isolate = this.debugOptions.isolate || 'all';
            const style = this.params.style || 0;
            const shouldDrawMesh = isolate === 'all' || isolate === 'mesh';
            const shouldDrawFibers = isolate === 'all' || isolate === 'fibers';
            const shouldDrawTensor = isolate === 'all' || isolate === 'tensor';

            if (style >= 4.0 && (this.params.dualAvatarEnabled ?? true)) {
                const avatarA = Mat4.multiply(Mat4.composeTranslationScale(-1.05, 0, 0, 0.62), mvp);
                const partner = Mat4.multiply(Mat4.composeTranslationScale(1.05, 0, 0, 0.62), mvp);
                const interiorCount = Math.floor((this.baseSomaInstances.length / 9) * 0.45);
                if (shouldDrawFibers) {
                    this.drawFibers(avatarA);
                    this.drawFibers(partner);
                    this.drawPoints(avatarA, this.somaVao, interiorCount);
                    this.drawPoints(partner, this.somaVao, interiorCount);
                }
                if (shouldDrawMesh) {
                    this.drawMesh(avatarA, false, this.meshVao);
                    this.drawMesh(partner, false, this.partnerMeshVao);
                }
                this.drawBridges(mvp);
                this.drawImmuneParticles(mvp);
                const single = this.baseIndices.length + this.baseFiberVertices.length / 3 + this.baseSomaInstances.length / 9;
                const dual = this.baseIndices.length * 2 + (this.baseFiberVertices.length / 3) * 2 + interiorCount * 2 + this.bridgeVertexCount;
                this.synaptixPerformance = { ...this.synaptixPerformance, singleWorkUnits: single, dualWorkUnits: dual, workRatio: dual / Math.max(1, single) };
                return;
            }
            if (shouldDrawTensor && (style >= 3.0 || this.debugOptions.tensorField)) {
                this.drawPoints(mvp, this.tensorVao, this.voxelCount);
            }
            if (shouldDrawFibers && (style >= 2.0 || style >= 4.0 || isolate === 'fibers')) {
                this.drawFibers(mvp);
                this.drawPoints(mvp, this.somaVao, this.baseSomaInstances.length / 9);
            }
            if (shouldDrawMesh && (style < 3.0 || style >= 4.0 || isolate === 'mesh')) {
                const wireframe = this.debugOptions.wireframe || style === 1.0;
                this.drawMesh(mvp, wireframe);
            }
            this.drawImmuneParticles(mvp);
        },

        drawImmuneParticles(mvp) {
            if (!this.immuneDrawCount) return;
            this.drawPoints(mvp, this.immuneVao, this.immuneDrawCount);
        },

        getSynaptiXPerformanceStats() {
            return { ...this.synaptixPerformance };
        },

        async benchmarkSynaptiX({ warmupFrames = 20, sampleFrames = 60 } = {}) {
            const measure = async (dual) => {
                this.setParams({ dualAvatarEnabled: dual, style: 4.0 });
                for (let i = 0; i < warmupFrames; i++) await new Promise(requestAnimationFrame);
                const samples = [];
                let previous = performance.now();
                for (let i = 0; i < sampleFrames; i++) {
                    await new Promise(requestAnimationFrame);
                    const now = performance.now();
                    samples.push(now - previous);
                    previous = now;
                }
                samples.sort((a, b) => a - b);
                return samples[Math.floor(samples.length / 2)] || 0;
            };
            const singleMedianMs = await measure(false);
            const dualMedianMs = await measure(true);
            const result = { singleMedianMs, dualMedianMs, frameTimeRatio: dualMedianMs / Math.max(0.001, singleMedianMs) };
            this.synaptixPerformance = { ...this.synaptixPerformance, ...result };
            return result;
        },
    });
}

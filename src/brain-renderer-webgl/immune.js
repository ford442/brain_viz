import { clamp01, mix } from '../webgl-gl-utils.js';
import { seedImmuneSurge, clearImmunePool, sampleImmuneParticle } from '../immune-particles.js';

export function applyImmuneMethods(Klass) {
    Object.assign(Klass.prototype, {
        spawnImmuneParticles(target, intensity = 1.0) {
            const site = (Array.isArray(target) && target.length >= 3 && !target.some(isNaN))
                ? target
                : (this.stimulus && this.stimulus.pos) || [0, 0, 0];
            this._immuneSurgeSeed = (this._immuneSurgeSeed || 0) + 97.3;
            const count = seedImmuneSurge(this.immunePool, site, intensity, this.time, this._immuneSurgeSeed);
            this.params.immuneActivity = clamp01(intensity);
            return count;
        },

        clearImmuneParticles() {
            clearImmunePool(this.immunePool);
            this.params.immuneActivity = 0.0;
            this.immuneDrawCount = 0;
        },

        updateImmuneParticles() {
            const activity = clamp01(this.params.immuneActivity || 0.0);
            if (activity <= 0.001 || this.immunePool.activeCount === 0) {
                this.immuneDrawCount = 0;
                return;
            }

            let written = 0;
            for (let i = 0; i < this.immunePool.activeCount; i++) {
                const p = sampleImmuneParticle(this.immunePool, i, this.time, activity);
                if (!p) continue;
                this.immunePositions[written * 3 + 0] = p.x;
                this.immunePositions[written * 3 + 1] = p.y;
                this.immunePositions[written * 3 + 2] = p.z;
                // Leukocyte green-white, flaring gold during the phagocytosis burst.
                // The point shader reuses .w as both point size and alpha, so the
                // fade is baked into RGB and .w carries the sprite size.
                const lum = p.alpha * (0.8 + p.burst * 1.6);
                this.immuneColorSize[written * 4 + 0] = mix(0.35, 1.0, p.burst) * lum;
                this.immuneColorSize[written * 4 + 1] = mix(1.0, 0.92, p.burst) * lum;
                this.immuneColorSize[written * 4 + 2] = mix(0.55, 0.6, p.burst) * lum;
                this.immuneColorSize[written * 4 + 3] = 3.0 * p.size;
                written++;
            }
            this.immuneDrawCount = written;
            if (written === 0) return;

            const gl = this.gl;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.immunePosition);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.immunePositions.subarray(0, written * 3));
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.immuneColorSize);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.immuneColorSize.subarray(0, written * 4));
        },
    });
}

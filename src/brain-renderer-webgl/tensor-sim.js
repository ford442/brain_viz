import { clamp01, mix, smoothstep } from '../webgl-gl-utils.js';
import { BRAIN_RANGE } from './constants.js';

export function applyTensorSimMethods(Klass) {
    Object.assign(Klass.prototype, {
        sampleField(worldPos, useAI = false) {
            const tensor = useAI ? this._lastAITensor : this._lastHumanTensor;
            const normalizedX = clamp01((worldPos[0] / BRAIN_RANGE) * 0.5 + 0.5);
            const normalizedY = clamp01((worldPos[1] / BRAIN_RANGE) * 0.5 + 0.5);
            const normalizedZ = clamp01((worldPos[2] / BRAIN_RANGE) * 0.5 + 0.5);
            const x = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedX * this.voxelDim)));
            const y = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedY * this.voxelDim)));
            const z = Math.min(this.voxelDim - 1, Math.max(0, Math.floor(normalizedZ * this.voxelDim)));
            return tensor[z * this.voxelDim * this.voxelDim + y * this.voxelDim + x];
        },

        computeResonance(humanVal, aiVal) {
            return 1.0 - smoothstep(0.0, this.params.resonanceThreshold || 0.2, Math.abs(humanVal - aiVal));
        },

        getFieldColor(humanVal, aiVal, position, style) {
            const resonance = this.computeResonance(humanVal, aiVal);
            const shift = this.params.colorShift || 0.0;
            if (style >= 4.0) {
                const humanColor = [
                    mix(0.05, 0.35, humanVal),
                    mix(0.65, 0.95, humanVal),
                    mix(0.95, 0.4, humanVal)
                ];
                const aiColor = [
                    mix(0.65, 1.0, aiVal),
                    mix(0.1, 0.25, aiVal),
                    mix(0.75, 1.0, aiVal)
                ];
                return [
                    mix(humanColor[0], aiColor[0], this.params.aiInfluence * 0.7) + resonance * 0.15,
                    mix(humanColor[1], aiColor[1], this.params.aiInfluence * 0.7) + resonance * 0.08,
                    mix(humanColor[2], aiColor[2], this.params.aiInfluence * 0.7) + resonance * 0.2
                ];
            }
            if (style >= 3.0) {
                return [
                    clamp01(humanVal * 1.6 + shift * 0.3),
                    clamp01(humanVal * 0.9 + 0.1),
                    clamp01(1.0 - humanVal * 0.75)
                ];
            }
            if (style >= 2.0) {
                return [
                    clamp01(0.1 + humanVal * 0.9 + shift * 0.3),
                    clamp01(0.55 + humanVal * 0.45),
                    clamp01(0.35 + humanVal * 0.6)
                ];
            }
            if (style >= 1.0) {
                return [
                    clamp01(0.08 + humanVal * 0.7 + Math.abs(position[1]) * 0.1),
                    clamp01(0.85 + humanVal * 0.15),
                    clamp01(0.92 + shift * 0.08)
                ];
            }
            return [
                clamp01(0.12 + humanVal * 0.15 + shift * 0.4),
                clamp01(0.38 + humanVal * 0.6),
                clamp01(0.52 + humanVal * 0.45)
            ];
        },

        updateTensorSimulation() {
            const dim = this.voxelDim;
            const current = this._lastHumanTensor;
            const next = this._nextHumanTensor;
            const amplitude = this.params.amplitude || 0;
            const smoothing = this.params.smoothing || 0;
            const coupling = this.params.fiberCoupling || 0;
            const style = this.params.style || 0;
            const time = this.time;
            const wave = Math.sin(time * (this.params.frequency || 1.0)) * 0.5 + 0.5;
            // [Paint Energy] Configurable brush radius; falls back to the legacy
            // fiber-coupling-derived radius for single-click/region callers.
            const stimulusRadius = (this.stimulus.radius && this.stimulus.radius > 0.0001)
                ? this.stimulus.radius
                : (0.22 + coupling * 0.16);

            for (let z = 0; z < dim; z++) {
                for (let y = 0; y < dim; y++) {
                    for (let x = 0; x < dim; x++) {
                        const idx = z * dim * dim + y * dim + x;
                        const xm = Math.max(0, x - 1);
                        const xp = Math.min(dim - 1, x + 1);
                        const ym = Math.max(0, y - 1);
                        const yp = Math.min(dim - 1, y + 1);
                        const zm = Math.max(0, z - 1);
                        const zp = Math.min(dim - 1, z + 1);
                        const avg = (
                            current[z * dim * dim + y * dim + xm] +
                            current[z * dim * dim + y * dim + xp] +
                            current[z * dim * dim + ym * dim + x] +
                            current[z * dim * dim + yp * dim + x] +
                            current[zm * dim * dim + y * dim + x] +
                            current[zp * dim * dim + y * dim + x]
                        ) / 6;

                        const worldX = ((x / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                        const worldY = ((y / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                        const worldZ = ((z / (dim - 1)) * 2.0 - 1.0) * BRAIN_RANGE;
                        let tractBias = 0.0;
                        let coverage = 0.0;
                        const affinityBase = idx * 12;
                        for (let slot = 0; slot < 3; slot++) {
                            const weight = this.fiberAffinityData[affinityBase + slot * 4 + 3];
                            if (weight <= 0.01) continue;
                            const dx = this.fiberAffinityData[affinityBase + slot * 4 + 0];
                            const dy = this.fiberAffinityData[affinityBase + slot * 4 + 1];
                            const dz = this.fiberAffinityData[affinityBase + slot * 4 + 2];
                            const step = BRAIN_RANGE / dim;
                            const ahead = this.sampleField([worldX + dx * step, worldY + dy * step, worldZ + dz * step]);
                            const behind = this.sampleField([worldX - dx * step, worldY - dy * step, worldZ - dz * step]);
                            tractBias += Math.max(ahead, behind) * weight;
                            coverage += weight;
                        }
                        if (coverage > 0) {
                            tractBias /= coverage;
                        }

                        const radial = Math.sqrt(worldX * worldX + worldY * worldY + worldZ * worldZ) / BRAIN_RANGE;
                        const corticalBias = 1.0 - smoothstep(0.1, 0.95, radial);
                        let nextVal = mix(current[idx], avg, 0.14 + smoothing * 0.22);
                        nextVal = mix(nextVal, tractBias, coupling * (0.15 + coverage * 0.45));
                        nextVal += (wave - 0.5) * amplitude * (0.02 + corticalBias * 0.04);
                        nextVal -= current[idx] * (0.015 + this.params.hypoxiaStress * 0.025 + this.params.heavyMetal * 0.012);

                        if (this.stimulus.active > 0.0) {
                            const dx = worldX - this.stimulus.pos[0];
                            const dy = worldY - this.stimulus.pos[1];
                            const dz = worldZ - this.stimulus.pos[2];
                            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                            const signal = Math.exp(-(dist * dist) / (stimulusRadius * stimulusRadius));
                            if (this.stimulus.erase) {
                                // [Paint Energy] Eraser mode: damp existing energy
                                // within the brush footprint instead of adding.
                                nextVal *= Math.max(0.0, 1.0 - this.stimulus.active * signal);
                            } else {
                                nextVal += signal * this.stimulus.active * 0.34;
                            }
                        }

                        if (this.stimulus.electricalActive > 0.0) {
                            nextVal += (Math.sin(time * 25.0 + worldX * 8.0 + worldY * 6.0) * 0.5 + 0.5) * this.stimulus.electricalActive * 0.06;
                        }
                        if (this.stimulus.mercuryActive > 0.0) {
                            nextVal *= Math.max(0.0, 1.0 - this.stimulus.mercuryActive * 0.03);
                        }
                        next[idx] = clamp01(nextVal);
                    }
                }
            }

            current.set(next);

            // [Paint Energy] Exponential half-life decay (set by injectStimulus()
            // when a caller passes decayHalfLife, e.g. the paint brush) takes
            // priority over the legacy immediate single-shot reset below.
            // lastDecayTime is re-stamped on every injectStimulus() call, so
            // active intensity only actually decays once injections stop.
            if (this.stimulus.active > 0.0 && this.stimulus.decayHalfLife > 0) {
                const now = performance.now();
                const dt = (now - this.stimulus.lastDecayTime) / 1000.0;
                this.stimulus.active *= Math.pow(0.5, dt / this.stimulus.decayHalfLife);
                this.stimulus.lastDecayTime = now;
                if (this.stimulus.active < 0.001) {
                    this.stimulus.active = 0.0;
                    this.stimulus.decayHalfLife = 0.0;
                }
            } else {
                this.stimulus.active = 0.0;
            }
            this.stimulus.electricalActive = 0.0;
            this.stimulus.mercuryActive = 0.0;
        },
    });
}

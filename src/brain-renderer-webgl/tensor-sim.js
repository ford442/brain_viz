// src/brain-renderer-webgl/tensor-sim.js
// [Tensor Physics] Field sampling and colouring for the WebGL2 fallback.
//
// The physics itself is NOT here any more. This file used to carry a third,
// hand-written neural field — a simplified wave/coupling/paint approximation
// that was never a port of the WGSL compute shader and drifted further from it
// with every new effect. It now drives the shared CPU reference stepper in
// src/physics/tensor-field.js, the same one the C++/WASM engine mirrors, so a
// change to the field lands on every CPU path at once. See
// docs/tensor-physics.md.
import { clamp01, mix, smoothstep } from '../webgl-gl-utils.js';
import { BRAIN_RANGE } from './constants.js';
import { normalizeFiberAffinities, resolveFieldParams, stepTensorField } from '../physics/tensor-field.js';

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

        /**
         * [Tensor Physics] Normalise the tract affinities once, when geometry
         * is (re)built, and hand the stepper the result. Doing it here rather
         * than per frame is both cheaper and what keeps this path's sample
         * coordinates identical to the C++ engine's — see spec §7.1.
         */
        prepareFiberAffinities() {
            this._normalizedFiberAffinity = this.fiberAffinityData
                ? normalizeFiberAffinities(this.fiberAffinityData, this.voxelDim)
                : null;
            return this._normalizedFiberAffinity;
        },

        /**
         * [Tensor Physics] Collect this renderer's live state into the shared
         * `TensorParams` shape. Names match COMPUTE_UNIFORM_LAYOUT, so a new
         * field the WebGPU path uploads reaches this path by being read here —
         * not by someone re-deriving an effect in a private loop.
         */
        collectFieldParams() {
            const p = this.params;
            return resolveFieldParams({
                voxelDim: this.voxelDim,
                time: this.time,
                frequency: p.frequency,
                amplitude: p.amplitude,
                spikeThreshold: p.spikeThreshold,
                style: p.style,
                fiberCoupling: p.fiberCoupling,
                hypoxiaStress: p.hypoxiaStress,
                metabolicRate: p.metabolicRate,
                mitochondrialFunction: p.mitochondrialFunction,
                fluidActive: p.fluidActive,
                cognitiveLoad: p.cognitiveLoad,
                stress: p.stress,
                heavyMetal: p.heavyMetal,
                resonanceThreshold: p.resonanceThreshold,
                // SynaptiX stays visual-only on this path, matching the WebGPU
                // renderer's uniform upload (see brain-renderer/uniforms.js).
                synaptiXActive: 0.0,
                aiInfluence: 0.0,
                electricalActive: this.stimulus.electricalActive,
                mercuryActive: this.stimulus.mercuryActive,
                stimulusPosX: this.stimulus.pos[0],
                stimulusPosY: this.stimulus.pos[1],
                stimulusPosZ: this.stimulus.pos[2],
                stimulusActive: this.stimulus.active,
                stimulusRadius: this.stimulus.radius,
                stimulusErase: this.stimulus.erase ? 1.0 : 0.0,
            });
        },

        updateTensorSimulation() {
            const affinity = this._normalizedFiberAffinity
                ?? (this.fiberAffinityData ? this.prepareFiberAffinities() : null);

            stepTensorField(this._lastHumanTensor, this._nextHumanTensor, {
                params: this.collectFieldParams(),
                fiberAffinity: affinity,
                frame: this._tensorFrame | 0,
            });
            this._lastHumanTensor.set(this._nextHumanTensor);
            this._tensorFrame = (this._tensorFrame | 0) + 1;

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

import { clamp01 } from '../webgl-gl-utils.js';

export function applyStateMethods(Klass) {
    Object.assign(Klass.prototype, {
        setParams(newParams) {
            if (newParams.aiInfluence !== undefined && newParams.partnerInfluence === undefined) {
                newParams = { ...newParams, partnerInfluence: newParams.aiInfluence };
            }
            if (newParams.partnerInfluence !== undefined) {
                newParams = { ...newParams, aiInfluence: newParams.partnerInfluence };
            }
            const geometryKeys = ['foldScale', 'foldStrength', 'fissureDepth', 'lobeFoldBias', 'corticalThickness', 'growth', 'fiberSymmetry', 'bundleCoherence'];
            const geometryChanged = geometryKeys.some((key) => newParams[key] !== undefined && newParams[key] !== this.params[key]);
            this.params = { ...this.params, ...newParams };
            if (geometryChanged) {
                this.geometryDirty = true;
            }
        },

        setSynaptiXParams(newParams) {
            this.setParams(newParams);
        },

        setDebugOptions(newOptions) {
            this.debugOptions = { ...this.debugOptions, ...newOptions };
        },

        getDebugOptions() {
            return { ...this.debugOptions };
        },

        updateAltitudeState() {
            const alt = this.params.altitude || 0.0;
            const altFraction = Math.min(1.0, alt / 8000);
            this.params.oxygenLevel = Math.max(0.35, 1.0 - (altFraction * 0.65));
            let stressCurve = 0.0;
            if (altFraction > 0.5) {
                stressCurve = 1.0 / (1.0 + Math.exp(-10 * (altFraction - 0.5)));
            }
            if (alt > this._altitudeInternal.lastAltitude) {
                this._altitudeInternal.activationTime += 1;
            } else if (alt < this._altitudeInternal.lastAltitude) {
                this._altitudeInternal.activationTime = Math.max(0, this._altitudeInternal.activationTime - 2);
            }
            this.params.hypoxiaStress = clamp01(stressCurve * (0.65 + this._altitudeInternal.activationTime / 600.0));
            this.params.metabolicRate = 1.0 + (this.params.hypoxiaStress * 1.0);
            if (this.params.hypoxiaStress > 0.5) {
                const sustainedPenalty = Math.max(0.3, 1.0 - (this._altitudeInternal.activationTime / 1800.0));
                this.params.mitochondrialFunction = Math.max(0.35, sustainedPenalty);
            } else {
                this.params.mitochondrialFunction = 1.0 - this.params.hypoxiaStress * 0.4;
            }
            this._altitudeInternal.lastAltitude = alt;
        },

        // `duration` is accepted (and ignored, same as before) purely as a
        // positional placeholder so radius/erase/decayHalfLife land in the same
        // argument slots as the WebGPU renderer's injectStimulus() — callers
        // like PaintController invoke both renderers uniformly.
        injectStimulus(targetX, targetY, targetZ, intensity, duration = 0.0, radius = null, erase = false, decayHalfLife = 0.0) {
            const BOUNDARY_LIMIT = 1.45;
            if ([targetX, targetY, targetZ, intensity].some((val) => isNaN(val))) {
                return;
            }
            this.stimulus.pos = [
                Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetX)),
                Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetY)),
                Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetZ))
            ];
            this.stimulus.active = Math.max(0.0, intensity);
            // [Paint Energy]
            this.stimulus.radius = (radius === null || isNaN(radius)) ? 0.0 : Math.max(0.0, radius);
            this.stimulus.erase = Boolean(erase);
            if (decayHalfLife > 0) {
                this.stimulus.decayHalfLife = decayHalfLife;
                this.stimulus.lastDecayTime = performance.now();
            } else {
                this.stimulus.decayHalfLife = 0.0;
            }
        },

        injectElectrical(intensity) {
            if (isNaN(intensity)) return;
            this.stimulus.electricalActive = Math.max(0.0, intensity);
        },

        injectMercury(intensity) {
            if (isNaN(intensity)) return;
            this.stimulus.mercuryActive = Math.max(0.0, intensity);
        },

        triggerLesion(center, radius) {
            this.params.lesionCenterX = center[0];
            this.params.lesionCenterY = center[1];
            this.params.lesionCenterZ = center[2];
            this.params.lesionRadius = Math.max(0, radius);
        },

        calmState() {
            this.params.frequency = 2.0;
            this.params.amplitude = 0.5;
            this.params.smoothing = 0.9;
            this.params.colorShift = 0.0;
            this.params.sparkle = 0.0;
            this.params.pointCloudDensity = 1.0;
            this.params.fiberCoupling = 0.5;
            this.params.shake = 0.0;
            this.params.stress = 0.0;
            this.params.cortisol = 0.0;
            this.params.heavyMetal = 0.0;
            this.params.cognitiveLoad = 0.0;
            this.params.fluidActive = 0.0;
            this.params.immuneActivity = 0.0;
            this.clearImmuneParticles();
            this.params.fogDensity = 0.0;
            this.params.aberration = 0.0;
            this.params.grain = 0.0;
            this.params.focus = 0.5;
            this.params.aperture = 0.0;
            this.params.ambientLight = 0.2;
            this.params.dirIntensity = 0.8;
            this.params.lightDirX = 1.0;
            this.params.lightDirY = 1.0;
            this.params.lightDirZ = 1.0;
        },

        resetActivity() {
            this._lastHumanTensor.fill(0);
            this._lastAITensor.fill(0);
        },

        async enableWasmMode() {
            console.warn('[BrainRendererWebGL] WASM compute mode is unavailable in the WebGL fallback.');
            return false;
        },

        disableWasmMode() {
            this.wasmMode = false;
        },

        runWasmBenchmark() {
            return null;
        },
    });
}

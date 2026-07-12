export function applyStimulusMethods(Target) {
    Target.prototype.updateAltitudeState = function() {
        const alt = this.params.altitude;

        // Barometric formula: O2 = 0.21 * (1 - altitude/44330)^5.255
        // Simplified linear approximation: 1.0 at 0m → 0.35 at 8000m
        // [Scientific Fix] Changed from 0.3 to 0.35 to match actual barometric calculation
        // At 8000m, atmospheric pressure is ~35% of sea level (35600/101325 Pa)
        const altFraction = Math.min(1.0, alt / 8000);
        this.params.oxygenLevel = Math.max(0.35, 1.0 - (altFraction * 0.65));

        // Hypoxia stress: sigmoid curve, peak response at 4000-5000m
        let stressCurve;
        if (altFraction > 0.5) {
    stressCurve = 1.0 / (1.0 + Math.exp(-10 * (altFraction - 0.5)));
        } else {
    stressCurve = altFraction * 0.2;
        }
        this.params.hypoxiaStress = stressCurve;

        // Metabolic rate: hypoxia increases ATP demand
        this.params.metabolicRate = 1.0 + (this.params.hypoxiaStress * 1.0);

        // Mitochondrial function: declines with sustained hypoxia
        if (this.params.hypoxiaStress > 0.5) {
    this._altitudeInternal.activationTime += this.isRunning ? 1.0 : 0.0;
    const sustainedPenalty = Math.max(0.3, 1.0 - (this._altitudeInternal.activationTime / 1800.0)); // 30 min = 1800 frames @ 60fps
    this.params.mitochondrialFunction = sustainedPenalty;
        } else {
    this._altitudeInternal.activationTime = 0;
    this.params.mitochondrialFunction = 1.0;
        }

        this._altitudeInternal.lastAltitude = alt;
    };

    Target.prototype.triggerLesion = function(center, radius) {
        this.params.lesionCenterX = center[0];
        this.params.lesionCenterY = center[1];
        this.params.lesionCenterZ = center[2];
        this.params.lesionRadius = radius;
    };

    Target.prototype.triggerTMS = function(center, strength = 1.2, radius = 0.28, durationMs = 650) {
        this.tms = {
    center: center,
    strength: strength,
    radius: radius,
    duration: durationMs,
    startTime: performance.now()
        };
        this.params.tmsCenterX = center[0];
        this.params.tmsCenterY = center[1];
        this.params.tmsCenterZ = center[2];
        this.params.tmsActive = strength;
        this.params.tmsRadius = radius;
    };

    Target.prototype.injectStimulus = function(targetX, targetY, targetZ, intensity, duration = 0.0) {
        // [Neuro-Weaver] Validation: Prevent injection of invalid values
        if ([targetX, targetY, targetZ, intensity, duration].some(val => isNaN(val))) {
     console.warn("Neuro-Weaver: Invalid stimulus parameters ignored");
     return;
        }

        // Update state for Compute Shader uniforms
        // [Neuro-Weaver] V2.7: Clamp coordinates to brain range (Refactored)
        const BOUNDARY_LIMIT = 1.6;
        this.stimulus.pos = [
    Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetX)),
    Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetY)),
    Math.max(-BOUNDARY_LIMIT, Math.min(BOUNDARY_LIMIT, targetZ))
        ];
        // Ensure intensity is non-negative
        this.stimulus.active = Math.max(0.0, intensity);
        if (duration > 0) {
    this.stimulus.decayRate = intensity / duration;
    this.stimulus.lastTime = performance.now();
        } else {
    this.stimulus.decayRate = 0.0;
        }

        // [Phase 1 WASM] Forward stimulus to the C++ engine when in WASM mode
        if (this.wasmMode && this.wasmEngine.available) {
    this.wasmEngine.injectStimulus(
        this.stimulus.pos[0],
        this.stimulus.pos[1],
        this.stimulus.pos[2],
        this.stimulus.active,
        this.params.mitochondrialFunction ?? 1.0
    );
        }

        console.log(`[Neuro-Weaver] Stimulus Injected: Pos(${targetX.toFixed(2)}, ${targetY.toFixed(2)}, ${targetZ.toFixed(2)}) Intensity(${intensity.toFixed(2)})`);
    };

    Target.prototype.injectElectrical = function(intensity, duration) {
        if (isNaN(intensity)) return;
        this.stimulus.electricalActive = Math.max(0.0, intensity);
        console.log(`[Neuro-Weaver] Electrical Stimulus Injected: Intensity(${intensity.toFixed(2)})`);
    };

    Target.prototype.injectMercury = function(intensity, duration) {
        if (isNaN(intensity)) return;
        this.stimulus.mercuryActive = Math.max(0.0, intensity);
        console.log(`[Neuro-Weaver] Mercury Stimulus Injected: Intensity(${intensity.toFixed(2)})`);
    };

    Target.prototype.calmState = function() {
        // Clear all activity by resetting parameters to a "Calm" state.
        // Setting amplitude low prevents new chaotic waves.
        // Setting smoothing high (0.98) causes existing activity to decay very slowly,
        // creating a "settling down" effect rather than an abrupt cutoff.
        this.params.amplitude = 0.1;
        this.params.frequency = 0.5;
        this.params.smoothing = 0.98;
        this.params.colorShift = 0.0;
        this.params.sparkle = 0.0;
        this.params.aberration = 0.0;
        this.params.grain = 0.0;
        this.params.aperture = 0.0;
        this.params.stress = 0.0;
        this.params.cortisol = 0.0;

        this.tms = null;
        this.params.cognitiveLoad = 0.0;
    };

    Target.prototype.resetActivity = function() {
        // Instantly clear the volumetric tensor data
        const emptyData = new Float32Array(this.voxelCount);
        this._lastHumanTensor.fill(0);
        this.device.queue.writeBuffer(this.tensorBuffer, 0, emptyData);
        // Also reset WASM engine buffer so both paths stay in sync
        if (this.wasmEngine.available) this.wasmEngine.reset();
    };

    Target.prototype.enableWasmMode = async function() {
        const ok = await this.wasmEngine.init();
        if (ok) {
    this.wasmMode = true;
    console.log('[BrainRenderer] WASM simulation mode ENABLED');
        } else {
    console.warn('[BrainRenderer] WASM unavailable — staying on WebGPU compute');
        }
        return ok;
    };

    Target.prototype.disableWasmMode = function() {
        this.wasmMode = false;
        console.log('[BrainRenderer] WASM simulation mode DISABLED — using WebGPU compute');
    };

    Target.prototype.runWasmBenchmark = function(steps = 100) {
        if (!this.wasmEngine.available) {
    console.warn('[BrainRenderer] WASM not initialised — call enableWasmMode() first');
    return null;
        }
        return this.wasmEngine.benchmark(steps);
    };

}

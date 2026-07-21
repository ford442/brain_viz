export function applyDeformationMethods(Target) {
    Target.prototype.applyBrainDeformation = function(x, y, z) {
        const sample = this.sampleCorticalSurface(x, y, z, true);
        const radius = sample.radius;
        return { x: x * radius, y: y * radius, z: z * radius };
    };

    Target.prototype.isInsideBrain = function(x, y, z) {
        const len = Math.sqrt(x*x + y*y + z*z);
        if (len === 0) return true;
        const nx = x / len;
        const ny = y / len;
        const nz = z / len;
        const sample = this.sampleCorticalSurface(nx, ny, nz, false);
        const safeRadius = sample.radius * 0.93;
        return len < safeRadius;
    };

    Target.prototype.sampleCorticalSurface = function(x, y, z, includeFine = true) {
        const hemisphere = x >= 0.0 ? 1.0 : -1.0;
        const absX = Math.abs(x);
        const absY = Math.abs(y);
        const opts = this.options;
        const growth = Math.max(0.65, opts.growth || 1.0);

        const frontal = this.saturate((z - 0.08) * 1.8 + 0.1 * y);
        const occipital = this.saturate((-z - 0.18) * 2.0 + 0.05 * y);
        const temporal = this.saturate((absX - 0.32) * 2.4 + (-y - 0.05) * 0.6);
        const parietal = this.saturate((y + 0.02) * 1.8) * this.saturate(1.1 - absX * 1.1);

        const bias = opts.lobeFoldBias;
        const macroField =
    frontal * this.orientedFoldField(x, y, z, 2.5, [0.9, 0.15, 1.25], 0.45, 0.22, 11.0) * (1.2 * bias) +
    occipital * this.orientedFoldField(x, y, z, 2.0, [0.25, 0.85, 1.6], 0.18, 0.08, 31.0) * 0.7 +
    temporal * this.temporalFoldField(x, y, z) * (0.95 * bias) +
    parietal * this.orientedFoldField(x, y, z, 2.3, [1.15, 1.0, 0.35], 0.26, 0.2, 53.0) * (0.9 * bias);

        const microField = includeFine
    ? this.fbm3(
        x * 7.5 * opts.foldScale + hemisphere * 0.9,
        y * 7.5 * opts.foldScale - 0.3,
        z * 7.5 * opts.foldScale + 0.6,
        3,
        2.05,
        0.5
    ) * 0.35
    : 0.0;

        const asymmetry =
    this.fbm3(x * 1.7 + hemisphere * 0.7, y * 1.8 - 0.2, z * 1.6 + 0.4, 2, 2.0, 0.5) * 0.06 +
    hemisphere * 0.03 * frontal -
    hemisphere * 0.025 * occipital;

        const dorsalLift = 0.06 * (1.0 - absX * 0.35) * (y > 0 ? y * y : 0.0);
        const cerebellarTaper = -0.08 * this.saturate(-y - 0.25) * (0.4 + this.saturate(-z + 0.1));
        const anteriorBulge = 0.05 * frontal * (0.7 + 0.3 * (1.0 - absX));

        const fissureNoise = this.fbm3(y * 3.0 + 4.2, z * 4.2 - 1.3, hemisphere * 0.7, 2, 2.0, 0.5);
        const fissureMask = Math.exp(-Math.pow(absX * (6.5 + opts.foldScale), 2.0));
        const bridgeMask = this.saturate((-y - 0.05) * 2.4) * this.saturate(1.0 - Math.abs(z) * 1.4);
        const fissureDepth = opts.fissureDepth * (1.0 + fissureNoise * 0.22) * (1.0 - bridgeMask * 0.62);
        const fissureIndent = -fissureMask * fissureDepth * 0.18;

        const foldSignal = macroField + microField + asymmetry;
        const ridge = Math.max(0.0, foldSignal);
        const sulcus = Math.max(0.0, -foldSignal);

        const outward = ridge * opts.foldStrength * 0.55 * growth;
        const inward = sulcus * (opts.foldStrength + opts.corticalThickness * 0.6) * 0.4 * growth;

        const radius =
    opts.baseRadius *
    (
        1.0 +
        dorsalLift +
        cerebellarTaper +
        anteriorBulge +
        fissureIndent +
        outward -
        inward
    );

        return {
    radius: Math.max(opts.baseRadius * 0.68, radius),
    foldSignal
        };
    };

    Target.prototype.temporalFoldField = function(x, y, z) {
        const hemisphereCenter = x >= 0.0 ? 0.72 : -0.72;
        const dx = x - hemisphereCenter;
        const dy = y + 0.08;
        const dz = z * 0.85;
        const radial = Math.sqrt(dx * dx * 1.25 + dy * dy * 0.9 + dz * dz * 1.5);
        const ring = Math.sin((radial * 12.0 + z * 4.0) * this.options.foldScale);
        const drift = this.fbm3(x * 4.0 + 2.0, y * 3.7 - 1.3, z * 4.3 + 0.4, 2, 2.1, 0.5);
        return ring * 0.55 + drift * 0.35;
    };

    Target.prototype.orientedFoldField = function(x, y, z, scale, axisWeights, phase, warp, seedOffset) {
        const sx = x * scale * axisWeights[0];
        const sy = y * scale * axisWeights[1];
        const sz = z * scale * axisWeights[2];
        const warpField = this.fbm3(sx + seedOffset, sy - seedOffset * 0.2, sz + 0.7, 2, 2.0, 0.5);
        const stripe = Math.sin((sx + sy * 0.6 + sz * 0.35 + warpField * warp + phase) * Math.PI * this.options.foldScale);
        const volume = this.fbm3(sx + 0.3, sy + 0.7, sz - 0.5, 3, 2.0, 0.5);
        return stripe * 0.6 + volume * 0.4;
    };

}

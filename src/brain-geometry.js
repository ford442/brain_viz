// brain-geometry.js
// Procedural Brain Generation with Organic Connectome Fibers - V3.1 Dense Points
// [Neuro-Weaver] Generates deformed sphere mesh, anatomically-guided fiber pathways,
// and dense hierarchical soma / bouton / varicosity point clouds.

export class BrainGeometry {
    constructor(options = {}) {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.fiberNormals = [];
        this.fiberMetadata = [];
        this.fiberPaths = [];
        // [V3.1] Rich instance data for instanced mesh somas
        // Layout per instance: [x, y, z, baseScale, typeId, bundleId, phase, shapeSeed]
        this.somaInstances = [];
        // [V3.1] Dense point-cloud billboards (boutons, varicosities, AI quanta)
        // Layout per instance: [x, y, z, baseScale, typeId, bundleId, phase, pad]
        this.pointCloudInstances = [];
        this.sparkSources = [];
        this.fiberCenterlines = [];
        this.seed = options.seed ?? 1337;
        this.randomState = this.seed >>> 0;
        this.options = {
            baseRadius: 1.5,
            foldScale: 1.0,
            foldStrength: 0.16,
            fissureDepth: 0.52,
            lobeFoldBias: 1.0,
            corticalThickness: 0.11,
            growth: 1.0,
            ...options
        };
    }

    generate(rows, cols) {
        this.randomState = this.seed >>> 0;
        // Clear previous data
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.fiberNormals = [];
        this.somaInstances = [];
        this.pointCloudInstances = [];
        this.sparkSources = [];
        this.fiberMetadata = [];
        this.fiberPaths = [];
        this.fiberCenterlines = [];

        // 1. Generate deformed sphere (Brain Mesh)
        for (let r = 0; r <= rows; r++) {
            const v = r / rows;
            const phi = v * Math.PI;

            for (let c = 0; c <= cols; c++) {
                const u = c / cols;
                const theta = u * Math.PI * 2;

                // Standard Sphere
                let x = Math.sin(phi) * Math.cos(theta);
                let y = Math.cos(phi);
                let z = Math.sin(phi) * Math.sin(theta);

                const p = this.applyBrainDeformation(x, y, z);

                this.vertices.push(p.x, p.y, p.z);

                // Normals (Approximation: from center)
                const len = Math.sqrt(p.x*p.x + p.y*p.y + p.z*p.z);
                this.normals.push(p.x/len, p.y/len, p.z/len);
            }
        }

        // Indices
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const first = r * (cols + 1) + c;
                const second = first + cols + 1;

                this.indices.push(first, second, first + 1);
                this.indices.push(second, second + 1, first + 1);
            }
        }

        // 2. Generate Organic Connectome Fibers
        this.generateOrganicConnectomeFibers();

        // 3. Generate AI Fiber Pathways
        this.generateAIFiberPathways();

        // 4. Generate U-fibers (shallow association fibers)
        this.generateUFibers();

        // 5. Generate cortical mantle micro-node cloud for dense connectome rendering
        this.generateCorticalMantleCloud();

        // 6. Build per-voxel fiber affinity map from actual bundles
        this.buildFiberAffinityMap();
    }

    applyBrainDeformation(x, y, z) {
        const sample = this.sampleCorticalSurface(x, y, z, true);
        const radius = sample.radius;
        return { x: x * radius, y: y * radius, z: z * radius };
    }

    isInsideBrain(x, y, z) {
        const len = Math.sqrt(x*x + y*y + z*z);
        if (len === 0) return true;
        const nx = x / len;
        const ny = y / len;
        const nz = z / len;
        const sample = this.sampleCorticalSurface(nx, ny, nz, false);
        const safeRadius = sample.radius * 0.93;
        return len < safeRadius;
    }

    sampleCorticalSurface(x, y, z, includeFine = true) {
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
    }

    temporalFoldField(x, y, z) {
        const hemisphereCenter = x >= 0.0 ? 0.72 : -0.72;
        const dx = x - hemisphereCenter;
        const dy = y + 0.08;
        const dz = z * 0.85;
        const radial = Math.sqrt(dx * dx * 1.25 + dy * dy * 0.9 + dz * dz * 1.5);
        const ring = Math.sin((radial * 12.0 + z * 4.0) * this.options.foldScale);
        const drift = this.fbm3(x * 4.0 + 2.0, y * 3.7 - 1.3, z * 4.3 + 0.4, 2, 2.1, 0.5);
        return ring * 0.55 + drift * 0.35;
    }

    orientedFoldField(x, y, z, scale, axisWeights, phase, warp, seedOffset) {
        const sx = x * scale * axisWeights[0];
        const sy = y * scale * axisWeights[1];
        const sz = z * scale * axisWeights[2];
        const warpField = this.fbm3(sx + seedOffset, sy - seedOffset * 0.2, sz + 0.7, 2, 2.0, 0.5);
        const stripe = Math.sin((sx + sy * 0.6 + sz * 0.35 + warpField * warp + phase) * Math.PI * this.options.foldScale);
        const volume = this.fbm3(sx + 0.3, sy + 0.7, sz - 0.5, 3, 2.0, 0.5);
        return stripe * 0.6 + volume * 0.4;
    }

    saturate(v) {
        return Math.max(0.0, Math.min(1.0, v));
    }

    random() {
        this.randomState = (1664525 * this.randomState + 1013904223) >>> 0;
        return this.randomState / 4294967296;
    }

    hash3(ix, iy, iz) {
        let h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + this.seed * 1447) | 0;
        h = (h ^ (h >> 13)) * 1274126177;
        h ^= h >> 16;
        return ((h >>> 0) / 4294967295) * 2.0 - 1.0;
    }

    smoothNoise3(x, y, z) {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fy = y - iy;
        const fz = z - iz;
        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uy = fy * fy * (3.0 - 2.0 * fy);
        const uz = fz * fz * (3.0 - 2.0 * fz);

        const n000 = this.hash3(ix, iy, iz);
        const n100 = this.hash3(ix + 1, iy, iz);
        const n010 = this.hash3(ix, iy + 1, iz);
        const n110 = this.hash3(ix + 1, iy + 1, iz);
        const n001 = this.hash3(ix, iy, iz + 1);
        const n101 = this.hash3(ix + 1, iy, iz + 1);
        const n011 = this.hash3(ix, iy + 1, iz + 1);
        const n111 = this.hash3(ix + 1, iy + 1, iz + 1);

        const nx00 = n000 + (n100 - n000) * ux;
        const nx10 = n010 + (n110 - n010) * ux;
        const nx01 = n001 + (n101 - n001) * ux;
        const nx11 = n011 + (n111 - n011) * ux;
        const nxy0 = nx00 + (nx10 - nx00) * uy;
        const nxy1 = nx01 + (nx11 - nx01) * uy;
        return nxy0 + (nxy1 - nxy0) * uz;
    }

    fbm3(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
        let amplitude = 0.5;
        let frequency = 1.0;
        let sum = 0.0;
        let norm = 0.0;
        for (let i = 0; i < octaves; i++) {
            sum += this.smoothNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
            norm += amplitude;
            frequency *= lacunarity;
            amplitude *= gain;
        }
        return norm > 0.0 ? sum / norm : 0.0;
    }

    generateCircuitGrid() {
        const step = 0.15;
        const range = 1.5;
        for (let x = -range; x <= range; x += step) {
            for (let y = -range; y <= range; y += step) {
                for (let z = -range; z <= range; z += step) {
                    if (!this.isInsideBrain(x, y, z)) continue;
                    this.somaInstances.push(x, y, z, 0.03, 1.0, 0.0, 0.0, 0.0);
                    this.addSparkSource([x, y, z], [x, y, z], 0.2, 0.0, 0.0, 0.0, 0.0);
                    if (this.isInsideBrain(x + step, y, z)) {
                        if (this.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x + step, y, z);
                            this.fiberMetadata.push(0.05, 0.0, 0.5, 0.0, 0.05, 0.0, 0.5, 0.0);
                            this.fiberPaths.push(x, y, z, x + step, y, z);
                            this.fiberPaths.push(x, y, z, x + step, y, z);
                            this.addSparkSource([x + step * 0.5, y, z], [1.0, 0.0, 0.0], 0.28, 0.0, 0.0, 0.0, 1.0);
                        }
                    }
                    if (this.isInsideBrain(x, y + step, z)) {
                        if (this.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x, y + step, z);
                            this.fiberMetadata.push(0.05, 1.0, 0.5, 0.0, 0.05, 1.0, 0.5, 0.0);
                            this.fiberPaths.push(x, y, z, x, y + step, z);
                            this.fiberPaths.push(x, y, z, x, y + step, z);
                            this.addSparkSource([x, y + step * 0.5, z], [0.0, 1.0, 0.0], 0.28, 0.0, 1.0, 0.0, 1.0);
                        }
                    }
                    if (this.isInsideBrain(x, y, z + step)) {
                        if (this.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x, y, z + step);
                            this.fiberMetadata.push(0.05, 2.0, 0.5, 0.0, 0.05, 2.0, 0.5, 0.0);
                            this.fiberPaths.push(x, y, z, x, y, z + step);
                            this.fiberPaths.push(x, y, z, x, y, z + step);
                            this.addSparkSource([x, y, z + step * 0.5], [0.0, 0.0, 1.0], 0.28, 0.0, 2.0, 0.0, 1.0);
                        }
                    }
                }
            }
        }
    }

    randomPointInBrain() {
        for (let attempt = 0; attempt < 50; attempt++) {
            const x = (this.random() - 0.5) * 2.8;
            const y = (this.random() - 0.5) * 2.8;
            const z = (this.random() - 0.5) * 2.8;
            if (this.isInsideBrain(x, y, z)) return [x, y, z];
        }
        return [0.0, 0.0, 0.0];
    }

    // [V3.1] Cortical bias: 1.0 near surface, decaying into depth
    getCorticalBias(x, y, z) {
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len === 0) return 1.0;
        const sample = this.sampleCorticalSurface(x / len, y / len, z / len, true);
        const distToSurf = sample.radius - len;
        return Math.max(0.05, Math.min(1.0, Math.exp(-distToSurf * 3.5)));
    }

    addSomaInstance(x, y, z, scale, typeId, bundleId, phase, shapeSeed) {
        // 9 floats padded to 36 bytes to match shader stride
        this.somaInstances.push(x, y, z, scale, typeId, bundleId, phase, shapeSeed, 0.0);
    }

    addPointCloudInstance(x, y, z, scale, typeId, bundleId, phase) {
        this.pointCloudInstances.push(x, y, z, scale, typeId, bundleId, phase, 0.0);
    }

    randomUnitVector(bias = null, biasStrength = 0.0) {
        const z = this.random() * 2.0 - 1.0;
        const theta = this.random() * Math.PI * 2.0;
        const r = Math.sqrt(Math.max(0.0, 1.0 - z * z));
        let x = r * Math.cos(theta);
        let y = z;
        let zz = r * Math.sin(theta);

        if (bias && biasStrength > 0.0) {
            x += bias[0] * biasStrength;
            y += bias[1] * biasStrength;
            zz += bias[2] * biasStrength;
        }

        const len = Math.sqrt(x * x + y * y + zz * zz) || 1.0;
        return [x / len, y / len, zz / len];
    }

    addPointCluster(center, count, spread, scaleMin, scaleMax, typeId, bundleId, bias = null, anisotropy = [1.0, 1.0, 1.0]) {
        for (let i = 0; i < count; i++) {
            const dir = this.randomUnitVector(bias, bias ? 0.6 : 0.0);
            const radius = spread * (0.15 + Math.pow(this.random(), 1.8) * 0.85);
            const x = center[0] + dir[0] * radius * anisotropy[0];
            const y = center[1] + dir[1] * radius * anisotropy[1];
            const z = center[2] + dir[2] * radius * anisotropy[2];
            if (!this.isInsideBrain(x, y, z)) continue;
            const scale = scaleMin + (scaleMax - scaleMin) * this.random();
            this.addPointCloudInstance(x, y, z, scale, typeId, bundleId, this.random() * Math.PI * 2.0);
        }
    }

    generateCorticalMantleCloud() {
        const mantleSamples = 3200;
        const sparseCoreSamples = 320;
        const corticalBundles = 8;

        for (let i = 0; i < mantleSamples; i++) {
            const dir = this.randomUnitVector();
            const surface = this.sampleCorticalSurface(dir[0], dir[1], dir[2], true);
            const depth = 0.015 + Math.pow(this.random(), 2.5) * 0.22;
            const tangentA = this.randomUnitVector([dir[1], -dir[0], dir[2] * 0.2], 0.45);
            const tangentB = this.randomUnitVector([-dir[2], dir[0] * 0.3, dir[1]], 0.35);
            const lateralJitter = (this.random() - 0.5) * 0.05;
            const verticalJitter = (this.random() - 0.5) * 0.035;
            const radius = surface.radius - depth;
            const x = dir[0] * radius + tangentA[0] * lateralJitter + tangentB[0] * verticalJitter;
            const y = dir[1] * radius + tangentA[1] * lateralJitter + tangentB[1] * verticalJitter;
            const z = dir[2] * radius + tangentA[2] * lateralJitter + tangentB[2] * verticalJitter;
            if (!this.isInsideBrain(x, y, z)) continue;

            const corticalBias = this.getCorticalBias(x, y, z);
            const bundleId = Math.floor(this.random() * corticalBundles);
            const typeId = corticalBias > 0.82 ? 5 : 3;
            const scale = (0.003 + this.random() * 0.006) * (0.8 + corticalBias * 0.9);
            this.addPointCloudInstance(x, y, z, scale, typeId, bundleId, this.random() * Math.PI * 2.0);

            if (this.random() < 0.06 * corticalBias) {
                this.addSomaInstance(
                    x,
                    y,
                    z,
                    0.008 + corticalBias * 0.008 + this.random() * 0.004,
                    this.random() < 0.35 ? 1 : 2,
                    bundleId,
                    this.random() * Math.PI * 2.0,
                    this.random()
                );
            }

            if (this.random() < 0.04) {
                this.addPointCluster([x, y, z], 5 + Math.floor(corticalBias * 6), 0.03 + corticalBias * 0.025, 0.0025, 0.006, 5, bundleId, dir, [1.0, 0.7, 1.0]);
            }
        }

        for (let i = 0; i < sparseCoreSamples; i++) {
            const p = this.randomPointInBrain();
            const corticalBias = this.getCorticalBias(p[0], p[1], p[2]);
            if (corticalBias > 0.45) continue;
            this.addPointCloudInstance(
                p[0],
                p[1],
                p[2],
                0.003 + this.random() * 0.004,
                4,
                20 + (i % 6),
                this.random() * Math.PI * 2.0
            );
            if (this.random() < 0.08) {
                this.addSomaInstance(p[0], p[1], p[2], 0.008 + this.random() * 0.004, 2, 20 + (i % 6), this.random() * Math.PI * 2.0, this.random());
            }
        }
    }

    generateAIFiberPathways() {
        const NUM_AI_FIBERS = 180;
        const BUNDLE_ID_AI = 100;
        for (let i = 0; i < NUM_AI_FIBERS; i++) {
            const start = this.randomPointInBrain();
            const end = this.randomPointInBrain();
            const segments = 10;
            let prev = start;
            const pts = [start];
            for (let s = 1; s <= segments; s++) {
                const t = s / segments;
                const bx = start[0] + (end[0] - start[0]) * t;
                const by = start[1] + (end[1] - start[1]) * t;
                const bz = start[2] + (end[2] - start[2]) * t;
                const jitter = 0.06;
                const jx = Math.sin(t * 48.0 + i * 3.71) * jitter;
                const jy = Math.cos(t * 37.0 + i * 2.13) * jitter;
                const jz = Math.sin(t * 55.0 + i * 5.47) * jitter;
                const curr = [bx + jx, by + jy, bz + jz];
                pts.push(curr);
                if (s > 1) {
                    this.addFiberTubeSegment(prev, curr, 0.010, 0.008, BUNDLE_ID_AI, 0.08, t, false);
                    // AI mesh nodes every 3rd segment
                    if (s % 3 === 0) {
                        const mid = [(prev[0]+curr[0])*0.5, (prev[1]+curr[1])*0.5, (prev[2]+curr[2])*0.5];
                        this.addSomaInstance(mid[0], mid[1], mid[2], 0.014, 2, BUNDLE_ID_AI, this.random()*6.28, this.random());
                        const tangent = [curr[0]-prev[0], curr[1]-prev[1], curr[2]-prev[2]];
                        this.addSparkSource(mid, tangent, 0.55, t, BUNDLE_ID_AI, 0.08, 3.0);
                    }
                    // Dense AI point cloud along every segment
                    const pJitter = 0.025;
                    for (let k = 0; k < 3; k++) {
                        const bt = this.random();
                        const px = prev[0] + (curr[0]-prev[0])*bt + (this.random()-0.5)*pJitter;
                        const py = prev[1] + (curr[1]-prev[1])*bt + (this.random()-0.5)*pJitter;
                        const pz = prev[2] + (curr[2]-prev[2])*bt + (this.random()-0.5)*pJitter;
                        if (this.isInsideBrain(px, py, pz)) {
                            this.addPointCloudInstance(px, py, pz, 0.007, 3, BUNDLE_ID_AI, this.random()*6.28);
                        }
                    }
                }
                prev = curr;
            }
            this.fiberCenterlines.push({ pts, bundleId: BUNDLE_ID_AI, myelin: 0.08 });
            // Terminal AI node
            this.addSomaInstance(end[0], end[1], end[2], 0.018, 0, BUNDLE_ID_AI, 0.0, this.random());
            const endTangent = [end[0]-start[0], end[1]-start[1], end[2]-start[2]];
            this.addSparkSource(end, endTangent, 0.7, 0.0, BUNDLE_ID_AI, 0.08, 3.0);
        }
        this.generateHumanVesicleSparks();
        this.generateFusionHotspotSparks();
    }

    generateHumanVesicleSparks() {
        const BUNDLES = [
            { s:[-0.9,  0.2,  0.55], c:[ 0.0,  0.85,  0.4], e:[ 0.9,  0.2,  0.55], r:0.07, m:0.9, id:0, n:8 },
            { s:[-0.85, 0.2, -0.45], c:[ 0.0,  0.65, -0.6], e:[ 0.85, 0.2, -0.45], r:0.065, m:0.9, id:0, n:6 },
            { s:[-0.35, 0.85,  0.3], c:[-0.4,  0.05,  0.45], e:[-0.1, -0.85,  0.1], r:0.06, m:0.88, id:1, n:6 },
            { s:[ 0.35, 0.85,  0.3], c:[ 0.4,  0.05,  0.45], e:[ 0.1, -0.85,  0.1], r:0.06, m:0.88, id:1, n:6 },
            { s:[-0.2,  0.05, -0.85], c:[-0.65, -0.3, -0.45], e:[-0.8, -0.05,  0.15], r:0.05, m:0.82, id:2, n:5 },
            { s:[ 0.2,  0.05, -0.85], c:[ 0.65, -0.3, -0.45], e:[ 0.8, -0.05,  0.15], r:0.05, m:0.82, id:2, n:5 },
        ];
        for (const bun of BUNDLES) {
            for (let s = 0; s < bun.n; s++) {
                const jit = bun.r * 0.7;
                const rnd = () => (this.random() - 0.5) * 2;
                const pS = [bun.s[0]+rnd()*jit, bun.s[1]+rnd()*jit, bun.s[2]+rnd()*jit];
                const pC = [bun.c[0]+rnd()*jit*0.4, bun.c[1]+rnd()*jit*0.4, bun.c[2]+rnd()*jit*0.4];
                const pE = [bun.e[0]+rnd()*jit, bun.e[1]+rnd()*jit, bun.e[2]+rnd()*jit];
                const pts = this.generateSplinePath(pS, pC, pE, 12);
                for (let i = 1; i < pts.length - 2; i += 3) {
                    const mid = pts[i];
                    if (this.isInsideBrain(mid[0], mid[1], mid[2])) {
                        const tangent = [pts[i+1][0]-pts[i-1][0], pts[i+1][1]-pts[i-1][1], pts[i+1][2]-pts[i-1][2]];
                        this.addSparkSource(mid, tangent, 0.4, i/pts.length, bun.id, bun.m, 2.0);
                    }
                }
            }
        }
    }

    generateFusionHotspotSparks() {
        for (let i = 0; i < 40; i++) {
            const pt = this.randomPointInBrain();
            const theta = this.random() * Math.PI * 2;
            const phi = this.random() * Math.PI;
            const tangent = [
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            ];
            this.addSparkSource(pt, tangent, 0.85, this.random(), 200 + i, 0.5, 4.0);
        }
    }

    generateOrganicConnectomeFibers() {
        const BUNDLES = [
            { s:[-0.9,  0.2,  0.55], c:[ 0.0,  0.85,  0.4], e:[ 0.9,  0.2,  0.55], r:0.07, m:0.9, id:0, n:28, b:6 },
            { s:[-0.85, 0.2, -0.45], c:[ 0.0,  0.65, -0.6], e:[ 0.85, 0.2, -0.45], r:0.065, m:0.9, id:0, n:24, b:5 },
            { s:[-0.35, 0.85,  0.3], c:[-0.4,  0.05,  0.45], e:[-0.1, -0.85,  0.1], r:0.06, m:0.88, id:1, n:22, b:4 },
            { s:[ 0.35, 0.85,  0.3], c:[ 0.4,  0.05,  0.45], e:[ 0.1, -0.85,  0.1], r:0.06, m:0.88, id:1, n:22, b:4 },
            { s:[-0.2,  0.05, -0.85], c:[-0.65, -0.3, -0.45], e:[-0.8, -0.05,  0.15], r:0.05, m:0.82, id:2, n:20, b:5 },
            { s:[ 0.2,  0.05, -0.85], c:[ 0.65, -0.3, -0.45], e:[ 0.8, -0.05,  0.15], r:0.05, m:0.82, id:2, n:20, b:5 },
            { s:[-0.8,  0.45,  0.5], c:[-1.0,  0.3, -0.05], e:[-0.8,  0.1, -0.65], r:0.055, m:0.78, id:3, n:20, b:3 },
            { s:[ 0.8,  0.45,  0.5], c:[ 1.0,  0.3, -0.05], e:[ 0.8,  0.1, -0.65], r:0.055, m:0.78, id:3, n:20, b:3 },
            { s:[-0.6,  0.35,  0.5], c:[-0.3,  0.7,  0.2], e:[-0.85, -0.2,  0.05], r:0.05, m:0.76, id:4, n:18, b:3 },
            { s:[ 0.6,  0.35,  0.5], c:[ 0.3,  0.7,  0.2], e:[ 0.85, -0.2,  0.05], r:0.05, m:0.76, id:4, n:18, b:3 },
            { s:[-0.1,  0.6,  0.5], c:[-0.15, 0.6,  0.0], e:[-0.1,  0.3, -0.6], r:0.045, m:0.74, id:5, n:16, b:2 },
            { s:[ 0.1,  0.6,  0.5], c:[ 0.15, 0.6,  0.0], e:[ 0.1,  0.3, -0.6], r:0.045, m:0.74, id:5, n:16, b:2 },
            { s:[-0.75, 0.2,  0.6], c:[-0.8, -0.1,  0.0], e:[-0.65, -0.1, -0.75], r:0.05, m:0.75, id:6, n:18, b:3 },
            { s:[ 0.75, 0.2,  0.6], c:[ 0.8, -0.1,  0.0], e:[ 0.65, -0.1, -0.75], r:0.05, m:0.75, id:6, n:18, b:3 },
            { s:[-0.65, -0.3,  0.35], c:[-0.5,  0.1,  0.65], e:[-0.55, 0.4,  0.65], r:0.045, m:0.72, id:7, n:16, b:3 },
            { s:[ 0.65, -0.3,  0.35], c:[ 0.5,  0.1,  0.65], e:[ 0.55, 0.4,  0.65], r:0.045, m:0.72, id:7, n:16, b:3 },
        ];

        for (const bun of BUNDLES) {
            // Bundle-level hub at control point
            const hubJitter = bun.r * 0.25;
            const hubPos = [
                bun.c[0] + (this.random()-0.5)*hubJitter,
                bun.c[1] + (this.random()-0.5)*hubJitter,
                bun.c[2] + (this.random()-0.5)*hubJitter
            ];
            if (this.isInsideBrain(hubPos[0], hubPos[1], hubPos[2])) {
                this.addSomaInstance(hubPos[0], hubPos[1], hubPos[2], bun.r * 0.55, 0, bun.id, this.random()*6.28, this.random());
                this.addSparkSource(hubPos, [hubPos[0], hubPos[1], hubPos[2]], 0.55, 0.0, bun.id, bun.m, 0.0);
                this.addPointCluster(hubPos, 18, bun.r * 0.8, bun.r * 0.08, bun.r * 0.18, 5, bun.id, hubPos, [1.0, 0.7, 1.0]);
            }

            for (let s = 0; s < bun.n; s++) {
                const jit = bun.r * 0.7;
                const rnd = () => (this.random() - 0.5) * 2;
                const pS = [bun.s[0]+rnd()*jit, bun.s[1]+rnd()*jit, bun.s[2]+rnd()*jit];
                const pC = [bun.c[0]+rnd()*jit*0.4, bun.c[1]+rnd()*jit*0.4, bun.c[2]+rnd()*jit*0.4];
                const pE = [bun.e[0]+rnd()*jit, bun.e[1]+rnd()*jit, bun.e[2]+rnd()*jit];
                const pts = this.generateSplinePath(pS, pC, pE, 12);
                this.fiberCenterlines.push({ pts, bundleId: bun.id, myelin: bun.m });

                for (let i = 0; i < pts.length - 1; i++) {
                    const [x1, y1, z1] = pts[i];
                    const [x2, y2, z2] = pts[i + 1];
                    if (!this.isInsideBrain(x1, y1, z1) && !this.isInsideBrain(x2, y2, z2)) continue;
                    const t = i / (pts.length - 1);
                    const radius = bun.r * (1.0 - t * 0.3);
                    const nextT = (i + 1) / (pts.length - 1);
                    const nextRadius = bun.r * (1.0 - nextT * 0.3);
                    this.addFiberTubeSegment([x1, y1, z1], [x2, y2, z2], radius, nextRadius, bun.id, bun.m, t, false);

                    // Midpoint spark
                    if (i % 2 === 0) {
                        const midPoint = [(x1+x2)*0.5, (y1+y2)*0.5, (z1+z2)*0.5];
                        const tangent = [x2-x1, y2-y1, z2-z1];
                        this.addSparkSource(midPoint, tangent, 0.38 + bun.m * 0.3, t, bun.id, bun.m, 1.0);
                    }

                    // [V3.1] Dense boutons along fiber, denser near cortical surface
                    const corticalBias = this.getCorticalBias((x1+x2)*0.5, (y1+y2)*0.5, (z1+z2)*0.5);
                    const nBoutons = 2 + Math.floor(5 * corticalBias) + (t > 0.65 ? 2 : 0);
                    for (let b = 0; b < nBoutons; b++) {
                        const bt = this.random();
                        const bx = x1 + (x2-x1)*bt + (this.random()-0.5)*radius*0.5;
                        const by = y1 + (y2-y1)*bt + (this.random()-0.5)*radius*0.5;
                        const bz = z1 + (z2-z1)*bt + (this.random()-0.5)*radius*0.5;
                        if (this.isInsideBrain(bx, by, bz)) {
                            const beadType = b === 0 && t > 0.7 ? 5 : 3;
                            this.addPointCloudInstance(bx, by, bz, radius * (0.22 + corticalBias * 0.22), beadType, bun.id, this.random()*6.28);
                        }
                    }

                    const varicosityCount = 1 + Math.floor(corticalBias * 2.0) + (t > 0.75 ? 1 : 0);
                    for (let v = 0; v < varicosityCount; v++) {
                        const vt = 0.18 + this.random() * 0.64;
                        const vx = x1 + (x2 - x1) * vt;
                        const vy = y1 + (y2 - y1) * vt;
                        const vz = z1 + (z2 - z1) * vt;
                        if (this.isInsideBrain(vx, vy, vz)) {
                            this.addPointCloudInstance(vx, vy, vz, radius * (0.26 + 0.12 * this.random()), 4, bun.id, this.random() * 6.28);
                        }
                    }

                    // Medium mesh soma every 3 segments
                    if (i % 2 === 0 && i > 0 && i < pts.length - 2 && corticalBias > 0.28) {
                        const mp = [(x1+x2)*0.5, (y1+y2)*0.5, (z1+z2)*0.5];
                        this.addSomaInstance(mp[0], mp[1], mp[2], bun.r * 0.22 * (1.0 - t*0.3), 1, bun.id, this.random()*6.28, this.random());
                    }
                }

                // Start / mid / end mesh somas for each sub-fiber
                const mid = pts[Math.floor(pts.length / 2)];
                [pts[0], mid, pts[pts.length - 1]].forEach((pt, idx) => {
                    if (this.isInsideBrain(pt[0], pt[1], pt[2])) {
                        const sc = bun.r * (idx === 0 ? 0.35 : (idx === 1 ? 0.25 : 0.18));
                        const type = idx === 0 ? 0 : (idx === 1 ? 1 : 2);
                        this.addSomaInstance(pt[0], pt[1], pt[2], sc, type, bun.id, this.random()*6.28, this.random());
                        if (idx === 0) {
                            this.addSparkSource(pt, [pt[0], pt[1], pt[2]], 0.45 + bun.m * 0.35, 0.15, bun.id, bun.m, 0.0);
                        }
                    }
                });

                // Terminal arbor with cortical-bias density
                this.addTerminalBranches(pts[pts.length - 1], bun.b, bun.r * 0.5, bun.id, 1.0);
                this.addPointCluster(pts[pts.length - 1], 8 + Math.floor(bun.b * 2.5), bun.r * 0.85, bun.r * 0.08, bun.r * 0.22, 5, bun.id, pts[pts.length - 1], [1.0, 0.75, 1.0]);
            }
        }
    }

    generateSplinePath(start, control, end, segments) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t  = i / segments;
            const mt = 1.0 - t;
            pts.push([
                mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0],
                mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1],
                mt * mt * start[2] + 2 * mt * t * control[2] + t * t * end[2],
            ]);
        }
        return pts;
    }

    addTerminalBranches(origin, count, segRadius, bundleId, branchPhase = 0.0) {
        const DEPTH = 5;
        const corticalBias = this.getCorticalBias(origin[0], origin[1], origin[2]);
        const adjustedCount = Math.max(4, Math.floor(count * (1.0 + corticalBias * 3.2)));
        for (let i = 0; i < adjustedCount; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi   = this.random() * Math.PI * 0.6;
            const dx = Math.sin(phi) * Math.cos(theta);
            const dy = Math.cos(phi) * 0.6 + (this.random() - 0.5) * 0.4;
            const dz = Math.sin(phi) * Math.sin(theta);
            const branchDir = [dx, dy, dz];

            let [px, py, pz] = origin;
            let len = segRadius;
            for (let d = 0; d < DEPTH; d++) {
                const jit = len * 0.4;
                const nx = px + dx * len + (this.random() - 0.5) * jit;
                const ny = py + dy * len + (this.random() - 0.5) * jit;
                const nz = pz + dz * len + (this.random() - 0.5) * jit;
                if (this.isInsideBrain(px, py, pz) || this.isInsideBrain(nx, ny, nz)) {
                    const nextRadius = segRadius * (1.0 - (d + 1) / DEPTH) * 0.92;
                    this.addFiberTubeSegment(
                        [px, py, pz],
                        [nx, ny, nz],
                        segRadius * (1.0 - d / DEPTH),
                        Math.max(0.003, nextRadius),
                        bundleId,
                        0.3,
                        branchPhase + (d / DEPTH) * 0.15,
                        d === DEPTH - 1
                    );
                    // Varicosity beads along branch
                    const beadCount = 1 + Math.floor(corticalBias * 2.5) + (d >= DEPTH - 2 ? 1 : 0);
                    for (let bead = 0; bead < beadCount; bead++) {
                        const vb = 0.2 + this.random() * 0.6;
                        const vmid = [
                            px + (nx - px) * vb,
                            py + (ny - py) * vb,
                            pz + (nz - pz) * vb
                        ];
                        if (this.isInsideBrain(vmid[0], vmid[1], vmid[2])) {
                            this.addPointCloudInstance(vmid[0], vmid[1], vmid[2], len * (0.22 + this.random() * 0.28), 4, bundleId, this.random()*6.28);
                        }
                    }
                }
                px = nx; py = ny; pz = nz;
                len *= 0.65;
            }
            // Terminal bouton cluster at tip
            const tipCount = 6 + Math.floor(12 * corticalBias);
            for (let b = 0; b < tipCount; b++) {
                const jx = (this.random()-0.5)*len*0.8;
                const jy = (this.random()-0.5)*len*0.8;
                const jz = (this.random()-0.5)*len*0.8;
                const tx = px + jx, ty = py + jy, tz = pz + jz;
                if (this.isInsideBrain(tx, ty, tz)) {
                    this.addPointCloudInstance(tx, ty, tz, len * (0.25 + this.random() * 0.2), 5, bundleId, this.random()*6.28);
                }
            }
            if (this.isInsideBrain(px, py, pz)) {
                this.addPointCluster([px, py, pz], 4 + Math.floor(corticalBias * 6.0), len * 1.8, len * 0.18, len * 0.35, 5, bundleId, branchDir, [1.0, 0.8, 1.0]);
            }
        }
    }

    addFiberTubeSegment(start, end, startRadius, endRadius, bundleId, myelin, segmentPhase = 0.0, addEndCaps = false) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const dz = end[2] - start[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 1e-6) return;

        const tx = dx / length;
        const ty = dy / length;
        const tz = dz / length;
        const tangent = [tx, ty, tz];
        const ref = Math.abs(ty) > 0.82 ? [1.0, 0.0, 0.0] : [0.0, 1.0, 0.0];
        let nx = tangent[1] * ref[2] - tangent[2] * ref[1];
        let ny = tangent[2] * ref[0] - tangent[0] * ref[2];
        let nz = tangent[0] * ref[1] - tangent[1] * ref[0];
        let nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
        nx /= nLen; ny /= nLen; nz /= nLen;

        let bx = tangent[1] * nz - tangent[2] * ny;
        let by = tangent[2] * nx - tangent[0] * nz;
        let bz = tangent[0] * ny - tangent[1] * nx;
        let bLen = Math.sqrt(bx * bx + by * by + bz * bz) || 1.0;
        bx /= bLen; by /= bLen; bz /= bLen;

        const SIDES = bundleId >= 100 ? 5 : 7;
        const startRing = [];
        const endRing = [];
        const ringNormals = [];

        for (let i = 0; i < SIDES; i++) {
            const a = (i / SIDES) * Math.PI * 2.0;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const rx = nx * ca + bx * sa;
            const ry = ny * ca + by * sa;
            const rz = nz * ca + bz * sa;
            ringNormals.push([rx, ry, rz]);
            startRing.push([
                start[0] + rx * startRadius,
                start[1] + ry * startRadius,
                start[2] + rz * startRadius
            ]);
            endRing.push([
                end[0] + rx * endRadius,
                end[1] + ry * endRadius,
                end[2] + rz * endRadius
            ]);
        }

        const pushVertex = (pos, normal) => {
            this.fibers.push(pos[0], pos[1], pos[2]);
            this.fiberNormals.push(normal[0], normal[1], normal[2], 0.0);
            this.fiberMetadata.push(Math.max(startRadius, endRadius), bundleId, Math.max(0.0, Math.min(1.0, myelin)), segmentPhase);
            this.fiberPaths.push(start[0], start[1], start[2], end[0], end[1], end[2]);
        };

        for (let i = 0; i < SIDES; i++) {
            const ni = (i + 1) % SIDES;
            const s0 = startRing[i];
            const s1 = startRing[ni];
            const e0 = endRing[i];
            const e1 = endRing[ni];
            const n0 = ringNormals[i];
            const n1 = ringNormals[ni];

            pushVertex(s0, n0);
            pushVertex(e0, n0);
            pushVertex(s1, n1);

            pushVertex(s1, n1);
            pushVertex(e0, n0);
            pushVertex(e1, n1);
        }

        if (addEndCaps) {
            const startCapNormal = [-tx, -ty, -tz];
            const endCapNormal = [tx, ty, tz];
            for (let i = 1; i < SIDES - 1; i++) {
                pushVertex(start, startCapNormal);
                pushVertex(startRing[i], startCapNormal);
                pushVertex(startRing[i + 1], startCapNormal);

                pushVertex(end, endCapNormal);
                pushVertex(endRing[i + 1], endCapNormal);
                pushVertex(endRing[i], endCapNormal);
            }
        }
    }

    addSparkSource(anchor, tangent, intensity, phase, bundleId, myelin, kind) {
        const tx = tangent[0];
        const ty = tangent[1];
        const tz = tangent[2];
        const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
        const invLen = len > 1e-6 ? 1.0 / len : 1.0;
        const nx = len > 1e-6 ? tx * invLen : 0.0;
        const ny = len > 1e-6 ? ty * invLen : 0.0;
        const nz = len > 1e-6 ? tz * invLen : 1.0;

        this.sparkSources.push(
            anchor[0], anchor[1], anchor[2], phase,
            nx, ny, nz, intensity,
            bundleId, myelin, kind, 0.0
        );
    }

    // [V3.2] Shallow U-fibers (association fibers just under cortical surface)
    generateUFibers() {
        const NUM_U_FIBERS = 320;
        const BUNDLE_ID_U = 50;
        for (let i = 0; i < NUM_U_FIBERS; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi = Math.acos(2 * this.random() - 1);
            const nx = Math.sin(phi) * Math.cos(theta);
            const ny = Math.cos(phi);
            const nz = Math.sin(phi) * Math.sin(theta);
            const sample = this.sampleCorticalSurface(nx, ny, nz, true);
            const radius = sample.radius;
            const cx = nx * radius * 0.90;
            const cy = ny * radius * 0.90;
            const cz = nz * radius * 0.90;
            if (!this.isInsideBrain(cx, cy, cz)) continue;

            let t1x = ny, t1y = -nx, t1z = 0;
            const t1len = Math.sqrt(t1x*t1x + t1y*t1y + t1z*t1z);
            if (t1len < 0.01) { t1x = 0; t1y = 1; t1z = 0; }
            else { t1x /= t1len; t1y /= t1len; t1z /= t1len; }
            const t2x = ny*t1z - nz*t1y;
            const t2y = nz*t1x - nx*t1z;
            const t2z = nx*t1y - ny*t1x;

            const tangentMix = this.random() * 0.55 - 0.275;
            const ux = t1x * (1.0 - Math.abs(tangentMix)) + t2x * tangentMix;
            const uy = t1y * (1.0 - Math.abs(tangentMix)) + t2y * tangentMix;
            const uz = t1z * (1.0 - Math.abs(tangentMix)) + t2z * tangentMix;
            const uLen = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1.0;
            const dirx = ux / uLen;
            const diry = uy / uLen;
            const dirz = uz / uLen;

            const arcLen = 0.11 + this.random() * 0.17;
            const corticalInset = 0.84 + this.random() * 0.07;
            const bend = (this.random() - 0.5) * arcLen * 0.9;
            const start = [cx + dirx * arcLen, cy + diry * arcLen, cz + dirz * arcLen];
            const end = [cx - dirx * arcLen, cy - diry * arcLen, cz - dirz * arcLen];
            const control = [
                cx * corticalInset + t2x * bend,
                cy * corticalInset + t2y * bend,
                cz * corticalInset + t2z * bend
            ];

            const pts = this.generateSplinePath(start, control, end, 8);
            for (let j = 0; j < pts.length - 1; j++) {
                if (this.isInsideBrain(pts[j][0], pts[j][1], pts[j][2]) || this.isInsideBrain(pts[j+1][0], pts[j+1][1], pts[j+1][2])) {
                    this.addFiberTubeSegment(pts[j], pts[j+1], 0.006, 0.004, BUNDLE_ID_U, 0.15, j/(pts.length-1), false);
                }
            }
            this.fiberCenterlines.push({ pts, bundleId: BUNDLE_ID_U, myelin: 0.15 });
            for (let j = 0; j < pts.length; j++) {
                if (this.isInsideBrain(pts[j][0], pts[j][1], pts[j][2])) {
                    this.addPointCloudInstance(pts[j][0], pts[j][1], pts[j][2], 0.005, 3, BUNDLE_ID_U, this.random()*6.28);
                }
            }
        }
    }

    // [V3.2] Build per-voxel fiber affinity map from actual generated centerlines
    buildFiberAffinityMap() {
        const dim = 32;
        const brainRange = 1.6;
        const voxelCount = dim * dim * dim;
        const voxelAccumulators = new Array(voxelCount).fill(null).map(() => []);
        const voxelRadius = brainRange * 2.0 / dim;

        const worldToVoxel = (wx, wy, wz) => {
            const nx = (wx / brainRange) * 0.5 + 0.5;
            const ny = (wy / brainRange) * 0.5 + 0.5;
            const nz = (wz / brainRange) * 0.5 + 0.5;
            return [
                Math.max(0, Math.min(dim - 1, Math.floor(nx * dim))),
                Math.max(0, Math.min(dim - 1, Math.floor(ny * dim))),
                Math.max(0, Math.min(dim - 1, Math.floor(nz * dim)))
            ];
        };

        for (const cl of this.fiberCenterlines) {
            for (let i = 0; i < cl.pts.length - 1; i++) {
                const p0 = cl.pts[i];
                const p1 = cl.pts[i+1];
                const dx = p1[0] - p0[0];
                const dy = p1[1] - p0[1];
                const dz = p1[2] - p0[2];
                const segLen = Math.sqrt(dx*dx + dy*dy + dz*dz);
                if (segLen < 1e-6) continue;
                const dir = [dx/segLen, dy/segLen, dz/segLen];
                const bundleBoost =
                    cl.bundleId === 50 ? 0.75 :
                    cl.bundleId >= 100 ? 0.9 :
                    cl.bundleId >= 20 ? 1.15 :
                    1.0;
                const samples = Math.max(2, Math.ceil(segLen / (voxelRadius * 0.55)));
                for (let s = 0; s < samples; s++) {
                    const t = (s + 0.5) / samples;
                    const sx = p0[0] + dx * t;
                    const sy = p0[1] + dy * t;
                    const sz = p0[2] + dz * t;
                    const [vx, vy, vz] = worldToVoxel(sx, sy, sz);
                    const localWeight = (segLen / samples) * (0.35 + (cl.myelin || 0.5)) * bundleBoost;
                    for (let oz = -1; oz <= 1; oz++) {
                        for (let oy = -1; oy <= 1; oy++) {
                            for (let ox = -1; ox <= 1; ox++) {
                                const nx = Math.max(0, Math.min(dim - 1, vx + ox));
                                const ny = Math.max(0, Math.min(dim - 1, vy + oy));
                                const nz = Math.max(0, Math.min(dim - 1, vz + oz));
                                const idx = nz * dim * dim + ny * dim + nx;
                                const dist2 = ox*ox + oy*oy + oz*oz;
                                const spread = Math.exp(-dist2 * 0.75);
                                const directionalBias = cl.bundleId === 50 ? 1.25 - Math.min(0.2, Math.abs(dir[1]) * 0.2) : 1.0;
                                voxelAccumulators[idx].push({
                                    dir,
                                    weight: localWeight * spread * directionalBias
                                });
                            }
                        }
                    }
                }
            }
        }

        const data = new Float32Array(voxelCount * 12);
        for (let i = 0; i < voxelCount; i++) {
            const accs = voxelAccumulators[i];
            if (accs.length === 0) {
                const z = Math.floor(i / (dim * dim));
                const rem = i % (dim * dim);
                const y = Math.floor(rem / dim);
                const x = rem % dim;
                const wx = (x / dim) * 2.0 - 1.0;
                const wy = (y / dim) * 2.0 - 1.0;
                const wz = (z / dim) * 2.0 - 1.0;
                const len = Math.sqrt(wx*wx + wy*wy + wz*wz) || 1.0;
                data[i*12+0] = wx/len;
                data[i*12+1] = wy/len;
                data[i*12+2] = wz/len;
                data[i*12+3] = 0.0;
                for (let k = 1; k < 3; k++) {
                    data[i*12+k*4+0] = 0.0;
                    data[i*12+k*4+1] = 0.0;
                    data[i*12+k*4+2] = 0.0;
                    data[i*12+k*4+3] = 0.0;
                }
                continue;
            }

            // Cluster similar directions
            const summed = [];
            for (const a of accs) {
                let found = false;
                for (const s of summed) {
                    const dot = s.dx*a.dir[0] + s.dy*a.dir[1] + s.dz*a.dir[2];
                    if (Math.abs(dot) > 0.78) {
                        const sign = dot >= 0.0 ? 1.0 : -1.0;
                        s.dx += a.dir[0] * a.weight * sign;
                        s.dy += a.dir[1] * a.weight * sign;
                        s.dz += a.dir[2] * a.weight * sign;
                        s.weight += a.weight;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    summed.push({ dx: a.dir[0]*a.weight, dy: a.dir[1]*a.weight, dz: a.dir[2]*a.weight, weight: a.weight });
                }
            }

            for (const s of summed) {
                const len = Math.sqrt(s.dx*s.dx + s.dy*s.dy + s.dz*s.dz);
                if (len > 0) { s.dx /= len; s.dy /= len; s.dz /= len; }
            }
            summed.sort((a, b) => b.weight - a.weight);

            const picks = [];
            for (const s of summed) {
                if (picks.length >= 3) break;
                let ok = true;
                for (const p of picks) {
                    const dot = Math.abs(s.dx*p.dx + s.dy*p.dy + s.dz*p.dz);
                    if (dot > 0.60) { ok = false; break; }
                }
                if (ok) picks.push(s);
            }

            let totalW = picks.reduce((sum, p) => sum + p.weight, 0);
            if (totalW === 0) totalW = 1;
            for (let k = 0; k < 3; k++) {
                const p = picks[k];
                const base = i * 12 + k * 4;
                if (p) {
                    data[base+0] = p.dx;
                    data[base+1] = p.dy;
                    data[base+2] = p.dz;
                    data[base+3] = p.weight / totalW;
                } else {
                    data[base+0] = 0.0; data[base+1] = 0.0; data[base+2] = 0.0; data[base+3] = 0.0;
                }
            }
        }
        this.fiberAffinityData = data;
    }

    getFiberAffinityData() {
        return this.fiberAffinityData || new Float32Array(32*32*32*12);
    }

    getVertexData() { return new Float32Array(this.vertices); }
    getNormalData() {
        const padded = new Float32Array(this.normals.length / 3 * 4);
        for (let i = 0; i < this.normals.length / 3; i++) {
            padded[i * 4 + 0] = this.normals[i * 3 + 0];
            padded[i * 4 + 1] = this.normals[i * 3 + 1];
            padded[i * 4 + 2] = this.normals[i * 3 + 2];
            padded[i * 4 + 3] = 0.0;
        }
        return padded;
    }
    getIndexData() { return new Uint32Array(this.indices); }
    getIndexCount() { return this.indices.length; }
    getFiberData() { return new Float32Array(this.fibers); }
    getFiberNormalData() { return new Float32Array(this.fiberNormals); }
    getFiberDataWithMetadata() { return new Float32Array(this.fiberMetadata); }
    getFiberPathData() { return new Float32Array(this.fiberPaths); }
    getSparkSourceData() { return new Float32Array(this.sparkSources); }
    getFiberVertexCount() { return this.fibers.length / 3; }
    getVertexCount() { return this.vertices.length / 3; }
    // [V3.1] Rich instance buffers
    getSomaInstanceData() { return new Float32Array(this.somaInstances); }
    getPointCloudData() { return new Float32Array(this.pointCloudInstances); }
    getSomaPositions() {
        // Back-compat: flatten positions from rich instances
        const out = new Float32Array(this.somaInstances.length / 9 * 3);
        for (let i = 0; i < this.somaInstances.length / 9; i++) {
            out[i*3+0] = this.somaInstances[i*9+0];
            out[i*3+1] = this.somaInstances[i*9+1];
            out[i*3+2] = this.somaInstances[i*9+2];
        }
        return out;
    }
    getFiberMetadata() { return new Float32Array(this.fiberMetadata); }
}

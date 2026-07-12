export function applyInstancesMethods(Target) {
    Target.prototype.addSomaInstance = function(x, y, z, scale, typeId, bundleId, phase, shapeSeed) {
        // 9 floats padded to 36 bytes to match shader stride
        this.somaInstances.push(x, y, z, scale, typeId, bundleId, phase, shapeSeed, 0.0);
    };

    Target.prototype.addPointCloudInstance = function(x, y, z, scale, typeId, bundleId, phase) {
        this.pointCloudInstances.push(x, y, z, scale, typeId, bundleId, phase, 0.0);
    };

    Target.prototype.randomUnitVector = function(bias = null, biasStrength = 0.0) {
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
    };

    Target.prototype.addPointCluster = function(center, count, spread, scaleMin, scaleMax, typeId, bundleId, bias = null, anisotropy = [1.0, 1.0, 1.0]) {
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
    };

    Target.prototype.generateCorticalMantleCloud = function() {
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
    };

    Target.prototype.generateAIFiberPathways = function() {
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
    };

    Target.prototype.generateHumanVesicleSparks = function() {
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
    };

    Target.prototype.generateFusionHotspotSparks = function() {
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
    };

}

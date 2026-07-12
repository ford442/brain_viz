export function applyFibersMethods(Target) {
    Target.prototype.generateOrganicConnectomeFibers = function() {
        // [V3.3] Bilateral connectome: midline-symmetric commissural bundles plus
        // left-hemisphere lateral bundles whose right-hemisphere twin is mirror-generated.
        // fiberSymmetry (0..1) blends each right fiber toward a mirror of its left partner;
        // bundleCoherence (0..1) tightens fibers within a bundle for a cleaner tractography look.
        const symmetry = this.saturate(this.options.fiberSymmetry ?? 0.85);
        const coherence = this.saturate(this.options.bundleCoherence ?? 0.6);

        // Commissural / midline bundles span both hemispheres (already x-symmetric).
        const COMMISSURAL = [
    { s:[-0.9,  0.2,  0.55], c:[ 0.0,  0.85,  0.4], e:[ 0.9,  0.2,  0.55], r:0.07, m:0.9, id:0, n:28, b:6 },
    { s:[-0.85, 0.2, -0.45], c:[ 0.0,  0.65, -0.6], e:[ 0.85, 0.2, -0.45], r:0.065, m:0.9, id:0, n:24, b:5 },
        ];

        // Left-hemisphere lateral bundles; the right hemisphere is mirror-generated.
        const LATERAL = [
    { s:[-0.35, 0.85,  0.3], c:[-0.4,  0.05,  0.45], e:[-0.1, -0.85,  0.1], r:0.06, m:0.88, id:1, n:22, b:4 },
    { s:[-0.2,  0.05, -0.85], c:[-0.65, -0.3, -0.45], e:[-0.8, -0.05,  0.15], r:0.05, m:0.82, id:2, n:20, b:5 },
    { s:[-0.8,  0.45,  0.5], c:[-1.0,  0.3, -0.05], e:[-0.8,  0.1, -0.65], r:0.055, m:0.78, id:3, n:20, b:3 },
    { s:[-0.6,  0.35,  0.5], c:[-0.3,  0.7,  0.2], e:[-0.85, -0.2,  0.05], r:0.05, m:0.76, id:4, n:18, b:3 },
    { s:[-0.1,  0.6,  0.5], c:[-0.15, 0.6,  0.0], e:[-0.1,  0.3, -0.6], r:0.045, m:0.74, id:5, n:16, b:2 },
    { s:[-0.75, 0.2,  0.6], c:[-0.8, -0.1,  0.0], e:[-0.65, -0.1, -0.75], r:0.05, m:0.75, id:6, n:18, b:3 },
    { s:[-0.65, -0.3,  0.35], c:[-0.5,  0.1,  0.65], e:[-0.55, 0.4,  0.65], r:0.045, m:0.72, id:7, n:16, b:3 },
        ];

        for (const bun of COMMISSURAL) {
    this.buildConnectomeBundle(bun, coherence, null);
        }
        for (const bun of LATERAL) {
    const captured = this.buildConnectomeBundle(bun, coherence, null);
    const mirrored = {
        s: [-bun.s[0], bun.s[1], bun.s[2]],
        c: [-bun.c[0], bun.c[1], bun.c[2]],
        e: [-bun.e[0], bun.e[1], bun.e[2]],
        r: bun.r, m: bun.m, id: bun.id, n: bun.n, b: bun.b
    };
    this.buildConnectomeBundle(mirrored, coherence, { jitter: captured, symmetry });
        }
    };

    Target.prototype.buildConnectomeBundle = function(bun, coherence, mirrorSource) {
        const captured = [];
        const symmetry = mirrorSource ? this.saturate(mirrorSource.symmetry) : 0.0;
        const jitterScale = 1.0 - coherence * 0.7;

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
    const jit = bun.r * 0.7 * jitterScale;
    const rnd = () => (this.random() - 0.5) * 2;
    const topJit = (this.options.networkTopology || 0.0) * 0.5;

    // Always draw a fresh jitter set (keeps the RNG stream and per-fiber variety).
    const fresh = {
        jS: [rnd()*jit, rnd()*jit, rnd()*jit],
        jC: [rnd()*jit*0.4, rnd()*jit*0.4, rnd()*jit*0.4],
        jE: [rnd()*jit, rnd()*jit, rnd()*jit],
        tS: [rnd()*topJit, rnd()*topJit, rnd()*topJit],
        tC: [rnd()*topJit, rnd()*topJit, rnd()*topJit],
        tE: [rnd()*topJit, rnd()*topJit, rnd()*topJit],
    };
    captured.push(fresh);

    let j = fresh;
    if (mirrorSource && mirrorSource.jitter[s]) {
        const src = mirrorSource.jitter[s];
        const mir = (v) => [-v[0], v[1], v[2]]; // reflect across the x = 0 midplane
        const blend = (a, b) => [
            a[0] + (b[0]-a[0])*symmetry,
            a[1] + (b[1]-a[1])*symmetry,
            a[2] + (b[2]-a[2])*symmetry
        ];
        j = {
            jS: blend(fresh.jS, mir(src.jS)),
            jC: blend(fresh.jC, mir(src.jC)),
            jE: blend(fresh.jE, mir(src.jE)),
            tS: blend(fresh.tS, mir(src.tS)),
            tC: blend(fresh.tC, mir(src.tC)),
            tE: blend(fresh.tE, mir(src.tE)),
        };
    }

    {
        const pS = [bun.s[0]+j.jS[0]+j.tS[0], bun.s[1]+j.jS[1]+j.tS[1], bun.s[2]+j.jS[2]+j.tS[2]];
        const pC = [bun.c[0]+j.jC[0]+j.tC[0], bun.c[1]+j.jC[1]+j.tC[1], bun.c[2]+j.jC[2]+j.tC[2]];
        const pE = [bun.e[0]+j.jE[0]+j.tE[0], bun.e[1]+j.jE[1]+j.tE[1], bun.e[2]+j.jE[2]+j.tE[2]];
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
        return captured;
    };

    Target.prototype.generateSplinePath = function(start, control, end, segments) {
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
    };

    Target.prototype.addTerminalBranches = function(origin, count, segRadius, bundleId, branchPhase = 0.0) {
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
    };

    Target.prototype.addFiberTubeSegment = function(start, end, startRadius, endRadius, bundleId, myelin, segmentPhase = 0.0, addEndCaps = false) {
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
    };

    Target.prototype.addSparkSource = function(anchor, tangent, intensity, phase, bundleId, myelin, kind) {
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
    };

    Target.prototype.generateUFibers = function() {
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
    };

    Target.prototype.buildFiberAffinityMap = function() {
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
    };

}

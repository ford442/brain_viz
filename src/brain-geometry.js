// brain-geometry.js
// Procedural Brain Generation with Organic Connectome Fibers - V3.0
// [Neuro-Weaver] Generates deformed sphere mesh and anatomically-guided fiber pathways.

export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.somaPositions = [];
        this.sparkSources = [];
        // Per-vertex metadata: [radius, bundleId, myelin, segmentPhase] — companion buffer for Connectome shading
        this.fiberMetadata = [];
        // Per-vertex path endpoints: [start.xyz, end.xyz] for tensor-aware fiber sampling
        this.fiberPaths = [];
    }

    generate(rows, cols) {
        // Clear previous data
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.somaPositions = [];
        this.sparkSources = [];
        this.fiberMetadata = [];
        this.fiberPaths = [];

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

        // 2. Generate Organic Connectome Fibers (replaces Manhattan grid for style=2)
        this.generateOrganicConnectomeFibers();
    }

    applyBrainDeformation(x, y, z) {
        // A. Longitudinal Fissure (separate hemispheres)
        const fissureStrength = Math.exp(-Math.abs(x) * 5.0);
        const fissureIndent = 1.0 - (fissureStrength * 0.4);

        // B. Gyri/Sulci (Folds)
        const noise = Math.sin(x * 10) * Math.cos(y * 10) * Math.sin(z * 10);
        const foldHeight = 1.0 + (noise * 0.05);

        const radius = 1.5 * fissureIndent * foldHeight;

        return { x: x * radius, y: y * radius, z: z * radius };
    }

    isInsideBrain(x, y, z) {
        // Inverse deformation check (approximate)
        // We normalize the point and check if it's within the radius defined by our deformation function
        const len = Math.sqrt(x*x + y*y + z*z);
        if (len === 0) return true;

        const nx = x / len;
        const ny = y / len;
        const nz = z / len;

        // Calculate expected radius at this angle
        // (Re-using deformation logic without 'foldHeight' noise for a slightly safer margin,
        //  or include it if we want to fill the folds)

        // A. Fissure
        const fissureStrength = Math.exp(-Math.abs(nx) * 5.0);
        const fissureIndent = 1.0 - (fissureStrength * 0.4);

        // Base radius is 1.5 * fissureIndent
        // We leave a small margin (0.9) so fibers don't poke out
        const maxRadius = 1.5 * fissureIndent * 0.9;

        return len < maxRadius;
    }

    // [V2.3] Circuit Grid Generation — kept as named fallback
    generateCircuitGrid() {
        const step = 0.15; // Grid spacing
        const range = 1.5; // Bounding box half-size

        // We will generate segments along axes
        // To make it look like a flow/circuit, we scan the grid

        for (let x = -range; x <= range; x += step) {
            for (let y = -range; y <= range; y += step) {
                for (let z = -range; z <= range; z += step) {

                    if (!this.isInsideBrain(x, y, z)) continue;

                    // Store Soma Position (Grid Node)
                    // Add some jitter for organic feel? No, grid structure is the aesthetic.
                    this.somaPositions.push(x, y, z);
                    this.addSparkSource([x, y, z], [x, y, z], 0.2, 0.0, 0.0, 0.0, 0.0);

                    // Try to connect to neighbors (+X, +Y, +Z)
                    // We only connect 'forward' to avoid duplicates

                    // Connect X+1
                    if (this.isInsideBrain(x + step, y, z)) {
                         // Random chance to skip connection (sparse circuit look)
                        if (Math.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x + step, y, z);
                            this.fiberMetadata.push(0.05, 0.0, 0.5, 0.0, 0.05, 0.0, 0.5, 0.0);
                            this.fiberPaths.push(x, y, z, x + step, y, z);
                            this.fiberPaths.push(x, y, z, x + step, y, z);
                            this.addSparkSource([x + step * 0.5, y, z], [1.0, 0.0, 0.0], 0.28, 0.0, 0.0, 0.0, 1.0);
                        }
                    }

                    // Connect Y+1
                    if (this.isInsideBrain(x, y + step, z)) {
                        if (Math.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x, y + step, z);
                            this.fiberMetadata.push(0.05, 1.0, 0.5, 0.0, 0.05, 1.0, 0.5, 0.0);
                            this.fiberPaths.push(x, y, z, x, y + step, z);
                            this.fiberPaths.push(x, y, z, x, y + step, z);
                            this.addSparkSource([x, y + step * 0.5, z], [0.0, 1.0, 0.0], 0.28, 0.0, 1.0, 0.0, 1.0);
                        }
                    }

                    // Connect Z+1
                    if (this.isInsideBrain(x, y, z + step)) {
                        if (Math.random() > 0.3) {
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

    // [V3.0] Organic Connectome Fiber Generation
    // Generates curved, branching, anatomically-guided white-matter tracts using
    // quadratic Bézier splines seeded from 16 major bilateral bundles.
    // Replaces the Manhattan circuit grid for style=2 Connectome mode.
    generateOrganicConnectomeFibers() {
        // Bundle descriptor fields:
        //   s  — spline start  [x,y,z]
        //   c  — Bézier control point  [x,y,z]
        //   e  — spline end  [x,y,z]
        //   r  — nominal radius (for metadata / future thick-line rendering)
        //   m  — myelin fraction 0-1 (metadata, Phase 2)
        //   id — bundle ID 0-7 (metadata, Phase 2)
        //   n  — number of parallel sub-fibers per bundle
        //   b  — terminal branch count per sub-fiber endpoint
        const BUNDLES = [
            // Corpus Callosum — genu (frontal inter-hemispheric commissure)
            { s:[-0.9,  0.2,  0.55], c:[ 0.0,  0.85,  0.4], e:[ 0.9,  0.2,  0.55],
              r:0.07, m:0.9, id:0, n:28, b:6 },
            // Corpus Callosum — splenium (posterior inter-hemispheric commissure)
            { s:[-0.85, 0.2, -0.45], c:[ 0.0,  0.65, -0.6], e:[ 0.85, 0.2, -0.45],
              r:0.065, m:0.9, id:0, n:24, b:5 },
            // Left Corticospinal tract — descending motor projection
            { s:[-0.35, 0.85,  0.3], c:[-0.4,  0.05,  0.45], e:[-0.1, -0.85,  0.1],
              r:0.06, m:0.88, id:1, n:22, b:4 },
            // Right Corticospinal tract
            { s:[ 0.35, 0.85,  0.3], c:[ 0.4,  0.05,  0.45], e:[ 0.1, -0.85,  0.1],
              r:0.06, m:0.88, id:1, n:22, b:4 },
            // Left Optic radiation — visual projection to occipital cortex
            { s:[-0.2,  0.05, -0.85], c:[-0.65, -0.3, -0.45], e:[-0.8, -0.05,  0.15],
              r:0.05, m:0.82, id:2, n:20, b:5 },
            // Right Optic radiation
            { s:[ 0.2,  0.05, -0.85], c:[ 0.65, -0.3, -0.45], e:[ 0.8, -0.05,  0.15],
              r:0.05, m:0.82, id:2, n:20, b:5 },
            // Left Superior Longitudinal Fasciculus — fronto-parietal association
            { s:[-0.8,  0.45,  0.5], c:[-1.0,  0.3, -0.05], e:[-0.8,  0.1, -0.65],
              r:0.055, m:0.78, id:3, n:20, b:3 },
            // Right Superior Longitudinal Fasciculus
            { s:[ 0.8,  0.45,  0.5], c:[ 1.0,  0.3, -0.05], e:[ 0.8,  0.1, -0.65],
              r:0.055, m:0.78, id:3, n:20, b:3 },
            // Left Arcuate Fasciculus — language fronto-temporal arc
            { s:[-0.6,  0.35,  0.5], c:[-0.3,  0.7,  0.2], e:[-0.85, -0.2,  0.05],
              r:0.05, m:0.76, id:4, n:18, b:3 },
            // Right Arcuate Fasciculus
            { s:[ 0.6,  0.35,  0.5], c:[ 0.3,  0.7,  0.2], e:[ 0.85, -0.2,  0.05],
              r:0.05, m:0.76, id:4, n:18, b:3 },
            // Left Cingulum — medial limbic association arc
            { s:[-0.1,  0.6,  0.5], c:[-0.15, 0.6,  0.0], e:[-0.1,  0.3, -0.6],
              r:0.045, m:0.74, id:5, n:16, b:2 },
            // Right Cingulum
            { s:[ 0.1,  0.6,  0.5], c:[ 0.15, 0.6,  0.0], e:[ 0.1,  0.3, -0.6],
              r:0.045, m:0.74, id:5, n:16, b:2 },
            // Left Inferior Fronto-Occipital Fasciculus — long-range temporal bypass
            { s:[-0.75, 0.2,  0.6], c:[-0.8, -0.1,  0.0], e:[-0.65, -0.1, -0.75],
              r:0.05, m:0.75, id:6, n:18, b:3 },
            // Right Inferior Fronto-Occipital Fasciculus
            { s:[ 0.75, 0.2,  0.6], c:[ 0.8, -0.1,  0.0], e:[ 0.65, -0.1, -0.75],
              r:0.05, m:0.75, id:6, n:18, b:3 },
            // Left Uncinate Fasciculus — hooked temporal-frontal tract
            { s:[-0.65, -0.3,  0.35], c:[-0.5,  0.1,  0.65], e:[-0.55, 0.4,  0.65],
              r:0.045, m:0.72, id:7, n:16, b:3 },
            // Right Uncinate Fasciculus
            { s:[ 0.65, -0.3,  0.35], c:[ 0.5,  0.1,  0.65], e:[ 0.55, 0.4,  0.65],
              r:0.045, m:0.72, id:7, n:16, b:3 },
        ];

        for (const bun of BUNDLES) {
            for (let s = 0; s < bun.n; s++) {
                // Perturb each sub-fiber within the bundle radius for natural spread
                const jit = bun.r * 0.7;
                const rnd = () => (Math.random() - 0.5) * 2;
                const pS = [bun.s[0]+rnd()*jit, bun.s[1]+rnd()*jit, bun.s[2]+rnd()*jit];
                const pC = [bun.c[0]+rnd()*jit*0.4, bun.c[1]+rnd()*jit*0.4, bun.c[2]+rnd()*jit*0.4];
                const pE = [bun.e[0]+rnd()*jit, bun.e[1]+rnd()*jit, bun.e[2]+rnd()*jit];

                const pts = this.generateSplinePath(pS, pC, pE, 12);

                for (let i = 0; i < pts.length - 1; i++) {
                    const [x1, y1, z1] = pts[i];
                    const [x2, y2, z2] = pts[i + 1];
                    if (!this.isInsideBrain(x1, y1, z1) && !this.isInsideBrain(x2, y2, z2)) continue;
                    const t = i / (pts.length - 1);
                    const radius = bun.r * (1.0 - t * 0.3);
                    this.addFiberRibbonSegment([x1, y1, z1], [x2, y2, z2], radius, bun.id, bun.m, t);
                    if (i % 2 === 0) {
                        const midPoint = [
                            (x1 + x2) * 0.5,
                            (y1 + y2) * 0.5,
                            (z1 + z2) * 0.5
                        ];
                        const tangent = [x2 - x1, y2 - y1, z2 - z1];
                        this.addSparkSource(midPoint, tangent, 0.38 + bun.m * 0.3, t, bun.id, bun.m, 1.0);
                    }
                }

                // Soma nodes: start, midpoint, and end of each sub-fiber
                const mid = pts[Math.floor(pts.length / 2)];
                [pts[0], mid, pts[pts.length - 1]].forEach(pt => {
                    if (this.isInsideBrain(pt[0], pt[1], pt[2])) {
                        this.somaPositions.push(pt[0], pt[1], pt[2]);
                        this.addSparkSource(pt, [pt[0], pt[1], pt[2]], 0.45 + bun.m * 0.35, 0.15, bun.id, bun.m, 0.0);
                    }
                });

                // Fan-out terminal branches at the axon-terminal endpoint
                this.addTerminalBranches(pts[pts.length - 1], bun.b, bun.r * 0.5, bun.id, 1.0);
            }
        }
    }

    // [V3.0] Quadratic Bézier spline: smooth curve through a single control point.
    // Returns (segments+1) [x,y,z] waypoints from start to end.
    generateSplinePath(start, control, end, segments) {
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t  = i / segments;
            const mt = 1.0 - t;
            // B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
            pts.push([
                mt * mt * start[0] + 2 * mt * t * control[0] + t * t * end[0],
                mt * mt * start[1] + 2 * mt * t * control[1] + t * t * end[1],
                mt * mt * start[2] + 2 * mt * t * control[2] + t * t * end[2],
            ]);
        }
        return pts;
    }

    // [V3.0] Cortical terminal arborisation: fans out short, tapering branch segments
    // from a fiber endpoint to mimic axon terminals / dendritic arbors.
    addTerminalBranches(origin, count, segRadius, bundleId, branchPhase = 0.0) {
        const DEPTH = 4; // branch segments per terminal fiber
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.random() * Math.PI * 0.6;
            const dx = Math.sin(phi) * Math.cos(theta);
            const dy = Math.cos(phi) * 0.6 + (Math.random() - 0.5) * 0.4;
            const dz = Math.sin(phi) * Math.sin(theta);

            let [px, py, pz] = origin;
            let len = segRadius;
            for (let d = 0; d < DEPTH; d++) {
                const jit = len * 0.4;
                const nx = px + dx * len + (Math.random() - 0.5) * jit;
                const ny = py + dy * len + (Math.random() - 0.5) * jit;
                const nz = pz + dz * len + (Math.random() - 0.5) * jit;
                if (this.isInsideBrain(px, py, pz) || this.isInsideBrain(nx, ny, nz)) {
                    this.addFiberRibbonSegment(
                        [px, py, pz],
                        [nx, ny, nz],
                        segRadius * (1.0 - d / DEPTH),
                        bundleId,
                        0.3,
                        branchPhase + (d / DEPTH) * 0.15
                    );
                }
                px = nx; py = ny; pz = nz;
                len *= 0.65; // taper: shorter segments toward terminals
            }
        }
    }

    addFiberRibbonSegment(start, end, radius, bundleId, myelin, segmentPhase = 0.0) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const dz = end[2] - start[2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 1e-6) return;

        const tx = dx / length;
        const ty = dy / length;
        const tz = dz / length;

        const upX = Math.abs(ty) > 0.92 ? 1 : 0;
        const upY = Math.abs(ty) > 0.92 ? 0 : 1;
        const upZ = 0;

        let sx = ty * upZ - tz * upY;
        let sy = tz * upX - tx * upZ;
        let sz = tx * upY - ty * upX;
        const sLen = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1.0;
        sx = (sx / sLen) * radius;
        sy = (sy / sLen) * radius;
        sz = (sz / sLen) * radius;

        const v0 = [start[0] + sx, start[1] + sy, start[2] + sz];
        const v1 = [start[0] - sx, start[1] - sy, start[2] - sz];
        const v2 = [end[0] + sx, end[1] + sy, end[2] + sz];
        const v3 = [end[0] - sx, end[1] - sy, end[2] - sz];

        // Two triangles per segment
        this.fibers.push(
            v0[0], v0[1], v0[2],
            v2[0], v2[1], v2[2],
            v1[0], v1[1], v1[2],
            v1[0], v1[1], v1[2],
            v2[0], v2[1], v2[2],
            v3[0], v3[1], v3[2]
        );

        for (let i = 0; i < 6; i++) {
            this.fiberMetadata.push(radius, bundleId, Math.max(0.0, Math.min(1.0, myelin)), segmentPhase);
            this.fiberPaths.push(
                start[0], start[1], start[2],
                end[0], end[1], end[2]
            );
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

    getVertexData() { return new Float32Array(this.vertices); }
    getNormalData() { return new Float32Array(this.normals); }
    getIndexData() { return new Uint32Array(this.indices); }
    getIndexCount() { return this.indices.length; }
    getFiberData() { return new Float32Array(this.fibers); }
    getFiberDataWithMetadata() { return new Float32Array(this.fiberMetadata); }
    getFiberPathData() { return new Float32Array(this.fiberPaths); }
    getSparkSourceData() { return new Float32Array(this.sparkSources); }
    getFiberVertexCount() { return this.fibers.length / 3; }
    getVertexCount() { return this.vertices.length / 3; }
    // V2.2 Getter: Soma Positions for Instancing
    getSomaPositions() { return new Float32Array(this.somaPositions); }
    // [V3.0] Per-segment metadata [radius, bundleId, myelin] — consumed by Phase 2 pipeline
    getFiberMetadata() { return new Float32Array(this.fiberMetadata); }
}

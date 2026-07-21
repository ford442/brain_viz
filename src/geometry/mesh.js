export function applyMeshMethods(Target) {
    Target.prototype.generate = function(rows, cols) {
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
    };

    Target.prototype.generateCircuitGrid = function() {
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
    };

    Target.prototype.randomPointInBrain = function() {
        for (let attempt = 0; attempt < 50; attempt++) {
    const x = (this.random() - 0.5) * 2.8;
    const y = (this.random() - 0.5) * 2.8;
    const z = (this.random() - 0.5) * 2.8;
    if (this.isInsideBrain(x, y, z)) return [x, y, z];
        }
        return [0.0, 0.0, 0.0];
    };

    Target.prototype.getCorticalBias = function(x, y, z) {
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len === 0) return 1.0;
        const sample = this.sampleCorticalSurface(x / len, y / len, z / len, true);
        const distToSurf = sample.radius - len;
        return Math.max(0.05, Math.min(1.0, Math.exp(-distToSurf * 3.5)));
    };

}

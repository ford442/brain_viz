// brain-geometry.js
// Procedural Brain Generation with Circuit Grid

export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.somaPositions = [];
    }

    generate(rows, cols) {
        // Clear previous data
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.somaPositions = [];

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

        // 2. Generate Structured Circuit Grid
        this.generateCircuitGrid();
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

                    // Try to connect to neighbors (+X, +Y, +Z)
                    // We only connect 'forward' to avoid duplicates

                    // Connect X+1
                    if (this.isInsideBrain(x + step, y, z)) {
                         // Random chance to skip connection (sparse circuit look)
                        if (Math.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x + step, y, z);
                        }
                    }

                    // Connect Y+1
                    if (this.isInsideBrain(x, y + step, z)) {
                        if (Math.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x, y + step, z);
                        }
                    }

                    // Connect Z+1
                    if (this.isInsideBrain(x, y, z + step)) {
                        if (Math.random() > 0.3) {
                            this.fibers.push(x, y, z);
                            this.fibers.push(x, y, z + step);
                        }
                    }
                }
            }
        }
    }

    getVertexData() { return new Float32Array(this.vertices); }
    getNormalData() { return new Float32Array(this.normals); }
    getIndexData() { return new Uint32Array(this.indices); }
    getIndexCount() { return this.indices.length; }
    getFiberData() { return new Float32Array(this.fibers); }
    getFiberVertexCount() { return this.fibers.length / 3; }
    getVertexCount() { return this.vertices.length / 3; }
    getSomaPositions() { return new Float32Array(this.somaPositions); }
}

// brain-geometry.js

export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
    }

    generate(rows, cols) {
        // Clear previous data
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];

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

                // Apply Brain Deformations
                // A. Longitudinal Fissure (separate hemispheres)
                // Push x inwards when close to 0
                const fissureStrength = Math.exp(-Math.abs(x) * 5.0);
                // Not strictly correct but visually approximate:
                // We want to pull X towards 0 slightly less? No, we want a gap or a dip.
                // Let's simple indent the Y/Z radius when X is small.
                const fissureIndent = 1.0 - (fissureStrength * 0.4);

                // B. Gyri/Sulci (Folds)
                // Use sine waves based on position
                const noise = Math.sin(x * 10) * Math.cos(y * 10) * Math.sin(z * 10);
                const foldHeight = 1.0 + (noise * 0.05);

                const radius = 1.5 * fissureIndent * foldHeight;

                x *= radius;
                y *= radius;
                z *= radius;

                this.vertices.push(x, y, z);

                // Normals (Approximation: from center)
                // Ideally should be computed from derivatives, but normalized pos is okay for procedural blob
                const len = Math.sqrt(x*x + y*y + z*z);
                this.normals.push(x/len, y/len, z/len);
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

        // 2. Generate Fibers (Connectome lines)
        // Just random lines inside the volume for now
        // Or connect random vertices
        const fiberCount = 500;
        for (let i = 0; i < fiberCount; i++) {
            // Pick two random points inside the sphere
            // We can pick existing vertices to ensure they touch the surface
            const idx1 = Math.floor(Math.random() * (this.vertices.length / 3));
            const idx2 = Math.floor(Math.random() * (this.vertices.length / 3));

            const p1x = this.vertices[idx1*3];
            const p1y = this.vertices[idx1*3+1];
            const p1z = this.vertices[idx1*3+2];

            const p2x = this.vertices[idx2*3];
            const p2y = this.vertices[idx2*3+1];
            const p2z = this.vertices[idx2*3+2];

            // Push pairs for line-list
            this.fibers.push(p1x, p1y, p1z);
            this.fibers.push(p2x, p2y, p2z);
        }
    }

    getVertexData() {
        return new Float32Array(this.vertices);
    }

    getNormalData() {
        return new Float32Array(this.normals);
    }

    getIndexData() {
        return new Uint32Array(this.indices);
    }

    getIndexCount() {
        return this.indices.length;
    }

    // Returns the buffer for fiber rendering
    // Expected to contain pairs of vertices for LINE_LIST
    getFiberData() {
        return new Float32Array(this.fibers);
    }

    getFiberVertexCount() {
        return this.fibers.length / 3;
    }

    getVertexCount() {
        return this.vertices.length / 3;
    }
}

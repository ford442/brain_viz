// brain-geometry.js
export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = []; // New buffer for lines
    }
    
    generate(segments = 64, rings = 32) { // Increased density for better looking fibers
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = [];
        
        // 1. Generate Base Sphere with Deformations
        for (let ring = 0; ring <= rings; ring++) {
            const theta = (ring / rings) * Math.PI;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let segment = 0; segment <= segments; segment++) {
                const phi = (segment / segments) * 2 * Math.PI;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinPhi * sinTheta;
                
                // Brain deformations
                const deform1 = Math.sin(phi * 3 + theta * 2) * 0.15;
                const deform2 = Math.cos(phi * 5 - theta * 3) * 0.1;
                const deform3 = Math.sin(phi * 7 + theta * 5) * 0.08;
                const radius = 1.0 + deform1 + deform2 + deform3;
                
                x *= radius;
                y *= radius;
                z *= radius;
                
                this.vertices.push(x, y, z);
                this.normals.push(x, y, z); // Approximate normal is just position for sphere-likes
                
                // 2. Generate Fibers (Lines)
                // For every vertex, we create a "hair" sticking out
                // We store 2 points per fiber: Root (on surface) and Tip (in air)
                // We'll calculate the Tip position in the shader to animate it
                
                // Root vertex (same as surface)
                this.fiberVertices.push(x, y, z);
                // Tip vertex (duplicate pos, we will identify it by index in shader)
                this.fiberVertices.push(x, y, z);
            }
        }
        
        // Generate indices for the solid mesh
        for (let ring = 0; ring < rings; ring++) {
            for (let segment = 0; segment < segments; segment++) {
                const first = ring * (segments + 1) + segment;
                const second = first + segments + 1;
                this.indices.push(first, second, first + 1);
                this.indices.push(second, second + 1, first + 1);
            }
        }
    }
    
    getVertexData() { return new Float32Array(this.vertices); }
    getNormalData() { return new Float32Array(this.normals); }
    getIndexData() { return new Uint32Array(this.indices); }
    getFiberData() { return new Float32Array(this.fiberVertices); } // New export
    
    getVertexCount() { return this.vertices.length / 3; }
    getIndexCount() { return this.indices.length; }
    getFiberVertexCount() { return this.fiberVertices.length / 3; } // Count of individual points
}

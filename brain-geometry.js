// brain-geometry.js
export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = [];
    }
    
    // Helper to calculate position from spherical coordinates with deformations
    getPosition(theta, phi) {
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        // Base Sphere
        let x = cosPhi * sinTheta;
        let y = cosTheta;
        let z = sinPhi * sinTheta;

        // --- Brain Shape Morphing ---
        // 1. General Scaling (Ellipsoid)
        x *= 0.85;
        z *= 1.1;

        // 2. Longitudinal Fissure
        const fissureWidth = 5.0;
        const fissureDepth = 0.2;
        let fissureEffect = Math.exp(-Math.pow(x * fissureWidth, 2));

        // 3. Radius Modulation
        let radius = 1.0;
        radius -= fissureEffect * fissureDepth * Math.max(0.0, y + 0.5);

        // 4. Gyri/Sulci (Wrinkles)
        const noiseFreq = 10.0;
        const noiseAmp = 0.03;
        const wrinkle = Math.sin(x * noiseFreq) * Math.cos(y * noiseFreq) * Math.sin(z * noiseFreq * 0.8);
        const wrinkle2 = Math.cos(x * 15.0 + y) * 0.01;

        radius += wrinkle * noiseAmp + wrinkle2;

        return {
            x: x * radius,
            y: y * radius,
            z: z * radius
        };
    }

    generate(segments = 80, rings = 50) {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = [];
        
        for (let ring = 0; ring <= rings; ring++) {
            const theta = (ring / rings) * Math.PI;
            
            for (let segment = 0; segment <= segments; segment++) {
                const phi = (segment / segments) * 2 * Math.PI;
                
                // Get current point
                const p = this.getPosition(theta, phi);
                
                // Calculate Normal using derivatives (tangents)
                // We need slightly offset points to calculate the tangent plane
                const delta = 0.01;
                const p_theta = this.getPosition(theta + delta, phi);
                const p_phi = this.getPosition(theta, phi + delta);
                
                // Tangent vectors
                const tx = p_theta.x - p.x;
                const ty = p_theta.y - p.y;
                const tz = p_theta.z - p.z;
                
                const px = p_phi.x - p.x;
                const py = p_phi.y - p.y;
                const pz = p_phi.z - p.z;
                
                // Cross product for normal
                // Normal = TangentTheta x TangentPhi (or vice versa depending on winding)
                // Standard sphere winding: Theta moves South, Phi moves East.
                // TangentTheta is "down", TangentPhi is "right". Cross(Down, Right) = Out.
                let nx = ty * pz - tz * py;
                let ny = tz * px - tx * pz;
                let nz = tx * py - ty * px;
                
                // Normalize
                const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                if (len > 0.0001) {
                    nx /= len; ny /= len; nz /= len;
                } else {
                    // Fallback for poles
                    nx = p.x; ny = p.y; nz = p.z;
                }

                this.vertices.push(p.x, p.y, p.z);
                this.normals.push(nx, ny, nz);

                // Fiber points
                this.fiberVertices.push(p.x, p.y, p.z);
                this.fiberVertices.push(p.x, p.y, p.z);
            }
        }
        
        // Indices
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
    getFiberData() { return new Float32Array(this.fiberVertices); }
    
    getVertexCount() { return this.vertices.length / 3; }
    getIndexCount() { return this.indices.length; }
    getFiberVertexCount() { return this.fiberVertices.length / 3; }
}

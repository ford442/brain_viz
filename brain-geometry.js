// Brain geometry generation
export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
    }
    
    // Generate a brain-like geometry using UV sphere with deformations
    generate(segments = 32, rings = 16) {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        
        // Create UV sphere as base
        for (let ring = 0; ring <= rings; ring++) {
            const theta = (ring / rings) * Math.PI;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);
            
            for (let segment = 0; segment <= segments; segment++) {
                const phi = (segment / segments) * 2 * Math.PI;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                
                // Base sphere coordinates
                let x = cosPhi * sinTheta;
                let y = cosTheta;
                let z = sinPhi * sinTheta;
                
                // Add brain-like deformations (bumpy surface)
                const deform1 = Math.sin(phi * 3 + theta * 2) * 0.15;
                const deform2 = Math.cos(phi * 5 - theta * 3) * 0.1;
                const deform3 = Math.sin(phi * 7 + theta * 5) * 0.08;
                
                const radius = 1.0 + deform1 + deform2 + deform3;
                
                x *= radius;
                y *= radius;
                z *= radius;
                
                // Store vertex position
                this.vertices.push(x, y, z);
                
                // Store normal (will be normalized in shader)
                this.normals.push(x, y, z);
            }
        }
        
        // Generate indices for triangle strips
        for (let ring = 0; ring < rings; ring++) {
            for (let segment = 0; segment < segments; segment++) {
                const first = ring * (segments + 1) + segment;
                const second = first + segments + 1;
                
                this.indices.push(first, second, first + 1);
                this.indices.push(second, second + 1, first + 1);
            }
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
    
    getVertexCount() {
        return this.vertices.length / 3;
    }
    
    getIndexCount() {
        return this.indices.length;
    }
}

// brain-geometry.js
export class BrainGeometry {
    constructor() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = [];
    }
    
    // Improved brain shape generator
    // Returns {x, y, z}
    getPosition(theta, phi) {
        // Sphere base:
        // theta [0, PI], phi [0, 2PI]

        // 1. Convert to cartesian on unit sphere
        let x = Math.sin(theta) * Math.cos(phi);
        let y = Math.cos(theta);
        let z = Math.sin(theta) * Math.sin(phi);

        // 2. Separate Hemispheres
        // We want a gap along the X=0 plane (or Z=0 depending on orientation).
        // Let's assume Z is forward/back, Y is up/down, X is left/right.
        // Longitudinal fissure is at X=0.

        // Apply a split. If x is close to 0, push it inwards.
        const fissureWidth = 0.15;
        const fissureDepth = 0.4;

        // Signed x to know which side we are on
        const side = Math.sign(x);

        // We model the brain roughly as two ellipsoids that touch/flatten at x=0
        // Scale to flatten slightly
        x *= 0.8;

        // Create the gap
        // We want x to be 0 at the center, but the 'fleshy' part starts at +/- gap.
        // Actually, let's use a shaping function.
        // x_new = x + sign(x) * gap ?
        // Or just indent the sphere at x=0.

        let r = 1.0;

        // Indent at the fissure (x=0)
        // High impact when x is near 0.
        const xAbs = Math.abs(x);
        const fissureIndent = Math.exp(-Math.pow(xAbs * 4.0, 2.0));
        r -= fissureIndent * fissureDepth;

        // 3. Temporal Lobes
        // Bulge at lower sides (y < 0, |x| > 0.4, z near center)
        // Let's use simple sine modulation for lobes.
        const temporal = Math.max(0, -y - 0.2) * Math.exp(-Math.pow(z, 2)) * Math.abs(x);
        r += temporal * 0.5;

        // 4. Cerebellum
        // Back bottom (z < -0.5, y < -0.2)
        // We want a bulge there.
        // Let's assume Z is forward (positive) / back (negative).
        // Standard WebGL: Camera at +Z look -Z.
        // So Z > 0 is front? Or back?
        // Let's assume standard 'Head' orientation: Y up, Z front.
        // Actually, usually Z is front in medical, but screen Z is out.
        // Let's assume sphere.

        // Cerebellum bulge at back-bottom
        // Let's say Z is Front, -Z is Back.
        // At z < -0.3 and y < -0.3
        const cerebellum = Math.max(0, -z - 0.3) * Math.max(0, -y - 0.3) * (1.0 - Math.abs(x)*0.5);
        r += cerebellum * 0.8;

        // 5. General brain shape elongation
        // Front-to-back is longer.
        z *= 1.2;

        // Apply radius modulation
        x *= r;
        y *= r;
        z *= r;

        // 6. Gyri/Sulci (Surface noise)
        // Detailed noise for wrinkles.
        // Use high frequency sine waves.
        const freq1 = 12.0;
        const freq2 = 24.0;

        const noise1 = Math.sin(x * freq1) * Math.cos(y * freq1) * Math.sin(z * freq1);
        const noise2 = Math.sin(x * freq2 + y) * Math.cos(z * freq2 + x);

        const wrinkleStrength = 0.04; // Depth of wrinkles

        // Apply wrinkles along the normal direction (roughly radial here)
        const displacement = (noise1 + noise2 * 0.5) * wrinkleStrength;

        x += x * displacement;
        y += y * displacement;
        z += z * displacement;

        return { x, y, z };
    }

    generate(segments = 120, rings = 80) {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.fiberVertices = [];
        
        for (let ring = 0; ring <= rings; ring++) {
            const theta = (ring / rings) * Math.PI; // 0 to PI
            
            for (let segment = 0; segment <= segments; segment++) {
                const phi = (segment / segments) * 2 * Math.PI; // 0 to 2PI
                
                const p = this.getPosition(theta, phi);
                
                // Calculate Normal
                const delta = 0.005;
                // We need to perturb theta/phi to find tangent plane
                const p_theta = this.getPosition(theta + delta, phi);
                const p_phi = this.getPosition(theta, phi + delta);
                
                // Vectors
                const v1 = { x: p_theta.x - p.x, y: p_theta.y - p.y, z: p_theta.z - p.z };
                const v2 = { x: p_phi.x - p.x, y: p_phi.y - p.y, z: p_phi.z - p.z };
                
                // Cross v1 x v2
                // Theta moves South, Phi moves East.
                // TangentTheta (v1) is South (down). TangentPhi (v2) is East (right).
                // South x East = Out (Normal).
                let nx = v1.y * v2.z - v1.z * v2.y;
                let ny = v1.z * v2.x - v1.x * v2.z;
                let nz = v1.x * v2.y - v1.y * v2.x;
                
                const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
                if (len > 0.00001) {
                    nx /= len; ny /= len; nz /= len;
                } else {
                    nx = 0; ny = 1; nz = 0;
                }

                this.vertices.push(p.x, p.y, p.z);
                this.normals.push(nx, ny, nz);

                // Fiber data (just copy position for now, shader handles animation)
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

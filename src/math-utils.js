// Matrix math utilities
export class Mat4 {
    static create() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }
    
    // Corrected for WebGPU depth range [0, 1]
    static perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        // WebGPU uses a 0..1 clip space for Z.
        // Column-Major:
        // f/aspect  0    0       0
        // 0         f    0       0
        // 0         0    A      -1
        // 0         0    B       0
        // where A = f/(n-f), B = nf/(n-f)
        // Array Indices (Col-Major):
        // Col 0: 0..3
        // Col 1: 4..7
        // Col 2: 8..11 -> [0, 0, A, -1]
        // Col 3: 12..15 -> [0, 0, B, 0]
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, far / (near - far), -1,
            0, 0, (far * near) / (near - far), 0
        ]);
    }
    
    static lookAt(eye, center, up) {
        const z = normalize([
            eye[0] - center[0],
            eye[1] - center[1],
            eye[2] - center[2]
        ]);
        const x = normalize(cross(up, z));
        const y = cross(z, x);
        
        // Column-Major View Matrix:
        // Col 0: [x.x, y.x, z.x, 0]
        // Col 1: [x.y, y.y, z.y, 0]
        // Col 2: [x.z, y.z, z.z, 0]
        // Col 3: [-dot(x,e), -dot(y,e), -dot(z,e), 1]

        return new Float32Array([
            x[0], y[0], z[0], 0,
            x[1], y[1], z[1], 0,
            x[2], y[2], z[2], 0,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
        ]);
    }
    
    static multiply(a, b) {
        const result = new Float32Array(16);
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 
                    a[i * 4 + 0] * b[0 * 4 + j] +
                    a[i * 4 + 1] * b[1 * 4 + j] +
                    a[i * 4 + 2] * b[2 * 4 + j] +
                    a[i * 4 + 3] * b[3 * 4 + j];
            }
        }
        
        return result;
    }

    static transpose(m) {
        return new Float32Array([
            m[0], m[4], m[8], m[12],
            m[1], m[5], m[9], m[13],
            m[2], m[6], m[10], m[14],
            m[3], m[7], m[11], m[15]
        ]);
    }
    
    static rotateY(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        
        // Column-Major (Transpose of standard):
        // Col 0: [c, 0, -s, 0]
        // Col 1: [0, 1, 0, 0]
        // Col 2: [s, 0, c, 0]
        // Col 3: [0, 0, 0, 1]

        return new Float32Array([
            c, 0, -s, 0,
            0, 1, 0, 0,
            s, 0, c, 0,
            0, 0, 0, 1
        ]);
    }
    
    static rotateX(angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        
        // Column-Major (Transpose of standard):
        // Col 0: [1, 0, 0, 0]
        // Col 1: [0, c, s, 0]
        // Col 2: [0, -s, c, 0]
        // Col 3: [0, 0, 0, 1]

        return new Float32Array([
            1, 0, 0, 0,
            0, c, s, 0,
            0, -s, c, 0,
            0, 0, 0, 1
        ]);
    }
}

function normalize(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len === 0) {
        return [0, 0, 0];
    }
    return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// [Neuro-Weaver] Advanced Easing Functions for RoutinePlayer
export const Easing = {
    linear: t => t,

    // Quadratic (Power of 2)
    quadIn: t => t * t,
    quadOut: t => t * (2 - t),
    quadInOut: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

    // Cubic (Power of 3)
    cubicIn: t => t * t * t,
    cubicOut: t => (--t) * t * t + 1,
    cubicInOut: t => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    // Sine (Trigonometric)
    sineIn: t => 1 - Math.cos(t * Math.PI / 2),
    sineOut: t => Math.sin(t * Math.PI / 2),
    sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2,

    // Back (Overshoot)
    backOut: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    // Exponential
    expoInOut: function(t) {
        if (t === 0) return 0;
        if (t === 1) return 1;
        if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
        return (2 - Math.pow(2, -20 * t + 10)) / 2;
    }
};

// [Neuro-Weaver] Spline Interpolation (Catmull-Rom)
// Evaluates a Catmull-Rom spline at parameter t [0, 1] given an array of points (values).
// The path array should contain at least 2 points.
export function evaluateSpline(path, t) {
    if (!path || path.length === 0) return 0;
    if (path.length === 1) return path[0];

    // Map t to the segment index and local segment parameter
    const segments = path.length - 1;
    const scaledT = t * segments;
    const index = Math.min(Math.floor(scaledT), segments - 1);
    const localT = scaledT - index;

    // Get the 4 control points
    const p0 = path[Math.max(0, index - 1)];
    const p1 = path[index];
    const p2 = path[Math.min(segments, index + 1)];
    const p3 = path[Math.min(segments, index + 2)];

    // Catmull-Rom interpolation formula
    const t2 = localT * localT;
    const t3 = t2 * localT;

    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * localT +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

// Small math helpers and GL program setup shared by the WebGL fallback renderer

export function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export function mix(a, b, t) {
    return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
    return t * t * (3 - 2 * t);
}

export function createDefaultParams() {
    return {
        cognitiveLoad: 0.0,
        frequency: 2.0,
        amplitude: 0.5,
        spikeThreshold: 0.8,
        smoothing: 0.9,
        style: 0.0,
        sliceZ: 2.0,
        flowSpeed: 4.0,
        colorShift: 0.0,
        sparkle: 0.0,
        growth: 1.0,
        shake: 0.0,
        aberration: 0.0,
        grain: 0.0,
        focus: 0.5,
        aperture: 0.0,
        lightDirX: 1.0,
        lightDirY: 1.0,
        lightDirZ: 1.0,
        ambientLight: 0.2,
        dirIntensity: 0.8,
        stress: 0.0,
        cortisol: 0.0,
        heavyMetal: 0.0,
        myelin_degradation: 0.0,
        fluidActive: 0.0,
        immuneActivity: 0.0,
        altitude: 0.0,
        oxygenLevel: 1.0,
        hypoxiaStress: 0.0,
        metabolicRate: 1.0,
        mitochondrialFunction: 1.0,
        fogDensity: 0.0,
        aiInfluence: 0.5,
        resonanceThreshold: 0.2,
        aiLayer: 0.0,
        pointCloudDensity: 1.0,
        fiberCoupling: 0.5,
        foldScale: 1.0,
        foldStrength: 0.16,
        fissureDepth: 0.52,
        lobeFoldBias: 1.0,
        corticalThickness: 0.11,
    };
}

export function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`WebGL program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return program;
}

export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`WebGL shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
}

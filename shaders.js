// shaders.js
// Verified Neuro-Weaver V2.1 Implementation
// Updated with volumetric tensor logic (3D Flattened Buffer), instanced rendering, and heatmap modes.
// Refactored constants and Gaussian Pulse logic.

// --- SHARED CONSTANTS ---
// These are interpolated into the shader strings.
const CONSTANTS = `
    const BRAIN_RANGE: f32 = 1.6;
    const VOXEL_DIM: u32 = 32u;
    const FLOW_SPEED: f32 = 6.0;
    const FLOW_SCALE: f32 = 0.0005;
    const CLIP_PLANE_NORMAL: vec3<f32> = vec3<f32>(0.0, 0.0, -1.0);
`;

// --- HELPER FUNCTIONS ---
const HELPERS = `
    // Gaussian Pulse for smoother stimulus
    fn gaussian_pulse(dist: f32, width: f32) -> f32 {
        let k = 4.0 / (width * width);
        return exp(-k * dist * dist);
    }
`;

export const vertexShader = `
${CONSTANTS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding1: f32,
    padding2: f32,
    clipPlane: vec4<f32>,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> voxelGrid: array<f32>;

fn getVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }

    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));

    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return voxelGrid[index];
}

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var finalPos = input.position;
    var finalNormal = input.normal;
    var finalColor = vec3<f32>(0.0);
    
    let activity = getVoxelValue(input.position);

    let worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;

    // --- CONNECTOME MODE ---
    if (uniforms.style >= 2.0 && uniforms.style < 3.0) {
        finalPos = input.position;
        let baseColor = vec3<f32>(0.05, 0.1, 0.15);
        let pulseColor = vec3<f32>(0.0, 0.8, 1.0);

        let radius = length(worldPos);
        let spatialPhase = radius * 4.0;

        let pulseWave = sin(f32(vertexIndex) * FLOW_SCALE + spatialPhase - uniforms.time * FLOW_SPEED);
        let pulse = smoothstep(0.8, 1.0, pulseWave);

        let activeGlow = mix(baseColor, pulseColor * 0.5, activity);
        let activePulse = pulseColor * pulse * activity;

        finalColor = activeGlow + activePulse;
        finalNormal = vec3<f32>(0.0, 1.0, 0.0);
    }
    // --- HEATMAP MODE ---
    else if (uniforms.style >= 3.0) {
        finalPos = input.position;
        // Thermal Gradient: Deep Blue -> Cyan -> Red-Orange
        let c1 = vec3<f32>(0.0, 0.0, 0.4);
        let c2 = vec3<f32>(0.0, 0.8, 0.8);
        let c3 = vec3<f32>(1.0, 0.2, 0.0);

        if (activity < 0.5) {
            finalColor = mix(c1, c2, activity * 2.0);
        } else {
            finalColor = mix(c2, c3, (activity - 0.5) * 2.0);
        }
    }
    // --- GHOST MODE ---
    else {
        let displacement = input.normal * activity * 0.05;
        finalPos = input.position + displacement;
        finalColor = vec3<f32>(0.2, 0.6, 1.0);
        if (uniforms.style > 0.5) { finalColor = vec3<f32>(0.0, 0.9, 0.5); }
    }

    output.position = uniforms.mvpMatrix * vec4<f32>(finalPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(finalNormal, 0.0)).xyz);
    output.color = finalColor;
    output.activity = activity;
    output.clipDist = dot(output.worldPos, uniforms.clipPlane.xyz) + uniforms.clipPlane.w;
    
    return output;
}
`;

export const fragmentShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding: vec2<f32>,
    clipPlane: vec4<f32>,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }

    if (uniforms.style >= 3.0) { return vec4<f32>(input.color, 1.0); }

    if (uniforms.style >= 2.0) {
        let alpha = 0.4 + (input.activity * 0.6);
        return vec4<f32>(input.color, alpha);
    }
    
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    let NdotV = abs(dot(normal, viewDir));
    let rim = pow(1.0 - NdotV, 3.0);
    let baseAlpha = 0.02;
    let rimAlpha = smoothstep(0.6, 1.0, rim);
    let finalAlpha = baseAlpha + rimAlpha * 0.5;

    var col = input.color;
    col += vec3<f32>(0.8) * rimAlpha;

    // Journal: "Using mix() for color based on activity looks better than additive blending."
    let activityGlowColor = vec3<f32>(0.5, 0.8, 1.0);
    let mixFactor = clamp(input.activity * 1.5 * rimAlpha, 0.0, 1.0);
    col = mix(col, activityGlowColor, mixFactor);

    return vec4<f32>(col, clamp(finalAlpha, 0.0, 1.0));
}
`;

export const sphereVertexShader = `
${CONSTANTS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding1: f32,
    padding2: f32,
    clipPlane: vec4<f32>,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) instancePos: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) clipDist: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> voxelGrid: array<f32>;

fn getVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }

    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));

    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return voxelGrid[index];
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let activity = getVoxelValue(input.instancePos);

    let scale = 0.02 + (activity * 0.08);
    let pos = (input.position * scale) + input.instancePos;

    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);

    let c1 = vec3<f32>(0.2, 0.2, 0.4);
    let c2 = vec3<f32>(1.0, 1.0, 1.0);
    output.color = mix(c1, c2, activity);
    output.clipDist = dot(output.worldPos, uniforms.clipPlane.xyz) + uniforms.clipPlane.w;

    return output;
}
`;

export const sphereFragmentShader = `
struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) clipDist: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
    return vec4<f32>(input.color, 1.0);
}
`;

export const computeShader = `
${CONSTANTS}
${HELPERS}

struct TensorParams {
    time: f32,
    voxelDim: u32,
    frequency: f32,
    amplitude: f32,
    spikeThreshold: f32,
    smoothing: f32,
    style: f32,
    padding: f32,
    stimulusPos: vec3<f32>,
    stimulusActive: f32,
}

@group(0) @binding(0) var<storage, read_write> voxelGrid: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;

fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    let dim = params.voxelDim;
    let total = dim * dim * dim;
    
    if (index >= total) { return; }

    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;

    var val = voxelGrid[index];

    let normPos = vec3<f32>(f32(x), f32(y), f32(z)) / f32(dim);
    let worldPos = (normPos * 2.0 - 1.0) * BRAIN_RANGE;

    // Region definitions
    var regionDecay = 0.96;
    var diffusionRate = 0.1;

    if (worldPos.z > 0.5) { // Frontal
        regionDecay = 0.98;
        diffusionRate = 0.15;
    } else if (worldPos.z < -0.5) { // Occipital
        regionDecay = 0.92;
        diffusionRate = 0.05;
    } else if (abs(worldPos.x) > 0.8) { // Temporal
        regionDecay = 0.95;
    } else if (worldPos.y > 0.6) { // Parietal
        regionDecay = 0.94;
        diffusionRate = 0.12;
    }

    // Diffusion
    var neighborSum = 0.0;
    var neighborCount = 0.0;
    if (x > 0u) { neighborSum += voxelGrid[getIndex(x - 1u, y, z)]; neighborCount += 1.0; }
    if (x < dim - 1u) { neighborSum += voxelGrid[getIndex(x + 1u, y, z)]; neighborCount += 1.0; }
    if (y > 0u) { neighborSum += voxelGrid[getIndex(x, y - 1u, z)]; neighborCount += 1.0; }
    if (y < dim - 1u) { neighborSum += voxelGrid[getIndex(x, y + 1u, z)]; neighborCount += 1.0; }
    if (z > 0u) { neighborSum += voxelGrid[getIndex(x, y, z - 1u)]; neighborCount += 1.0; }
    if (z < dim - 1u) { neighborSum += voxelGrid[getIndex(x, y, z + 1u)]; neighborCount += 1.0; }

    let avg = neighborSum / max(1.0, neighborCount);
    val = mix(val, avg, diffusionRate);

    // Stimulus
    if (params.stimulusActive > 0.0) {
        let dist = distance(worldPos, params.stimulusPos);
        let pulse = gaussian_pulse(dist, 0.5);
        if (pulse > 0.01) {
            val += params.stimulusActive * pulse;
        }
    }

    val *= regionDecay;
    voxelGrid[index] = clamp(val, 0.0, 1.0);
}
`;

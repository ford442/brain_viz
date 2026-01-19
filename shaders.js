// shaders.js
// Verified Neuro-Weaver V2.2 Implementation
// Updated with volumetric tensor logic (3D Flattened Buffer), instanced rendering, and heatmap modes.
// Refactored constants and Gaussian Pulse logic.

// --- SHARED CONSTANTS ---
// These are interpolated into the shader strings.
const CONSTANTS = `
    const BRAIN_RANGE: f32 = 1.6;
    const VOXEL_DIM: u32 = 32u;
    // FLOW_SPEED moved to uniforms in V2.3
    const FLOW_SCALE: f32 = 0.001;
    const CLIP_PLANE_NORMAL: vec3<f32> = vec3<f32>(0.0, 0.0, -1.0);
`;

// --- HELPER FUNCTIONS ---
const HELPERS = `
    // Gaussian Pulse for smoother stimulus
    // V2.2 Helper: Used for stimulus injection and region decay
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
    flowSpeed: f32, // V2.3: Controls pulse speed
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
// [Verified] Volumetric Data: Flattened 3D buffer representing brain activity
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
    // [Verified] Activity Trails: Pulses travel along fibers
    if (uniforms.style >= 2.0 && uniforms.style < 3.0) {
        finalPos = input.position;
        let baseColor = vec3<f32>(0.05, 0.1, 0.15);
        let pulseColor = vec3<f32>(0.0, 0.8, 1.0);

        let radius = length(worldPos);

        // Activity Trail: Combines vertex index (linear flow) with spatial radius (organic variety)
        let spatialPhase = radius * 2.0;
        let flowPhase = f32(vertexIndex) * FLOW_SCALE;

        // "Data Packet" effect: Moves along the grid lines
        // Simulates information flow by offsetting sine wave with vertex index.
        // V2.3 Verified: Uses uniform flowSpeed for dynamic control.
        let pulseWave = sin(flowPhase + spatialPhase - uniforms.time * uniforms.flowSpeed);
        let pulse = smoothstep(0.85, 1.0, pulseWave); // Sharper pulses

        let activeGlow = mix(baseColor, pulseColor * 0.5, activity);
        let activePulse = pulseColor * pulse * activity;

        finalColor = activeGlow + activePulse;
        finalNormal = vec3<f32>(0.0, 1.0, 0.0);
    }
    // --- HEATMAP MODE ---
    // [Verified] Heatmap: 3D thermal gradient (Blue->Red)
    else if (uniforms.style >= 3.0) {
        finalPos = input.position;
        // Thermal Gradient: Blue -> Green/Cyan -> Red
        let c1 = vec3<f32>(0.0, 0.0, 0.5); // Deep Blue
        let c2 = vec3<f32>(0.0, 0.9, 0.4); // Teal/Green
        let c3 = vec3<f32>(1.0, 0.2, 0.0); // Red/Orange

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

        // Style 1 (Cyber): Digital Grid
        if (uniforms.style > 0.5 && uniforms.style < 1.5) {
            finalColor = vec3<f32>(0.0, 0.9, 0.5);

            // Grid Effect: Local space grid lines
            let gridScale = 20.0;
            let g = abs(fract(input.position * gridScale) - 0.5);
            let gridLine = step(0.48, max(g.x, max(g.y, g.z)));

            if (gridLine > 0.5) {
                finalColor += vec3<f32>(0.6, 1.0, 0.8) * activity * 2.0;
            }
        }
    }

    output.position = uniforms.mvpMatrix * vec4<f32>(finalPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(finalNormal, 0.0)).xyz);
    output.color = finalColor;
    output.activity = activity;
    // V2.2 Clipping Logic: Calculate distance to plane
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
    // V2.2 Clipping: Discard pixels behind plane
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
// V2.2 Instancing Logic
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
fn main_sphere(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let activity = getVoxelValue(input.instancePos);

    // [Verified] Instanced Neurons: Somas scaled by local tensor activity
    let scale = 0.02 + (activity * 0.08);
    let pos = (input.position * scale) + input.instancePos;

    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);

    let c1 = vec3<f32>(0.2, 0.2, 0.4);
    let c2 = vec3<f32>(1.0, 1.0, 1.0);
    output.color = mix(c1, c2, activity);
    // V2.2 Clipping: Ensure instances respect the slice plane
    output.clipDist = dot(output.worldPos, uniforms.clipPlane.xyz) + uniforms.clipPlane.w;

    return output;
}
`;

export const sphereFragmentShader = `
// V2.2 Sphere Fragment
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
// V2.2 Compute Logic: Region-based diffusion and stimulus
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
    // Implicit padding (28 -> 32) aligns stimulusPos to 16 bytes.
    // V2.2 Stimulus Fields (offset 32)
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

    // Region definitions (V2.2 Tuned)
    // [Verified] Region Mapping: Anatomical regions defined by world coordinates
    var regionDecay = 0.96;
    var diffusionRate = 0.1;

    if (worldPos.z > 0.5) { // Frontal Lobe (Higher retention)
        regionDecay = 0.985;
        diffusionRate = 0.15;
    } else if (worldPos.z < -0.5) { // Occipital Lobe
        regionDecay = 0.92;
        diffusionRate = 0.05;
    } else if (abs(worldPos.x) > 0.8) { // Temporal Lobe
        regionDecay = 0.95;
    } else if (worldPos.y > 0.6) { // Parietal Lobe
        regionDecay = 0.94;
        diffusionRate = 0.12;
    }

    // Cyber Mode (Style 1): Digital signal logic (Sharper, less organic spread)
    if (abs(params.style - 1.0) < 0.1) {
        diffusionRate = 0.05; // Less diffusion = more pixelated
        regionDecay = 0.92;   // Fast digital decay
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

    // Stimulus Injection (V2.2)
    // [Verified] Stimulus: Inject gaussian pulse at target coordinate
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

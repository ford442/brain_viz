// shaders.js
// Verified Neuro-Weaver V2.6 Implementation
// [Neuro-Weaver] Updated with volumetric tensor logic (3D Flattened Buffer), instanced rendering, and heatmap modes.
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

    // [Neuro-Weaver] Refactored: Region Physics Logic (Renamed for V2.7)
    // Returns vec3(decay, diffusion, flowBias)
    // [Neuro-Weaver] Defines anatomical zones: Frontal, Occipital, Temporal, Parietal
    fn getRegionPhysics(worldPosition: vec3<f32>, style: f32) -> vec3<f32> {
        var decay = 0.96;
        var diffusion = 0.1;
        var flowBias = 0.0;

        // Frontal Lobe: High retention for complex thought
        if (worldPosition.z > 0.5) {
            decay = 0.998; // [Neuro-Weaver] V2.6: Hyper-retention for deep thought
            diffusion = 0.15;
            // [Neuro-Weaver] Directional Flow: Signals drift from Frontal towards Occipital
            flowBias = -1.0;
        }
        // Occipital Lobe: Fast processing, visual inputs
        else if (worldPosition.z < -0.5) {
            decay = 0.92;
            diffusion = 0.04;
        }
        // Temporal Lobe: Auditory/Memory
        else if (abs(worldPosition.x) > 0.8) {
            decay = 0.95;
        }
        // Parietal Lobe: Sensory integration
        else if (worldPosition.y > 0.6) {
            decay = 0.94;
            diffusion = 0.12;
        }

        // Cyber Mode (Style 1): Digital signal logic
        if (abs(style - 1.0) < 0.1) {
            diffusion = 0.05;
            decay = 0.92;
            flowBias = 0.0;
        }
        return vec3<f32>(decay, diffusion, flowBias);
    }

    // [Neuro-Weaver] Refactored: Signal Flow Logic (Renamed for V2.7)
    fn calculateSignalFlow(vertexIndex: u32, worldPos: vec3<f32>, time: f32, speed: f32, flowScale: f32) -> f32 {
        // [Neuro-Weaver] Refactored: Calculate flow along the fiber
        let fiberOffset = f32(vertexIndex) * flowScale;
        let spatialPhase = length(worldPos) * 2.0;

        // Dynamic Wave: sin(Distance - Time * Speed)
        let wave = sin(fiberOffset * 8.0 + spatialPhase - (time * speed));

        // Sharpen the wave into a pulse for better visibility
        return smoothstep(0.85, 1.0, wave);
    }

    // [Neuro-Weaver] V2.6 Helper: Heatmap Color Ramp
    fn getHeatmapColor(activity: f32) -> vec3<f32> {
        // Thermal Gradient: Blue -> Green/Cyan -> Neon Orange
        let c1 = vec3<f32>(0.0, 0.0, 0.6); // Deeper Blue
        let c2 = vec3<f32>(0.0, 0.9, 0.5); // Brighter Teal
        let c3 = vec3<f32>(1.0, 0.4, 0.0); // Neon Orange

        if (activity < 0.5) {
            return mix(c1, c2, activity * 2.0);
        } else {
            return mix(c2, c3, (activity - 0.5) * 2.0);
        }
    }
`;

export const vertexShader = `
${CONSTANTS}
${HELPERS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32, // V2.3: Controls pulse speed
    colorShift: f32, // [Phase 5] Serotonin Color Shift
    slicePlane: vec4<f32>, // [Neuro-Weaver] V2.6: Renamed from clipPlane
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
    @location(5) signal: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
// [Verified] Volumetric Data: Flattened 3D buffer representing brain activity
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;

fn getVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }

    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));

    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return activityTensor[index];
}

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var finalPos = input.position;
    var finalNormal = input.normal;
    var finalColor = vec3<f32>(0.0);
    var signalStrength = 0.0;
    
    let activity = getVoxelValue(input.position);

    let worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;

    // --- CONNECTOME MODE ---
    // [V2.3] Traveling Pulse Logic (Activity Trails)
    // [Neuro-Weaver] Simulates information flow along the axon fibers using spatial phase offset
    // Signals travel along the fibers based on vertex index and flow speed
    if (uniforms.style >= 2.0 && uniforms.style < 3.0) {
        finalPos = input.position;

        var baseColor = vec3<f32>(0.05, 0.1, 0.15); // Dark Blue Base
        var pulseColor = vec3<f32>(0.0, 0.8, 1.0); // Cyan Pulse

        // [Phase 5] Serotonin Color Shift (Blue -> Gold/Red)
        if (uniforms.colorShift > 0.0) {
             let warmBase = vec3<f32>(0.2, 0.05, 0.05); // Deep Red
             let warmPulse = vec3<f32>(1.0, 0.8, 0.2); // Gold
             baseColor = mix(baseColor, warmBase, uniforms.colorShift);
             pulseColor = mix(pulseColor, warmPulse, uniforms.colorShift);
        }

        // [Neuro-Weaver] Refactored: Use helper function calculateSignalFlow
        signalStrength = calculateSignalFlow(vertexIndex, worldPos, uniforms.time, uniforms.flowSpeed, FLOW_SCALE);

        // Blend based on activity
        // Glow is the resting state activity
        let glow = mix(baseColor, pulseColor * 0.5, activity);
        // Flash is the moving signal pulse
        let flash = pulseColor * signalStrength * activity;

        finalColor = glow + flash;
        finalNormal = vec3<f32>(0.0, 1.0, 0.0);
    }
    // --- HEATMAP MODE ---
    // [V2.3] Volumetric Heatmap Style
    // [Neuro-Weaver] Style 3.0: Volumetric Temperature Gradient
    // Renders the brain surface using a thermal color ramp derived from volumetric activity
    else if (uniforms.style >= 3.0) {
        finalPos = input.position;
        // [Neuro-Weaver] V2.6 Refactor: Use helper for Heatmap Color
        finalColor = getHeatmapColor(activity);

        // [Phase 5] Heatmap Color Shift
        if (uniforms.colorShift > 0.0) {
             let warmShift = vec3<f32>(1.0, 0.5, 0.0);
             finalColor = mix(finalColor, warmShift, uniforms.colorShift * activity * 0.8);
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
    output.signal = signalStrength;
    // [V2.3] Clipping Logic: Calculate distance to plane
    // [Neuro-Weaver] Refactored: Renamed planeDist to sliceDepth for clarity
    // Clipping Logic: Dot product determines side of the plane
    // [Neuro-Weaver] V2.6: Use slicePlane
    let planeNormal = uniforms.slicePlane.xyz;
    let sliceDepth = uniforms.slicePlane.w;
    output.clipDist = dot(output.worldPos, planeNormal) + sliceDepth;
    
    return output;
}
`;

export const fragmentShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32, // [Phase 5]
    slicePlane: vec4<f32>, // [Neuro-Weaver] V2.6: Renamed from clipPlane
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
    @location(5) signal: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // V2.2 Clipping: Discard pixels behind plane
    if (input.clipDist < 0.0) { discard; }

    // [Neuro-Weaver] Style 3.0: Return Heatmap Color (calculated in Vertex Shader)
    // Renders the volumetric thermal gradient based on tensor activity
    if (uniforms.style >= 3.0) { return vec4<f32>(input.color, 1.0); }

    if (uniforms.style >= 2.0) {
        // [Neuro-Weaver] Style 2.0: Translucent Fibers with activity glow
        // Opacity Modulation: Pulse ripples through transparency
        let alpha = 0.3 + (input.activity * 0.2) + (input.signal * 0.8);
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

export const somaVertexShader = `
// [V2.3] Instanced Soma Logic (Neurons)
${CONSTANTS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32, // [Phase 5]
    slicePlane: vec4<f32>, // [Neuro-Weaver] V2.6: Renamed from clipPlane
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
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;

fn getVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }

    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));

    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return activityTensor[index];
}

@vertex
fn main_soma(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let activity = getVoxelValue(input.instancePos);

    // [Verified] Instanced Neurons: Somas scaled by local tensor activity
    // [Neuro-Weaver] Reactive scaling to visualize firing intensity (0.02 base + activity)
    let scale = 0.02 + (activity * 0.12);
    let pos = (input.position * scale) + input.instancePos;

    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);

    var c1 = vec3<f32>(0.2, 0.2, 0.4);
    var c2 = vec3<f32>(1.0, 1.0, 1.0);

    // [Phase 5] Soma Color Shift
    if (uniforms.colorShift > 0.0) {
        c1 = mix(c1, vec3<f32>(0.4, 0.1, 0.1), uniforms.colorShift); // Reddish
        c2 = mix(c2, vec3<f32>(1.0, 0.9, 0.5), uniforms.colorShift); // Gold
    }

    output.color = mix(c1, c2, activity);
    // V2.2 Clipping: Ensure instances respect the slice plane
    // [Neuro-Weaver] Refactored: Use explicit sliceDepth
    // [Neuro-Weaver] V2.6: Use slicePlane
    let planeNormal = uniforms.slicePlane.xyz;
    let sliceDepth = uniforms.slicePlane.w;
    output.clipDist = dot(output.worldPos, planeNormal) + sliceDepth;

    return output;
}
`;

export const somaFragmentShader = `
// [V2.3] Soma Fragment Shader
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

@group(0) @binding(0) var<storage, read_write> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;

fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    // [V2.5] Compute Physics
    let index = globalId.x;
    let dim = params.voxelDim;
    let total = dim * dim * dim;
    
    if (index >= total) { return; }

    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;

    var val = activityTensor[index];

    let normalizedPosition = vec3<f32>(f32(x), f32(y), f32(z)) / f32(dim);
    let worldPosition = (normalizedPosition * 2.0 - 1.0) * BRAIN_RANGE;

    // [V2.5] Region Mapping Implementation
    // Defines anatomical zones for varying signal decay and diffusion properties.
    // [Neuro-Weaver] Refactored: Use helper function
    let physics = getRegionPhysics(worldPosition, params.style);
    let decay = physics.x;
    let diffusion = physics.y;
    let flowBias = physics.z;

    // [Neuro-Weaver V2.8] Diffusion Step (6-Neighbor Laplacian)
    var neighborSum = 0.0;
    var neighborCount = 0.0;

    // X-Axis Neighbors
    if (x > 0u) { neighborSum += activityTensor[getIndex(x - 1u, y, z)]; neighborCount += 1.0; }
    if (x < dim - 1u) { neighborSum += activityTensor[getIndex(x + 1u, y, z)]; neighborCount += 1.0; }

    // Y-Axis Neighbors
    if (y > 0u) { neighborSum += activityTensor[getIndex(x, y - 1u, z)]; neighborCount += 1.0; }
    if (y < dim - 1u) { neighborSum += activityTensor[getIndex(x, y + 1u, z)]; neighborCount += 1.0; }

    // Z-Axis Neighbors
    if (z > 0u) { neighborSum += activityTensor[getIndex(x, y, z - 1u)]; neighborCount += 1.0; }
    if (z < dim - 1u) { neighborSum += activityTensor[getIndex(x, y, z + 1u)]; neighborCount += 1.0; }

    // [Neuro-Weaver] Directional Flow Logic
    // If flowBias is negative, pull signal from 'upstream' (Frontal/Z+)
    if (flowBias < -0.1) {
        if (z < dim - 1u) {
            let upstream = activityTensor[getIndex(x, y, z + 1u)];
            // Add weighted upstream influence to the average
            neighborSum += upstream * 2.5;
            neighborCount += 2.5;
        }
    }

    let avg = neighborSum / max(1.0, neighborCount);
    val = mix(val, avg, diffusion);

    // [Neuro-Weaver] 2. Stimulus Injection
    // Direct voxel manipulation from CPU events (injected via uniforms)
    if (params.stimulusActive > 0.0) {
        // Calculate distance from stimulus center
        let d = distance(worldPosition, params.stimulusPos);
        // Use wider Gaussian for more organic impact
        let signal = gaussian_pulse(d, 0.5);

        // Accumulate signal if above threshold
        if (signal > 0.01) {
            val += params.stimulusActive * signal;
        }
    }

    val *= decay;
    activityTensor[index] = clamp(val, 0.0, 1.0);
}
`;

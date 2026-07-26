import { CONSTANTS, HELPERS } from './shared.js';

export const somaVertexShader = `
// [V3.1] Instanced Soma Logic with hierarchical types, elongation, and firing spikes
${CONSTANTS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32,
    dopamineTrails: f32,
    slicePlane: vec4<f32>,
    sparkle: f32,
    growth: f32,
    aberration: f32,
    grain: f32,
    focus: f32,
    aperture: f32,
    lightDir: vec3<f32>,
    ambientLight: f32,
    dirIntensity: f32,
    stress: f32,
    cortisol: f32,
    altitude: f32,
    oxygenLevel: f32,
    hypoxiaStress: f32,
    metabolicRate: f32,
    mitochondrialFunction: f32,
    fogDensity: f32,
    zoom: f32,
    heavyMetal: f32,
    fluidActive: f32,
    aiInfluence: f32,
    resonanceThreshold: f32,
    synaptiXActive: f32,
    aiLayer: f32,
    pointCloudDensity: f32,
    fiberCoupling: f32,
    connectomeVariant: f32,
    tmsActive: f32,
    tmsCenter: vec3<f32>,
    tmsPulse: f32,
    tmsRadius: f32,
    edgeDetection: f32,
    pulseSaturation: f32,
    trailLength: f32,
    lesionCenter: vec3<f32>,
    lesionActive: f32,
    lesionRadius: f32,
    decimation: f32,
    psychedelic: f32,
    immuneActivity: f32,
    plasticityDecay: f32,
    visualFatigue: f32,
    sensoryDeprivation: f32,
    spatialMemory: f32,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) instancePos: vec3<f32>,
    @location(2) instanceMeta: vec4<f32>, // baseScale, typeId, bundleId, phase
    @location(3) instanceShape: vec2<f32>, // shapeSeed, elongation
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) clipDist: f32,
    @location(3) normal: vec3<f32>,
    @location(4) instanceCenter: vec3<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;

fn getVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }
    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));
    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return activityTensor[index];
}

fn sampleSmoothedVoxelValue(worldPos: vec3<f32>) -> f32 {
    let step = (BRAIN_RANGE / f32(VOXEL_DIM)) * 0.45;
    let center = getVoxelValue(worldPos);
    let neighbors =
        getVoxelValue(worldPos + vec3<f32>( step, 0.0, 0.0)) +
        getVoxelValue(worldPos + vec3<f32>(-step, 0.0, 0.0)) +
        getVoxelValue(worldPos + vec3<f32>(0.0,  step, 0.0)) +
        getVoxelValue(worldPos + vec3<f32>(0.0, -step, 0.0)) +
        getVoxelValue(worldPos + vec3<f32>(0.0, 0.0,  step)) +
        getVoxelValue(worldPos + vec3<f32>(0.0, 0.0, -step));
    return (center * 0.5) + (neighbors * (0.5 / 6.0));
}

fn getAIVoxelValue(worldPos: vec3<f32>) -> f32 {
    let normPos = (worldPos / BRAIN_RANGE) * 0.5 + 0.5;
    if (any(normPos < vec3<f32>(0.0)) || any(normPos > vec3<f32>(1.0))) { return 0.0; }
    let x = u32(normPos.x * f32(VOXEL_DIM));
    let y = u32(normPos.y * f32(VOXEL_DIM));
    let z = u32(normPos.z * f32(VOXEL_DIM));
    let index = min(z, VOXEL_DIM-1u) * VOXEL_DIM * VOXEL_DIM + min(y, VOXEL_DIM-1u) * VOXEL_DIM + min(x, VOXEL_DIM-1u);
    return aiTensor[index];
}

fn sampleSmoothedAIVoxelValue(worldPos: vec3<f32>) -> f32 {
    let step = (BRAIN_RANGE / f32(VOXEL_DIM)) * 0.45;
    let center = getAIVoxelValue(worldPos);
    let neighbors =
        getAIVoxelValue(worldPos + vec3<f32>( step, 0.0, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(-step, 0.0, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0,  step, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, -step, 0.0)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, 0.0,  step)) +
        getAIVoxelValue(worldPos + vec3<f32>(0.0, 0.0, -step));
    return (center * 0.5) + (neighbors * (0.5 / 6.0));
}

@vertex
fn main_soma(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let baseScale = input.instanceMeta.x;
    let typeId = input.instanceMeta.y;
    let bundleId = input.instanceMeta.z;
    let phase = input.instanceMeta.w;
    let shapeSeed = input.instanceShape.x;
    let isAI = bundleId >= 100.0;

    var advectedInstancePos = input.instancePos;
    if (uniforms.fluidActive > 0.0) {
        let timeSpeed = uniforms.time * 2.0;
        let flowVelocity = vec3<f32>(
            sin(input.instancePos.y * 3.0 + timeSpeed) * cos(input.instancePos.z * 2.0 - timeSpeed),
            cos(input.instancePos.x * 3.0 - timeSpeed) * sin(input.instancePos.z * 2.0 + timeSpeed),
            sin(input.instancePos.x * 2.0 + timeSpeed) * cos(input.instancePos.y * 3.0 - timeSpeed)
        ) * 0.5 * uniforms.fluidActive;
        advectedInstancePos = input.instancePos + flowVelocity;
    }


    // TMS Distortion
    if (uniforms.tmsActive > 0.0) {
        let dist = distance(advectedInstancePos, uniforms.tmsCenter);
        let radius = uniforms.tmsRadius;
        let falloff = exp(-(dist * dist) / (radius * radius));
        let pull = normalize(advectedInstancePos - uniforms.tmsCenter + vec3<f32>(0.001));
        let twist = cross(pull, vec3<f32>(0.0, 1.0, 0.0));
        let distortion = (pull * 0.1 + twist * 0.15) * falloff * uniforms.tmsPulse;
        advectedInstancePos = advectedInstancePos + distortion;
    }

    let activity = sampleSmoothedVoxelValue(advectedInstancePos);
    let aiActivity = sampleSmoothedAIVoxelValue(advectedInstancePos);

    // Dynamic scale: base + activity burst + pulse
    var scale = baseScale;
    let peakActivity = max(activity, aiActivity * 0.9);
    let firing = peakActivity * 3.0;
    let firingSpike = smoothstep(0.5, 0.98, peakActivity);
    let pulse = 1.0 + (0.22 + firingSpike * 0.28) * sin(uniforms.time * 6.0 + phase) * peakActivity;
    scale *= (1.0 + firing + firingSpike * 0.85) * pulse;

    if (typeId < 0.5) { scale *= 1.5; }
    else if (typeId < 1.5) { scale *= 1.0; }
    else { scale *= 0.6; }

    scale *= (0.82 + min(uniforms.pointCloudDensity, 2.0) * 0.18);

    if (length(advectedInstancePos) > uniforms.growth * 1.8) {
        scale = 0.0;
    }
    if (uniforms.cortisol > 0.0) {
        let decayFactor = 1.0 - (uniforms.cortisol * 0.8);
        scale *= max(0.0, decayFactor);
    }

    if (uniforms.plasticityDecay > 0.0) {
        let decayFactor = 1.0 - (uniforms.plasticityDecay * 0.5);
        scale *= max(0.0, decayFactor);
    }

    if (uniforms.sensoryDeprivation > 0.0) {
        let distToOrigin = length(advectedInstancePos);
        let voidRadius = uniforms.sensoryDeprivation * 1.5;
        if (distToOrigin < voidRadius) {
            scale = 0.0;
        }
    }

    // Elongation for pyramidal / interneuron shape variation
    let theta = shapeSeed * 6.28318;
    let phi = shapeSeed * 12.566;
    let axis = vec3<f32>(sin(phi)*cos(theta), sin(phi)*sin(theta), cos(phi));
    let elongation = select(0.0, 0.65, typeId < 1.5);
    let localPos = input.position + axis * dot(input.position, axis) * elongation;

    let pos = (localPos * scale) + advectedInstancePos;

    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(localPos, 0.0)).xyz);
    output.instanceCenter = (uniforms.modelMatrix * vec4<f32>(advectedInstancePos, 1.0)).xyz;

    var color: vec3<f32>;
    if (uniforms.style >= 4.0) {
        if (isAI) {
            color = vec3<f32>(0.85, 0.25, 0.95) * (0.45 + peakActivity);
            color += vec3<f32>(1.0, 0.6, 0.9) * (aiActivity * 0.8 + firingSpike * 0.3);
        } else {
            color = vec3<f32>(0.1, 0.75, 1.0) * (0.45 + peakActivity);
            color += vec3<f32>(0.6, 0.9, 1.0) * (activity * 0.5 + firingSpike * 0.25);
        }
        let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, abs(activity - aiActivity));
        color += vec3<f32>(1.0, 0.92, 0.55) * resonance * max(activity, aiActivity) * 1.5;
    } else {
        color = mix(vec3<f32>(0.2, 0.2, 0.4), vec3<f32>(1.0, 1.0, 1.0), activity);
        if (isAI) {
            color = mix(vec3<f32>(0.6, 0.1, 0.6), vec3<f32>(1.0, 0.4, 0.95), activity);
        }
        if (typeId < 0.5) {
            color = mix(vec3<f32>(0.5, 0.55, 0.7), color, 0.6);
        } else if (typeId > 1.5) {
            color = mix(vec3<f32>(0.8, 0.85, 0.9), color, 0.4);
        }
    }

    if (peakActivity > 0.68) {
        color += vec3<f32>(1.0, 0.95, 0.8) * (peakActivity - 0.68) * 3.8;
    }

    if (uniforms.sparkle > 0.0 && activity > 0.1) {
         let noise = fract(sin(dot(input.instancePos.zx, vec2(34.123, 19.33))) * 12345.67);
         let flash = step(0.95 - (uniforms.sparkle * 0.2), sin(uniforms.time * 40.0 + noise * 10.0));
         color += vec3<f32>(0.8, 0.9, 1.0) * flash * uniforms.sparkle;
    }

    output.color = color;
    let planeNormal = uniforms.slicePlane.xyz;
    let sliceDepth = uniforms.slicePlane.w;
    output.clipDist = dot(output.worldPos, planeNormal) + sliceDepth;

    return output;
}
`;

export const somaFragmentShader = `
// [V3.1] Soma Fragment Shader with rim lighting and fog
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32,
    dopamineTrails: f32,
    slicePlane: vec4<f32>,
    sparkle: f32,
    growth: f32,
    aberration: f32,
    grain: f32,
    focus: f32,
    aperture: f32,
    lightDir: vec3<f32>,
    ambientLight: f32,
    dirIntensity: f32,
    stress: f32,
    cortisol: f32,
    altitude: f32,
    oxygenLevel: f32,
    hypoxiaStress: f32,
    metabolicRate: f32,
    mitochondrialFunction: f32,
    fogDensity: f32,
    zoom: f32,
    heavyMetal: f32,
    fluidActive: f32,
    aiInfluence: f32,
    resonanceThreshold: f32,
    synaptiXActive: f32,
    aiLayer: f32,
    pointCloudDensity: f32,
    fiberCoupling: f32,
    connectomeVariant: f32,
    tmsActive: f32,
    tmsCenter: vec3<f32>,
    tmsPulse: f32,
    tmsRadius: f32,
    edgeDetection: f32,
    pulseSaturation: f32,
    trailLength: f32,
    lesionCenter: vec3<f32>,
    lesionActive: f32,
    lesionRadius: f32,
    decimation: f32,
    psychedelic: f32,
    immuneActivity: f32,
    plasticityDecay: f32,
    visualFatigue: f32,
    sensoryDeprivation: f32,
    spatialMemory: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) clipDist: f32,
    @location(3) normal: vec3<f32>,
    @location(4) instanceCenter: vec3<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }



    let N = normalize(input.normal);
    let V = normalize(vec3<f32>(0.0, 0.0, uniforms.zoom) - input.worldPos);
    let rim = pow(1.0 - max(0.0, dot(N, V)), 2.5);
    let L = normalize(uniforms.lightDir);
    let ndotl = max(0.0, dot(N, L));
    let lit = input.color * (uniforms.ambientLight + ndotl * uniforms.dirIntensity * 0.8) + input.color * rim * 0.55;

    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let depth = length(input.worldPos - cameraPos);
    let fogFactor = exp(-uniforms.fogDensity * depth * 0.5);
    let fogColor = vec3<f32>(0.02, 0.02, 0.05);
    var col = mix(fogColor, lit, clamp(fogFactor, 0.0, 1.0));

    if (uniforms.lesionActive > 0.0) {
        let dist = distance(input.worldPos, uniforms.lesionCenter);
        if (dist < uniforms.lesionRadius) {
            let lesionFactor = (1.0 - (dist / uniforms.lesionRadius)) * uniforms.lesionActive;
            col = mix(col, vec3<f32>(0.1, 0.1, 0.1), lesionFactor);
        }
    }
    return vec4<f32>(col, 1.0);
}
`;


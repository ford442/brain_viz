// src/shaders/pointcloud-render.js
// [Neuro-Weaver] Dense point-cloud (billboard bouton/varicosity) shaders.
// Split out of the former monolithic shaders.js.
import { CONSTANTS } from './render-shared.js';

export const pointCloudVertexShader = `
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
    lightDir: vec3<f32>,
    ambientLight: f32,
    dirIntensity: f32,
    stress: f32,
    cortisol: f32,
    focus: f32,
    aperture: f32,
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
    apoptosis: f32,
    particleSpeed: f32,
}

struct VertexInput {
    @location(0) corner: vec2<f32>,
    @location(1) instancePos: vec3<f32>,
    @location(2) instanceMeta: vec4<f32>, // baseScale, typeId, bundleId, phase
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
    @location(4) pointData: vec4<f32>,
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
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    let baseScale = input.instanceMeta.x;
    let typeId = input.instanceMeta.y;
    let bundleId = input.instanceMeta.z;
    let phase = input.instanceMeta.w;
    let isAI = bundleId >= 100.0;

    var pos = input.instancePos;
    if (uniforms.fluidActive > 0.0) {
        let timeSpeed = uniforms.time * 2.0;
        let flowVelocity = vec3<f32>(
            sin(pos.y * 3.0 + timeSpeed) * cos(pos.z * 2.0 - timeSpeed),
            cos(pos.x * 3.0 - timeSpeed) * sin(pos.z * 2.0 + timeSpeed),
            sin(pos.x * 2.0 + timeSpeed) * cos(pos.y * 3.0 - timeSpeed)
        ) * 0.5 * uniforms.fluidActive;
        pos = pos + flowVelocity;
    }

    let activity = sampleSmoothedVoxelValue(pos);
    let aiActivity = sampleSmoothedAIVoxelValue(pos);

    let densityScale = 0.55 + min(uniforms.pointCloudDensity, 2.0) * 0.45;
    var scale = baseScale * densityScale;
    let peakActivity = max(activity, aiActivity * 0.95);
    let firing = peakActivity * 2.7;
    let firingSpike = smoothstep(0.48, 0.98, peakActivity);
    let pulse = 1.0 + (0.18 + firingSpike * 0.52) * sin(uniforms.time * (8.0 + typeId) + phase) * peakActivity;
    scale *= (1.0 + firing + firingSpike * 1.2) * pulse;

    if (typeId > 4.5) {
        scale *= 0.78;
    } else if (typeId > 3.5) {
        scale *= 0.92;
    }

    if (length(pos) > uniforms.growth * 1.8) {
        scale = 0.0;
    }

    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let viewDir = normalize(cameraPos - pos);
    let up = vec3<f32>(0.0, 1.0, 0.0);
    var side = cross(viewDir, up);
    if (length(side) < 0.001) {
        side = vec3<f32>(1.0, 0.0, 0.0);
    }
    side = normalize(side);
    let trueUp = normalize(cross(viewDir, side));

    let offset = side * input.corner.x * scale + trueUp * input.corner.y * scale;
    let worldPos = pos + offset;

    let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold + 0.025, abs(activity - aiActivity));
    var color: vec3<f32>;
    if (uniforms.style >= 4.0) {
        if (isAI) {
            color = vec3<f32>(0.72, 0.16, 1.0) * (0.35 + peakActivity);
            color += vec3<f32>(1.0, 0.4, 0.92) * (aiActivity * 0.95 + firingSpike * 0.45);
        } else {
            color = vec3<f32>(0.08, 0.62, 1.0) * (0.35 + peakActivity);
            color += vec3<f32>(0.6, 0.94, 1.0) * (activity * 0.8 + firingSpike * 0.35);
        }
        color += vec3<f32>(1.0, 0.96, 0.72) * resonance * max(activity, aiActivity) * 1.85;
    } else {
        if (isAI) {
            color = mix(vec3<f32>(0.5, 0.1, 0.55), vec3<f32>(0.95, 0.4, 1.0), activity);
        } else {
            let warmShift = uniforms.colorShift;
            color = mix(vec3<f32>(0.1, 0.55, 0.75), vec3<f32>(0.75, 0.9, 1.0), activity);
            color = mix(color, vec3<f32>(1.0, 0.7, 0.4), warmShift * activity);
        }
        if (typeId > 3.5) {
            color = mix(color, vec3<f32>(0.95, 0.85, 0.6), 0.35); // varicosity tint
        }
        if (typeId > 4.5) {
            color = mix(color, vec3<f32>(0.95, 0.98, 1.0), 0.2);
        }
    }

    if (peakActivity > 0.6) {
        color += vec3<f32>(1.0, 0.95, 0.85) * (peakActivity - 0.6) * 3.5;
    }

    var alpha = clamp(0.18 + peakActivity * 0.72 + firingSpike * 0.35 + resonance * 0.22, 0.0, 1.0);
    if (typeId > 4.5) {
        alpha *= 0.85;
    }
    if (isAI) { alpha *= 0.96; }

    output.position = uniforms.mvpMatrix * vec4<f32>(worldPos, 1.0);
    output.color = color;
    output.uv = input.corner;
    output.alpha = alpha;
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    output.pointData = vec4<f32>(typeId, select(0.0, 1.0, isAI), resonance, firingSpike);
    return output;
}
`;

export const pointCloudFragmentShader = `
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
    lightDir: vec3<f32>,
    ambientLight: f32,
    dirIntensity: f32,
    stress: f32,
    cortisol: f32,
    focus: f32,
    aperture: f32,
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
    apoptosis: f32,
    particleSpeed: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
    @location(4) pointData: vec4<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
    let d = length(input.uv);
    let typeId = input.pointData.x;
    let isAI = input.pointData.y;
    let resonance = input.pointData.z;
    let firingSpike = input.pointData.w;

    let softFalloff = exp(-d * d * 5.5);
    let beadCore = pow(max(0.0, 1.0 - d), 3.5);
    let arborHalo = exp(-d * d * 2.6);
    let aiDiamond = pow(max(0.0, 1.0 - max(abs(input.uv.x), abs(input.uv.y))), 5.0);
    let aiStar = pow(max(0.0, 1.0 - (abs(input.uv.x) + abs(input.uv.y)) * 0.92), 8.0);

    var falloff = mix(softFalloff, beadCore, 0.25);
    if (typeId > 3.5 && typeId <= 4.5) {
        falloff = mix(softFalloff, beadCore, 0.65);
    } else if (typeId > 4.5) {
        falloff = mix(softFalloff, arborHalo, 0.55) + beadCore * 0.25;
    }
    if (isAI > 0.5) {
        falloff = mix(falloff, aiDiamond + aiStar * 0.6, 0.72);
    }

    let flare = 1.0 + firingSpike * 0.55 + resonance * 0.4;
    let col = input.color * falloff * flare;
    return vec4<f32>(col, clamp(input.alpha * falloff * (0.9 + resonance * 0.2), 0.0, 1.0));
}
`;

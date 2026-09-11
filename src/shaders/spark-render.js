// src/shaders/spark-render.js
// [Neuro-Weaver] Synaptic spark/particle shaders.
// Split out of the former monolithic shaders.js.
import { CONSTANTS, HELPERS } from './render-shared.js';

export const sparkVertexShader = `
${CONSTANTS}
${HELPERS}

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
    apoptosis: f32,
    particleSpeed: f32,
}

struct SparkInput {
    @location(0) corner: vec2<f32>,
    @location(1) anchorPhase: vec4<f32>,
    @location(2) tangentStrength: vec4<f32>,
    @location(3) material: vec4<f32>,
}

struct SparkOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;

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
fn main(input: SparkInput) -> SparkOutput {
    var output: SparkOutput;

    let anchor = input.anchorPhase.xyz;
    let tangent = normalize(input.tangentStrength.xyz);
    let strength = input.tangentStrength.w;
    let bundleId = input.material.x;
    let myelin = clamp(input.material.y, 0.0, 1.0);
    let kind = input.material.z;

    // [SynaptiX] Particle kinds:
    //   kind 0.0 = standard organic spark (cyan-white)
    //   kind 1.0 = fiber midpoint spark (warm)
    //   kind 2.0 = human vesicle (deep blue-cyan, slow)
    //   kind 3.0 = AI quanta (bright magenta-orange, fast)
    //   kind 4.0 = fusion burst (white-gold, intense)
    var sparkTint: vec3<f32>;
    var speedMul: f32 = 1.0;
    var sizeMul: f32 = 1.0;
    if (kind > 3.5) {
        sparkTint = vec3<f32>(1.0, 0.95, 0.7);
        speedMul = 0.6;
        sizeMul = 1.6;
    } else if (kind > 2.5) {
        sparkTint = vec3<f32>(1.0, 0.35, 0.85);
        speedMul = 2.2;
        sizeMul = 0.75;
    } else if (kind > 1.5) {
        sparkTint = vec3<f32>(0.15, 0.55, 1.0);
        speedMul = 0.7;
        sizeMul = 1.2;
    } else {
        sparkTint = mix(vec3<f32>(0.2, 0.9, 1.0), vec3<f32>(1.0, 0.75, 0.25), clamp(kind * 0.5 + bundleId * 0.05, 0.0, 1.0));
    }

    let localActivity = sampleSmoothedVoxelValue(anchor);
    let pulseSpeed = uniforms.flowSpeed * mix(0.55, 1.25, localActivity + uniforms.fluidActive * 0.2);
    let travel = (fract(uniforms.time * pulseSpeed * speedMul + input.anchorPhase.w + bundleId * 0.071) - 0.5);
    let trailScale = mix(0.10, 0.34, localActivity) * mix(0.8, 1.25, strength);
    let center = anchor + tangent * (travel * trailScale);

    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let viewDir = normalize(cameraPos - center);
    var side = cross(viewDir, tangent);
    if (length(side) < 0.001) {
        side = cross(vec3<f32>(0.0, 1.0, 0.0), tangent);
    }
    side = normalize(side);
    let up = normalize(cross(tangent, side));

    let size = mix(0.014, 0.052, strength) * mix(0.75, 1.35, myelin) * sizeMul;
    let offset = side * input.corner.x * size + up * input.corner.y * size;
    let worldPos = center + offset;

    let thermal = getHeatmapColor(clamp(localActivity * 1.1 + strength * 0.35, 0.0, 1.0));
    var finalAlpha = clamp((0.14 + localActivity * 0.55 + strength * 0.3) * mix(0.7, 1.2, myelin) * sizeMul, 0.08, 1.0);
    if (uniforms.style >= 4.0) {
        // localActivity is compute-blended composite; aiRaw is raw AI
        let aiRaw = sampleSmoothedAIVoxelValue(anchor);
        let diff = abs(localActivity - aiRaw);
        let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, diff);
        if (kind > 3.5) {
            // Fusion burst: only ignites at resonant voxels and pulses brighter than baseline sparks.
            let pulse = 0.45 + 0.55 * sin(uniforms.time * 7.5 + bundleId * 1.37 + input.anchorPhase.w * 6.28318);
            let burst = resonance * pulse;
            output.color = vec3<f32>(1.0, 0.95, 0.55) * (0.18 + burst * 2.8);
            finalAlpha = max(0.0, burst) * clamp(0.25 + strength * 0.8, 0.0, 1.0);
        } else if (kind > 2.5) {
            output.color = sparkTint * localActivity;
        } else if (kind > 1.5) {
            output.color = sparkTint * localActivity;
        } else {
            var mixedColor = vec3<f32>(0.0, 0.85, 1.0) * localActivity;
            mixedColor = mix(mixedColor, vec3<f32>(1.0, 0.0, 0.85) * localActivity, aiRaw * 0.7);
            output.color = mixedColor;
        }
    } else {
        output.color = thermal * sparkTint;
    }
    output.uv = input.corner;
    output.alpha = finalAlpha;
    output.position = uniforms.mvpMatrix * vec4<f32>(worldPos, 1.0);
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    return output;
}
`;

export const sparkFragmentShader = `
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
    apoptosis: f32,
    particleSpeed: f32,
}

struct SparkInput {
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@fragment
fn main(input: SparkInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }

    let falloff = exp(-dot(input.uv, input.uv) * 3.8);
    let core = pow(max(0.0, 1.0 - length(input.uv)), 2.2);
    let glow = mix(falloff, core, 0.45);
    let color = input.color * (0.35 + glow * 1.25);
    return vec4<f32>(color, clamp(input.alpha * glow, 0.0, 1.0));
}
`;


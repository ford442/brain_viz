import { CONSTANTS, HELPERS } from './shared.js';

export const postVertexShader = `
@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0)
    );
    return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}
`;

export const postFragmentShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32,
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
    // Altitude/Hypoxia Parameters
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
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var tDiffuse: texture_2d<f32>;
@group(0) @binding(2) var sDiffuse: sampler;
@group(0) @binding(3) var tDepth: texture_depth_2d;

@fragment
fn main(@builtin(position) position: vec4<f32>) -> @location(0) vec4<f32> {
    let uv = position.xy / vec2<f32>(textureDimensions(tDiffuse));

    // [Phase 7] Depth of Field Logic
    let coords = vec2<i32>(position.xy);
    let depth = textureLoad(tDepth, coords, 0);

    // Calculate Circle of Confusion
    let coc = abs(depth - uniforms.focus);
    let blurAmount = coc * uniforms.aperture * 10.0 + uniforms.visualFatigue * 15.0;

    // Chromatic Aberration
    var offset = uniforms.aberration * 0.01;
    let center = vec2<f32>(0.5, 0.5);
    let dist = distance(uv, center);
    offset *= dist * 2.0;

    var color = vec3<f32>(0.0);

    // WGSL uniform control flow fix: Compute all samples, then blend

    // Simple Box Blur with Spread
    let spread = blurAmount * 0.01;
    var accum = vec3<f32>(0.0);
    var totalWeight = 0.0;

    // 9-tap kernel
    for(var i = -1; i <= 1; i++) {
        for(var j = -1; j <= 1; j++) {
            let uvOffset = vec2<f32>(f32(i), f32(j)) * spread;

            let r = textureSample(tDiffuse, sDiffuse, uv + uvOffset + vec2<f32>(offset, 0.0)).r;
            let g = textureSample(tDiffuse, sDiffuse, uv + uvOffset).g;
            let b = textureSample(tDiffuse, sDiffuse, uv + uvOffset - vec2<f32>(offset, 0.0)).b;

            accum += vec3<f32>(r, g, b);
            totalWeight += 1.0;
        }
    }
    let blurredColor = accum / totalWeight;

    let r_sharp = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(offset, 0.0)).r;
    let g_sharp = textureSample(tDiffuse, sDiffuse, uv).g;
    let b_sharp = textureSample(tDiffuse, sDiffuse, uv - vec2<f32>(offset, 0.0)).b;
    let sharpColor = vec3<f32>(r_sharp, g_sharp, b_sharp);

    if (blurAmount > 0.1) {
        color = blurredColor;
    } else {
        color = sharpColor;
    }

    // Cheap bright-pass bloom for connectome sparks and hot fibre bundles
    if (uniforms.style >= 2.0) {
        let texel = 1.0 / vec2<f32>(textureDimensions(tDiffuse));
        var bloom = vec3<f32>(0.0);
        var bloomWeight = 0.0;
        for (var i = -1; i <= 1; i++) {
            for (var j = -1; j <= 1; j++) {
                let w = select(0.16, 0.28, i == 0 && j == 0);
                let sampleCol = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(f32(i), f32(j)) * texel);
                let lum = max(0.0, dot(sampleCol.rgb, vec3<f32>(0.299, 0.587, 0.114)) - 0.65);
                bloom += sampleCol.rgb * lum * w;
                bloomWeight += lum * w;
            }
        }
        if (bloomWeight > 0.0) {
            let depthFade = clamp(1.0 - coc * 0.4, 0.45, 1.0);
            color += (bloom / max(0.0001, bloomWeight)) * 0.42 * depthFade;
        }
    }

    // Film Grain
    if (uniforms.grain > 0.0) {
        let noise = fract(sin(dot(uv + uniforms.time * 0.1, vec2<f32>(12.9898, 78.233))) * 43758.5453);
        color += (noise - 0.5) * uniforms.grain;
    }

    // Visual Cortex Edge Detection Filter
    if (uniforms.edgeDetection > 0.0) {
        let stepX = 1.0 / vec2<f32>(textureDimensions(tDiffuse)).x;
        let stepY = 1.0 / vec2<f32>(textureDimensions(tDiffuse)).y;

        let c00 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(-stepX, -stepY)).rgb;
        let c01 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(0.0, -stepY)).rgb;
        let c02 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(stepX, -stepY)).rgb;
        let c10 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(-stepX, 0.0)).rgb;
        let c12 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(stepX, 0.0)).rgb;
        let c20 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(-stepX, stepY)).rgb;
        let c21 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(0.0, stepY)).rgb;
        let c22 = textureSample(tDiffuse, sDiffuse, uv + vec2<f32>(stepX, stepY)).rgb;

        let gx = -1.0 * c00 + 1.0 * c02 - 2.0 * c10 + 2.0 * c12 - 1.0 * c20 + 1.0 * c22;
        let gy = -1.0 * c00 - 2.0 * c01 - 1.0 * c02 + 1.0 * c20 + 2.0 * c21 + 1.0 * c22;

        let edge = length(gx) + length(gy);
        let edgeColor = vec3<f32>(edge);

        // Blend based on intensity
        color = mix(color, edgeColor * vec3<f32>(0.5, 1.0, 0.5) + color * 0.2, uniforms.edgeDetection);
    }

    return vec4<f32>(color, 1.0);
}
`;


// [V3.1] Dense Point Cloud (Billboard Boutons / Varicosities)
export const pointCloudVertexShader = `
${CONSTANTS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32,
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
    let firing = peakActivity * 2.7 * uniforms.pulseSaturation;
    let firingSpike = smoothstep(0.48, 0.98, peakActivity);
    let pulse = 1.0 + (0.18 + firingSpike * 0.52 * uniforms.pulseSaturation) * sin(uniforms.time * (8.0 + typeId) + phase) * peakActivity;
    scale *= (1.0 + firing + firingSpike * 1.2 * uniforms.pulseSaturation) * pulse;

    if (typeId > 4.5) {
        scale *= 0.78;
    } else if (typeId > 3.5) {
        scale *= 0.92;
    }

    if (length(pos) > uniforms.growth * 1.8) {
        scale = 0.0;
    }
    if (uniforms.decimation > 0.0) {
        let noise = fract(sin(dot(pos, vec3<f32>(12.9898, 78.233, 45.164))) * 43758.5453);
        if (noise < uniforms.decimation) { scale = 0.0; }
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

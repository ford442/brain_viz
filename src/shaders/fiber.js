import { CONSTANTS, HELPERS } from './shared.js';

export const fiberVertexShader = `
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

struct FiberVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec4<f32>,
    @location(2) fiberMeta: vec4<f32>,
    @location(3) fiberStart: vec3<f32>,
    @location(4) fiberEnd: vec3<f32>,
    @location(5) pathwayMeta: vec4<f32>,
}

struct PathwayState {
    // selected numeric ID, route progress, pulse intensity, blocked flag
    control: vec4<f32>,
    // transmitter RGB and low static-highlight strength
    colorAndStatic: vec4<f32>,
}

struct FiberVertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
    @location(5) signal: f32,
    @location(6) distToCenter: f32,
    @location(7) fiberMaterial: vec4<f32>,
    @location(8) fiberTangent: vec3<f32>,
    @location(9) fiberFlags: vec2<f32>,
    @location(10) pathwayEmission: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
@group(0) @binding(3) var<storage, read> fiberDirections: array<vec4<f32>>;
@group(0) @binding(4) var<uniform> pathwayState: PathwayState;

fn getPathwayEmission(meta: vec4<f32>, position: vec3<f32>) -> f32 {
    if (meta.x <= 0.0 || abs(meta.x - pathwayState.control.x) > 0.25 || pathwayState.control.w > 0.5) {
        return 0.0;
    }
    let routeProgress = clamp(meta.z, 0.0, 1.0);
    let selectionWeight = clamp(meta.w, 0.0, 1.0);
    let head = clamp(1.0 - abs(routeProgress - pathwayState.control.y) / 0.12, 0.0, 1.0);
    let behind = pathwayState.control.y - routeProgress;
    var tail = 0.0;
    if (behind >= 0.0 && behind <= 0.22) {
        tail = (1.0 - behind / 0.22) * 0.55;
    }
    var emission = (pathwayState.colorAndStatic.w + max(head, tail) * pathwayState.control.z) * selectionWeight;
    if (uniforms.lesionActive > 0.0 && uniforms.lesionRadius > 0.0) {
        let lesionDistance = distance(position, uniforms.lesionCenter);
        if (lesionDistance < uniforms.lesionRadius) {
            emission *= 1.0 - uniforms.lesionActive * (1.0 - lesionDistance / uniforms.lesionRadius);
        }
    }
    return max(0.0, emission);
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

fn getFiberAffinity(index: u32, slot: u32) -> vec4<f32> {
    return fiberDirections[index * 3u + slot];
}

fn worldToIndex(worldPosition: vec3<f32>) -> u32 {
    let normalized = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(0.99999));
    let x = u32(normalized.x * f32(VOXEL_DIM));
    let y = u32(normalized.y * f32(VOXEL_DIM));
    let z = u32(normalized.z * f32(VOXEL_DIM));
    return z * VOXEL_DIM * VOXEL_DIM + y * VOXEL_DIM + x;
}

fn sampleFiberCoupledSignal(worldPos: vec3<f32>, tangent: vec3<f32>, isAI: bool) -> vec3<f32> {
    let idx = worldToIndex(worldPos);
    let step = (BRAIN_RANGE / f32(VOXEL_DIM)) * 0.95;
    var directional = 0.0;
    var coverage = 0.0;
    var alignment = 0.0;
    for (var slot = 0u; slot < 3u; slot = slot + 1u) {
        let aff = getFiberAffinity(idx, slot);
        if (aff.w < 0.01) { continue; }
        let axis = normalize(aff.xyz + vec3<f32>(0.0001, 0.0001, 0.0001));
        let align = abs(dot(axis, tangent));
        let forward = select(-axis, axis, dot(axis, tangent) >= 0.0);
        let tractSample =
            sampleSmoothedVoxelValue(worldPos + forward * step) * 0.55 +
            sampleSmoothedVoxelValue(worldPos - forward * step * 0.65) * 0.25 +
            sampleSmoothedVoxelValue(worldPos) * 0.20;
        directional = directional + tractSample * aff.w * mix(0.55, 1.25, align);
        coverage = coverage + aff.w;
        alignment = max(alignment, align * aff.w);
    }
    if (coverage > 0.0) {
        directional = directional / coverage;
    }
    let local = select(sampleSmoothedVoxelValue(worldPos), sampleSmoothedAIVoxelValue(worldPos), isAI);
    return vec3<f32>(mix(local, directional, clamp(uniforms.fiberCoupling, 0.0, 1.0)), clamp(coverage, 0.0, 1.0), clamp(alignment, 0.0, 1.0));
}

fn calculateSignalFlow(startPos: vec3<f32>, endPos: vec3<f32>, time: f32, speed: f32, segmentPhase: f32, flowBias: f32, myelin: f32, radius: f32, bundleId: f32) -> f32 {
    let midpoint = mix(startPos, endPos, 0.5);
    let region = getRegionPhysics(midpoint, uniforms.style);
    let diffusionNorm = clamp(region.y / 0.15, 0.0, 1.0);
    var travel = fract(time * speed + segmentPhase + bundleId * 0.031);
    if (flowBias < -0.1) {
        travel = 1.0 - travel;
    }

    let regionSpeed = mix(0.78, 1.2, region.x);
    let segmentSpan = mix(0.10, 0.22, 1.0 - myelin) * mix(1.2, 0.75, diffusionNorm) + radius * 0.12;
    let trail = max(1.0, uniforms.trailLength);
    let centerT = fract(travel * regionSpeed);
    let t0 = clamp(centerT - segmentSpan * 1.8 * trail, 0.0, 1.0);
    let t1 = clamp(centerT - segmentSpan * 0.9 * trail, 0.0, 1.0);
    let t2 = centerT;
    let t3 = clamp(centerT + segmentSpan * 0.9 * trail, 0.0, 1.0);
    let t4 = clamp(centerT + segmentSpan * 1.8 * trail, 0.0, 1.0);

    let s0 = sampleSmoothedVoxelValue(mix(startPos, endPos, t0));
    let s1 = sampleSmoothedVoxelValue(mix(startPos, endPos, t1));
    let s2 = sampleSmoothedVoxelValue(mix(startPos, endPos, t2));
    let s3 = sampleSmoothedVoxelValue(mix(startPos, endPos, t3));
    let s4 = sampleSmoothedVoxelValue(mix(startPos, endPos, t4));

    let weighted = (s0 * 0.12) + (s1 * 0.20) + (s2 * 0.36) + (s3 * 0.20) + (s4 * 0.12);
    let regionalBoost = mix(0.72, 1.28, region.x) * mix(0.88, 1.12, myelin) * mix(1.08, 0.88, diffusionNorm);
    return clamp(weighted * regionalBoost, 0.0, 1.5);
}

@vertex
fn main(input: FiberVertexInput) -> FiberVertexOutput {
    var output: FiberVertexOutput;

    var finalPos = input.position;
    // TMS Distortion
    if (uniforms.tmsActive > 0.0) {
        let dist = distance(finalPos, uniforms.tmsCenter);
        let radius = uniforms.tmsRadius;
        let falloff = exp(-(dist * dist) / (radius * radius));
        let pull = normalize(finalPos - uniforms.tmsCenter + vec3<f32>(0.001));
        let twist = cross(pull, vec3<f32>(0.0, 1.0, 0.0));
        let distortion = (pull * 0.1 + twist * 0.15) * falloff * uniforms.tmsPulse;
        finalPos = finalPos + distortion;
    }

    if (uniforms.sensoryDeprivation > 0.0) {
        let distToOrigin = length(finalPos.xyz);
        let voidRadius = uniforms.sensoryDeprivation * 1.5;
        if (distToOrigin < voidRadius) {
            let pushFactor = (voidRadius - distToOrigin) / voidRadius;
            finalPos += normalize(finalPos) * pushFactor * voidRadius;
        }
    }
    let worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;

    let worldNormal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal.xyz, 0.0)).xyz);
    let radius = max(0.0025, input.fiberMeta.x);
    let bundleId = input.fiberMeta.y;
    let myelin = clamp(input.fiberMeta.z, 0.0, 1.0);
    let segmentPhase = input.fiberMeta.w;
    let isAI = bundleId >= 100.0;
    let degradation = clamp(uniforms.cortisol + uniforms.plasticityDecay, 0.0, 1.0);
    let effectiveMyelin = myelin * (1.0 - degradation * (1.0 - myelin));
    let hierarchy = clamp(radius * select(18.0, 48.0, isAI), 0.0, 1.0);
    let taper = clamp(1.0 - hierarchy * 0.45, 0.35, 1.0);
    let tangent = normalize(input.fiberEnd - input.fiberStart);
    let coupledSignal = sampleFiberCoupledSignal(finalPos, tangent, isAI);
    let activity = sampleSmoothedVoxelValue(finalPos);
    let aiActivity = sampleSmoothedAIVoxelValue(finalPos);
    let tractActivity = coupledSignal.x;
    let tractCoverage = coupledSignal.y;
    let tractAlignment = coupledSignal.z;
    let midpoint = mix(input.fiberStart, input.fiberEnd, 0.5);
    let flowBias = getRegionPhysics(midpoint, uniforms.style).z;
    let conductionBoost = 1.0 + uniforms.fiberCoupling * (0.25 + tractCoverage * 0.45 + tractAlignment * 0.35);
    let conductionSpeed = uniforms.flowSpeed * select(1.0, 2.35, isAI) * (0.45 + effectiveMyelin * 1.65 + radius * 18.0) * conductionBoost;
    let signalStrength = calculateSignalFlow(input.fiberStart, input.fiberEnd, uniforms.time, conductionSpeed, segmentPhase, flowBias, effectiveMyelin, radius, bundleId);
    let aiSignal = calculateSignalFlow(input.fiberStart, input.fiberEnd, uniforms.time, uniforms.flowSpeed * 2.4 * (0.4 + effectiveMyelin * 0.8 + radius * 10.0), segmentPhase, flowBias, 0.12, radius * 0.35, bundleId + 100.0);
    let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, abs(signalStrength - aiSignal));
    let pathwayEmission = getPathwayEmission(input.pathwayMeta, input.position);
    var baseColor = vec3<f32>(0.0);

    if (isAI) {
        let aiHue = (bundleId - 100.0) * 0.21 + uniforms.time * 0.4;
        baseColor = vec3<f32>(
            0.85 + 0.15 * sin(aiHue),
            0.15 + 0.25 * sin(aiHue + 2.5),
            0.75 + 0.25 * sin(aiHue + 1.2)
        );
        let spiky = smoothstep(0.68, 0.96, signalStrength + max(aiActivity, tractActivity) * 0.5 + sin(uniforms.time * 14.0 + segmentPhase * 20.0) * 0.12);
        baseColor += vec3<f32>(1.0, 0.2, 0.9) * (signalStrength * 0.8 + spiky * 0.4);
    } else {
        // [V3.3] Anatomical (variant 0): classic DTI tractography palette — encode local
        // fiber orientation as RGB (L-R red, I-S green, A-P blue) for colourful glowing tracts.
        let dtiDir = normalize(abs(tangent) + vec3<f32>(0.04));
        let dtiColor = pow(dtiDir, vec3<f32>(0.62)); // brighten toward luminous pastel tracts
        // Reasoning Pathways (variant 1): flowing teal -> gold routing for SynaptiX storytelling.
        let wave = sin(uniforms.time * 1.2 + segmentPhase * 9.0 + input.position.y * 3.0) * 0.5 + 0.5;
        let reasoning = mix(vec3<f32>(0.0, 0.82, 1.0), vec3<f32>(0.08, 0.95, 0.48), wave);
        baseColor = mix(dtiColor, reasoning, clamp(uniforms.connectomeVariant, 0.0, 1.0));
        baseColor += mix(vec3<f32>(0.1, 0.8, 1.0), vec3<f32>(1.0, 0.9, 0.35), uniforms.colorShift) * max(signalStrength, tractActivity) * 0.85;
    }

    let ranvier = 0.75 + 0.25 * sin(segmentPhase * 42.0 + uniforms.time * 8.0 + dot(input.position, tangent) * 9.0);
    let sheath = mix(0.8, 1.25, effectiveMyelin) * ranvier;
    baseColor += vec3<f32>(1.0, 0.92, 0.55) * resonance * select(0.08, 0.18, isAI);
    baseColor += vec3<f32>(0.8, 0.96, 1.0) * tractCoverage * tractAlignment * uniforms.fiberCoupling * 0.22;
    baseColor += pathwayState.colorAndStatic.xyz * pathwayEmission;

    output.position = uniforms.mvpMatrix * vec4<f32>(finalPos, 1.0);
    output.worldPos = worldPos;
    output.normal = worldNormal;
    output.color = baseColor * sheath;
    output.activity = activity;
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    output.signal = select(max(signalStrength, tractActivity), max(aiActivity, tractActivity) + signalStrength * 0.4, isAI);
    output.distToCenter = length(input.position);
    output.fiberMaterial = vec4<f32>(effectiveMyelin, radius, hierarchy, taper);
    output.fiberTangent = tangent;
    output.fiberFlags = vec2<f32>(select(0.0, 1.0, isAI), resonance);
    output.pathwayEmission = pathwayEmission;
    return output;
}
`;

export const fiberFragmentShader = `
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

struct FiberFragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
    @location(5) signal: f32,
    @location(6) distToCenter: f32,
    @location(7) fiberMaterial: vec4<f32>,
    @location(8) fiberTangent: vec3<f32>,
    @location(9) fiberFlags: vec2<f32>,
    @location(10) pathwayEmission: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;

@fragment
fn main(input: FiberFragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
    if (uniforms.decimation > 0.0) {
        let noise = fract(sin(dot(input.worldPos, vec3<f32>(12.9898, 78.233, 45.164))) * 43758.5453);
        if (noise < uniforms.decimation) { discard; }
    }


    if (input.distToCenter > uniforms.growth * 1.8) { discard; }

    let isAIFiber = input.fiberFlags.x > 0.5;
    let resonance = input.fiberFlags.y;
    let tangent = normalize(input.fiberTangent);
    let normal = normalize(input.normal);
    let lightDir = normalize(uniforms.lightDir);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, uniforms.zoom) - input.worldPos);
    let halfDir = normalize(lightDir + viewDir);

    let myelin = clamp(input.fiberMaterial.x, 0.0, 1.0);
    let radius = clamp(input.fiberMaterial.y * 8.0, 0.0, 1.0);
    let hierarchy = clamp(input.fiberMaterial.z, 0.0, 1.0);
    let taper = clamp(input.fiberMaterial.w, 0.0, 1.0);

    let ndotl = max(0.0, dot(normal, lightDir));
    let ndotv = max(0.0, dot(normal, viewDir));
    let tangentLight = abs(dot(tangent, halfDir));
    let tangentFacing = abs(dot(tangent, viewDir));
    let specPower = mix(12.0, 64.0, myelin);
    let anisotropic = pow(max(0.0, tangentLight), specPower) * mix(0.35, 1.0, myelin);
    let sheathSpec = pow(max(0.0, dot(normal, halfDir)), mix(6.0, 24.0, myelin));
    let rim = pow(1.0 - ndotv, 2.2) * mix(0.18, 0.52, hierarchy);

    let localDensity = sampleSmoothedVoxelValue(input.worldPos);
    let ambientOcclusion = clamp(1.0 - localDensity * 0.38 - input.signal * 0.12, 0.42, 1.0);
    let nodePulse = 0.7 + 0.3 * sin(uniforms.time * 9.0 + input.signal * 5.0 + input.distToCenter * 12.0);

    var metallic = vec3<f32>(0.0);
    if (isAIFiber) {
        metallic = mix(vec3<f32>(0.75, 0.25, 0.85), vec3<f32>(1.0, 0.6, 0.95), myelin);
    } else {
        metallic = mix(vec3<f32>(0.4, 0.5, 0.62), vec3<f32>(1.0, 0.95, 0.8), myelin);
    }

    let coreTint = mix(input.color * 0.8, metallic, 0.25 + myelin * 0.35);
    let sheathTint = mix(coreTint, metallic, 0.42 + myelin * 0.38);
    let diffuse = sheathTint * (uniforms.ambientLight + ndotl * uniforms.dirIntensity * 0.9) * ambientOcclusion;
    let highlight = metallic * (anisotropic * (0.8 + radius * 0.5) + sheathSpec * 0.24 + tangentFacing * 0.08);

    var activityGlow = vec3<f32>(0.0);
    if (isAIFiber) {
        let spikeTrain = smoothstep(0.72, 0.98, sin(uniforms.time * 15.0 + input.signal * 6.0 + tangentFacing * 8.0) * 0.5 + 0.5);
        activityGlow = vec3<f32>(0.95, 0.2, 0.82) * (input.signal * mix(0.55, 1.0, myelin) + spikeTrain * 0.35);
    } else {
        activityGlow = vec3<f32>(0.08, 0.78, 0.95) * input.signal * mix(0.55, 1.0, myelin) * nodePulse;
    }

    let avalanche = smoothstep(0.56, 0.92, input.signal + localDensity * 0.55);
    let avalancheColor = vec3<f32>(1.0, 0.92, 0.58) * max(avalanche, resonance) * (0.45 + localDensity * 0.8);
    let twistShade = 0.92 + 0.08 * sin(dot(input.worldPos, tangent) * 18.0 + uniforms.time * 4.0);

    // [V3.3] Luminous tractography glow — a soft emissive core that keeps tracts mesmerizing
    // in both stills and motion, plus a warm electric tint in the Reasoning Pathways variant.
    let glowPulse = 0.6 + 0.4 * sin(uniforms.time * 3.0 + input.distToCenter * 6.0 + input.signal * 4.0);
    let emissive = input.color * (0.35 + input.signal * 0.9) * glowPulse * mix(1.0, 1.25, myelin);
    let reasoningWarm = vec3<f32>(1.0, 0.55, 0.15) * clamp(uniforms.connectomeVariant, 0.0, 1.0) * input.signal * 0.4;

    // [Phase 2.5] Spatial Memory Retrieval - backwards traveling glowing breadcrumbs
    let breadcrumbPhase = fract(input.distToCenter * 8.0 - uniforms.time * 2.5);
    let breadcrumbGlow = smoothstep(0.8, 1.0, breadcrumbPhase) * uniforms.spatialMemory;
    let breadcrumbColor = vec3<f32>(1.0, 0.9, 0.4) * breadcrumbGlow * 3.0;
    let glowLuma = max(emissive.r, max(emissive.g, emissive.b));

    let finalRgb = diffuse * twistShade + highlight + activityGlow + avalancheColor + emissive + reasoningWarm + breadcrumbColor + vec3<f32>(1.0, 0.95, 0.65) * resonance * 0.35;
    let alpha = clamp(0.18 + input.signal * 0.4 + ndotl * 0.16 + rim * 0.18 + anisotropic * 0.12 + glowLuma * 0.12, 0.12, 0.96) * ambientOcclusion * mix(0.82, 1.0, taper);

        // [Phase 19] Dopamine Trails Glow
    var finalRgbOut = finalRgb;
    if (uniforms.dopamineTrails > 0.0) {
        // use time and flow speed to make it pulse/trail
        let dopaPhase = fract(uniforms.time * uniforms.flowSpeed * 0.1 + input.worldPos.y * 5.0 + input.worldPos.x * 2.0);
        let dopaPulse = smoothstep(0.8, 1.0, dopaPhase) * smoothstep(0.0, 0.2, 1.0 - dopaPhase);
        let dopaColor = vec3<f32>(1.0, 0.8, 0.2); // Golden dopamine glow
        finalRgbOut = finalRgbOut + (dopaColor * dopaPulse * uniforms.dopamineTrails * 2.0);
    }

    return vec4<f32>(finalRgbOut, alpha);
}
`;

import { CONSTANTS, HELPERS } from './shared.js';

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
    sparkle: f32, // [Phase 5] Synaptic Sparkles
    growth: f32, // [Phase 6] Dendritic Growth
    aberration: f32, // [Phase 7] Chromatic Aberration
    grain: f32, // [Phase 7] Film Grain
    focus: f32, // [Phase 7] Focus Distance
    aperture: f32, // [Phase 7] Aperture Size,
    lightDir: vec3<f32>, // [Phase 2] Directional Light
    ambientLight: f32, // [Phase 2] Ambient Light Intensity
    dirIntensity: f32, // [Phase 2] Directional Light Intensity
    stress: f32, // Cognitive Stress Distortion
    cortisol: f32, // [Phase 5] Cortisol Structural Decay
    // Altitude/Hypoxia Parameters
    altitude: f32, // Altitude in meters
    oxygenLevel: f32, // Oxygen saturation (1.0-0.3)
    hypoxiaStress: f32, // Cellular stress response
    metabolicRate: f32, // ATP consumption multiplier
    mitochondrialFunction: f32, // ATP synthesis efficiency
    fogDensity: f32, // Volumetric Fog
    zoom: f32, // Camera zoom for distance math
    heavyMetal: f32,
    fluidActive: f32, // Procedural Volumetric Fluid Dynamics
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
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
    @location(5) signal: f32,
    @location(6) distToCenter: f32, // [Phase 6]
    @location(7) fiberMaterial: vec3<f32>,
    @location(8) fiberTangent: vec3<f32>,
    @location(9) fiberFlags: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
// [Verified] Volumetric Data: Flattened 3D buffer representing brain activity
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
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var finalPos = input.position;
    var finalNormal = normalize(input.normal.xyz);

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

    var finalColor = vec3<f32>(0.0);
    var signalStrength = 0.0;
    output.fiberMaterial = vec3<f32>(0.0);
    output.fiberTangent = vec3<f32>(0.0, 0.0, 1.0);
    output.fiberFlags = vec2<f32>(0.0);
    
    let activity = sampleSmoothedVoxelValue(finalPos);
    let aiActivity = sampleSmoothedAIVoxelValue(finalPos);

    let worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;

    // --- SYNAPTIX SURFACE MODE ---
    if (uniforms.style >= 4.0) {
        // Dual displacement fields: slow organic breathing vs sharp AI gyri.
        let humanWave = 0.55 + 0.45 * sin(uniforms.time * 1.35 + activity * 4.0 + input.position.y * 3.5);
        let humanDisp = normalize(input.position) * activity * (0.02 + humanWave * 0.035);
        let gridCoord = input.position * 22.0 + vec3<f32>(uniforms.time * 0.15, uniforms.time * 0.2, uniforms.time * 0.18);
        let grid = abs(fract(gridCoord) - 0.5);
        let ridge = step(0.41, max(grid.x, max(grid.y, grid.z)));
        let aiFacetNoise = hashNoise3(input.position * 18.0 + vec3<f32>(uniforms.time * 0.5));
        let aiSpike = smoothstep(0.55, 0.92, aiActivity + aiFacetNoise * 0.35);
        let aiRidge = normalize(input.position) * ridge * aiSpike * aiActivity * 0.055;
        let aiDisp = normalize(input.position) * aiActivity * (0.012 + aiSpike * 0.02);
        finalPos = input.position + humanDisp + aiDisp + aiRidge;
        finalNormal = normalize(input.position + aiRidge * 4.0 + vec3<f32>(grid.y - grid.z, grid.z - grid.x, grid.x - grid.y) * aiSpike * 0.2);
        signalStrength = aiActivity;
        finalColor = vec3<f32>(0.0);
    }
    // Apply psychedelic morphing to vertex positions
    if (uniforms.psychedelic > 0.0) {
        let psychFreq = 8.0;
        let psychTime = uniforms.time * 2.0;

        let noiseOffset = vec3<f32>(
            sin(finalPos.y * psychFreq + psychTime) * cos(finalPos.z * psychFreq),
            sin(finalPos.z * psychFreq + psychTime) * cos(finalPos.x * psychFreq),
            sin(finalPos.x * psychFreq + psychTime) * cos(finalPos.y * psychFreq)
        );

        finalPos += normalize(input.position) * noiseOffset * uniforms.psychedelic * 0.15;
    }

    // --- HEATMAP MODE ---
    if (uniforms.style >= 3.0 && uniforms.style < 4.0) {
        finalPos = input.position;
        finalColor = getHeatmapColor(activity);

        if (uniforms.colorShift > 0.0) {
             let warmShift = vec3<f32>(1.0, 0.5, 0.0);
             finalColor = mix(finalColor, warmShift, uniforms.colorShift * activity * 0.8);
        }
    }
    // --- GHOST MODE ---
    else if (uniforms.style < 3.0) {
            let displacement = normalize(input.position) * activity * 0.05;
            finalPos = input.position + displacement;

            // [Phase 5] Cortisol Structural Decay
            if (uniforms.cortisol > 0.0) {
                let decayFactor = 1.0 - (uniforms.cortisol * 0.3);
                finalPos *= max(0.0, decayFactor);
            }

            if (uniforms.plasticityDecay > 0.0) {
                let erosion = uniforms.plasticityDecay * 0.15;
                finalPos -= normalize(input.position) * erosion;
            }

            if (uniforms.sensoryDeprivation > 0.0) {
                let distToOrigin = length(finalPos.xyz);
                let voidRadius = uniforms.sensoryDeprivation * 1.5;
                if (distToOrigin < voidRadius) {
                    let pushFactor = (voidRadius - distToOrigin) / voidRadius;
                    finalPos += normalize(finalPos) * pushFactor * voidRadius;
                }
            }

            // [Phase 2] Cognitive Stress Distortion
            if (uniforms.stress > 0.0) {
                let noiseFreq = 15.0;
                let stressDisp = sin(finalPos.x * noiseFreq + uniforms.time * 10.0) * cos(finalPos.y * noiseFreq + uniforms.time * 8.0) * sin(finalPos.z * noiseFreq);
                finalPos += normalize(input.position) * stressDisp * uniforms.stress * 0.5;
            }

            // [Phase 5] Cortisol Structural Decay
            if (uniforms.cortisol > 0.0) {
                // Decay structural integrity based on cortisol level (shrinks vertices inward, especially higher activity areas)
                let decayErosion = uniforms.cortisol * 0.2 * (1.0 - activity);
                finalPos -= normalize(input.position) * decayErosion;
            }

            if (uniforms.plasticityDecay > 0.0) {
                let erosion = uniforms.plasticityDecay * 0.15;
                finalPos -= normalize(input.position) * erosion;
            }

            // [Phase 6] Heavy Metal Structural Alteration
            if (uniforms.heavyMetal > 0.0) {
                let lesionNoise = fract(sin(dot(finalPos.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                let erosion = uniforms.heavyMetal * 0.3 * lesionNoise;
                finalPos -= normalize(input.position) * erosion;
            }

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

    // Apply psychedelic color shift
    if (uniforms.psychedelic > 0.0) {
        let hsvShift = fract(uniforms.time * 0.5 + finalPos.y * 2.0);

        // Simple hue shift approximation via RGB mixing
        let r = sin(hsvShift * 6.28318) * 0.5 + 0.5;
        let g = sin((hsvShift + 0.333) * 6.28318) * 0.5 + 0.5;
        let b = sin((hsvShift + 0.666) * 6.28318) * 0.5 + 0.5;

        let psychColor = vec3<f32>(r, g, b);
        finalColor = mix(finalColor, psychColor, uniforms.psychedelic * 0.8);
    }

    // Apply cyanosis color shift from hypoxia (oxygen deprivation)
    if (uniforms.hypoxiaStress > 0.1) {
        let cyanosisShift = uniforms.hypoxiaStress * 0.6; // Up to 60% shift at severe hypoxia
        let cyanosisColor = vec3<f32>(0.3, 0.4, 0.7); // Cyanotic blue/purple
        finalColor = mix(finalColor, cyanosisColor, cyanosisShift);

        // At extreme hypoxia (>0.8), add a purple tint
        if (uniforms.hypoxiaStress > 0.8) {
            let deepCyanosis = vec3<f32>(0.5, 0.2, 0.7); // Deep purple
            finalColor = mix(finalColor, deepCyanosis, (uniforms.hypoxiaStress - 0.8) * 2.0);
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
    
    // [Phase 6] Dendritic Growth: Distance from center
    output.distToCenter = length(output.worldPos);

    return output;
}
`;

export const fragmentShader = `
${CONSTANTS}
${HELPERS}

struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    flowSpeed: f32,
    colorShift: f32, // [Phase 5]
    slicePlane: vec4<f32>, // [Neuro-Weaver] V2.6: Renamed from clipPlane
    sparkle: f32, // [Phase 5] Synaptic Sparkles
    growth: f32, // [Phase 6]
    aberration: f32, // [Phase 7]
    grain: f32, // [Phase 7],
    focus: f32, // [Phase 7] Focus Distance
    aperture: f32, // [Phase 7] Aperture Size
    lightDir: vec3<f32>, // [Phase 2]
    ambientLight: f32, // [Phase 2]
    dirIntensity: f32, // [Phase 2]
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
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
@group(0) @binding(3) var<storage, read> fiberDirections: array<vec4<f32>>;

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

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
    @location(4) clipDist: f32,
    @location(5) signal: f32,
    @location(6) distToCenter: f32, // [Phase 6]
    @location(7) fiberMaterial: vec3<f32>,
    @location(8) fiberTangent: vec3<f32>,
    @location(9) fiberFlags: vec2<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // V2.2 Clipping: Discard pixels behind plane
    if (input.clipDist < 0.0) { discard; }
    if (uniforms.decimation > 0.0) {
        let noise = fract(sin(dot(input.worldPos, vec3<f32>(12.9898, 78.233, 45.164))) * 43758.5453);
        if (noise < uniforms.decimation) { discard; }
    }



    // [Phase 6] Dendritic Growth: Discard outside growth radius
    if (input.distToCenter > uniforms.growth * 1.8) { discard; }

    // Shared view-dependent calculations for frosted-glass translucency
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    let NdotV = abs(dot(normal, viewDir));
    let rim = pow(1.0 - NdotV, 3.0);

    // --- SYNAPTIX MODE (Style 4.0) ---
    // activityTensor now contains compute-blended human+AI composite.
    // aiTensor still holds raw AI for comparison.
    if (uniforms.style >= 4.0) {
        // [SynaptiX] Bichromatic volumetric raymarch through both tensors
        let rayOrigin = vec3<f32>(0.0, 0.0, uniforms.zoom);
        let rayDir = normalize(input.worldPos - rayOrigin);
        let bounds = raySphereBounds(rayOrigin, rayDir, BRAIN_RANGE);

        var volumeColor = vec3<f32>(0.0);
        var volumeAlpha = 0.0;
        if (bounds.y > bounds.x) {
            let planeNormal = uniforms.slicePlane.xyz;
            let planeOffset = uniforms.slicePlane.w;
            var startT = max(bounds.x, 0.0);
            var endT = bounds.y;
            let originPlane = dot(rayOrigin, planeNormal) + planeOffset;
            let dirPlane = dot(rayDir, planeNormal);
            if (abs(dirPlane) > 1e-4) {
                let planeT = -originPlane / dirPlane;
                if (originPlane < 0.0) {
                    startT = max(startT, planeT);
                } else if (originPlane + dirPlane * endT < 0.0) {
                    endT = min(endT, planeT);
                }
            }
            if (endT > startT) {
                let span = endT - startT;
                let stepCount: u32 = 24u;
                let stepSize = span / f32(stepCount);
                var t = startT;
                var transmittance = 1.0;
                for (var i = 0u; i < 28u; i = i + 1u) {
                    if (i >= stepCount || transmittance < 0.03) { break; }
                    let samplePos = rayOrigin + rayDir * (t + stepSize * 0.5);
                    let jitter = 0.86 + 0.14 * hashNoise3(samplePos * 2.75 + vec3<f32>(uniforms.time * 0.08));
                    let humanVal = clamp(getVoxelValue(samplePos) * jitter, 0.0, 1.0);
                    let aiVal = clamp(getAIVoxelValue(samplePos) * jitter, 0.0, 1.0);
                    let density = max(humanVal, aiVal);
                    if (density > 0.0005) {
                        // Bichromatic: cyan for human, magenta for AI
                        var sampleColor = vec3<f32>(0.0, 0.85, 1.0) * humanVal;
                        sampleColor = mix(sampleColor, vec3<f32>(1.0, 0.0, 0.85) * aiVal, aiVal * 0.7);
                        // White-gold resonance at overlap
                        let diff = abs(humanVal - aiVal);
                        let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, diff);
                        sampleColor += vec3<f32>(1.0, 0.92, 0.55) * resonance * max(humanVal, aiVal) * 1.8;
                        let depthT = clamp((t + stepSize * 0.5 - startT) / span, 0.0, 1.0);
                        let depthTint = mix(vec3<f32>(0.55, 0.75, 1.0), vec3<f32>(1.0, 0.58, 0.12), depthT);
                        let emission = sampleColor * depthTint;
                        let alpha = 1.0 - exp(-density * stepSize * 8.5);
                        volumeColor += transmittance * emission * alpha;
                        transmittance *= (1.0 - alpha * 0.9);
                    } else {
                        transmittance *= 0.995;
                    }
                    t += stepSize;
                }
                volumeAlpha = clamp(1.0 - transmittance, 0.0, 1.0);
            }
        }

        let blended = input.activity; // Composite from compute shader
        let aiRaw = input.signal;     // Raw AI from aiTensor

        // Bichromatic shell: cyan base, magenta where AI dominates
        var mixedColor = vec3<f32>(0.0, 0.85, 1.0) * blended;
        mixedColor = mix(mixedColor, vec3<f32>(1.0, 0.0, 0.85) * blended, aiRaw * 0.7);

        // Resonance burst: white-gold where human and AI align
        let diff = abs(blended - aiRaw);
        let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, diff);
        mixedColor += vec3<f32>(1.0, 0.92, 0.55) * resonance * blended * 2.5;

        // Divergence noise: violet chaos where they differ
        let divergence = smoothstep(uniforms.resonanceThreshold * 2.0, uniforms.resonanceThreshold * 5.0, diff);
        let noise = hashNoise3(input.worldPos * 4.0 + vec3<f32>(uniforms.time * 0.6));
        mixedColor += vec3<f32>(0.7, 0.15, 0.9) * divergence * noise * 0.4;

        // Blend shell over volumetric background
        mixedColor = mix(volumeColor, mixedColor, 0.55 + rim * 0.3);
        let rimAlpha = smoothstep(0.5, 1.0, rim);
        let glassAlpha = 0.04 + rimAlpha * 0.22;
        let finalAlpha = clamp(glassAlpha + blended * 0.18 + volumeAlpha * 0.25, 0.0, 0.55);

        if (uniforms.lesionActive > 0.0) {
            let dist = distance(input.worldPos, uniforms.lesionCenter);
            if (dist < uniforms.lesionRadius) {
                let lesionFactor = (1.0 - (dist / uniforms.lesionRadius)) * uniforms.lesionActive;
                mixedColor = mix(mixedColor, vec3<f32>(0.1, 0.1, 0.1), lesionFactor);
            }
        }
        return vec4<f32>(mixedColor, finalAlpha);
    }

    // [Neuro-Weaver] Style 3.0: Translucent Heatmap Shell
    // Volume raymarch through the tensor so the interior reads as a true thermal body
    if (uniforms.style >= 3.0) {
        let rayOrigin = vec3<f32>(0.0, 0.0, uniforms.zoom);
        let rayDir = normalize(input.worldPos - rayOrigin);
        let bounds = raySphereBounds(rayOrigin, rayDir, BRAIN_RANGE);

        if (bounds.y <= bounds.x) {
            discard;
        }

        let volume = raymarchHeatmapVolume(rayOrigin, rayDir, bounds.x, bounds.y, uniforms.slicePlane.xyz, uniforms.slicePlane.w, uniforms.time);
        let shellTint = getHeatmapColor(pow(input.activity, 0.9));
        let rimBoost = smoothstep(0.4, 1.0, rim) * 0.22;
        let shellBurst = smoothstep(0.68, 0.98, input.activity) * 0.18;
        let mixedColor = mix(volume.rgb, shellTint + vec3<f32>(1.0, 0.88, 0.5) * shellBurst, 0.12 + rimBoost);
        let alpha = clamp(volume.a + 0.08 + rimBoost + shellBurst * 0.15, 0.0, 0.94);
        if (uniforms.lesionActive > 0.0) {
            let dist = distance(input.worldPos, uniforms.lesionCenter);
            if (dist < uniforms.lesionRadius) {
                let lesionFactor = (1.0 - (dist / uniforms.lesionRadius)) * uniforms.lesionActive;
                mixedColor = mix(mixedColor, vec3<f32>(0.1, 0.1, 0.1), lesionFactor);
            }
        }
        return vec4<f32>(mixedColor, alpha);
    }

    if (uniforms.style >= 2.0) {
        // [Neuro-Weaver] Style 2.0: Translucent Fibers with activity glow
        // Lighting: anisotropic highlight along the tract with a soft rim
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

        let ndotl = max(0.0, dot(normal, lightDir));
        let ndotv = max(0.0, dot(normal, viewDir));
        let tangentFacing = abs(dot(tangent, viewDir));
        let specPower = mix(10.0, 52.0, myelin);
        let specular = pow(max(0.0, dot(normal, halfDir)), specPower) * mix(0.2, 1.0, myelin);
        let rim = pow(1.0 - ndotv, 2.4) * mix(0.15, 0.45, hierarchy);

        // Voxel-aware occlusion: darker in dense/high-activity regions to reduce uniform glow
        let localDensity = sampleSmoothedVoxelValue(input.worldPos);
        let ambientOcclusion = clamp(1.0 - localDensity * 0.38 - input.signal * 0.12, 0.42, 1.0);
        let avalanche = smoothstep(0.56, 0.92, input.signal + localDensity * 0.55);

        let fiberBase = input.color * (0.24 + ndotl * 0.72) * ambientOcclusion;
        // [SynaptiX] AI fibers: violet metallic, human: steel-gold metallic
        var metallic: vec3<f32>;
        if (isAIFiber) {
            metallic = mix(vec3<f32>(0.75, 0.25, 0.85), vec3<f32>(1.0, 0.6, 0.95), myelin);
        } else {
            metallic = mix(vec3<f32>(0.4, 0.5, 0.62), vec3<f32>(1.0, 0.95, 0.8), myelin);
        }
        let highlight = metallic * (specular * (0.6 + radius * 0.4) + rim * 0.32 + tangentFacing * 0.08);
        // [SynaptiX] AI activity glow = magenta, human = cyan
        var activityGlow: vec3<f32>;
        if (isAIFiber) {
            let spikeTrain = smoothstep(0.72, 0.98, sin(uniforms.time * 15.0 + input.signal * 6.0 + tangentFacing * 8.0) * 0.5 + 0.5);
            activityGlow = vec3<f32>(0.95, 0.2, 0.82) * (input.signal * mix(0.55, 1.0, myelin) + spikeTrain * 0.35);
        } else {
            let vesicleBreath = 0.82 + 0.18 * sin(uniforms.time * 2.1 + input.signal * 4.0 + radius * 8.0);
            activityGlow = vec3<f32>(0.08, 0.78, 0.95) * input.signal * mix(0.55, 1.0, myelin) * vesicleBreath;
        }
        let avalancheColor = vec3<f32>(1.0, 0.92, 0.58) * max(avalanche, resonance) * (0.45 + localDensity * 0.8);
        let finalRgb = fiberBase + highlight + activityGlow + avalancheColor + vec3<f32>(1.0, 0.95, 0.65) * resonance * 0.35;

        let alpha = clamp(0.22 + (input.signal * 0.36) + (ndotl * 0.18) + (rim * 0.14) + avalanche * 0.1 + resonance * 0.12, 0.12, 0.9) * ambientOcclusion;
        if (uniforms.lesionActive > 0.0) {
            let dist = distance(input.worldPos, uniforms.lesionCenter);
            if (dist < uniforms.lesionRadius) {
                let lesionFactor = (1.0 - (dist / uniforms.lesionRadius)) * uniforms.lesionActive;
                finalRgb = mix(finalRgb, vec3<f32>(0.1, 0.1, 0.1), lesionFactor);
            }
        }
        return vec4<f32>(finalRgb, alpha);
    }

    // [Neuro-Weaver] Frosted-glass skin for modes 0 (Organic) and 1 (Cyber)
    // Low base alpha + rim silhouette + activity punch-through = see-through glass effect
    let rimAlpha = smoothstep(0.5, 1.0, rim);
    let glassAlpha = 0.04 + rimAlpha * 0.22;
    let activityAlpha = input.activity * 0.18;
    let finalAlpha = clamp(glassAlpha + activityAlpha, 0.0, 0.35);

    // [Phase 2] Dynamic Lighting Control
    let NdotL = max(0.0, dot(input.normal, normalize(uniforms.lightDir)));
    let diffuse = vec3<f32>(1.0) * NdotL * uniforms.dirIntensity;
    let ambient = vec3<f32>(1.0) * uniforms.ambientLight;

    var col = input.color * (ambient + diffuse);
    col += vec3<f32>(0.8) * rimAlpha;

    // Activity glow punches through glass where brain is active
    let activityGlowColor = vec3<f32>(0.5, 0.8, 1.0);
    let mixFactor = clamp(input.activity * 1.5 * rimAlpha, 0.0, 1.0);
    col = mix(col, activityGlowColor, mixFactor);

    // Apply volumetric fog based on fragment depth
    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let depth = length(input.worldPos - cameraPos);
    let fogFactor = exp(-uniforms.fogDensity * depth * 0.5);
    let fogColor = vec3<f32>(0.02, 0.02, 0.05); // Deep space background color
    col = mix(fogColor, col, clamp(fogFactor, 0.0, 1.0));

    if (uniforms.lesionActive > 0.0) {
        let dist = distance(input.worldPos, uniforms.lesionCenter);
        if (dist < uniforms.lesionRadius) {
            let lesionFactor = (1.0 - (dist / uniforms.lesionRadius)) * uniforms.lesionActive;
            col = mix(col, vec3<f32>(0.1, 0.1, 0.1), lesionFactor);
        }
    }
    return vec4<f32>(col, clamp(finalAlpha, 0.0, 1.0));
}
`;


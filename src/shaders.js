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
    // With regional sensitivity to hypoxia
    fn getRegionPhysics(worldPosition: vec3<f32>, style: f32) -> vec3<f32> {
        var decay = 0.96;
        var diffusion = 0.1;
        var flowBias = 0.0;
        var oxygenSensitivity = 1.0; // Regional vulnerability to hypoxia

        // Frontal Lobe: High retention for complex thought, MOST vulnerable to hypoxia
        if (worldPosition.z > 0.5) {
            decay = 0.998; // [Neuro-Weaver] V2.6: Hyper-retention for deep thought
            diffusion = 0.15;
            flowBias = -1.0;
            oxygenSensitivity = 1.8; // Executive function degrades first
        }
        // Occipital Lobe: Fast processing, visual inputs
        // [Scientific Fix] Occipital is NOT particularly resistant - it's at terminal
        // PCA branches (watershed zone) and can be vulnerable to hypoxia
        else if (worldPosition.z < -0.5) {
            decay = 0.92;
            diffusion = 0.04;
            oxygenSensitivity = 1.0; // Neutral - not resistant, at watershed zone
        }
        // Temporal Lobe: Auditory/Memory, memory centers vulnerable
        else if (abs(worldPosition.x) > 0.8) {
            decay = 0.95;
            oxygenSensitivity = 1.2; // Memory vulnerable to hypoxia
        }
        // Parietal Lobe: Sensory integration, baseline sensitivity
        else if (worldPosition.y > 0.6) {
            decay = 0.94;
            diffusion = 0.12;
            oxygenSensitivity = 1.0;
        }

        // Cyber Mode (Style 1): Digital signal logic
        if (abs(style - 1.0) < 0.1) {
            diffusion = 0.05;
            decay = 0.92;
            flowBias = 0.0;
        }

        // Store sensitivity multiplier in flowBias for later use
        // (Will be applied when hypoxia physics is calculated)
        return vec3<f32>(decay, diffusion, flowBias);
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

    // Hypoxia Physics: Returns (decayModifier, diffusionModifier, frequencyBoost)
    // Modulates neural signals based on oxygen availability and metabolic stress
    fn getHypoxiaPhysics(hypoxiaStress: f32, metabolicRate: f32, mitochondrialFunc: f32) -> vec3<f32> {
        // Decay increases with metabolic demand but limited by mitochondrial function
        // Signals burn out faster from ATP depletion
        let basalDecay = 0.96;
        let decayBoost = hypoxiaStress * 0.08 * metabolicRate * (1.0 - mitochondrialFunc);
        let decayMod = basalDecay - decayBoost;

        // Diffusion DECREASES with hypoxia (impaired axonal transport)
        // Cut diffusion by up to 50% at severe hypoxia
        let diffusionPenalty = hypoxiaStress * 0.5;
        let diffusionMod = max(0.01, 1.0 - diffusionPenalty);

        // Frequency modulation: initial boost (hyperventilation), then depression
        // Peak response around 50% hypoxia stress
        let freqBoost = hypoxiaStress * 2.0 * (1.0 - hypoxiaStress * 0.5);

        return vec3<f32>(decayMod, diffusionMod, freqBoost);
    }

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

    fn hashNoise3(p: vec3<f32>) -> f32 {
        return fract(sin(dot(p, vec3<f32>(12.9898, 78.233, 45.164))) * 43758.5453);
    }

    fn avalancheCriticality(cognitiveLoad: f32, stress: f32, fluidActive: f32) -> f32 {
        let drive = cognitiveLoad * 0.75 + stress * 0.9 + fluidActive * 0.35;
        return clamp(drive, 0.0, 1.0);
    }

    fn raySphereBounds(rayOrigin: vec3<f32>, rayDir: vec3<f32>, radius: f32) -> vec2<f32> {
        let b = dot(rayOrigin, rayDir);
        let c = dot(rayOrigin, rayOrigin) - radius * radius;
        let h = b * b - c;
        if (h < 0.0) {
            return vec2<f32>(1.0, -1.0);
        }
        let s = sqrt(h);
        return vec2<f32>(-b - s, -b + s);
    }

    fn raymarchHeatmapVolume(rayOrigin: vec3<f32>, rayDir: vec3<f32>, tMin: f32, tMax: f32, planeNormal: vec3<f32>, planeOffset: f32, time: f32) -> vec4<f32> {
        var startT = max(tMin, 0.0);
        var endT = tMax;

        let originPlane = dot(rayOrigin, planeNormal) + planeOffset;
        let dirPlane = dot(rayDir, planeNormal);
        if (originPlane < 0.0 && originPlane + dirPlane * endT < 0.0) {
            return vec4<f32>(0.0);
        }
        if (abs(dirPlane) > 1e-4) {
            let planeT = -originPlane / dirPlane;
            if (originPlane < 0.0) {
                startT = max(startT, planeT);
            } else if (originPlane + dirPlane * endT < 0.0) {
                endT = min(endT, planeT);
            }
        }

        if (endT <= startT) {
            return vec4<f32>(0.0);
        }

        let span = endT - startT;
        let stepCount: u32 = 28u;
        let stepSize = span / f32(stepCount);
        var t = startT;
        var transmittance = 1.0;
        var color = vec3<f32>(0.0);

        for (var i = 0u; i < 32u; i = i + 1u) {
            if (i >= stepCount || transmittance < 0.03) {
                break;
            }

            let samplePos = rayOrigin + rayDir * (t + stepSize * 0.5);
            let depthT = clamp((t + stepSize * 0.5 - startT) / span, 0.0, 1.0);
            let jitter = 0.86 + 0.14 * hashNoise3(samplePos * 2.75 + vec3<f32>(time * 0.08));
            let density = clamp(getVoxelValue(samplePos) * jitter, 0.0, 1.0);

            if (density > 0.0005) {
                let thermal = getHeatmapColor(pow(density, 0.85));
                let depthTint = mix(vec3<f32>(0.55, 0.75, 1.0), vec3<f32>(1.0, 0.58, 0.12), depthT);
                let burst = smoothstep(0.64, 0.95, density);
                let emission = thermal * depthTint + vec3<f32>(1.0, 0.9, 0.55) * burst * 0.55;
                let alpha = 1.0 - exp(-density * stepSize * 8.5);
                color += transmittance * emission * alpha;
                transmittance *= (1.0 - alpha * 0.9);
            } else {
                transmittance *= 0.995;
            }

            t += stepSize;
        }

        return vec4<f32>(color, clamp(1.0 - transmittance, 0.0, 1.0));
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
    pad5: f32,
    pad6: f32,
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
    let centerT = fract(travel * regionSpeed);
    let t0 = clamp(centerT - segmentSpan * 1.8, 0.0, 1.0);
    let t1 = clamp(centerT - segmentSpan * 0.9, 0.0, 1.0);
    let t2 = centerT;
    let t3 = clamp(centerT + segmentSpan * 0.9, 0.0, 1.0);
    let t4 = clamp(centerT + segmentSpan * 1.8, 0.0, 1.0);

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
    var finalColor = vec3<f32>(0.0);
    var signalStrength = 0.0;
    output.fiberMaterial = vec3<f32>(0.0);
    output.fiberTangent = vec3<f32>(0.0, 0.0, 1.0);
    output.fiberFlags = vec2<f32>(0.0);
    
    let activity = sampleSmoothedVoxelValue(input.position);
    let aiActivity = sampleSmoothedAIVoxelValue(input.position);

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
    // --- HEATMAP MODE ---
    else if (uniforms.style >= 3.0) {
        finalPos = input.position;
        finalColor = getHeatmapColor(activity);

        if (uniforms.colorShift > 0.0) {
             let warmShift = vec3<f32>(1.0, 0.5, 0.0);
             finalColor = mix(finalColor, warmShift, uniforms.colorShift * activity * 0.8);
        }
    }
    // --- GHOST MODE ---
    else {
            let displacement = normalize(input.position) * activity * 0.05;
            finalPos = input.position + displacement;

            // [Phase 5] Cortisol Structural Decay
            if (uniforms.cortisol > 0.0) {
                let decayFactor = 1.0 - (uniforms.cortisol * 0.3);
                finalPos *= max(0.0, decayFactor);
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
    pad5: f32,
    pad6: f32,
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

    return vec4<f32>(col, clamp(finalAlpha, 0.0, 1.0));
}
`;

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
    pad5: f32,
    pad6: f32,
}

struct FiberVertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec4<f32>,
    @location(2) fiberMeta: vec4<f32>,
    @location(3) fiberStart: vec3<f32>,
    @location(4) fiberEnd: vec3<f32>,
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
    let centerT = fract(travel * regionSpeed);
    let t0 = clamp(centerT - segmentSpan * 1.8, 0.0, 1.0);
    let t1 = clamp(centerT - segmentSpan * 0.9, 0.0, 1.0);
    let t2 = centerT;
    let t3 = clamp(centerT + segmentSpan * 0.9, 0.0, 1.0);
    let t4 = clamp(centerT + segmentSpan * 1.8, 0.0, 1.0);

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
    let worldPos = (uniforms.modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
    let worldNormal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal.xyz, 0.0)).xyz);
    let activity = sampleSmoothedVoxelValue(input.position);
    let aiActivity = sampleSmoothedAIVoxelValue(input.position);
    let radius = max(0.0025, input.fiberMeta.x);
    let bundleId = input.fiberMeta.y;
    let myelin = clamp(input.fiberMeta.z, 0.0, 1.0);
    let segmentPhase = input.fiberMeta.w;
    let isAI = bundleId >= 100.0;
    let degradation = clamp(uniforms.cortisol, 0.0, 1.0);
    let effectiveMyelin = myelin * (1.0 - degradation * (1.0 - myelin));
    let hierarchy = clamp(radius * select(18.0, 48.0, isAI), 0.0, 1.0);
    let taper = clamp(1.0 - hierarchy * 0.45, 0.35, 1.0);
    let tangent = normalize(input.fiberEnd - input.fiberStart);
    let midpoint = mix(input.fiberStart, input.fiberEnd, 0.5);
    let flowBias = getRegionPhysics(midpoint, uniforms.style).z;
    let conductionSpeed = uniforms.flowSpeed * select(1.0, 2.35, isAI) * (0.45 + effectiveMyelin * 1.65 + radius * 18.0);
    let signalStrength = calculateSignalFlow(input.fiberStart, input.fiberEnd, uniforms.time, conductionSpeed, segmentPhase, flowBias, effectiveMyelin, radius, bundleId);
    let aiSignal = calculateSignalFlow(input.fiberStart, input.fiberEnd, uniforms.time, uniforms.flowSpeed * 2.4 * (0.4 + effectiveMyelin * 0.8 + radius * 10.0), segmentPhase, flowBias, 0.12, radius * 0.35, bundleId + 100.0);
    let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, abs(signalStrength - aiSignal));
    var baseColor = vec3<f32>(0.0);

    if (isAI) {
        let aiHue = (bundleId - 100.0) * 0.21 + uniforms.time * 0.4;
        baseColor = vec3<f32>(
            0.85 + 0.15 * sin(aiHue),
            0.15 + 0.25 * sin(aiHue + 2.5),
            0.75 + 0.25 * sin(aiHue + 1.2)
        );
        let spiky = smoothstep(0.68, 0.96, signalStrength + aiActivity * 0.5 + sin(uniforms.time * 14.0 + segmentPhase * 20.0) * 0.12);
        baseColor += vec3<f32>(1.0, 0.2, 0.9) * (signalStrength * 0.8 + spiky * 0.4);
    } else {
        let wave = sin(uniforms.time * 1.2 + segmentPhase * 9.0 + input.position.y * 3.0) * 0.5 + 0.5;
        baseColor = mix(vec3<f32>(0.0, 0.82, 1.0), vec3<f32>(0.08, 0.95, 0.48), wave);
        baseColor += mix(vec3<f32>(0.1, 0.8, 1.0), vec3<f32>(1.0, 0.9, 0.35), uniforms.colorShift) * signalStrength * 0.85;
    }

    let ranvier = 0.75 + 0.25 * sin(segmentPhase * 42.0 + uniforms.time * 8.0 + dot(input.position, tangent) * 9.0);
    let sheath = mix(0.8, 1.25, effectiveMyelin) * ranvier;
    baseColor += vec3<f32>(1.0, 0.92, 0.55) * resonance * select(0.08, 0.18, isAI);

    output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
    output.worldPos = worldPos;
    output.normal = worldNormal;
    output.color = baseColor * sheath;
    output.activity = activity;
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    output.signal = select(signalStrength, aiActivity + signalStrength * 0.4, isAI);
    output.distToCenter = length(input.position);
    output.fiberMaterial = vec4<f32>(effectiveMyelin, radius, hierarchy, taper);
    output.fiberTangent = tangent;
    output.fiberFlags = vec2<f32>(select(0.0, 1.0, isAI), resonance);
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
    pad5: f32,
    pad6: f32,
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
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;

@fragment
fn main(input: FiberFragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
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
    let finalRgb = diffuse * twistShade + highlight + activityGlow + avalancheColor + vec3<f32>(1.0, 0.95, 0.65) * resonance * 0.35;
    let alpha = clamp(0.18 + input.signal * 0.34 + ndotl * 0.16 + rim * 0.16 + anisotropic * 0.12, 0.12, 0.94) * ambientOcclusion * mix(0.8, 1.0, taper);

    return vec4<f32>(finalRgb, alpha);
}
`;

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
    pad5: f32,
    pad6: f32,
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

    let activity = sampleSmoothedVoxelValue(advectedInstancePos);
    let aiActivity = sampleSmoothedAIVoxelValue(advectedInstancePos);

    // Dynamic scale: base + activity burst + pulse
    var scale = baseScale;
    let firing = activity * 3.0;
    let pulse = 1.0 + 0.35 * sin(uniforms.time * 6.0 + phase) * activity;
    scale *= (1.0 + firing) * pulse;

    if (typeId < 0.5) { scale *= 1.5; }
    else if (typeId < 1.5) { scale *= 1.0; }
    else { scale *= 0.6; }

    scale *= uniforms.pointCloudDensity;

    if (length(advectedInstancePos) > uniforms.growth * 1.8) {
        scale = 0.0;
    }
    if (uniforms.cortisol > 0.0) {
        let decayFactor = 1.0 - (uniforms.cortisol * 0.8);
        scale *= max(0.0, decayFactor);
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
            color = vec3<f32>(0.85, 0.25, 0.95) * (0.5 + activity);
            color += vec3<f32>(1.0, 0.6, 0.9) * aiActivity * 0.8;
        } else {
            color = vec3<f32>(0.1, 0.75, 1.0) * (0.5 + activity);
            color += vec3<f32>(0.6, 0.9, 1.0) * activity * 0.5;
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

    if (activity > 0.7) {
        color += vec3<f32>(1.0, 0.95, 0.8) * (activity - 0.7) * 3.0;
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
    pad5: f32,
    pad6: f32,
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
    let col = mix(fogColor, lit, clamp(fogFactor, 0.0, 1.0));

    return vec4<f32>(col, 1.0);
}
`;

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
    pad5: f32,
    pad6: f32,
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
    pad5: f32,
    pad6: f32,
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

export const computeShader = `
// V3.2 Compute Logic: Multi-direction fiber-coupled diffusion
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
    // Altitude/Hypoxia parameters for compute shader physics
    hypoxiaStress: f32,
    metabolicRate: f32,
    mitochondrialFunction: f32,
    // Environmental hazards + cognitive state (matches JS layout)
    fluidActive: f32,        // offset 60
    electricalActive: f32,   // offset 64
    mercuryActive: f32,      // offset 68
    cognitiveLoad: f32,      // offset 72
    stress: f32,             // offset 76
    heavyMetal: f32,         // offset 80
    pad2: f32,               // offset 84
    // [SynaptiX] AI Tensor Mirror params (offset 88)
    aiInfluence: f32,
    resonanceThreshold: f32,
    synaptiXActive: f32,
    // [V3.2] Fiber-volume coupling (offset 100)
    fiberCoupling: f32,
}

@group(0) @binding(0) var<storage, read_write> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;
@group(0) @binding(2) var<storage, read> fiberDirections: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> aiTensor: array<f32>;

fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

fn indexToWorld(index: u32, dim: u32) -> vec3<f32> {
    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;
    let normalizedPosition = vec3<f32>(f32(x), f32(y), f32(z)) / f32(dim);
    return (normalizedPosition * 2.0 - 1.0) * BRAIN_RANGE;
}

fn worldToIndex(worldPosition: vec3<f32>, dim: u32) -> u32 {
    let normalized = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(0.99999));
    let x = u32(normalized.x * f32(dim));
    let y = u32(normalized.y * f32(dim));
    let z = u32(normalized.z * f32(dim));
    return getIndex(x, y, z);
}

fn sampleAIActivation(worldPosition: vec3<f32>, dim: u32) -> f32 {
    return aiTensor[worldToIndex(worldPosition, dim)];
}

// [V3.2] Read 3 fiber affinities for a voxel: each vec4 = (dir.xyz, weight)
fn getFiberAffinity(index: u32, slot: u32) -> vec4<f32> {
    return fiberDirections[index * 3u + slot];
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

    var val = activityTensor[index];

    let worldPosition = indexToWorld(index, dim);
    let normalizedPosition = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(1.0));

    let physics = getRegionPhysics(worldPosition, params.style);
    var decay = physics.x;
    var diffusion = physics.y;
    let flowBias = physics.z;

    // Apply hypoxia physics modulation
    let hypoxiaPhysics = getHypoxiaPhysics(params.hypoxiaStress, params.metabolicRate, params.mitochondrialFunction);
    decay *= hypoxiaPhysics.x;
    diffusion *= hypoxiaPhysics.y;

    // Safe neighbor reads
    let xm = select(0u, x - 1u, x > 0u);
    let xp = select(dim - 1u, x + 1u, x < dim - 1u);
    let ym = select(0u, y - 1u, y > 0u);
    let yp = select(dim - 1u, y + 1u, y < dim - 1u);
    let zm = select(0u, z - 1u, z > 0u);
    let zp = select(dim - 1u, z + 1u, z < dim - 1u);

    let valXm = activityTensor[getIndex(xm, y, z)];
    let valXp = activityTensor[getIndex(xp, y, z)];
    let valYm = activityTensor[getIndex(x, ym, z)];
    let valYp = activityTensor[getIndex(x, yp, z)];
    let valZm = activityTensor[getIndex(x, y, zm)];
    let valZp = activityTensor[getIndex(x, y, zp)];

    var gradX = (valXp - valXm) * 0.5;
    var gradY = (valYp - valYm) * 0.5;
    var gradZ = (valZp - valZm) * 0.5;
    let gradient = vec3<f32>(gradX, gradY, gradZ);

    let avg = (valXm + valXp + valYm + valYp + valZm + valZp) / 6.0;

    // [V3.2] Multi-direction anisotropic diffusion
    var diffused = avg;
    var totalFiberWeight = 0.0;
    for (var slot = 0u; slot < 3u; slot = slot + 1u) {
        let aff = getFiberAffinity(index, slot);
        let weight = aff.w;
        if (weight < 0.01) { continue; }
        let fiberDir = aff.xyz;
        let along = dot(gradient, fiberDir);
        let perpVec = gradient - along * fiberDir;
        let diffusionAlong = diffusion * 1.6 * weight;
        let diffusionPerp  = diffusion * 0.35;
        diffused = diffused + along * diffusionAlong + dot(perpVec, perpVec) * diffusionPerp * sign(along);
        totalFiberWeight = totalFiberWeight + weight;
    }
    if (totalFiberWeight > 0.0) {
        diffused = avg + (diffused - avg) / totalFiberWeight;
    }
    val = mix(val, diffused, 0.7);

    // [V3.2] Highway bias: sustained activity along dominant fiber tracts
    if (params.fiberCoupling > 0.0) {
        for (var slot = 0u; slot < 3u; slot = slot + 1u) {
            let aff = getFiberAffinity(index, slot);
            let weight = aff.w;
            if (weight < 0.01) { continue; }
            let fiberDir = aff.xyz;
            let step = (BRAIN_RANGE / f32(dim)) * 0.8;
            let upstreamPos = worldPosition - fiberDir * step;
            let downstreamPos = worldPosition + fiberDir * step;
            let upVal = getVoxelValue(upstreamPos);
            let downVal = getVoxelValue(downstreamPos);
            let highway = max(upVal, downVal) * weight * params.fiberCoupling * 0.25;
            val = val + highway;
        }
    }

    // [Phase 10] Criticality Cascades
    let criticality = avalancheCriticality(params.cognitiveLoad, params.stress, params.fluidActive);
    let localPeak = max(max(max(val, valXm), valXp), max(max(valYm, valYp), max(valZm, valZp)));
    let avalancheThreshold = params.spikeThreshold * mix(1.08, 0.72, criticality);
    let seeded = step(avalancheThreshold, localPeak);
    let cascadeNoise = 0.72 + 0.28 * hashNoise3(worldPosition * 1.7 + vec3<f32>(params.time * 0.31));
    let primaryAff = getFiberAffinity(index, 0u);
    var branchBias = 0.5;
    if (primaryAff.w > 0.01) {
        branchBias = clamp(0.5 + 0.5 * dot(normalize(gradient + vec3<f32>(0.001, 0.001, 0.001)), primaryAff.xyz), 0.0, 1.0);
    }
    let cascade = seeded * cascadeNoise * mix(0.18, 1.0, branchBias) * (0.35 + criticality * 0.85);
    if (cascade > 0.0) {
        val = max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5));
        val = val + cascade * branchBias * 0.48;
        diffusion *= mix(1.0, 1.32, cascade);
        decay *= mix(1.0, mix(0.94, 0.82, criticality), cascade);
    }

    // [V3.2] Traveling Phase Wave along strongest fiber direction
    let phaseSpeed = 4.0;
    let waveFreq = 6.2832;
    var travelingWave = 0.0;
    if (primaryAff.w > 0.01) {
        let spatialPhase = dot(normalizedPosition, primaryAff.xyz) * waveFreq;
        travelingWave = sin(spatialPhase - params.time * phaseSpeed) * 0.5 + 0.5;
    } else {
        travelingWave = sin(dot(normalizedPosition, vec3<f32>(0.0, 1.0, 0.0)) * waveFreq - params.time * phaseSpeed) * 0.5 + 0.5;
    }
    val = val + val * (travelingWave - 0.5) * 0.08;

    // Directional Flow Logic
    if (flowBias < -0.1) {
        if (z < dim - 1u) {
            let upstream = activityTensor[getIndex(x, y, z + 1u)];
            val = mix(val, upstream, diffusion * 0.4);
        }
    }

    // Fluid Dynamics
    if (params.fluidActive > 0.0) {
        let timeSpeed = params.time * 2.0;
        let flowVelocity = vec3<f32>(
            sin(worldPosition.y * 3.0 + timeSpeed) * cos(worldPosition.z * 2.0 - timeSpeed),
            cos(worldPosition.x * 3.0 - timeSpeed) * sin(worldPosition.z * 2.0 + timeSpeed),
            sin(worldPosition.x * 2.0 + timeSpeed) * cos(worldPosition.y * 3.0 - timeSpeed)
        ) * 0.5 * params.fluidActive;
        let samplePos = worldPosition - flowVelocity;
        let normalizedSamplePos = (samplePos / BRAIN_RANGE) * 0.5 + 0.5;
        let sx = u32(clamp(normalizedSamplePos.x * f32(dim), 0.0, f32(dim - 1u)));
        let sy = u32(clamp(normalizedSamplePos.y * f32(dim), 0.0, f32(dim - 1u)));
        let sz = u32(clamp(normalizedSamplePos.z * f32(dim), 0.0, f32(dim - 1u)));
        let upstreamIndex = getIndex(sx, sy, sz);
        let upstreamVal = activityTensor[upstreamIndex];
        val = mix(val, upstreamVal, min(1.0, params.fluidActive * 0.5));
    }

    // Stimulus Injection
    if (params.stimulusActive > 0.0) {
        let d = distance(worldPosition, params.stimulusPos);
        var signal = gaussian_pulse(d, 0.5);
        signal *= params.mitochondrialFunction;
        if (signal > 0.01) {
            val = val + params.stimulusActive * signal;
        }
    }

    // Electrical Exposure
    if (params.electricalActive > 0.0) {
        let noise = fract(sin(dot(worldPosition.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.95) {
            val = val + params.electricalActive * 5.0;
        }
    }

    // Mercury Vapor
    if (params.mercuryActive > 0.0) {
        let d_merc = distance(worldPosition, vec3<f32>(0.0, 0.0, -1.2));
        var mercSignal = gaussian_pulse(d_merc, 1.2);
        val = val + params.mercuryActive * mercSignal * 0.5;
        decay = min(decay, 0.999);
    }

    // Heavy Metal
    if (params.heavyMetal > 0.0) {
        val = min(val, 1.0 - (params.heavyMetal * 0.8));
        decay = min(decay, 0.999 - (params.heavyMetal * 0.05));
    }

    // SynaptiX AI mirror
    if (params.synaptiXActive > 0.5) {
        let aiVal = sampleAIActivation(worldPosition, dim);
        let aiEnergy = aiVal * params.aiInfluence;
        if (aiEnergy > 0.0005 || val > 0.0005) {
            let aiRegion = getRegionPhysics(worldPosition, 1.0);
            let aiDiffusionBias = clamp(aiRegion.y / 0.15, 0.0, 1.0);
            let aiGeometricDecay = mix(1.18, 0.86, aiDiffusionBias);
            let aiSparsity = smoothstep(0.14, 0.82, aiVal);
            let aiPhase = hashNoise3(worldPosition * (8.0 + params.frequency * 0.35) + vec3<f32>(params.time * 0.45));
            let aiSpike = smoothstep(0.72, 0.98, aiPhase) * aiSparsity * (0.35 + params.aiInfluence * 0.65);
            var processedAI = pow(clamp(aiVal, 0.0, 1.0), aiGeometricDecay) * mix(0.7, 1.28, aiSparsity);
            processedAI = processedAI + aiSpike * 0.28;
            processedAI = clamp(processedAI, 0.0, 1.0);
            let humanVal = val;
            var blended = mix(humanVal, processedAI, params.aiInfluence);
            let diff = abs(humanVal - processedAI);
            let resonance = select(0.0, 1.0, diff < params.resonanceThreshold);
            let resonanceSoft = 1.0 - smoothstep(0.0, params.resonanceThreshold, diff);
            if (resonance > 0.5) {
                let burst = (0.22 + 0.58 * resonanceSoft) * max(humanVal, processedAI);
                blended = blended + burst;
            }
            let divergence = smoothstep(params.resonanceThreshold * 1.75, params.resonanceThreshold * 4.0, diff);
            blended *= 1.0 - divergence * 0.18;
            val = blended;
        }
    }

    val *= decay;
    activityTensor[index] = clamp(val, 0.0, 1.0);
}
`;

// [Phase 7] Post-Processing Shaders

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
    pad5: f32,
    pad6: f32,
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
    let blurAmount = coc * uniforms.aperture * 10.0;

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
    pad5: f32,
    pad6: f32,
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

    var scale = baseScale * uniforms.pointCloudDensity;
    let firing = activity * 2.5;
    let pulse = 1.0 + 0.25 * sin(uniforms.time * 8.0 + phase) * activity;
    scale *= (1.0 + firing) * pulse;

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

    var color: vec3<f32>;
    if (uniforms.style >= 4.0) {
        if (isAI) {
            color = vec3<f32>(0.9, 0.3, 1.0) * (0.4 + activity);
            color += vec3<f32>(0.7, 0.15, 0.85) * aiActivity * 0.6;
        } else {
            color = vec3<f32>(0.15, 0.7, 0.95) * (0.4 + activity);
            color += vec3<f32>(0.5, 0.85, 1.0) * activity * 0.4;
        }
        let resonance = 1.0 - smoothstep(0.0, uniforms.resonanceThreshold, abs(activity - aiActivity));
        color += vec3<f32>(1.0, 0.95, 0.7) * resonance * max(activity, aiActivity) * 1.2;
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
    }

    if (activity > 0.65) {
        color += vec3<f32>(1.0, 0.95, 0.85) * (activity - 0.65) * 2.5;
    }

    var alpha = clamp(0.35 + activity * 0.65, 0.0, 1.0);
    if (isAI) { alpha *= 0.9; }

    output.position = uniforms.mvpMatrix * vec4<f32>(worldPos, 1.0);
    output.color = color;
    output.uv = input.corner;
    output.alpha = alpha;
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
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
    pad5: f32,
    pad6: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
    let d = length(input.uv);
    let falloff = exp(-d * d * 5.0);
    let col = input.color * falloff;
    return vec4<f32>(col, clamp(input.alpha * falloff, 0.0, 1.0));
}
`;

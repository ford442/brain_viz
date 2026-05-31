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

    fn raymarchHeatmapVolume(rayOrigin: vec3<f32>, rayDir: vec3<f32>, tMin: f32, tMax: f32, planeNormal: vec3<f32>, planeOffset: f32) -> vec4<f32> {
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
            let jitter = 0.86 + 0.14 * hashNoise3(samplePos * 2.75 + vec3<f32>(uniforms.time * 0.08));
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
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) fiberMeta: vec4<f32>,
    @location(2) fiberStart: vec3<f32>,
    @location(3) fiberEnd: vec3<f32>,
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
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
// [Verified] Volumetric Data: Flattened 3D buffer representing brain activity
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;

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
    var finalNormal = input.normal;
    var finalColor = vec3<f32>(0.0);
    var signalStrength = 0.0;
    output.fiberMaterial = vec3<f32>(0.0);
    output.fiberTangent = vec3<f32>(0.0, 0.0, 1.0);
    
    let activity = sampleSmoothedVoxelValue(input.position);

    let worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;

    // --- CONNECTOME MODE ---
    // [V2.3] Traveling Pulse Logic (Activity Trails)
    // [Neuro-Weaver] Simulates information flow along the axon fibers using spatial phase offset
    // Signals travel along the fibers based on vertex index and flow speed
    if (uniforms.style >= 2.0 && uniforms.style < 3.0) {
        finalPos = input.position;
        let radius = max(0.002, input.fiberMeta.x);
        let bundleId = input.fiberMeta.y;
        let myelin = clamp(input.fiberMeta.z, 0.0, 1.0);
        let segmentPhase = input.fiberMeta.w;
        let degradation = clamp(uniforms.cortisol, 0.0, 1.0);
        let effectiveMyelin = myelin * (1.0 - degradation * (1.0 - myelin));
        let effectiveRadius = radius * mix(0.45, 1.0, effectiveMyelin);

        let conductionSpeed = uniforms.flowSpeed * (0.45 + effectiveMyelin * 1.65 + effectiveRadius * 18.0);
        signalStrength = calculateSignalFlow(input.fiberStart, input.fiberEnd, uniforms.time, conductionSpeed, segmentPhase, getRegionPhysics(mix(input.fiberStart, input.fiberEnd, 0.5), uniforms.style).z, effectiveMyelin, effectiveRadius, bundleId);
        let tangent = normalize(input.fiberEnd - input.fiberStart);
        let refAxis = select(vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), abs(tangent.y) > 0.82);
        let sideAxis = normalize(cross(tangent, refAxis));
        finalNormal = normalize(cross(sideAxis, tangent));

        let hue = bundleId * 0.83 + uniforms.colorShift * 2.3;
        let bundleColor = vec3<f32>(
            0.35 + 0.65 * (0.5 + 0.5 * sin(hue)),
            0.35 + 0.65 * (0.5 + 0.5 * sin(hue + 2.094)),
            0.35 + 0.65 * (0.5 + 0.5 * sin(hue + 4.188))
        );

        let hierarchy = clamp(effectiveRadius * 16.0, 0.0, 1.0);
        let brightness = mix(0.35, 1.55, effectiveMyelin) * mix(0.65, 1.45, hierarchy);
        let pulseColor = mix(vec3<f32>(0.1, 0.8, 1.0), vec3<f32>(1.0, 0.9, 0.35), uniforms.colorShift);
        let pulseBoost = signalStrength * (0.5 + effectiveMyelin * 0.9 + hierarchy * 0.6);

        finalColor = bundleColor * brightness + pulseColor * pulseBoost;

        if (uniforms.sparkle > 0.0) {
            let flicker = sin(uniforms.time * 40.0 + f32(vertexIndex) * 0.1 + bundleId);
            if (flicker > 0.8) {
                finalColor += vec3<f32>(1.0) * uniforms.sparkle * (0.4 + effectiveMyelin * 0.6);
            }
        }

        output.fiberMaterial = vec3<f32>(effectiveMyelin, effectiveRadius, hierarchy);
        output.fiberTangent = tangent;
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

        // [Phase 5] Cortisol Structural Decay
        if (uniforms.cortisol > 0.0) {
            let decayFactor = 1.0 - (uniforms.cortisol * 0.3);
            finalPos *= max(0.0, decayFactor);
        }

        // [Phase 2] Cognitive Stress Distortion
        if (uniforms.stress > 0.0) {
            let noiseFreq = 15.0;
            let stressDisp = sin(finalPos.x * noiseFreq + uniforms.time * 10.0) * cos(finalPos.y * noiseFreq + uniforms.time * 8.0) * sin(finalPos.z * noiseFreq);
            finalPos += input.normal * stressDisp * uniforms.stress * 0.5;
        }

        // [Phase 5] Cortisol Structural Decay
        if (uniforms.cortisol > 0.0) {
            // Decay structural integrity based on cortisol level (shrinks vertices inward, especially higher activity areas)
            let decayErosion = uniforms.cortisol * 0.2 * (1.0 - activity);
            finalPos -= input.normal * decayErosion;
        }

        // [Phase 6] Heavy Metal Structural Alteration
        if (uniforms.heavyMetal > 0.0) {
            let lesionNoise = fract(sin(dot(finalPos.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
            let erosion = uniforms.heavyMetal * 0.3 * lesionNoise;
            finalPos -= input.normal * erosion;
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
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;

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
    @location(7) fiberMaterial: vec3<f32>,
    @location(8) fiberTangent: vec3<f32>,
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

    // [Neuro-Weaver] Style 3.0: Translucent Heatmap Shell
    // Volume raymarch through the tensor so the interior reads as a true thermal body
    if (uniforms.style >= 3.0) {
        let rayOrigin = vec3<f32>(0.0, 0.0, uniforms.zoom);
        let rayDir = normalize(input.worldPos - rayOrigin);
        let bounds = raySphereBounds(rayOrigin, rayDir, BRAIN_RANGE);

        if (bounds.y <= bounds.x) {
            discard;
        }

        let volume = raymarchHeatmapVolume(rayOrigin, rayDir, bounds.x, bounds.y, uniforms.slicePlane.xyz, uniforms.slicePlane.w);
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
        let metallic = mix(vec3<f32>(0.4, 0.5, 0.62), vec3<f32>(1.0, 0.95, 0.8), myelin);
        let highlight = metallic * (specular * (0.6 + radius * 0.4) + rim * 0.32 + tangentFacing * 0.08);
        let activityGlow = vec3<f32>(0.12, 0.45, 0.9) * input.signal * mix(0.55, 1.0, myelin);
        let avalancheColor = vec3<f32>(1.0, 0.92, 0.58) * avalanche * (0.45 + localDensity * 0.8);
        let finalRgb = fiberBase + highlight + activityGlow + avalancheColor;

        let alpha = clamp(0.22 + (input.signal * 0.36) + (ndotl * 0.18) + (rim * 0.14) + avalanche * 0.1, 0.12, 0.82) * ambientOcclusion;
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
    sparkle: f32, // [Phase 5] Synaptic Sparkles
    growth: f32, // [Phase 6]
    aberration: f32, // [Phase 7]
    grain: f32, // [Phase 7],
    lightDir: vec3<f32>, // [Phase 2]
    ambientLight: f32, // [Phase 2]
    dirIntensity: f32, // [Phase 2]
    stress: f32,
    cortisol: f32,
    focus: f32, // [Phase 7]
    aperture: f32, // [Phase 7]
    fogDensity: f32,
    zoom: f32,
    heavyMetal: f32,
    fluidActive: f32,
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

@vertex
fn main_soma(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // Procedural Cellular Advection (Phase 9)
    // Evaluate fluid velocity field to push soma particles
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

    // [Verified] Instanced Neurons: Somas scaled by local tensor activity
    // [Neuro-Weaver] Reactive scaling to visualize firing intensity (0.02 base + activity)
    var scale = 0.02 + (activity * 0.12);

    // [Phase 5] Sparkle Logic: Pop Scale
    if (uniforms.sparkle > 0.0) {
        let noise = fract(sin(dot(advectedInstancePos.xy, vec2(12.9898, 78.233))) * 43758.5453);
        let flicker = sin(uniforms.time * 30.0 + noise * 50.0);
        if (flicker > 0.5) {
             scale += uniforms.sparkle * 0.03 * flicker;
        }
    }

    // [Phase 6] Dendritic Growth: Hide instances outside radius
    if (length(advectedInstancePos) > uniforms.growth * 1.8) {
        scale = 0.0;
    }
    // [Phase 5] Cortisol Structural Decay: Scale inward and simulate breakdown
    if (uniforms.cortisol > 0.0) {
        let decayFactor = 1.0 - (uniforms.cortisol * 0.8);
        scale *= max(0.0, decayFactor);
    }
    let pos = (input.position * scale) + advectedInstancePos;

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

    // [Phase 5] Sparkle Logic: Flash Color
    if (uniforms.sparkle > 0.0 && activity > 0.1) {
         let noise = fract(sin(dot(input.instancePos.zx, vec2(34.123, 19.33))) * 12345.67);
         let flash = step(0.95 - (uniforms.sparkle * 0.2), sin(uniforms.time * 40.0 + noise * 10.0));
         output.color += vec3<f32>(0.8, 0.9, 1.0) * flash * uniforms.sparkle;
    }
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
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) color: vec3<f32>,
    @location(2) clipDist: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }

    // Apply volumetric fog based on fragment depth
    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let depth = length(input.worldPos - cameraPos);
    let fogFactor = exp(-uniforms.fogDensity * depth * 0.5);
    let fogColor = vec3<f32>(0.02, 0.02, 0.05); // Deep space background color
    let col = mix(fogColor, input.color, clamp(fogFactor, 0.0, 1.0));

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

@vertex
fn main(input: SparkInput) -> SparkOutput {
    var output: SparkOutput;

    let anchor = input.anchorPhase.xyz;
    let tangent = normalize(input.tangentStrength.xyz);
    let strength = input.tangentStrength.w;
    let bundleId = input.material.x;
    let myelin = clamp(input.material.y, 0.0, 1.0);
    let kind = input.material.z;

    let localActivity = sampleSmoothedVoxelValue(anchor);
    let pulseSpeed = uniforms.flowSpeed * mix(0.55, 1.25, localActivity + uniforms.fluidActive * 0.2);
    let travel = (fract(uniforms.time * pulseSpeed + input.anchorPhase.w + bundleId * 0.071) - 0.5);
    let trailScale = mix(0.10, 0.34, localActivity) * mix(0.8, 1.25, strength);
    var center = anchor + tangent * (travel * trailScale);

    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let viewDir = normalize(cameraPos - center);
    var side = cross(viewDir, tangent);
    if (length(side) < 0.001) {
        side = cross(vec3<f32>(0.0, 1.0, 0.0), tangent);
    }
    side = normalize(side);
    let up = normalize(cross(tangent, side));

    let size = mix(0.014, 0.052, strength) * mix(0.75, 1.35, myelin);
    let offset = side * input.corner.x * size + up * input.corner.y * size;
    let worldPos = center + offset;

    let thermal = getHeatmapColor(clamp(localActivity * 1.1 + strength * 0.35, 0.0, 1.0));
    let sparkTint = mix(vec3<f32>(0.2, 0.9, 1.0), vec3<f32>(1.0, 0.75, 0.25), clamp(kind * 0.5 + bundleId * 0.05, 0.0, 1.0));
    output.color = thermal * sparkTint;
    output.uv = input.corner;
    output.alpha = clamp((0.14 + localActivity * 0.55 + strength * 0.3) * mix(0.7, 1.2, myelin), 0.08, 1.0);
    output.position = uniforms.mvpMatrix * vec4<f32>(worldPos, 1.0);
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    return output;
}
`;

export const sparkFragmentShader = `
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
    // Altitude/Hypoxia parameters for compute shader physics
    hypoxiaStress: f32,
    metabolicRate: f32,
    mitochondrialFunction: f32,
    cognitiveLoad: f32,
    stress: f32,
    // Padding to 96 bytes is handled, now adding environmental hazards
    fluidActive: f32,
    electricalActive: f32,
    mercuryActive: f32,
    heavyMetal: f32,
    pad2: f32,
}

@group(0) @binding(0) var<storage, read_write> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;
@group(0) @binding(2) var<storage, read> fiberDirections: array<vec4<f32>>;

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
    var decay = physics.x;
    var diffusion = physics.y;
    let flowBias = physics.z;

    // Apply hypoxia physics modulation
    let hypoxiaPhysics = getHypoxiaPhysics(params.hypoxiaStress, params.metabolicRate, params.mitochondrialFunction);
    decay *= hypoxiaPhysics.x;      // Accelerated decay under hypoxia
    diffusion *= hypoxiaPhysics.y;  // Reduced signal propagation

    // [Phase 3/8] Anisotropic Diffusion with Fiber Direction Field
    // Read precomputed fiber direction for this voxel (xyz = direction, w unused)
    let fiberDir = fiberDirections[index].xyz;

    // Compute discrete gradient from 6-neighbor differences
    var gradX = 0.0;
    var gradY = 0.0;
    var gradZ = 0.0;
    var neighborSum = 0.0;
    var neighborCount = 0.0;

    // Safe neighbor reads (clamp indices to avoid out-of-bounds)
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

    // Discrete gradient (central differences)
    gradX = (valXp - valXm) * 0.5;
    gradY = (valYp - valYm) * 0.5;
    gradZ = (valZp - valZm) * 0.5;
    let gradient = vec3<f32>(gradX, gradY, gradZ);

    // Neighbor average (6-neighbor with clamped boundary conditions)
    neighborSum = valXm + valXp + valYm + valYp + valZm + valZp;
    neighborCount = 6.0;

    let avg = neighborSum / max(1.0, neighborCount);

    // Anisotropic diffusion: stronger along fiber direction, weaker perpendicular
    let along = dot(gradient, fiberDir);
    let perpVec = gradient - along * fiberDir;

    let diffusionAlong = diffusion * 1.6;
    let diffusionPerp  = diffusion * 0.35;

    let diffused = avg + along * diffusionAlong + dot(perpVec, perpVec) * diffusionPerp * sign(along);
    val = mix(val, diffused, 0.7);

    // [Phase 10] Criticality Cascades: thresholded local ignition biased by fiber direction
    let criticality = avalancheCriticality(params.cognitiveLoad, params.stress, params.fluidActive);
    let localPeak = max(max(max(val, valXm), valXp), max(max(valYm, valYp), max(valZm, valZp)));
    let avalancheThreshold = params.spikeThreshold * mix(1.08, 0.72, criticality);
    let seeded = step(avalancheThreshold, localPeak);
    let branchBias = clamp(0.5 + 0.5 * dot(normalize(gradient + vec3<f32>(0.001, 0.001, 0.001)), fiberDir), 0.0, 1.0);
    let cascadeNoise = 0.72 + 0.28 * hashNoise3(worldPosition * 1.7 + vec3<f32>(params.time * 0.31));
    let cascade = seeded * cascadeNoise * mix(0.18, 1.0, branchBias) * (0.35 + criticality * 0.85);
    if (cascade > 0.0) {
        val = max(val, localPeak * 0.84 + cascade * (0.42 + localPeak * 0.5));
        val += cascade * branchBias * 0.48;
        diffusion *= mix(1.0, 1.32, cascade);
        decay *= mix(1.0, mix(0.94, 0.82, criticality), cascade);
    }

    // [Phase 3/8] Traveling Phase Wave (oscillatory propagation along fibers)
    let phaseSpeed = 4.0;
    let waveFreq = 6.2832; // 2*PI
    let spatialPhase = dot(normalizedPosition, fiberDir) * waveFreq;
    let travelingWave = sin(spatialPhase - params.time * phaseSpeed) * 0.5 + 0.5;
    // Modulate existing signal with traveling wave (subtle structured pattern)
    val += val * (travelingWave - 0.5) * 0.08;

    // [Neuro-Weaver] Directional Flow Logic
    // If flowBias is negative, pull signal from 'upstream' (Frontal/Z+)
    if (flowBias < -0.1) {
        if (z < dim - 1u) {
            let upstream = activityTensor[getIndex(x, y, z + 1u)];
            val = mix(val, upstream, diffusion * 0.4);
        }
    }

    // Procedural Volumetric Fluid Dynamics (Advection)
    // Simulates neurotransmitter diffusion using volumetric rendering
    if (params.fluidActive > 0.0) {
        // Create a procedural velocity field (swirling advection)
        let timeSpeed = params.time * 2.0;
        let flowVelocity = vec3<f32>(
            sin(worldPosition.y * 3.0 + timeSpeed) * cos(worldPosition.z * 2.0 - timeSpeed),
            cos(worldPosition.x * 3.0 - timeSpeed) * sin(worldPosition.z * 2.0 + timeSpeed),
            sin(worldPosition.x * 2.0 + timeSpeed) * cos(worldPosition.y * 3.0 - timeSpeed)
        ) * 0.5 * params.fluidActive;

        // Determine coordinates to sample "upstream" density from
        let samplePos = worldPosition - flowVelocity;

        // Convert sample pos back to grid coordinates
        let normalizedSamplePos = (samplePos / BRAIN_RANGE) * 0.5 + 0.5;
        let sx = u32(clamp(normalizedSamplePos.x * f32(dim), 0.0, f32(dim - 1u)));
        let sy = u32(clamp(normalizedSamplePos.y * f32(dim), 0.0, f32(dim - 1u)));
        let sz = u32(clamp(normalizedSamplePos.z * f32(dim), 0.0, f32(dim - 1u)));

        let upstreamIndex = getIndex(sx, sy, sz);
        let upstreamVal = activityTensor[upstreamIndex];

        // Advect: mix current value with upstream value based on fluidActive intensity
        val = mix(val, upstreamVal, min(1.0, params.fluidActive * 0.5));
    }

    // [Neuro-Weaver] 2. Stimulus Injection
    // Direct voxel manipulation from CPU events (injected via uniforms)
    if (params.stimulusActive > 0.0) {
        // Calculate distance from stimulus center
        let d = distance(worldPosition, params.stimulusPos);
        // Use wider Gaussian for more organic impact
        var signal = gaussian_pulse(d, 0.5);

        // Hypoxia dampens stimulus response (brain less responsive to stimuli)
        signal *= params.mitochondrialFunction;

        // Accumulate signal if above threshold
        if (signal > 0.01) {
            val += params.stimulusActive * signal;
        }
    }

    // [Neuro-Weaver] Electrical Exposure
    if (params.electricalActive > 0.0) {
        // High frequency global random spikes
        let noise = fract(sin(dot(worldPosition.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (noise > 0.95) {
            val += params.electricalActive * 5.0;
        }
    }

    // [Neuro-Weaver] Mercury Vapor Exposure
    if (params.mercuryActive > 0.0) {
        // Accumulates in Occipital/Parietal regions
        let d_merc = distance(worldPosition, vec3<f32>(0.0, 0.0, -1.2));
        var mercSignal = gaussian_pulse(d_merc, 1.2);
        val += params.mercuryActive * mercSignal * 0.5;
        // Simulate accumulation and structural degradation by reducing decay drastically
        decay = min(decay, 0.999);
    }

    // [Phase 6] Heavy Metal Permanent Structural Accumulation
    if (params.heavyMetal > 0.0) {
        val = min(val, 1.0 - (params.heavyMetal * 0.8));
        decay = min(decay, 0.999 - (params.heavyMetal * 0.05));
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

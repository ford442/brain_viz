// src/shaders/render-shared.js
// [Neuro-Weaver] Shared WGSL constants and helper functions interpolated into
// the render/compute shader strings that live alongside this file (mesh,
// soma, spark, volumetric-compute, point-cloud, post-fx). Split out of the
// former monolithic shaders.js.
//
// NOTE: this is distinct from ./shared.js, which backs the separately
// maintained shaders/fiber.js pipeline and has a different (4-arg)
// getRegionPhysics signature. Do not conflate the two.

// --- SHARED CONSTANTS ---
// These are interpolated into the shader strings.
export const CONSTANTS = `
    const BRAIN_RANGE: f32 = 1.6;
    const VOXEL_DIM: u32 = 32u;
    // FLOW_SPEED moved to uniforms in V2.3
    const FLOW_SCALE: f32 = 0.001;
    const CLIP_PLANE_NORMAL: vec3<f32> = vec3<f32>(0.0, 0.0, -1.0);
`;

// --- HELPER FUNCTIONS ---
export const HELPERS = `
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


// src/shaders/render-shared.js
// [Neuro-Weaver] Shared WGSL constants and helper functions interpolated into
// the render/compute shader strings that live alongside this file (mesh,
// soma, spark, volumetric-compute, point-cloud, post-fx). Split out of the
// former monolithic shaders.js.
//
// This is the ONLY shared WGSL helper module. The former ./shared.js twin —
// which backed a parallel shader tree with a different 4-arg
// getRegionPhysics signature — has been deleted; every pipeline, fiber
// included, now uses the 2-arg getRegionPhysics below. Do not re-fork it.

// --- SHARED CONSTANTS ---
// These are interpolated into the shader strings.
export const CONSTANTS = `
    const BRAIN_RANGE: f32 = 1.6;
    // FLOW_SPEED moved to uniforms in V2.3
    const FLOW_SCALE: f32 = 0.001;
    const CLIP_PLANE_NORMAL: vec3<f32> = vec3<f32>(0.0, 0.0, -1.0);
`;

// --- FIELD RESOLUTION ---
// [Field Resolution] `VOXEL_DIM` used to be `const VOXEL_DIM: u32 = 32u` in
// CONSTANTS above, which is why the engine could never run at any other
// resolution: the grid size was compiled into every pipeline.
//
// HELPERS below (and the shaders that interpolate it) now call `voxel_dim()`
// instead. That function is *not* defined in HELPERS, because the two shader
// families read the dimension from different bind groups — the render
// pipelines from `uniforms`, the compute pipeline from `params`. Each shader
// interpolates exactly one of the snippets below alongside HELPERS; a shader
// that forgets fails to compile rather than silently indexing at 32.
//
// (WGSL allows out-of-order module-scope declarations, so these can be
// interpolated before or after the binding they read.)

/** `voxel_dim()` for render pipelines, reading the shared render uniform block. */
export const VOXEL_DIM_FROM_UNIFORMS = `
    fn voxel_dim() -> u32 {
        return max(1u, u32(uniforms.voxelDim));
    }
`;

/** `voxel_dim()` for the compute pipeline, reading `TensorParams`. */
export const VOXEL_DIM_FROM_PARAMS = `
    fn voxel_dim() -> u32 {
        return max(1u, params.voxelDim);
    }
`;

// --- HELPER FUNCTIONS ---
export const HELPERS = `
    // Gaussian Pulse for smoother stimulus
    // V2.2 Helper: Used for stimulus injection and region decay
    fn gaussian_pulse(dist: f32, width: f32) -> f32 {
        let k = 4.0 / (width * width);
        return exp(-k * dist * dist);
    }

    // [Tensor Physics] §3.1 regionZone(): which anatomical zone a position is
    // in — 0 default, 1 frontal, 2 occipital, 3 temporal, 4 parietal (1–4
    // index TensorParams.retentionBias as zone - 1). The one place the zone
    // tests are written; getRegionPhysics() and the §3.4 retention read it.
    fn regionZone(worldPosition: vec3<f32>) -> u32 {
        if (worldPosition.z > 0.5) { return 1u; }
        if (worldPosition.z < -0.5) { return 2u; }
        if (abs(worldPosition.x) > 0.8) { return 3u; }
        if (worldPosition.y > 0.6) { return 4u; }
        return 0u;
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
        let zone = regionZone(worldPosition);

        // Frontal Lobe: High retention for complex thought, MOST vulnerable to hypoxia
        if (zone == 1u) {
            decay = 0.998; // [Neuro-Weaver] V2.6: Hyper-retention for deep thought
            diffusion = 0.15;
            flowBias = -1.0;
            oxygenSensitivity = 1.8; // Executive function degrades first
        }
        // Occipital Lobe: Fast processing, visual inputs
        // [Scientific Fix] Occipital is NOT particularly resistant - it's at terminal
        // PCA branches (watershed zone) and can be vulnerable to hypoxia
        else if (zone == 2u) {
            decay = 0.92;
            diffusion = 0.04;
            oxygenSensitivity = 1.0; // Neutral - not resistant, at watershed zone
        }
        // Temporal Lobe: Auditory/Memory, memory centers vulnerable
        else if (zone == 3u) {
            decay = 0.95;
            oxygenSensitivity = 1.2; // Memory vulnerable to hypoxia
        }
        // Parietal Lobe: Sensory integration, baseline sensitivity
        else if (zone == 4u) {
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

        let x = u32(normPos.x * f32(voxel_dim()));
        let y = u32(normPos.y * f32(voxel_dim()));
        let z = u32(normPos.z * f32(voxel_dim()));

        let index = min(z, voxel_dim()-1u) * voxel_dim() * voxel_dim() + min(y, voxel_dim()-1u) * voxel_dim() + min(x, voxel_dim()-1u);
        return activityTensor[index];
    }

    fn sampleSmoothedVoxelValue(worldPos: vec3<f32>) -> f32 {
        let step = (BRAIN_RANGE / f32(voxel_dim())) * 0.45;
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
`;


// --- CLIPMAP FINE BRICK (render side) ---
// [Clipmap] Bindings and helpers for the shaders that read the fine brick:
// the mesh fragment shader (heatmap raymarch, organic/cyber shell) and the
// cortical patch shaders. Kept out of HELPERS on purpose: HELPERS is
// interpolated into every shader, compute included, and WGSL requires every
// identifier a function references to be declared even if the function is
// never called — a brick-aware helper in HELPERS would force every pipeline
// to bind the brick texture.
//
// The brick texture is the rgba16float render copy written by the brick step
// (src/shaders/brick-compute.js): r = fine activity, g = coarse field at that
// texel, b = primary tract weight, a = 1 where populated. It is toroidally
// addressed, so it is sampled through a *repeat* sampler at the lattice
// coordinate itself; the only place hardware filtering would blend across the
// wrap is the brick's outer face, which brickEdgeMask() fades to zero first.
//
// Positions are model space (the field's own space). Requires `uniforms`.
export const BRICK_RENDER_HELPERS = `
    @group(0) @binding(5) var brickTexture: texture_3d<f32>;
    @group(0) @binding(6) var brickSampler: sampler;

    // Continuous fine-lattice coordinate: voxel g's value sits at exactly g (§4.1).
    fn brickLatticeCoord(p: vec3<f32>) -> vec3<f32> {
        return ((p / BRAIN_RANGE) * 0.5 + 0.5) * uniforms.brickLatticeDim;
    }

    // 1 well inside the brick, 0 within a voxel of any face. The ramp spans
    // ~1.5 coarse voxels so the hand-off to the coarse field has no edge.
    fn brickEdgeMask(c: vec3<f32>) -> f32 {
        let local = c - uniforms.brickLatticeOrigin;
        let edge = min(local, vec3<f32>(uniforms.brickDim - 1.0) - local);
        return smoothstep(1.0, 12.0, min(edge.x, min(edge.y, edge.z)));
    }

    fn brickBlendAt(p: vec3<f32>) -> f32 {
        if (uniforms.brickWeight <= 0.0) { return 0.0; }
        return uniforms.brickWeight * brickEdgeMask(brickLatticeCoord(p));
    }

    fn sampleBrickTexel(p: vec3<f32>) -> vec4<f32> {
        let uvw = (brickLatticeCoord(p) + vec3<f32>(0.5)) / uniforms.brickDim;
        return textureSampleLevel(brickTexture, brickSampler, uvw, 0.0);
    }

    // The field at p: the fine brick where it exists, blended over \`coarse\`.
    fn detailedFieldValue(p: vec3<f32>, coarse: f32) -> f32 {
        let w = brickBlendAt(p);
        if (w <= 0.0) { return coarse; }
        return mix(coarse, sampleBrickTexel(p).r, w);
    }

    // Entry/exit distances of a ray through the brick's box (exit < entry: miss).
    fn rayBrickBounds(rayOrigin: vec3<f32>, rayDir: vec3<f32>) -> vec2<f32> {
        let lo = ((uniforms.brickLatticeOrigin / uniforms.brickLatticeDim) * 2.0 - 1.0) * BRAIN_RANGE;
        let hi = (((uniforms.brickLatticeOrigin + vec3<f32>(uniforms.brickDim - 1.0)) / uniforms.brickLatticeDim) * 2.0 - 1.0) * BRAIN_RANGE;
        let inv = 1.0 / select(rayDir, vec3<f32>(1e-6), abs(rayDir) < vec3<f32>(1e-6));
        let t0 = (lo - rayOrigin) * inv;
        let t1 = (hi - rayOrigin) * inv;
        let tNear = min(t0, t1);
        let tFar = max(t0, t1);
        return vec2<f32>(max(max(tNear.x, tNear.y), tNear.z), min(min(tFar.x, tFar.y), tFar.z));
    }

    // [Clipmap Phase C] How much of the global mesh the cortical patch has
    // replaced at p (1 = the patch fully covers it).
    fn patchFootprint(p: vec3<f32>) -> f32 {
        if (uniforms.patchBlend <= 0.0) { return 0.0; }
        let c = dot(normalize(p + vec3<f32>(1e-5)), uniforms.patchAxis);
        return uniforms.patchBlend * smoothstep(uniforms.patchCosOuter, uniforms.patchCosInner, c);
    }

    fn raymarchSegmentSteps(length: f32, step: f32) -> u32 {
        if (length <= 1e-5) { return 0u; }
        return max(1u, u32(round(length / step)));
    }

    // Front-to-back thermal raymarch. Without a brick this is the original
    // 28-step march. With one, the stretch of the ray inside the brick is
    // marched with uniforms.brickFineSteps steps instead of its share of the
    // 28, so fine structure is actually resolved rather than stepped over;
    // opacity is Beer–Lambert in distance, so the extra steps do not darken it.
    //
    // Splitting the ray changes how many coarse steps precede the brick from
    // one pixel to the next, and a 28-step march undersamples enough that each
    // change shows as a terrace along the brick's faces. So with a brick, each
    // sample sits at a per-pixel stratified offset within its step instead of
    // the midpoint, which turns the terraces into fine noise. The offset fades
    // in with brickWeight: with no brick every sample is at the midpoint, as before.
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
        let coarseStep = span / 28.0;
        var b0 = endT;
        var b1 = endT;
        if (uniforms.brickWeight > 0.0 && uniforms.brickFineSteps > 0.5) {
            let hit = rayBrickBounds(rayOrigin, rayDir);
            let enter = clamp(hit.x, startT, endT);
            let exit = clamp(hit.y, startT, endT);
            if (exit > enter) {
                b0 = enter;
                b1 = exit;
            }
        }
        let stepsBefore = raymarchSegmentSteps(b0 - startT, coarseStep);
        let stepsInside = select(0u, u32(uniforms.brickFineSteps), b1 > b0);
        let stepsAfter = raymarchSegmentSteps(endT - b1, coarseStep);
        let stepCount = stepsBefore + stepsInside + stepsAfter;

        var transmittance = 1.0;
        var color = vec3<f32>(0.0);
        let stratum = 0.5 + (hashNoise3(rayDir * 4096.0) - 0.5) * clamp(uniforms.brickWeight, 0.0, 1.0);

        for (var i = 0u; i < 128u; i = i + 1u) {
            if (i >= stepCount || transmittance < 0.03) {
                break;
            }

            var t: f32;
            var stepSize: f32;
            if (i < stepsBefore) {
                stepSize = (b0 - startT) / f32(stepsBefore);
                t = startT + stepSize * f32(i);
            } else if (i < stepsBefore + stepsInside) {
                stepSize = (b1 - b0) / f32(stepsInside);
                t = b0 + stepSize * f32(i - stepsBefore);
            } else {
                stepSize = (endT - b1) / f32(stepsAfter);
                t = b1 + stepSize * f32(i - stepsBefore - stepsInside);
            }

            let samplePos = rayOrigin + rayDir * (t + stepSize * stratum);
            let depthT = clamp((t + stepSize * stratum - startT) / span, 0.0, 1.0);
            let jitter = 0.86 + 0.14 * hashNoise3(samplePos * 2.75 + vec3<f32>(time * 0.08));
            let density = clamp(detailedFieldValue(samplePos, getVoxelValue(samplePos)) * jitter, 0.0, 1.0);

            if (density > 0.0005) {
                let thermal = getHeatmapColor(pow(density, 0.85));
                let depthTint = mix(vec3<f32>(0.55, 0.75, 1.0), vec3<f32>(1.0, 0.58, 0.12), depthT);
                let burst = smoothstep(0.64, 0.95, density);
                let emission = thermal * depthTint + vec3<f32>(1.0, 0.9, 0.55) * burst * 0.55;
                let alpha = 1.0 - exp(-density * stepSize * 8.5);
                color += transmittance * emission * alpha;
                transmittance *= (1.0 - alpha * 0.9);
            } else {
                transmittance *= pow(0.995, stepSize / coarseStep);
            }
        }

        return vec4<f32>(color, clamp(1.0 - transmittance, 0.0, 1.0));
    }
`;

// [Clipmap] Requires `uniforms`. Interpolated by the mesh vertex shader and
// the cortical patch vertex shader.
export const ORGANIC_SURFACE_DISPLACEMENT = `
// [Clipmap] Organic/Cyber shell displacement, shared with the cortical patch
// (src/shaders/cortical-patch.js) so the patch sits exactly where the mesh it
// replaces would — a mismatch shows as a double surface in the crossfade band.
fn organicSurfaceDisplace(base: vec3<f32>, activity: f32) -> vec3<f32> {
    let displacement = normalize(base) * activity * 0.05;
    var finalPos = base + displacement;

    // [Phase 5] Cortisol Structural Decay
    if (uniforms.cortisol > 0.0) {
        let decayFactor = 1.0 - (uniforms.cortisol * 0.3);
        finalPos *= max(0.0, decayFactor);
    }

    // [Phase 2] Cognitive Stress Distortion
    if (uniforms.stress > 0.0) {
        let noiseFreq = 15.0;
        let stressDisp = sin(finalPos.x * noiseFreq + uniforms.time * 10.0) * cos(finalPos.y * noiseFreq + uniforms.time * 8.0) * sin(finalPos.z * noiseFreq);
        finalPos += normalize(base) * stressDisp * uniforms.stress * 0.5;
    }

    // [Phase 5] Cortisol Structural Decay
    if (uniforms.cortisol > 0.0) {
        // Decay structural integrity based on cortisol level (shrinks vertices inward, especially higher activity areas)
        let decayErosion = uniforms.cortisol * 0.2 * (1.0 - activity);
        finalPos -= normalize(base) * decayErosion;
    }

    // [Phase 6] Heavy Metal Structural Alteration
    if (uniforms.heavyMetal > 0.0) {
        let lesionNoise = fract(sin(dot(finalPos.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        let erosion = uniforms.heavyMetal * 0.3 * lesionNoise;
        finalPos -= normalize(base) * erosion;
    }
    return finalPos;
}
`;

// src/shaders/cortical-patch.js
// [Clipmap Phase C] Recursive-zoom render path: the cortical patch that
// replaces the organic mesh around the fine brick below the zoom threshold
// (src/clipmap/cortical-patch.js builds its geometry), its laminar somas, and
// the point-sprite impostor drawn instead of both when the GPU budget or
// `cognitiveLoad` drops the brick to its reduced tier.
//
// Every shader here reads activity from the fine brick (BRICK_RENDER_HELPERS),
// blended over the coarse field outside it, so what moves on the patch is the
// fine level's dynamics — not a texture, and not the coarse field resampled.
//
// Shares the render bind group with every other render pipeline: bindings 0–2
// (uniforms, coarse and partner tensors) and 5–6 (brick texture + sampler).

import { CONSTANTS, HELPERS, VOXEL_DIM_FROM_UNIFORMS, BRICK_RENDER_HELPERS, ORGANIC_SURFACE_DISPLACEMENT } from './render-shared.js';
import { UNIFORMS_STRUCT_WGSL } from './uniform-layout.js';

const PATCH_PRELUDE = `
${CONSTANTS}
${VOXEL_DIM_FROM_UNIFORMS}
${HELPERS}

${UNIFORMS_STRUCT_WGSL}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;
${BRICK_RENDER_HELPERS}

// Activity at p: the fine brick blended over the (smoothed) coarse field.
fn patchActivity(p: vec3<f32>) -> f32 {
    return detailedFieldValue(p, sampleSmoothedVoxelValue(p));
}

fn modelRotationInverse() -> mat3x3<f32> {
    return transpose(mat3x3<f32>(uniforms.modelMatrix[0].xyz, uniforms.modelMatrix[1].xyz, uniforms.modelMatrix[2].xyz));
}
`;

// --- Patch surface -----------------------------------------------------------

export const patchVertexShader = `
${PATCH_PRELUDE}
${ORGANIC_SURFACE_DISPLACEMENT}

struct PatchInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) attr: vec4<f32>, // edgeFade, foldSignal, u, v
}

struct PatchOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) modelPos: vec3<f32>,
    @location(3) coarse: f32,
    @location(4) edgeFade: f32,
    @location(5) fold: f32,
    @location(6) clipDist: f32,
    @location(7) distToCenter: f32,
}

@vertex
fn main(input: PatchInput) -> PatchOutput {
    var output: PatchOutput;
    // The same displacement the organic mesh applies (driven by the coarse
    // field, as there), so patch and mesh agree where they crossfade…
    let coarse = sampleSmoothedVoxelValue(input.position);
    var pos = organicSurfaceDisplace(input.position, coarse);
    // …plus gyrus-scale relief from the fine brick, faded out toward the rim:
    // crowns of gyri (foldSignal > 0) lift with the fine field's local excess
    // over the coarse one, sulcal fundi barely move.
    let fine = sampleBrickTexel(input.position);
    let w = brickBlendAt(input.position) * input.attr.x;
    let crown = smoothstep(-0.2, 0.3, input.attr.y);
    let relief = (fine.r * (0.004 + crown * 0.014) + max(0.0, fine.r - fine.g) * 0.02) * w;
    pos = pos + input.normal * relief;

    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    output.modelPos = pos;
    output.coarse = coarse;
    output.edgeFade = input.attr.x;
    output.fold = input.attr.y;
    output.clipDist = dot(output.worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    output.distToCenter = length(output.worldPos);
    return output;
}
`;

export const patchFragmentShader = `
${PATCH_PRELUDE}

struct PatchFragment {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) modelPos: vec3<f32>,
    @location(3) coarse: f32,
    @location(4) edgeFade: f32,
    @location(5) fold: f32,
    @location(6) clipDist: f32,
    @location(7) distToCenter: f32,
}

@fragment
fn main(input: PatchFragment) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) { discard; }
    if (input.distToCenter > uniforms.growth * 1.8) { discard; }

    let brick = sampleBrickTexel(input.modelPos);
    let w = brickBlendAt(input.modelPos);
    let activity = mix(input.coarse, brick.r, w);
    // Where the fine level carries structure the coarse field cannot.
    let detail = max(0.0, brick.r - brick.g) * w;

    // The patch has real surface normals (the mesh's are radial), so lighting
    // is what makes gyri and sulci legible at this scale.
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, uniforms.zoom) - input.worldPos);
    let NdotV = abs(dot(normal, viewDir));
    let rim = pow(1.0 - NdotV, 3.0);
    let rimAlpha = smoothstep(0.5, 1.0, rim);
    let lightDir = normalize(uniforms.lightDir);
    let NdotL = max(0.0, dot(normal, lightDir));
    let halfDir = normalize(lightDir + viewDir);
    let specular = pow(max(0.0, dot(normal, halfDir)), 24.0) * 0.55;
    // Sulcal fundi sit in shadow; crowns catch the light.
    let sulcus = 1.0 - smoothstep(-0.35, 0.15, input.fold);

    var base = vec3<f32>(0.2, 0.6, 1.0);
    if (uniforms.colorShift > 0.0) {
        base = mix(base, vec3<f32>(1.0, 0.7, 0.2), uniforms.colorShift);
    }
    var col = base * (uniforms.ambientLight + NdotL * uniforms.dirIntensity) * mix(1.0, 0.55, sulcus);
    col += vec3<f32>(0.85) * (rimAlpha * 0.7 + specular);

    // Cyber: the same digital lattice as the shell, at the patch's finer scale.
    if (uniforms.style > 0.5 && uniforms.style < 1.5) {
        col = vec3<f32>(0.0, 0.9, 0.5) * (0.35 + NdotL * 0.65);
        let g = abs(fract(input.modelPos * 60.0) - 0.5);
        if (max(g.x, max(g.y, g.z)) > 0.47) {
            col += vec3<f32>(0.6, 1.0, 0.8) * activity * 2.0;
        }
    }

    // Activity glow, then a warm highlight on fine-only structure and a faint
    // tint along resolved tracts (brick.b = primary tract weight).
    col = mix(col, vec3<f32>(0.5, 0.8, 1.0), clamp(activity * 1.3, 0.0, 1.0));
    col += vec3<f32>(1.0, 0.72, 0.35) * detail * 2.2;
    col += vec3<f32>(0.25, 0.45, 0.7) * brick.b * w * activity * 0.35;

    if (uniforms.hypoxiaStress > 0.1) {
        col = mix(col, vec3<f32>(0.3, 0.4, 0.7), uniforms.hypoxiaStress * 0.6);
    }
    let depth = length(input.worldPos - vec3<f32>(0.0, 0.0, uniforms.zoom));
    let fogFactor = exp(-uniforms.fogDensity * depth * 0.5);
    col = mix(vec3<f32>(0.02, 0.02, 0.05), col, clamp(fogFactor, 0.0, 1.0));

    // More opaque than the glass shell it replaces: at gyrus scale the relief
    // is the content, and a face-on glass shell (alpha ≈ 0.05) shows none.
    let alpha = clamp(0.16 + rimAlpha * 0.24 + NdotL * 0.12 + specular * 0.6 + activity * 0.22 + detail * 0.3, 0.0, 0.62);
    return vec4<f32>(col, alpha * input.edgeFade * uniforms.patchBlend);
}
`;

// --- Laminar somas -----------------------------------------------------------

export const patchSomaVertexShader = `
${PATCH_PRELUDE}

struct SomaInput {
    @location(0) vertex: vec3<f32>,      // unit icosahedron
    @location(1) posScale: vec4<f32>,    // centre.xyz, radius
    @location(2) axisDepth: vec4<f32>,   // apical axis.xyz, depth through the sheet (0..1)
    @location(3) lamina: vec4<f32>,      // phase, seed, edgeFade, layer index (0 = II/III … 3 = VI)
}

struct SomaOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) normal: vec3<f32>,
    @location(1) activity: f32,
    @location(2) fade: f32,
    @location(3) layer: f32,
    @location(4) worldPos: vec3<f32>,
}

@vertex
fn main(input: SomaInput) -> SomaOutput {
    var output: SomaOutput;
    let center = input.posScale.xyz;
    let axis = normalize(input.axisDepth.xyz);
    let layer = input.lamina.w;
    let activity = patchActivity(center);

    // Pyramidal cell bodies (II/III, V) are drawn elongated along the apical
    // axis — perpendicular to the pial surface; layer IV granule cells round.
    let isGranule = abs(layer - 1.0) < 0.5;
    let elongation = select(1.75, 1.0, isGranule);
    let firing = smoothstep(0.35, 0.85, activity + 0.12 * sin(uniforms.time * 9.0 + input.lamina.x));
    let radius = input.posScale.w * (1.0 + firing * 0.7);

    let along = dot(input.vertex, axis);
    let across = input.vertex - axis * along;
    let local = (across + axis * along * elongation) * radius;
    let pos = center + local;

    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(pos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.vertex, 0.0)).xyz);
    output.activity = activity;
    output.fade = input.lamina.z * uniforms.patchBlend * brickBlendAt(center) / max(uniforms.brickWeight, 1e-4);
    output.layer = layer;
    return output;
}
`;

export const patchSomaFragmentShader = `
${PATCH_PRELUDE}

struct SomaFragment {
    @location(0) normal: vec3<f32>,
    @location(1) activity: f32,
    @location(2) fade: f32,
    @location(3) layer: f32,
    @location(4) worldPos: vec3<f32>,
}

@fragment
fn main(input: SomaFragment) -> @location(0) vec4<f32> {
    if (dot(input.worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w < 0.0) { discard; }
    let viewDir = normalize(vec3<f32>(0.0, 0.0, uniforms.zoom) - input.worldPos);
    let facing = abs(dot(normalize(input.normal), viewDir));
    let rest = mix(vec3<f32>(0.35, 0.45, 0.95), vec3<f32>(0.55, 0.35, 0.9), input.layer / 3.0);
    let fire = vec3<f32>(1.0, 0.82, 0.45);
    let firing = smoothstep(0.3, 0.85, input.activity);
    let col = mix(rest * 0.45, fire * 1.4, firing) * (0.55 + facing * 0.45);
    let alpha = clamp(0.25 + firing * 0.6, 0.0, 0.9) * clamp(input.fade, 0.0, 1.0);
    return vec4<f32>(col * alpha, alpha);
}
`;

// --- Impostor (reduced tier) -------------------------------------------------

export const patchImpostorVertexShader = `
${PATCH_PRELUDE}

struct ImpostorInput {
    @location(0) corner: vec2<f32>,      // quad corner in [-1, 1]²
    @location(1) position: vec3<f32>,    // patch vertex, as instance data
    @location(2) normal: vec3<f32>,
    @location(3) attr: vec4<f32>,        // edgeFade, foldSignal, u, v
}

struct ImpostorOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) corner: vec2<f32>,
    @location(1) activity: f32,
    @location(2) fade: f32,
    @location(3) detail: f32,
}

@vertex
fn main(input: ImpostorInput) -> ImpostorOutput {
    var output: ImpostorOutput;
    let brick = sampleBrickTexel(input.position);
    let w = brickBlendAt(input.position);
    let activity = mix(sampleSmoothedVoxelValue(input.position), brick.r, w);
    // Camera-facing in world space: offset along world X/Y, carried back into
    // model space by the inverse model rotation.
    let size = 0.0045 + activity * 0.004;
    let offset = modelRotationInverse() * vec3<f32>(input.corner * size, 0.0);
    let pos = input.position + input.normal * activity * 0.02 + offset;
    output.position = uniforms.mvpMatrix * vec4<f32>(pos, 1.0);
    output.corner = input.corner;
    output.activity = activity;
    output.fade = input.attr.x * uniforms.patchBlend;
    output.detail = max(0.0, brick.r - brick.g) * w;
    return output;
}
`;

export const patchImpostorFragmentShader = `
struct ImpostorFragment {
    @location(0) corner: vec2<f32>,
    @location(1) activity: f32,
    @location(2) fade: f32,
    @location(3) detail: f32,
}

@fragment
fn main(input: ImpostorFragment) -> @location(0) vec4<f32> {
    let r2 = dot(input.corner, input.corner);
    if (r2 > 1.0) { discard; }
    let soft = 1.0 - smoothstep(0.35, 1.0, r2);
    let col = mix(vec3<f32>(0.2, 0.55, 1.0), vec3<f32>(1.0, 0.8, 0.45), clamp(input.activity * 1.2 + input.detail * 2.0, 0.0, 1.0));
    let alpha = soft * (0.18 + input.activity * 0.5) * input.fade;
    return vec4<f32>(col * alpha, alpha);
}
`;

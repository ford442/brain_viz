// shaders/immune.js
// [Phase 6] WGSL for the immune cell migration particle streams.
//
// The instance layout and trajectory math mirror src/immune-particles.js so the
// WebGPU and WebGL2 paths agree on where a cell is at a given time.

import { sparkVertexShader } from '../shaders.js';

// The `Uniforms` struct is duplicated verbatim across every shader in
// shaders.js. Rather than add another hand-maintained copy (which silently
// corrupts data the moment a uniform is added), lift the canonical definition
// out of an existing shader so it can never drift.
const UNIFORMS_STRUCT = (() => {
    const match = /struct Uniforms \{[\s\S]*?\n\}/.exec(sparkVertexShader);
    if (!match) {
        throw new Error('[Neuro-Weaver] Unable to extract Uniforms struct for immune shaders');
    }
    return match[0];
})();

const IMMUNE_COMMON = `
${UNIFORMS_STRUCT}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(2) var<storage, read> aiTensor: array<f32>;

struct ImmuneOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) alpha: f32,
    @location(3) clipDist: f32,
}
`;

export const immuneVertexShader = `
const BRAIN_RANGE: f32 = 1.6;

${IMMUNE_COMMON}

struct ImmuneInput {
    @location(0) corner: vec2<f32>,
    @location(1) originStagger: vec4<f32>,
    @location(2) targetSpawn: vec4<f32>,
    @location(3) controlSeed: vec4<f32>,
    @location(4) motion: vec4<f32>,
}

@vertex
fn main(input: ImmuneInput) -> ImmuneOutput {
    var output: ImmuneOutput;

    let origin = input.originStagger.xyz;
    let stagger = input.originStagger.w;
    let target = input.targetSpawn.xyz;
    let spawnTime = input.targetSpawn.w;
    let control = input.controlSeed.xyz;
    let seed = input.controlSeed.w;
    let speed = input.motion.x;
    let cellIntensity = input.motion.y;

    let activity = clamp(uniforms.immuneActivity, 0.0, 1.0);
    // Spawn rate is tied to intensity: each cell has a seed threshold it must
    // clear before it starts streaming.
    let gated = spawnTime < 0.0 || activity <= 0.001 || seed > activity;

    let raw = (uniforms.time - spawnTime) * speed - stagger;
    let t = fract(max(raw, 0.0));

    // Quadratic Bezier along the vessel-like arc toward the inflammation site.
    let inv = 1.0 - t;
    let center = origin * (inv * inv) + control * (2.0 * inv * t) + target * (t * t);

    // Phagocytosis burst on arrival, then fade.
    let burst = smoothstep(0.86, 1.0, t);
    let fade = 1.0 - smoothstep(0.94, 1.0, t);
    let ramp = smoothstep(0.0, 0.08, t);

    let cameraPos = vec3<f32>(0.0, 0.0, uniforms.zoom);
    let viewDir = normalize(cameraPos - center);
    var side = cross(viewDir, vec3<f32>(0.0, 1.0, 0.0));
    if (length(side) < 0.001) {
        side = cross(viewDir, vec3<f32>(1.0, 0.0, 0.0));
    }
    side = normalize(side);
    let up = normalize(cross(viewDir, side));

    var size = 0.030 * (1.0 + burst * 2.2) * mix(0.8, 1.2, cellIntensity);
    var alpha = cellIntensity * activity * ramp * fade;
    if (gated || raw < 0.0) {
        size = 0.0;
        alpha = 0.0;
    }

    let worldPos = center + (side * input.corner.x + up * input.corner.y) * size;

    // Leukocyte green-white, flaring gold as it degranulates on the target.
    let tint = mix(vec3<f32>(0.35, 1.0, 0.55), vec3<f32>(1.0, 0.92, 0.6), burst);
    output.color = tint * (0.8 + burst * 2.4) * cellIntensity;
    output.uv = input.corner;
    output.alpha = alpha;
    output.position = uniforms.mvpMatrix * vec4<f32>(worldPos, 1.0);
    output.clipDist = dot(worldPos, uniforms.slicePlane.xyz) + uniforms.slicePlane.w;
    return output;
}
`;

export const immuneFragmentShader = `
${IMMUNE_COMMON}

@fragment
fn main(input: ImmuneOutput) -> @location(0) vec4<f32> {
    if (input.clipDist < 0.0) {
        discard;
    }
    let d = dot(input.uv, input.uv);
    if (d > 1.0) {
        discard;
    }
    // Soft nucleus with a brighter core — reads as a cell body, not a spark.
    let glow = smoothstep(1.0, 0.0, d);
    let core = smoothstep(0.45, 0.0, d);
    let alpha = input.alpha * glow;
    if (alpha <= 0.001) {
        discard;
    }
    return vec4<f32>(input.color * (glow * 0.6 + core * 0.9), alpha);
}
`;

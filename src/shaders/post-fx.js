// src/shaders/post-fx.js
// [Neuro-Weaver] Full-screen post-processing shaders (chromatic aberration,
// film grain, focus/DoF, vignette).
// Split out of the former monolithic shaders.js.

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
    sensoryDeprivation: f32,
    spatialMemory: f32,
    apoptosis: f32,
    particleSpeed: f32,
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

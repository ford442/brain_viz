// src/shaders/uniform-layout.js
// [Neuro-Weaver] Single source of truth for the render `Uniforms` and compute
// `TensorParams` WGSL structs (see CLAUDE.md "WGSL Struct Alignment &
// Padding").
//
// This module is a *generator*, not just a description:
//   - `UNIFORMS_STRUCT_WGSL` / `TENSOR_PARAMS_STRUCT_WGSL` are the WGSL struct
//     declarations every shader in src/shaders/*.js interpolates. No shader
//     hand-writes `struct Uniforms { ... }` any more, so the field order
//     cannot drift between pipelines that share one uniform buffer.
//   - `RENDER_UNIFORM_OFFSETS` / `COMPUTE_UNIFORM_OFFSETS` are the WGSL-aligned
//     Float32Array offsets brain-renderer/uniforms.js writes at, so the JS
//     side cannot drift from the struct it is filling.
//   - `RENDER_UNIFORM_FLOAT_COUNT` / `*_BYTE_SIZE` size the GPU buffers, so
//     there is no second "how big is this thing" constant to fall out of sync.
//
// Adding a uniform is therefore a one-line edit to the layout array below;
// the WGSL struct, the JS offsets, and the buffer sizes all follow. Never
// re-introduce a handwritten struct — tests/test_uniform_layout.js fails the
// build if one appears.

/** @typedef {import('../types.js').UniformLayoutField} UniformLayoutField */
/** @typedef {import('../types.js').UniformLayout} UniformLayout */

// WGSL "uniform" address-space AlignOf/SizeOf, in bytes, for the types these
// structs use, plus the spelling used when emitting WGSL.
// (WGSL spec §13.4.1 / §13.4.2 host-shareable layout.)
const WGSL_TYPE_INFO = {
    f32: { size: 4, align: 4, wgsl: 'f32' },
    u32: { size: 4, align: 4, wgsl: 'u32' },
    vec2: { size: 8, align: 8, wgsl: 'vec2<f32>' },
    vec3: { size: 12, align: 16, wgsl: 'vec3<f32>' },
    vec4: { size: 16, align: 16, wgsl: 'vec4<f32>' },
    mat4x4: { size: 64, align: 16, wgsl: 'mat4x4<f32>' },
};

function alignUp(offset, align) {
    return Math.ceil(offset / align) * align;
}

/**
 * The render `Uniforms` struct. Field order here *is* the WGSL field order
 * for every render/compute pipeline that binds the shared render uniform
 * buffer (mesh, fiber, soma, spark, point-cloud, post, immune, bridges).
 *
 * WGSL inserts alignment padding between an `f32` and a following
 * `vec3`/`vec4`/`mat4x4`; that padding is computed, never hand-written, so
 * the comments below note where it lands rather than declaring pad fields.
 *
 * @type {UniformLayoutField[]}
 */
export const RENDER_UNIFORM_LAYOUT = [
    { name: 'mvpMatrix', type: 'mat4x4' },
    { name: 'modelMatrix', type: 'mat4x4' },
    { name: 'time', type: 'f32' },
    { name: 'style', type: 'f32' },
    { name: 'flowSpeed', type: 'f32', comment: 'V2.3: pulse speed' },
    { name: 'colorShift', type: 'f32', comment: '[Phase 5] Serotonin Color Shift' },
    { name: 'dopamineTrails', type: 'f32' },
    // 4 bytes of implicit padding here: slicePlane is a vec4 (16-byte align).
    { name: 'slicePlane', type: 'vec4', comment: '[Neuro-Weaver] V2.6: renamed from clipPlane' },
    { name: 'sparkle', type: 'f32', comment: '[Phase 5] Synaptic Sparkles' },
    { name: 'growth', type: 'f32', comment: '[Phase 6] Dendritic Growth' },
    { name: 'aberration', type: 'f32', comment: '[Phase 7] Chromatic Aberration' },
    { name: 'grain', type: 'f32', comment: '[Phase 7] Film Grain' },
    { name: 'focus', type: 'f32', comment: '[Phase 7] Focus Distance' },
    { name: 'aperture', type: 'f32', comment: '[Phase 7] Aperture Size' },
    // 8 bytes of implicit padding here: lightDir is a vec3 (16-byte align).
    { name: 'lightDir', type: 'vec3', comment: '[Phase 2] Directional Light' },
    { name: 'ambientLight', type: 'f32', comment: '[Phase 2] Ambient Light Intensity' },
    { name: 'dirIntensity', type: 'f32', comment: '[Phase 2] Directional Light Intensity' },
    { name: 'stress', type: 'f32', comment: 'Cognitive Stress Distortion' },
    { name: 'cortisol', type: 'f32', comment: '[Phase 5] Cortisol Structural Decay' },
    { name: 'altitude', type: 'f32', comment: 'Altitude in meters' },
    { name: 'oxygenLevel', type: 'f32', comment: 'Oxygen saturation (1.0-0.3)' },
    { name: 'hypoxiaStress', type: 'f32', comment: 'Cellular stress response' },
    { name: 'metabolicRate', type: 'f32', comment: 'ATP consumption multiplier' },
    { name: 'mitochondrialFunction', type: 'f32', comment: 'ATP synthesis efficiency' },
    { name: 'fogDensity', type: 'f32', comment: 'Volumetric Fog' },
    { name: 'zoom', type: 'f32', comment: 'Camera zoom for distance math' },
    { name: 'heavyMetal', type: 'f32' },
    { name: 'fluidActive', type: 'f32', comment: 'Procedural Volumetric Fluid Dynamics' },
    { name: 'aiInfluence', type: 'f32' },
    { name: 'resonanceThreshold', type: 'f32' },
    { name: 'synaptiXActive', type: 'f32' },
    { name: 'aiLayer', type: 'f32' },
    { name: 'pointCloudDensity', type: 'f32' },
    { name: 'fiberCoupling', type: 'f32' },
    { name: 'connectomeVariant', type: 'f32', comment: '[V3.3] formerly pad5' },
    { name: 'tmsActive', type: 'f32' },
    { name: 'tmsCenter', type: 'vec3' },
    { name: 'tmsPulse', type: 'f32' },
    { name: 'tmsRadius', type: 'f32' },
    { name: 'edgeDetection', type: 'f32' },
    { name: 'pulseSaturation', type: 'f32' },
    { name: 'trailLength', type: 'f32' },
    { name: 'lesionCenter', type: 'vec3' },
    { name: 'lesionActive', type: 'f32' },
    { name: 'lesionRadius', type: 'f32' },
    { name: 'decimation', type: 'f32' },
    { name: 'psychedelic', type: 'f32' },
    { name: 'immuneActivity', type: 'f32' },
    { name: 'plasticityDecay', type: 'f32' },
    { name: 'visualFatigue', type: 'f32' },
    { name: 'sensoryDeprivation', type: 'f32' },
    { name: 'spatialMemory', type: 'f32' },
    { name: 'apoptosis', type: 'f32' },
    { name: 'particleSpeed', type: 'f32' },
];

/**
 * The compute `TensorParams` struct (src/shaders/volumetric-compute.js).
 * Every field is named and uploaded by brain-renderer/uniforms.js; the
 * former `_reserved0.._reserved15` scalar filler is gone, so the neuromodulator
 * and lesion params the CPU sends are now visible (and consumable) on the
 * compute side instead of being anonymous padding.
 *
 * @type {UniformLayoutField[]}
 */
export const COMPUTE_UNIFORM_LAYOUT = [
    { name: 'time', type: 'f32' },
    { name: 'voxelDim', type: 'u32' },
    { name: 'frequency', type: 'f32' },
    { name: 'amplitude', type: 'f32' },
    { name: 'spikeThreshold', type: 'f32' },
    { name: 'smoothing', type: 'f32' },
    { name: 'style', type: 'f32' },
    // 4 bytes of implicit padding here: stimulusPos is a vec3 (16-byte align).
    { name: 'stimulusPos', type: 'vec3', comment: 'V2.2 Stimulus Fields' },
    { name: 'stimulusActive', type: 'f32' },
    { name: 'hypoxiaStress', type: 'f32' },
    { name: 'metabolicRate', type: 'f32' },
    { name: 'mitochondrialFunction', type: 'f32' },
    { name: 'fluidActive', type: 'f32' },
    { name: 'electricalActive', type: 'f32' },
    { name: 'mercuryActive', type: 'f32' },
    { name: 'cognitiveLoad', type: 'f32' },
    { name: 'stress', type: 'f32' },
    { name: 'heavyMetal', type: 'f32' },
    { name: 'pad2', type: 'f32' },
    { name: 'aiInfluence', type: 'f32', comment: '[SynaptiX] AI Tensor Mirror params' },
    { name: 'resonanceThreshold', type: 'f32' },
    { name: 'synaptiXActive', type: 'f32' },
    { name: 'fiberCoupling', type: 'f32', comment: '[V3.2] Fiber-volume coupling' },
    { name: 'cognitiveDissonance', type: 'f32' },
    { name: 'pad3', type: 'f32' },
    { name: 'decayRate', type: 'f32', comment: '[Phase 21] Neuromodulator physics' },
    { name: 'diffusionRate', type: 'f32' },
    { name: 'pulseSaturation', type: 'f32' },
    { name: 'trailLength', type: 'f32' },
    { name: 'retentionBias', type: 'vec4', comment: 'x=frontal, y=occipital, z=temporal, w=parietal' },
    { name: 'lesionCenter', type: 'vec3' },
    { name: 'lesionActive', type: 'f32' },
    { name: 'lesionRadius', type: 'f32' },
    { name: 'decimation', type: 'f32' },
    { name: 'stimulusRadius', type: 'f32', comment: '[Paint Energy] brush radius (0 = legacy fixed sigma 0.5)' },
    { name: 'stimulusErase', type: 'f32', comment: '[Paint Energy] erase/damping mode flag (>0.5 = erase)' },
];

/**
 * Computes the WGSL-aligned float offset of every field in `layout`, in
 * declaration order, per uniform-address-space AlignOf/SizeOf rules.
 *
 * @param {UniformLayoutField[]} layout
 * @returns {UniformLayout}
 */
export function computeStructOffsets(layout) {
    let byteOffset = 0;
    let maxAlign = 4;
    /** @type {Object<string, number>} */
    const offsets = {};

    for (const field of layout) {
        const info = WGSL_TYPE_INFO[field.type];
        if (!info) {
            throw new Error(`[UniformLayout] Unknown WGSL type '${field.type}' for field '${field.name}'`);
        }
        if (offsets[field.name] !== undefined) {
            throw new Error(`[UniformLayout] Duplicate field name '${field.name}'`);
        }
        byteOffset = alignUp(byteOffset, info.align);
        offsets[field.name] = byteOffset / 4;
        byteOffset += info.size;
        maxAlign = Math.max(maxAlign, info.align);
    }

    return { offsets, totalFloats: alignUp(byteOffset, maxAlign) / 4 };
}

/**
 * Emits the WGSL `struct <name> { ... }` declaration for `layout`, with the
 * WGSL-computed byte offset of each field in a trailing comment. This is the
 * only place a Uniforms/TensorParams struct is written; shaders interpolate
 * the result.
 *
 * @param {string} name - WGSL struct name.
 * @param {UniformLayoutField[]} layout
 * @returns {string} WGSL source for the struct declaration.
 */
export function generateStructWGSL(name, layout) {
    const { offsets } = computeStructOffsets(layout);
    const lines = [
        '// [Neuro-Weaver] GENERATED from src/shaders/uniform-layout.js — do not hand-edit.',
        `struct ${name} {`,
    ];
    for (const field of layout) {
        const byteOffset = offsets[field.name] * 4;
        const note = field.comment ? ` ${field.comment} —` : '';
        lines.push(`    ${field.name}: ${WGSL_TYPE_INFO[field.type].wgsl}, //${note} byte offset ${byteOffset}`);
    }
    lines.push('}');
    return lines.join('\n');
}

const renderLayout = computeStructOffsets(RENDER_UNIFORM_LAYOUT);
const computeLayout = computeStructOffsets(COMPUTE_UNIFORM_LAYOUT);

/**
 * Float32Array index of every render-uniform field. brain-renderer/uniforms.js
 * writes exclusively through this map — there are no handwritten OFFSET_*
 * constants left to drift.
 * @type {Object<string, number>}
 */
export const RENDER_UNIFORM_OFFSETS = Object.freeze(renderLayout.offsets);

/** Total size of the render `Uniforms` struct, in Float32Array elements. */
export const RENDER_UNIFORM_FLOAT_COUNT = renderLayout.totalFloats;

/** Total size of the render `Uniforms` struct, in bytes (before GPU binding alignment). */
export const RENDER_UNIFORM_BYTE_SIZE = RENDER_UNIFORM_FLOAT_COUNT * 4;

/**
 * Float32Array index of every compute (`TensorParams`) field.
 * @type {Object<string, number>}
 */
export const COMPUTE_UNIFORM_OFFSETS = Object.freeze(computeLayout.offsets);

/** Total size of `TensorParams`, in Float32Array elements. */
export const COMPUTE_UNIFORM_FLOAT_COUNT = computeLayout.totalFloats;

/** Total size of `TensorParams`, in bytes. */
export const COMPUTE_UNIFORM_BYTE_SIZE = COMPUTE_UNIFORM_FLOAT_COUNT * 4;

/** The generated `struct Uniforms { ... }` WGSL, interpolated by every render shader. */
export const UNIFORMS_STRUCT_WGSL = generateStructWGSL('Uniforms', RENDER_UNIFORM_LAYOUT);

/** The generated `struct TensorParams { ... }` WGSL, interpolated by the compute shader. */
export const TENSOR_PARAMS_STRUCT_WGSL = generateStructWGSL('TensorParams', COMPUTE_UNIFORM_LAYOUT);

const FIELD_LINE_RE = /^\s*(\w+)\s*:\s*(f32|u32|vec2<f32>|vec3<f32>|vec4<f32>|mat4x4<f32>)\s*,/gm;

/**
 * Extracts the ordered field-name list of the first `struct <name> { ... }`
 * block in a WGSL source string.
 *
 * @param {string} source - WGSL shader source (a template string from src/shaders/*.js).
 * @param {string} [structName='Uniforms'] - Struct to look for.
 * @returns {string[]} Field names in declaration order.
 */
export function extractUniformFieldOrder(source, structName = 'Uniforms') {
    const start = source.indexOf(`struct ${structName}`);
    if (start === -1) return [];
    const bodyStart = source.indexOf('{', start);
    const bodyEnd = source.indexOf('}', bodyStart);
    if (bodyStart === -1 || bodyEnd === -1) return [];

    const body = source.slice(bodyStart, bodyEnd);
    const fields = [];
    let match;
    FIELD_LINE_RE.lastIndex = 0;
    while ((match = FIELD_LINE_RE.exec(body)) !== null) {
        fields.push(match[1]);
    }
    return fields;
}

/**
 * Throws if any named WGSL shader source's `struct Uniforms` field order
 * doesn't exactly match `RENDER_UNIFORM_LAYOUT`. Every pipeline binds the
 * *same* uniform buffer (see brain-renderer/pipelines.js), so a shader that
 * declares the struct with a different order silently reads the wrong field
 * values.
 *
 * With the generated struct this can only fail if a shader re-introduces a
 * handwritten declaration; tests/test_uniform_layout.js calls it over every
 * live shader source in CI.
 *
 * @param {Object<string, string>} shaderSources - Shader name -> WGSL source string.
 */
export function assertShaderUniformsMatch(shaderSources) {
    const canonical = RENDER_UNIFORM_LAYOUT.map((f) => f.name);
    const problems = [];

    for (const [name, source] of Object.entries(shaderSources)) {
        const actual = extractUniformFieldOrder(source);
        if (actual.length === 0) continue; // shader doesn't declare a Uniforms struct

        if (actual.length !== canonical.length) {
            problems.push(`'${name}' declares ${actual.length} Uniforms fields, expected ${canonical.length}`);
            continue;
        }
        for (let i = 0; i < canonical.length; i++) {
            if (actual[i] !== canonical[i]) {
                problems.push(`'${name}' field #${i} is '${actual[i]}', expected '${canonical[i]}'`);
                break;
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `[UniformLayout] One or more WGSL shaders declare a Uniforms struct that doesn't match the ` +
            `canonical field order (src/shaders/uniform-layout.js). Every pipeline shares the same uniform ` +
            `buffer, so this silently reads the wrong values. Mismatches:\n  ` +
            problems.join('\n  ')
        );
    }
}

// ---------------------------------------------------------------------------
// [Tensor Physics] C ABI mirror of the compute layout.
//
// The WASM engine used to take its parameters as a 13-float C function
// signature, so every field the CPU uploaded beyond those 13 was silently
// dropped. The C struct below is emitted from the *same* COMPUTE_UNIFORM_LAYOUT
// as the WGSL struct and the JS offsets, so `BrainTensorParams` cannot drift
// from `TensorParams`. See docs/tensor-physics.md §"Parameter contract".
//
// Padding is explicit here (`_padN` floats) because C has no
// 16-byte-alignment rule for vec3/vec4 — the filler is what reproduces the
// WGSL offsets. It is generated, never hand-written.
// ---------------------------------------------------------------------------

const C_TYPE_INFO = {
    f32: { decl: (n) => `float ${n}` },
    u32: { decl: (n) => `uint32_t ${n}` },
    vec2: { decl: (n) => `float ${n}[2]` },
    vec3: { decl: (n) => `float ${n}[3]` },
    vec4: { decl: (n) => `float ${n}[4]` },
    mat4x4: { decl: (n) => `float ${n}[16]` },
};

/**
 * Emits a C struct whose member byte offsets are identical to the WGSL struct
 * generated from the same layout, using explicit float padding.
 *
 * @param {string} name - C struct name.
 * @param {UniformLayoutField[]} layout
 * @returns {string} C source for the struct definition (no typedef, no guard).
 */
export function generateStructC(name, layout) {
    const { offsets, totalFloats } = computeStructOffsets(layout);
    const lines = [`typedef struct ${name} {`];
    let cursorFloats = 0;
    let padIndex = 0;

    for (const field of layout) {
        const fieldFloat = offsets[field.name];
        if (fieldFloat > cursorFloats) {
            const gap = fieldFloat - cursorFloats;
            lines.push(`    float _pad${padIndex++}[${gap}]; // WGSL alignment filler`);
            cursorFloats = fieldFloat;
        }
        const info = C_TYPE_INFO[field.type];
        if (!info) {
            throw new Error(`[UniformLayout] No C mapping for WGSL type '${field.type}'`);
        }
        const note = field.comment ? ` ${field.comment} —` : '';
        lines.push(`    ${info.decl(field.name)}; //${note} byte offset ${fieldFloat * 4}`);
        cursorFloats = fieldFloat + WGSL_TYPE_INFO[field.type].size / 4;
    }

    if (totalFloats > cursorFloats) {
        lines.push(`    float _pad${padIndex++}[${totalFloats - cursorFloats}]; // struct tail padding`);
    }
    lines.push(`} ${name};`);
    return lines.join('\n');
}

/** The generated `BrainTensorParams` C struct — mirrors WGSL `TensorParams`. */
export const TENSOR_PARAMS_STRUCT_C = generateStructC('BrainTensorParams', COMPUTE_UNIFORM_LAYOUT);

/**
 * Full text of the generated `wasm/brain_tensor_params.h`. Written to disk by
 * scripts/gen_wasm_params.mjs and verified by tests/test_uniform_layout.js, so
 * a layout edit that is not regenerated fails `npm test` instead of silently
 * mismatching the WASM ABI.
 *
 * @returns {string}
 */
export function generateTensorParamsHeader() {
    return `// wasm/brain_tensor_params.h
// [Tensor Physics] GENERATED by scripts/gen_wasm_params.mjs from
// COMPUTE_UNIFORM_LAYOUT in src/shaders/uniform-layout.js — do not hand-edit.
//
// This is the C ABI mirror of the WGSL \`TensorParams\` uniform struct. The JS
// bridge (src/wasm-engine.js) fills it through COMPUTE_UNIFORM_OFFSETS, the
// WebGPU path fills the same offsets in its uniform buffer, and the C++ engine
// reads it here — one declaration, three consumers.
//
// Regenerate with:  node scripts/gen_wasm_params.mjs
// Verified by:      npm test  (tests/test_uniform_layout.js)

#pragma once

#include <cstdint>

#ifdef __cplusplus
extern "C" {
#endif

${TENSOR_PARAMS_STRUCT_C}

// Number of floats in the struct (= sizeof(BrainTensorParams) / 4).
#define BTE_PARAMS_FLOAT_COUNT ${COMPUTE_UNIFORM_FLOAT_COUNT}u

// Byte size of the struct. bte_params_byte_size() returns this at runtime so
// the JS bridge can refuse to run against a stale .wasm.
#define BTE_PARAMS_BYTE_SIZE ${COMPUTE_UNIFORM_BYTE_SIZE}u

#ifdef __cplusplus
} // extern "C"
#endif
`;
}

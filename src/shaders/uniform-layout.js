// src/shaders/uniform-layout.js
// [Neuro-Weaver] Canonical description of the render `Uniforms` WGSL struct
// (see CLAUDE.md "WGSL Struct Alignment & Padding") plus dev-only assertions
// that catch the two ways this struct silently drifts:
//   1. The JS-side Float32Array offsets in brain-renderer/uniforms.js no
//      longer match the struct's WGSL-computed byte layout.
//   2. One of the WGSL shader files (surface/fiber/soma/spark/point-cloud/
//      post) redeclares `struct Uniforms` with a different field order than
//      the others, so the same uniform buffer is read at the wrong offsets
//      by that pipeline only.
// Both checks are dev-only (see assert* below) and are no-ops in production
// builds; they exist purely to fail loudly instead of corrupting data
// silently.

/** @typedef {import('../types.js').UniformLayoutField} UniformLayoutField */
/** @typedef {import('../types.js').UniformLayout} UniformLayout */

// WGSL "uniform" address-space AlignOf/SizeOf, in bytes, for the types this
// struct actually uses. (WGSL spec ยง13.4.1 / ยง13.4.2 host-shareable layout.)
const WGSL_TYPE_INFO = {
    f32: { size: 4, align: 4 },
    vec2: { size: 8, align: 8 },
    vec3: { size: 12, align: 16 },
    vec4: { size: 16, align: 16 },
    mat4x4: { size: 64, align: 16 },
};

function alignUp(offset, align) {
    return Math.ceil(offset / align) * align;
}

/**
 * The render `Uniforms` struct, in the field order declared by
 * `src/shaders/surface.js` (the most fully-commented, and the layout the
 * JS-side offsets in brain-renderer/uniforms.js are written against). Every
 * other shader file that declares `struct Uniforms { ... }` against the
 * same buffer must match this order exactly — see `assertShaderUniformsMatch`.
 *
 * @type {UniformLayoutField[]}
 */
export const RENDER_UNIFORM_LAYOUT = [
    { name: 'mvpMatrix', type: 'mat4x4' },
    { name: 'modelMatrix', type: 'mat4x4' },
    { name: 'time', type: 'f32' },
    { name: 'style', type: 'f32' },
    { name: 'flowSpeed', type: 'f32' },
    { name: 'colorShift', type: 'f32' },
    { name: 'dopamineTrails', type: 'f32' },
    { name: 'memoryBreadcrumbs', type: 'f32' },
    { name: 'padDopamine', type: 'vec2' },
    { name: 'slicePlane', type: 'vec4' },
    { name: 'sparkle', type: 'f32' },
    { name: 'growth', type: 'f32' },
    { name: 'aberration', type: 'f32' },
    { name: 'grain', type: 'f32' },
    { name: 'focus', type: 'f32' },
    { name: 'aperture', type: 'f32' },
    { name: 'lightDir', type: 'vec3' },
    { name: 'ambientLight', type: 'f32' },
    { name: 'dirIntensity', type: 'f32' },
    { name: 'stress', type: 'f32' },
    { name: 'cortisol', type: 'f32' },
    { name: 'altitude', type: 'f32' },
    { name: 'oxygenLevel', type: 'f32' },
    { name: 'hypoxiaStress', type: 'f32' },
    { name: 'metabolicRate', type: 'f32' },
    { name: 'mitochondrialFunction', type: 'f32' },
    { name: 'fogDensity', type: 'f32' },
    { name: 'zoom', type: 'f32' },
    { name: 'heavyMetal', type: 'f32' },
    { name: 'fluidActive', type: 'f32' },
    { name: 'aiInfluence', type: 'f32' },
    { name: 'resonanceThreshold', type: 'f32' },
    { name: 'synaptiXActive', type: 'f32' },
    { name: 'aiLayer', type: 'f32' },
    { name: 'pointCloudDensity', type: 'f32' },
    { name: 'fiberCoupling', type: 'f32' },
    { name: 'connectomeVariant', type: 'f32' },
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
        byteOffset = alignUp(byteOffset, info.align);
        offsets[field.name] = byteOffset / 4;
        byteOffset += info.size;
        maxAlign = Math.max(maxAlign, info.align);
    }

    return { offsets, totalFloats: alignUp(byteOffset, maxAlign) / 4 };
}

const isDev = typeof import.meta !== 'undefined' && !!(import.meta.env && import.meta.env.DEV);

/**
 * Dev-only guard: throws if the JS-side `Float32Array` offsets used to
 * populate the render uniform buffer (the OFFSET_* constants in
 * brain-renderer/uniforms.js) have drifted from the offsets the canonical
 * WGSL struct actually requires. No-op outside dev builds.
 *
 * @param {Object<string, number>} actualOffsets - Field name -> float offset, as currently written by updateUniforms().
 * @param {number} [actualFloatCount] - The JS-side RENDER_UNIFORM_FLOAT_COUNT, checked against the computed struct size.
 */
export function assertUniformLayout(actualOffsets, actualFloatCount) {
    if (!isDev) return;

    const { offsets: expected, totalFloats } = computeStructOffsets(RENDER_UNIFORM_LAYOUT);
    const mismatches = [];

    for (const [name, expectedOffset] of Object.entries(expected)) {
        const actual = actualOffsets[name];
        if (actual === undefined) {
            mismatches.push(`'${name}' is missing from actualOffsets (expected float offset ${expectedOffset})`);
        } else if (actual !== expectedOffset) {
            mismatches.push(`'${name}' is at float offset ${actual}, WGSL struct requires ${expectedOffset}`);
        }
    }

    for (const name of Object.keys(actualOffsets)) {
        if (!(name in expected)) {
            mismatches.push(`'${name}' is written by JS but is not a field of RENDER_UNIFORM_LAYOUT`);
        }
    }

    if (actualFloatCount !== undefined && actualFloatCount !== totalFloats) {
        mismatches.push(`total float count is ${actualFloatCount}, WGSL struct requires ${totalFloats}`);
    }

    if (mismatches.length > 0) {
        throw new Error(
            `[UniformLayout] JS uniform offsets no longer match the canonical WGSL Uniforms struct ` +
            `(src/shaders/uniform-layout.js). This causes silent data corruption on the GPU. Mismatches:\n  ` +
            mismatches.join('\n  ')
        );
    }
}

const FIELD_LINE_RE = /^\s*(\w+)\s*:\s*(f32|vec2<f32>|vec3<f32>|vec4<f32>|mat4x4<f32>)\s*,/gm;

/**
 * Extracts the ordered field-name list of the first `struct Uniforms { ... }`
 * block in a WGSL source string. Used to detect a shader whose Uniforms
 * struct has drifted from the canonical field order — see
 * `assertShaderUniformsMatch`.
 *
 * @param {string} source - WGSL shader source (a template string from src/shaders/*.js).
 * @returns {string[]} Field names in declaration order.
 */
export function extractUniformFieldOrder(source) {
    const start = source.indexOf('struct Uniforms');
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
 * Dev-only guard: throws if any named WGSL shader source's `struct Uniforms`
 * field order doesn't exactly match `RENDER_UNIFORM_LAYOUT`. Every pipeline
 * (surface, fiber, soma, spark, point-cloud, post) binds the *same*
 * `uniformBuffer` (see brain-renderer/pipelines.js), so a shader that
 * redeclares the struct with a different order silently reads the wrong
 * field values. No-op outside dev builds.
 *
 * @param {Object<string, string>} shaderSources - Shader name -> WGSL source string.
 */
export function assertShaderUniformsMatch(shaderSources) {
    if (!isDev) return;

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

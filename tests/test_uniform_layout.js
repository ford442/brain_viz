// tests/test_uniform_layout.js
// [Neuro-Weaver] Headless guard for the uniform-layout hotspot in CLAUDE.md.
//
// Playwright/visual verification cannot see a clip plane that is four floats
// off — it just renders a slightly wrong image. This test runs in plain Node
// (no WebGPU, no browser) and fails the build if:
//   1. Any shader file re-introduces a handwritten `struct Uniforms` /
//      `struct TensorParams` instead of interpolating the generated one.
//   2. The struct a shader actually emits drifts from RENDER_UNIFORM_LAYOUT.
//   3. The JS-side offsets/buffer sizes stop matching WGSL alignment rules.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
    RENDER_UNIFORM_LAYOUT,
    COMPUTE_UNIFORM_LAYOUT,
    RENDER_UNIFORM_OFFSETS,
    RENDER_UNIFORM_FLOAT_COUNT,
    RENDER_UNIFORM_BYTE_SIZE,
    COMPUTE_UNIFORM_OFFSETS,
    COMPUTE_UNIFORM_BYTE_SIZE,
    UNIFORMS_STRUCT_WGSL,
    TENSOR_PARAMS_STRUCT_WGSL,
    computeStructOffsets,
    extractUniformFieldOrder,
    assertShaderUniformsMatch,
} from '../src/shaders/uniform-layout.js';
import {
    RENDER_UNIFORM_BUFFER_SIZE,
    COMPUTE_UNIFORM_BUFFER_SIZE,
    UNIFORM_BUFFER_ALIGNMENT,
    RENDER_UNIFORM_FLOAT_COUNT as CONSTANTS_RENDER_FLOAT_COUNT,
} from '../src/brain-renderer/constants.js';
import {
    vertexShader, fragmentShader,
    somaVertexShader, somaFragmentShader,
    sparkVertexShader, sparkFragmentShader,
    postVertexShader, postFragmentShader,
    pointCloudVertexShader, pointCloudFragmentShader,
    computeShader,
} from '../src/shaders.js';
import { fiberVertexShader, fiberFragmentShader } from '../src/shaders/fiber.js';
import { immuneVertexShader, immuneFragmentShader } from '../src/shaders/immune.js';

const shaderDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shaders');

// ---------------------------------------------------------------------------
// 1. No handwritten structs survive anywhere in src/shaders/.
// ---------------------------------------------------------------------------
for (const file of readdirSync(shaderDir).filter((f) => f.endsWith('.js'))) {
    if (file === 'uniform-layout.js') continue; // the generator itself
    const source = readFileSync(join(shaderDir, file), 'utf8');
    for (const structName of ['Uniforms', 'TensorParams']) {
        assert.ok(
            !source.includes(`struct ${structName} {`),
            `${file} hand-writes 'struct ${structName} {'. Interpolate the generated ` +
            `struct from src/shaders/uniform-layout.js instead — duplicate declarations ` +
            `against a shared uniform buffer corrupt data silently.`
        );
    }
}

// ---------------------------------------------------------------------------
// 2. Every live shader's emitted Uniforms struct matches the canonical order.
// ---------------------------------------------------------------------------
const liveShaders = {
    vertexShader, fragmentShader,
    fiberVertexShader, fiberFragmentShader,
    somaVertexShader, somaFragmentShader,
    sparkVertexShader, sparkFragmentShader,
    postVertexShader, postFragmentShader,
    pointCloudVertexShader, pointCloudFragmentShader,
    immuneVertexShader, immuneFragmentShader,
};
assertShaderUniformsMatch(liveShaders);

// Every render pipeline must actually carry the struct (a shader that silently
// stopped interpolating it would pass the check above by declaring nothing).
for (const [name, source] of Object.entries(liveShaders)) {
    if (name === 'postVertexShader') continue; // fullscreen triangle, no uniforms
    assert.ok(
        source.includes('struct Uniforms {'),
        `${name} no longer contains the generated Uniforms struct`
    );
}

assert.deepEqual(
    extractUniformFieldOrder(computeShader, 'TensorParams'),
    COMPUTE_UNIFORM_LAYOUT.map((f) => f.name),
    'computeShader TensorParams struct drifted from COMPUTE_UNIFORM_LAYOUT'
);

// ---------------------------------------------------------------------------
// 3. Offsets obey WGSL uniform-address-space alignment.
// ---------------------------------------------------------------------------
const ALIGN = { f32: 4, u32: 4, vec2: 8, vec3: 16, vec4: 16, mat4x4: 16 };
const SIZE = { f32: 4, u32: 4, vec2: 8, vec3: 12, vec4: 16, mat4x4: 64 };

function checkAlignment(label, layout, offsets, totalBytes) {
    let cursor = 0;
    let maxAlign = 4;
    for (const field of layout) {
        const byteOffset = offsets[field.name] * 4;
        assert.ok(
            byteOffset % ALIGN[field.type] === 0,
            `${label}.${field.name} (${field.type}) is at byte ${byteOffset}, which is not ` +
            `${ALIGN[field.type]}-byte aligned — WGSL would place it elsewhere and the GPU ` +
            `would read neighbouring fields.`
        );
        assert.ok(
            byteOffset >= cursor,
            `${label}.${field.name} at byte ${byteOffset} overlaps the preceding field (ends at ${cursor})`
        );
        cursor = byteOffset + SIZE[field.type];
        maxAlign = Math.max(maxAlign, ALIGN[field.type]);
    }
    assert.equal(
        totalBytes,
        Math.ceil(cursor / maxAlign) * maxAlign,
        `${label} total size ${totalBytes} != struct size rounded to ${maxAlign}-byte alignment`
    );
}

checkAlignment('Uniforms', RENDER_UNIFORM_LAYOUT, RENDER_UNIFORM_OFFSETS, RENDER_UNIFORM_BYTE_SIZE);
checkAlignment('TensorParams', COMPUTE_UNIFORM_LAYOUT, COMPUTE_UNIFORM_OFFSETS, COMPUTE_UNIFORM_BYTE_SIZE);

// The two fields the drift bug actually corrupted: slicePlane must sit on its
// own vec4 boundary after dopamineTrails, not share dopamineTrails' slot (which
// is what made sliceZ land in padding and the clip plane read sparkle/growth).
for (const name of ['dopamineTrails', 'slicePlane', 'sparkle']) {
    assert.equal(
        typeof RENDER_UNIFORM_OFFSETS[name], 'number',
        `'${name}' disappeared from RENDER_UNIFORM_LAYOUT`
    );
}
assert.ok(
    RENDER_UNIFORM_OFFSETS.slicePlane >= RENDER_UNIFORM_OFFSETS.dopamineTrails + 1,
    'slicePlane must occupy a slot after dopamineTrails, not overlap it'
);
assert.equal(RENDER_UNIFORM_OFFSETS.slicePlane * 4 % 16, 0, 'slicePlane must be 16-byte aligned');
assert.equal(
    RENDER_UNIFORM_OFFSETS.sparkle,
    RENDER_UNIFORM_OFFSETS.slicePlane + 4,
    'sparkle must follow the full 4-float slicePlane, not overlap it'
);

// ---------------------------------------------------------------------------
// 4. Buffer sizes are all derived from the same layout.
// ---------------------------------------------------------------------------
assert.equal(CONSTANTS_RENDER_FLOAT_COUNT, RENDER_UNIFORM_FLOAT_COUNT,
    'constants.js float count drifted from the generated layout');
assert.equal(
    RENDER_UNIFORM_BUFFER_SIZE,
    Math.ceil(RENDER_UNIFORM_BYTE_SIZE / UNIFORM_BUFFER_ALIGNMENT) * UNIFORM_BUFFER_ALIGNMENT,
    'RENDER_UNIFORM_BUFFER_SIZE is not the generated struct size rounded to binding alignment'
);
assert.ok(RENDER_UNIFORM_BUFFER_SIZE >= RENDER_UNIFORM_BYTE_SIZE,
    'render uniform buffer is smaller than the struct it holds');
assert.equal(COMPUTE_UNIFORM_BUFFER_SIZE, COMPUTE_UNIFORM_BYTE_SIZE,
    'COMPUTE_UNIFORM_BUFFER_SIZE drifted from the generated TensorParams size');

// ---------------------------------------------------------------------------
// 5. The generator itself behaves (padding is inserted, not assumed).
// ---------------------------------------------------------------------------
const probe = computeStructOffsets([
    { name: 'a', type: 'f32' },
    { name: 'b', type: 'vec4' },
    { name: 'c', type: 'f32' },
]);
assert.deepEqual(probe.offsets, { a: 0, b: 4, c: 8 }, 'generator failed to pad f32 -> vec4');
assert.equal(probe.totalFloats, 12, 'generator failed to round the struct to its max alignment');

// Every declared field must actually reach the emitted WGSL.
for (const field of RENDER_UNIFORM_LAYOUT) {
    assert.ok(
        UNIFORMS_STRUCT_WGSL.includes(`    ${field.name}: `),
        `Uniforms.${field.name} is in the layout but missing from the generated WGSL`
    );
}
for (const field of COMPUTE_UNIFORM_LAYOUT) {
    assert.ok(
        TENSOR_PARAMS_STRUCT_WGSL.includes(`    ${field.name}: `),
        `TensorParams.${field.name} is in the layout but missing from the generated WGSL`
    );
}

assert.ok(UNIFORMS_STRUCT_WGSL.startsWith('// [Neuro-Weaver] GENERATED'));
assert.ok(TENSOR_PARAMS_STRUCT_WGSL.includes('stimulusErase: f32,'));

console.log('test_uniform_layout passed');

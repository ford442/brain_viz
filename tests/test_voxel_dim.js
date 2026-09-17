// tests/test_voxel_dim.js
// [Field Resolution] Pins the contract that makes the neural field's grid
// resolution a runtime value instead of a constant compiled into six places.
//
// What this guards, in order of how badly it used to break:
//   1. No shader may re-introduce a compile-time `VOXEL_DIM` constant — that is
//      exactly what made 32³ permanent. Every shader that indexes the tensor
//      must read the dimension from its uniform block.
//   2. Every shader that calls `voxel_dim()` must also define it, from a
//      binding that shader actually declares.
//   3. Resampling across resolutions must preserve a constant field exactly and
//      stay in range, because it is what carries a live session across a switch.
//   4. NWS1 tensor chunks are dim-specific, and a 32³ session written before
//      any of this must still load.

import assert from 'node:assert/strict';
import * as shaders from '../src/shaders.js';
import {
    DEFAULT_VOXEL_DIM,
    MAX_VOXEL_DIM,
    SUPPORTED_VOXEL_DIMS,
    assertVoxelDim,
    fiberAffinityByteLengthFor,
    inferVoxelDim,
    isSupportedVoxelDim,
    normalizeVoxelDim,
    resampleField,
    tensorByteLengthFor,
    voxelCountFor,
} from '../src/voxel-dim.js';
import { RENDER_UNIFORM_LAYOUT, COMPUTE_UNIFORM_LAYOUT } from '../src/shaders/uniform-layout.js';
import {
    NWS_MAGIC,
    decodeTensorPayload,
    encodeTensorPayload,
    manifestVoxelDim,
    parseSession,
    serializeSession,
    SESSION_CHUNK_TYPES,
} from '../src/session-format.js';
import { TensorResampler } from '../src/bci/tensor-resampler.js';
import { AITensorProjector } from '../src/synaptix-engine.js';
import { getAnatomicalRegionMeans } from '../src/synaptix-coupling.js';
import { BrainGeometry } from '../src/brain-geometry.js';

// --- 1. The module itself ---------------------------------------------------

assert.equal(DEFAULT_VOXEL_DIM, 32, 'the default resolution must stay 32³');
assert.ok(SUPPORTED_VOXEL_DIMS.includes(DEFAULT_VOXEL_DIM));
assert.equal(MAX_VOXEL_DIM, Math.max(...SUPPORTED_VOXEL_DIMS));

for (const dim of SUPPORTED_VOXEL_DIMS) {
    assert.ok(isSupportedVoxelDim(dim));
    assert.equal(voxelCountFor(dim), dim ** 3);
    assert.equal(tensorByteLengthFor(dim), dim ** 3 * 4);
    assert.equal(fiberAffinityByteLengthFor(dim), dim ** 3 * 12 * 4);
    assert.equal(inferVoxelDim(new Float32Array(voxelCountFor(dim))), dim);
    // The compute pass dispatches ceil(dim³ / 64) workgroups of 64; a dim whose
    // cube is not a multiple of 64 would leave a partial workgroup indexing
    // past the end of the buffer.
    assert.equal(voxelCountFor(dim) % 64, 0, `${dim}³ must be a multiple of the 64-invocation workgroup`);
}

assert.throws(() => assertVoxelDim(33), /not a supported voxel dimension/);
assert.throws(() => assertVoxelDim('64'), /not a supported voxel dimension/);
assert.equal(normalizeVoxelDim(33), DEFAULT_VOXEL_DIM);
assert.equal(normalizeVoxelDim(64), 64);
assert.equal(inferVoxelDim(null), DEFAULT_VOXEL_DIM);
assert.equal(inferVoxelDim(new Float32Array(7)), DEFAULT_VOXEL_DIM);

// --- 2. No shader may bake the dimension in ---------------------------------

const shaderSources = Object.entries(shaders).filter(([, v]) => typeof v === 'string');
assert.ok(shaderSources.length > 5, 'expected the shader module to export WGSL strings');

for (const [name, source] of shaderSources) {
    assert.ok(
        !/const\s+VOXEL_DIM\s*:/.test(source),
        `'${name}' declares a compile-time VOXEL_DIM constant — the grid size must come from ` +
        `uniforms.voxelDim / params.voxelDim so setVoxelDim() can change it (src/voxel-dim.js).`
    );

    const callsVoxelDim = source.includes('voxel_dim()');
    const definesVoxelDim = /fn\s+voxel_dim\s*\(\s*\)/.test(source);
    if (callsVoxelDim) {
        assert.ok(
            definesVoxelDim,
            `'${name}' calls voxel_dim() without defining it — interpolate VOXEL_DIM_FROM_UNIFORMS ` +
            `(render) or VOXEL_DIM_FROM_PARAMS (compute) from src/shaders/render-shared.js.`
        );
    }
    if (definesVoxelDim) {
        // The definition must read a binding this shader actually declares.
        if (source.includes('uniforms.voxelDim')) {
            assert.match(source, /var<uniform>\s+uniforms/,
                `'${name}' reads uniforms.voxelDim but declares no 'uniforms' binding`);
        } else {
            assert.match(source, /params\.voxelDim/,
                `'${name}' defines voxel_dim() but reads neither uniforms.voxelDim nor params.voxelDim`);
            assert.match(source, /var<uniform>\s+params/,
                `'${name}' reads params.voxelDim but declares no 'params' binding`);
        }
    }
}

// Both uniform blocks have to carry the dimension for those reads to resolve.
assert.ok(RENDER_UNIFORM_LAYOUT.some((f) => f.name === 'voxelDim'),
    'RENDER_UNIFORM_LAYOUT must carry voxelDim for the render pipelines to index the tensor');
assert.ok(COMPUTE_UNIFORM_LAYOUT.some((f) => f.name === 'voxelDim'),
    'COMPUTE_UNIFORM_LAYOUT must carry voxelDim');

// --- 3. Resampling across resolutions ---------------------------------------

// Same dim is a pass-through, so the common path allocates nothing.
const same = new Float32Array(voxelCountFor(32)).fill(0.25);
assert.equal(resampleField(same, 32, 32), same, 'a same-dim resample must return the input reference');

for (const [from, to] of [[32, 64], [64, 32], [32, 48], [48, 32]]) {
    const constant = new Float32Array(voxelCountFor(from)).fill(0.6);
    const out = resampleField(constant, from, to);
    assert.equal(out.length, voxelCountFor(to));
    for (let i = 0; i < out.length; i++) {
        assert.ok(Math.abs(out[i] - 0.6) < 1e-6,
            `resampling a constant field ${from}³ -> ${to}³ must stay constant (index ${i} = ${out[i]})`);
    }
}

// A gradient must stay monotone along x and inside the source's value range.
const gradientDim = 32;
const gradient = new Float32Array(voxelCountFor(gradientDim));
for (let z = 0; z < gradientDim; z++) {
    for (let y = 0; y < gradientDim; y++) {
        for (let x = 0; x < gradientDim; x++) {
            gradient[z * gradientDim * gradientDim + y * gradientDim + x] = x / (gradientDim - 1);
        }
    }
}
const upsampled = resampleField(gradient, gradientDim, 64);
for (let i = 0; i < upsampled.length; i++) {
    assert.ok(upsampled[i] >= -1e-6 && upsampled[i] <= 1 + 1e-6,
        `resampled value ${upsampled[i]} escaped the source range`);
}
for (let x = 1; x < 64; x++) {
    const prev = upsampled[(10 * 64 + 10) * 64 + (x - 1)];
    const curr = upsampled[(10 * 64 + 10) * 64 + x];
    assert.ok(curr >= prev - 1e-6, `upsampled gradient must stay monotone in x (x=${x})`);
}

assert.throws(() => resampleField(new Float32Array(10), 32, 64), /expected 32768 floats/);

// --- 4. NWS1 sessions carry their dimension ---------------------------------

assert.equal(manifestVoxelDim({ tensor: { shape: [32, 32, 32] } }), 32);
assert.equal(manifestVoxelDim({ tensor: { shape: [64, 64, 64] } }), 64);
assert.throws(() => manifestVoxelDim({ tensor: { shape: [32, 32, 16] } }), /non-cubic/);
assert.throws(() => manifestVoxelDim({ tensor: { shape: [96, 96, 96] } }), /not a supported voxel dimension/);
assert.throws(() => manifestVoxelDim({ tensor: {} }), /tensor.shape must be/);

function makeSession(dim) {
    const tensor = new Float32Array(voxelCountFor(dim)).fill(0.5);
    const manifest = {
        format: NWS_MAGIC,
        durationMs: 100,
        tensor: { shape: [dim, dim, dim], dtype: 'float32-le' },
    };
    const chunks = [{
        type: SESSION_CHUNK_TYPES.tensor,
        timestamp: 0,
        payload: encodeTensorPayload(tensor, dim),
    }];
    return serializeSession(manifest, chunks);
}

for (const dim of SUPPORTED_VOXEL_DIMS) {
    const parsed = await parseSession(await makeSession(dim).arrayBuffer());
    assert.equal(parsed.voxelDim, dim, `parseSession must report the manifest's dimension`);
    const decoded = decodeTensorPayload(parsed.chunks[0].payload, parsed.voxelDim);
    assert.equal(decoded.length, voxelCountFor(dim));
    assert.ok(Math.abs(decoded[0] - 0.5) < 1e-6);
}

// A 32³ session — the only kind that existed before this — still loads with no
// argument threading, because 32³ is the default everywhere.
const legacy = await parseSession(await makeSession(32).arrayBuffer());
assert.equal(decodeTensorPayload(legacy.chunks[0].payload).length, voxelCountFor(32));

// A payload whose length disagrees with the manifest is a corrupt session, not
// a coarse one.
assert.throws(() => encodeTensorPayload(new Float32Array(voxelCountFor(32)), 64), /require 262144 float32 values/);

// --- 5. Downstream consumers follow the dimension ---------------------------

for (const dim of SUPPORTED_VOXEL_DIMS) {
    const resampler = new TensorResampler(undefined, dim);
    const projected = resampler.project({ quality: 1, bands: { alpha: 1, beta: 1, gamma: 1 }, channels: {} });
    assert.equal(projected.length, voxelCountFor(dim), `TensorResampler must emit ${dim}³`);

    const projector = new AITensorProjector(dim);
    const phantom = projector.project(new Float32Array([0.1, 0.9, 0.4]), 0, 4);
    assert.equal(phantom.length, voxelCountFor(dim), `AITensorProjector must emit ${dim}³`);

    // Region means are computed over whatever grid they are handed.
    const field = new Float32Array(voxelCountFor(dim)).fill(1);
    const means = getAnatomicalRegionMeans(field);
    for (const [region, value] of Object.entries(means)) {
        assert.ok(Math.abs(value - 1) < 1e-6, `${region} mean at ${dim}³ should be 1, got ${value}`);
    }
}

// The fiber affinity map is baked at the geometry's dim — an affinity buffer at
// the wrong resolution feeds anisotropic diffusion tract directions from the
// wrong voxels, which is a different simulation, not a coarser one.
for (const dim of [32, 48]) {
    const geometry = new BrainGeometry({ voxelDim: dim });
    geometry.generate(24, 24);
    assert.equal(geometry.fiberAffinityDim, dim);
    assert.equal(
        geometry.getFiberAffinityData().byteLength,
        fiberAffinityByteLengthFor(dim),
        `BrainGeometry({ voxelDim: ${dim} }) must bake a ${dim}³ affinity map`
    );
}

// --- 6. The renderer mixins that actually perform a switch -------------------
//
// setVoxelDim() is the riskiest code in this change and needs neither a GPU nor
// a browser to be wrong: it has to resample before destroying anything, rebuild
// the bind groups after the buffers (a bind group captures the buffer it was
// built with, so skipping this leaves the pipelines reading freed memory), and
// leave the renderer untouched when it refuses. Stub backends pin that ordering.

const { applyResolutionMethods: applyGPUResolution } = await import('../src/brain-renderer/resolution.js');
const { applyResolutionMethods: applyGLResolution } = await import('../src/brain-renderer-webgl/resolution.js');

function makeStubDevice(limits = {}) {
    return {
        limits: {
            maxStorageBufferBindingSize: 128 * 1024 * 1024,
            maxBufferSize: 256 * 1024 * 1024,
            maxComputeWorkgroupsPerDimension: 65535,
            ...limits,
        },
        queue: { writeBuffer() {} },
    };
}

class StubGPURenderer {
    constructor() {
        this.voxelDim = DEFAULT_VOXEL_DIM;
        this.voxelCount = voxelCountFor(this.voxelDim);
        this._lastHumanTensor = new Float32Array(this.voxelCount).fill(0.4);
        this._lastAITensor = new Float32Array(this.voxelCount).fill(0.2);
        this.device = makeStubDevice();
        this.wasmEngine = null;
        this.wasmMode = false;
        this.log = [];
        this.tensorBuffer = { destroy: () => this.log.push('destroy:tensor') };
        this.aiTensorBuffer = { destroy: () => this.log.push('destroy:ai') };
        this.fiberDirectionBuffer = { destroy: () => this.log.push('destroy:fiber') };
    }
    createTensorStorageBuffers() { this.log.push('createBuffers'); }
    rebuildGeometry() { this.log.push('rebuildGeometry'); }
    createRenderBindGroups() { this.log.push('renderBindGroups'); }
    createComputeBindGroup() { this.log.push('computeBindGroup'); }
}
applyGPUResolution(StubGPURenderer);

const gpu = new StubGPURenderer();
assert.equal(gpu.setVoxelDim(DEFAULT_VOXEL_DIM), false, 'setting the current dim must be a no-op');
assert.deepEqual(gpu.log, [], 'a no-op switch must touch nothing');

assert.equal(gpu.setVoxelDim(64), true);
assert.equal(gpu.voxelDim, 64);
assert.equal(gpu.getVoxelDim(), 64);
assert.equal(gpu.voxelCount, voxelCountFor(64));
assert.equal(gpu._lastHumanTensor.length, voxelCountFor(64));
assert.equal(gpu._lastAITensor.length, voxelCountFor(64));
// The live field is carried across, not reset.
assert.ok(Math.abs(gpu._lastHumanTensor[voxelCountFor(64) >> 1] - 0.4) < 1e-6,
    'the human field must survive a resolution change');

assert.deepEqual(
    gpu.log,
    ['destroy:tensor', 'destroy:ai', 'destroy:fiber', 'createBuffers', 'rebuildGeometry',
     'renderBindGroups', 'computeBindGroup'],
    'buffers must be recreated before the bind groups that capture them'
);

// An unsupported dim is refused before anything is torn down.
const strict = new StubGPURenderer();
assert.throws(() => strict.setVoxelDim(96), /not a supported voxel dimension/);
assert.equal(strict.voxelDim, DEFAULT_VOXEL_DIM);
assert.deepEqual(strict.log, []);

// So is a device that cannot hold the larger field — a refusal, not a silent
// downgrade to a resolution nobody asked for.
const small = new StubGPURenderer();
small.device = makeStubDevice({ maxStorageBufferBindingSize: 1024 });
assert.throws(() => small.setVoxelDim(64), /caps storage bindings/);
assert.equal(small.voxelDim, DEFAULT_VOXEL_DIM);
assert.deepEqual(small.log, [], 'a refused switch must not destroy the working buffers');

// Before the device exists the switch is pure bookkeeping.
const preInit = new StubGPURenderer();
preInit.device = null;
assert.equal(preInit.setVoxelDim(48), true);
assert.equal(preInit.voxelCount, voxelCountFor(48));
assert.deepEqual(preInit.log, []);

class StubGLRenderer {
    constructor() {
        this.voxelDim = DEFAULT_VOXEL_DIM;
        this.voxelCount = voxelCountFor(this.voxelDim);
        this._lastHumanTensor = new Float32Array(this.voxelCount).fill(0.7);
        this._lastAITensor = new Float32Array(this.voxelCount);
        this._nextHumanTensor = new Float32Array(this.voxelCount);
        this._normalizedFiberAffinity = 'stale';
        this.log = [];
        this.meshBuffers = { tensorPosition: 'p', tensorColorSize: 'c' };
        this.tensorVao = 'vao';
        this.gl = {
            deleteVertexArray: () => this.log.push('deleteVao'),
            deleteBuffer: () => this.log.push('deleteBuffer'),
        };
    }
    buildAndUploadGeometry() { this.log.push('geometry'); }
    buildTensorDebugGrid() { this.log.push('debugGrid'); }
}
applyGLResolution(StubGLRenderer);

const gl = new StubGLRenderer();
assert.equal(gl.setVoxelDim(48), true);
assert.equal(gl.voxelDim, 48);
assert.equal(gl.voxelCount, voxelCountFor(48));
assert.equal(gl._nextHumanTensor.length, voxelCountFor(48), 'the scratch step buffer must be resized too');
assert.equal(gl._normalizedFiberAffinity, null, 'the per-dim affinity normalisation must be invalidated');
assert.ok(Math.abs(gl._lastHumanTensor[100] - 0.7) < 1e-6);
assert.deepEqual(gl.log, ['geometry', 'deleteVao', 'deleteBuffer', 'deleteBuffer', 'debugGrid'],
    'the dim³ debug grid must be released before it is rebuilt');

assert.throws(() => gl.setVoxelDim(7), /not a supported voxel dimension/);
assert.equal(gl.voxelDim, 48);

console.log('test_voxel_dim passed');

#!/usr/bin/env node
// scripts/wgsl_oracle.mjs
// [Tensor Physics] WGSL vs the CPU reference — docs/tensor-physics.md §9.2.
//
//   npm run test:wgsl            # or: node scripts/wgsl_oracle.mjs
//
// The golden fixtures pin the JS reference and the C++ engine to each other.
// Neither says anything about the compute shader, which is the field every
// WebGPU session actually sees — and it had drifted: the cascade gate was
// still a hard step() after both CPU paths moved to the soft band, and the
// coarse step ran in place, racing every neighbour read against that
// neighbour's write. This oracle runs the *production* `computeShader`
// (unmodified) on a real WebGPU implementation — Dawn, in headless Chromium,
// on SwiftShader's software adapter — and compares it with stepTensorField().
//
// Not bit-for-bit (§8): the hash and the advection sampler differ by design,
// so the oracle scenarios switch both off (no cascade — spikeThreshold above
// any reachable peak — no electrical spikes, no fluid). Everything else runs,
// including §3.4 off its defaults. What remains is float32 (with whatever FMA
// the driver fuses) against the reference's double intermediates.
//
// Skips (exit 0, loudly) when no Chromium build or WebGPU adapter is
// available, unless REQUIRE_WGSL_ORACLE=1. Never reports a pass it did not run.
//
// Environment:
//   CHROME_PATH=…            a Chromium/Chrome binary (default: Playwright's)
//   WGSL_ORACLE_GPU=hardware use the machine's adapter instead of SwiftShader
//   REQUIRE_WGSL_ORACLE=1    a skip is a failure
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { computeShader } from '../src/shaders/volumetric-compute.js';
import { COMPUTE_UNIFORM_LAYOUT, COMPUTE_UNIFORM_OFFSETS, COMPUTE_UNIFORM_BYTE_SIZE } from '../src/shaders/uniform-layout.js';
import {
    BRAIN_RANGE,
    makeReferenceFiberAffinities,
    regionZone,
    resolveFieldParams,
    stepTensorField,
} from '../src/physics/tensor-field.js';
import { GOLDEN_SCENARIO, NEUROMOD_SCENARIO } from '../tests/golden-scenario.js';

const REQUIRE = process.env.REQUIRE_WGSL_ORACLE === '1';

// §9.2: the deliberate divergences (§8.1 hash, §8.3 advection sampler) made
// inert, everything else left as the golden scenarios have it.
const INERT_DIVERGENCES = Object.freeze({
    spikeThreshold: 2.0,   // threshold ≥ 2.0·0.72 > any localPeak: §6.5 cascade is exactly 0
    cognitiveLoad: 0.0,
    stress: 0.0,
    fluidActive: 0.0,      // no §6.8 advection (trilinear vs nearest, §8.3)
    electricalActive: 0.0, // no §6.10 hash-placed spikes (§8.1)
});

const ORACLE_SCENARIOS = [
    { name: 'structured-baseline', from: GOLDEN_SCENARIO },
    { name: 'structured-neuromod', from: NEUROMOD_SCENARIO },
].map(({ name, from }) => ({
    name,
    voxelDim: from.voxelDim,
    // WGSL_ORACLE_STEPS=n runs a prefix — for bisecting a disagreement.
    steps: Number(process.env.WGSL_ORACLE_STEPS) || from.steps,
    dt: from.dt,
    params: { ...from.params, ...INERT_DIVERGENCES },
}));

// Tolerances, calibrated on SwiftShader (Chromium build 1234), 24 steps at 32³.
//
//                                   rel. L2   mean |Δ|   worst lobe mean
//   production shader               6.8e-5    1.1e-6     1.2e-6
//   §6.3 iso mix 0.70 -> 0.69       6-8e-4    2-5e-5     6e-5
//   §6.6 wave 0.08 -> 0.079         0.9-1.3e-3 4-8e-5    1e-4
//   §3.4 retention dropped          1.1e-1    4.9e-3     1e-2   (neuromod only)
//   §3.4 dropped entirely           4.6e-1    1.9e-2     4e-2   (neuromod only)
//   step in place (the old race)    1.2e-1    1.0e-2     1.6e-2
//
// The aggregate bounds sit ~5-8x above production and below a 1% change to a
// single coefficient. The per-voxel bound is loose on purpose: the production
// worst voxel (~7e-4) is a §4.2 nearest-voxel read that lands in a different
// cell on the GPU — mostly the per-step tract re-normalisation of §8.6, then
// float32/FMA rounding of sample coordinates — and such a flip grows over the
// run without meaning anything. It still catches a gross local error.
const MAX_REL_L2 = 3e-4;
const MAX_MEAN_ABS_DIFF = 1e-5;
const MAX_LOBE_MEAN_DIFF = 1e-5;
const MAX_VOXEL_DIFF = 5e-3;

const ZONE_NAMES = ['default', 'frontal', 'occipital', 'temporal', 'parietal'];

function skip(reason) {
    console.warn(`\n!!! wgsl_oracle SKIPPED — ${reason}`);
    console.warn('!!! The WGSL compute shader was NOT compared with the CPU reference.');
    console.warn('!!! Set REQUIRE_WGSL_ORACLE=1 to make this a failure.\n');
    process.exit(REQUIRE ? 1 : 0);
}

/**
 * A TensorParams byte image from a resolved parameter object. Field names come
 * from COMPUTE_UNIFORM_LAYOUT; vectors read `<name>X/Y/Z/W`, the flat
 * convention resolveFieldParams() uses (stimulusPosX…, retentionBiasX…).
 * Fields the field does not read (§6.14) are left 0.
 */
function packTensorParams(p) {
    const bytes = new ArrayBuffer(COMPUTE_UNIFORM_BYTE_SIZE);
    const view = new DataView(bytes);
    for (const field of COMPUTE_UNIFORM_LAYOUT) {
        const at = COMPUTE_UNIFORM_OFFSETS[field.name] * 4;
        if (field.type === 'u32') {
            view.setUint32(at, p[field.name] ?? 0, true);
        } else if (field.type === 'f32') {
            view.setFloat32(at, p[field.name] ?? 0, true);
        } else if (field.type === 'vec3' || field.type === 'vec4') {
            const axes = field.type === 'vec3' ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z', 'W'];
            axes.forEach((axis, i) => view.setFloat32(at + i * 4, p[`${field.name}${axis}`] ?? 0, true));
        }
    }
    return [...new Uint8Array(bytes)];
}

/**
 * $CHROME_PATH alone if set. Otherwise Playwright's pinned build (undefined =
 * its default), then any build in its cache, newest first: the npm package and
 * the browsers installed on a machine drift independently.
 */
function chromiumCandidates() {
    if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
    return [undefined, ...cachedChromiumBuilds()];
}

function cachedChromiumBuilds() {
    const cache = join(homedir(), '.cache', 'ms-playwright');
    if (!existsSync(cache)) return [];
    return readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        .flatMap((d) => ['chrome-linux64', 'chrome-linux', 'chrome-mac', 'chrome-win']
            .map((sub) => join(cache, d, sub, sub.startsWith('chrome-win') ? 'chrome.exe' : 'chrome')))
        .filter(existsSync);
}

const SOFTWARE_WEBGPU_ARGS = [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-vulkan=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-watchdog',
];
const HARDWARE_WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--enable-features=Vulkan'];

async function launchBrowser() {
    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        skip('the playwright package is not installed (npm install).');
    }
    const args = process.env.WGSL_ORACLE_GPU === 'hardware' ? HARDWARE_WEBGPU_ARGS : SOFTWARE_WEBGPU_ARGS;
    const errors = [];
    for (const executablePath of chromiumCandidates()) {
        try {
            return await chromium.launch({ headless: true, executablePath, args });
        } catch (err) {
            errors.push(`${executablePath ?? "playwright's default"}: ${String(err.message).split('\n')[0]}`);
        }
    }
    skip(`no Chromium build could be launched (npx playwright install chromium, or set CHROME_PATH).\n    ${errors.join('\n    ')}`);
}

/** Runs in the page. Steps the production shader `steps` times; returns the field. */
async function gpuRun({ shader, voxelDim, steps, dt, paramImages, fibers }) {
    if (!navigator.gpu) return { skip: 'navigator.gpu is undefined (WebGPU disabled in this build).' };
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { skip: 'no WebGPU adapter.' };
    const device = await adapter.requestDevice();
    const errors = [];
    device.addEventListener('uncapturederror', (e) => errors.push(e.error.message));

    const count = voxelDim ** 3;
    const STORAGE = GPUBufferUsage.STORAGE;
    const field = device.createBuffer({ size: count * 4, usage: STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const next = device.createBuffer({ size: count * 4, usage: STORAGE | GPUBufferUsage.COPY_SRC });
    const ai = device.createBuffer({ size: count * 4, usage: STORAGE | GPUBufferUsage.COPY_DST });
    const fiberBuf = device.createBuffer({ size: fibers.length * 4, usage: STORAGE | GPUBufferUsage.COPY_DST });
    const paramBuf = device.createBuffer({ size: paramImages[0].length, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const readback = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(field, 0, new Float32Array(count));
    device.queue.writeBuffer(ai, 0, new Float32Array(count));
    device.queue.writeBuffer(fiberBuf, 0, new Float32Array(fibers));

    device.pushErrorScope('validation');
    const module = device.createShaderModule({ code: shader });
    const info = await module.getCompilationInfo();
    const compileErrors = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
    if (compileErrors.length) return { error: `shader compilation failed:\n${compileErrors.join('\n')}` };
    // Mirrors initComputePipeline() in src/brain-renderer/pipelines.js.
    const layout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });
    const pipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        compute: { module, entryPoint: 'main' },
    });
    const bindGroup = device.createBindGroup({
        layout,
        entries: [
            { binding: 0, resource: { buffer: field } },
            { binding: 1, resource: { buffer: paramBuf } },
            { binding: 2, resource: { buffer: fiberBuf } },
            { binding: 3, resource: { buffer: ai } },
            { binding: 4, resource: { buffer: next } },
        ],
    });
    const validation = await device.popErrorScope();
    if (validation) return { error: `pipeline validation failed: ${validation.message}` };

    const started = performance.now();
    for (let step = 0; step < steps; step++) {
        device.queue.writeBuffer(paramBuf, 0, new Uint8Array(paramImages[step]));
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64));
        pass.end();
        // Same publication step as render-loop.js.
        encoder.copyBufferToBuffer(next, 0, field, 0, count * 4);
        device.queue.submit([encoder.finish()]);
    }
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(field, 0, readback, 0, count * 4);
    device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const out = Array.from(new Float32Array(readback.getMappedRange()));
    readback.unmap();
    if (errors.length) return { error: `GPU errors during the run:\n${errors.join('\n')}` };
    const ai2 = adapter.info ?? {};
    return { field: out, ms: performance.now() - started, adapter: [ai2.vendor, ai2.architecture, ai2.description].filter(Boolean).join(' / ') };
}

function cpuRun(scenario) {
    const { voxelDim, steps, dt, params } = scenario;
    const count = voxelDim ** 3;
    let field = new Float32Array(count);
    let next = new Float32Array(count);
    const fiberAffinity = makeReferenceFiberAffinities(voxelDim);
    for (let step = 0; step < steps; step++) {
        stepTensorField(field, next, { params: resolveFieldParams({ ...params, voxelDim, time: step * dt }), fiberAffinity, frame: step });
        [field, next] = [next, field];
    }
    return field;
}

function lobeMeans(field, dim) {
    const sums = new Float64Array(5);
    const counts = new Float64Array(5);
    const fr = Math.fround;
    for (let i = 0; i < field.length; i++) {
        const x = i % dim, y = ((i / dim) | 0) % dim, z = (i / (dim * dim)) | 0;
        const zone = regionZone(
            fr(fr(fr(x / dim) * 2 - 1) * BRAIN_RANGE),
            fr(fr(fr(y / dim) * 2 - 1) * BRAIN_RANGE),
            fr(fr(fr(z / dim) * 2 - 1) * BRAIN_RANGE),
        );
        sums[zone] += field[i];
        counts[zone]++;
    }
    return Array.from(sums, (s, z) => s / counts[z]);
}

const browser = await launchBrowser();
let failed = false;
try {
    const page = await browser.newPage();
    // WebGPU needs a secure context; about:blank is not one.
    await page.route('https://wgsl-oracle.invalid/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>wgsl oracle</title>' }));
    await page.goto('https://wgsl-oracle.invalid/');

    for (const scenario of ORACLE_SCENARIOS) {
        const { voxelDim, steps, dt, params } = scenario;
        const paramImages = Array.from({ length: steps }, (_, step) =>
            packTensorParams(resolveFieldParams({ ...params, voxelDim, time: step * dt })));
        const gpu = await page.evaluate(gpuRun, {
            shader: computeShader,
            voxelDim, steps, dt, paramImages,
            fibers: Array.from(makeReferenceFiberAffinities(voxelDim)),
        });
        if (gpu.skip) skip(gpu.skip);
        if (gpu.error) {
            console.error(`[wgsl_oracle] ${scenario.name}: ${gpu.error}`);
            failed = true;
            continue;
        }

        const cpu = cpuRun(scenario);
        let maxDiff = 0, worst = 0, sumDiff = 0, sqDiff = 0, sqCpu = 0;
        for (let i = 0; i < cpu.length; i++) {
            const d = Math.abs(gpu.field[i] - cpu[i]);
            sumDiff += d;
            sqDiff += d * d;
            sqCpu += cpu[i] * cpu[i];
            if (d > maxDiff) { maxDiff = d; worst = i; }
        }
        const relL2 = Math.sqrt(sqDiff / sqCpu);
        const gpuLobes = lobeMeans(gpu.field, voxelDim);
        const cpuLobes = lobeMeans(cpu, voxelDim);
        const lobeDiffs = gpuLobes.map((g, z) => Math.abs(g - cpuLobes[z]));
        const maxLobeDiff = Math.max(...lobeDiffs);
        const cpuMean = cpu.reduce((a, b) => a + b, 0) / cpu.length;

        console.log(`[wgsl_oracle] ${scenario.name}: ${steps} steps at ${voxelDim}³ on ${gpu.adapter || 'unknown adapter'} (${gpu.ms.toFixed(0)} ms)`);
        console.log(`[wgsl_oracle]   field mean ${cpuMean.toFixed(6)}; per-voxel |GPU−CPU| mean ${(sumDiff / cpu.length).toExponential(2)}, max ${maxDiff.toExponential(2)} (voxel ${worst}: GPU ${gpu.field[worst].toFixed(7)} vs CPU ${cpu[worst].toFixed(7)})`);
        console.log(`[wgsl_oracle]   relative L2 ‖GPU−CPU‖/‖CPU‖ ${relL2.toExponential(2)}`);
        console.log(`[wgsl_oracle]   lobe means |GPU−CPU|: ${ZONE_NAMES.map((n, z) => `${n} ${lobeDiffs[z].toExponential(1)}`).join(', ')}`);

        if (!(cpuMean > 0.01 && cpuMean < 0.99)) {
            console.error(`[wgsl_oracle] ${scenario.name}: the CPU field is dead or saturated (mean ${cpuMean}); the comparison would discriminate nothing.`);
            failed = true;
        }
        const checks = [
            ['relative L2', relL2, MAX_REL_L2],
            ['mean per-voxel', sumDiff / cpu.length, MAX_MEAN_ABS_DIFF],
            ['worst lobe mean', maxLobeDiff, MAX_LOBE_MEAN_DIFF],
            ['worst voxel', maxDiff, MAX_VOXEL_DIFF],
        ];
        for (const [label, value, bound] of checks) {
            if (!(value <= bound)) {
                console.error(`[wgsl_oracle] ${scenario.name}: FAIL ${label} ${value.toExponential(2)} > ${bound.toExponential(0)}`);
                failed = true;
            }
        }
    }
} finally {
    await browser.close();
}

if (failed) {
    console.error('[wgsl_oracle] FAIL: the WGSL step and src/physics/tensor-field.js disagree beyond float32 noise.\n' +
        '[wgsl_oracle] One of them left docs/tensor-physics.md — fix that one (§10), or record a new §8 divergence.');
    process.exit(1);
}
console.log('[wgsl_oracle] PASS: the production WGSL step matches the CPU reference on every oracle scenario.');

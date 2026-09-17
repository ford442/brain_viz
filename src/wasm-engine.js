// src/wasm-engine.js
// [Tensor Physics] JavaScript loader and bridge for the C++ BrainTensorEngine.
//
// The engine implements docs/tensor-physics.md; this file is the transport.
// Two things about it used to be wrong and are load-bearing now:
//
//  1. **Parameters travel as a struct, not as a positional argument list.** The
//     old bridge called a 13-float `bte_update(...)`, so `cognitiveLoad`,
//     `stress`, the paint radius, the eraser flag, fiber coupling and the
//     neuromodulator block were all dropped on the floor without a word. The
//     block written below is laid out by COMPUTE_UNIFORM_OFFSETS — the same map
//     brain-renderer/uniforms.js uses for the WebGPU uniform buffer — so the
//     two paths cannot receive different parameters.
//
//  2. **The heap view is re-derived after every call.** With
//     ALLOW_MEMORY_GROWTH=1 a growth detaches the old `HEAPF32.buffer`, and a
//     Float32Array captured at init then reads as an empty (or stale) array
//     for the rest of the session. Views are taken fresh from the module's
//     current heap on each use; see `_heap()`.
//
// Usage (hybrid mode):
//   const engine = new WasmTensorEngine(32);
//   await engine.init();
//   engine.setFiberAffinities(geometry.getFiberAffinityData());
//   engine.update(time, params);
//   renderer.setVoxelData(engine.getTensorData());
//
// If the module is unavailable (build not run, unsupported environment) init()
// resolves false and callers stay on the WebGPU compute path.

import {
    COMPUTE_UNIFORM_OFFSETS,
    COMPUTE_UNIFORM_BYTE_SIZE,
} from './shaders/uniform-layout.js';

/** Byte offset of a `TensorParams` field inside the params block. */
const cOff = (name) => COMPUTE_UNIFORM_OFFSETS[name] * 4;

/**
 * Where the Emscripten glue lives at runtime.
 *
 * It is served out of `public/wasm/`, so the URL has to be built from the app's
 * deployment base. A host-root '/wasm/…' 404s under `base: '/brain-viz/'`
 * exactly the way the ONNX Runtime assets used to (see vite.config.js).
 *
 * The release build emits an ES module (`.mjs`); a `.js` from a build made
 * before EXPORT_ES6 is still accepted, so both spellings are tried in turn.
 *
 * @returns {string[]} candidate URLs, most current first
 */
function resolveModuleUrls() {
    let base = '/';
    try {
        // import.meta.env exists under Vite; guard so this module still loads
        // in plain Node (tests) and in non-Vite bundlers.
        base = (import.meta.env && import.meta.env.BASE_URL) || '/';
    } catch {
        base = '/';
    }
    if (!base.endsWith('/')) base += '/';
    return [`${base}wasm/brain_tensor_engine.mjs`, `${base}wasm/brain_tensor_engine.js`];
}

/**
 * Import the first candidate URL that resolves to a module factory.
 * @param {string[]} urls
 * @returns {Promise<{factory: Function, url: string}>}
 */
async function importModuleFactory(urls) {
    let lastError = null;
    for (const url of urls) {
        try {
            const factory = (await import(/* @vite-ignore */ url)).default;
            if (typeof factory === 'function') return { factory, url };
            lastError = new Error(`${url} has no default export factory`);
        } catch (err) {
            lastError = err;
        }
    }
    throw new Error(
        `no loadable WASM glue at ${urls.join(' or ')} — did you run npm run build:wasm? ` +
        `(${lastError?.message ?? 'unknown error'})`
    );
}

export class WasmTensorEngine {
    constructor(voxelDim = 32) {
        this.voxelDim = voxelDim;
        this.voxelCount = voxelDim ** 3;
        this.available = false;
        this._module = null;
        this._handle = null;
        this._outPtr = null;      // tensor read-back buffer in the WASM heap
        this._paramsPtr = null;   // BrainTensorParams block in the WASM heap
        this._scratchPtr = null;  // staging buffer for affinity / AI uploads
        this._scratchBytes = 0;
        this._benchmarkResults = null;

        this._bte = {};
    }

    /**
     * Load and initialise the WASM module.
     * Safe to call repeatedly; later calls are no-ops.
     * @returns {Promise<boolean>} true if WASM is now available.
     */
    async init() {
        if (this.available) return true;

        try {
            const { factory, url } = await importModuleFactory(resolveModuleUrls());
            this._module = await factory();
            const cwrap = this._module.cwrap;

            this._bte = {
                create: cwrap('bte_create', 'number', ['number']),
                destroy: cwrap('bte_destroy', null, ['number']),
                paramsByteSize: cwrap('bte_params_byte_size', 'number', []),
                setParams: cwrap('bte_set_params', null, ['number', 'number']),
                setFiberAffinities: cwrap('bte_set_fiber_affinities', null, ['number', 'number', 'number']),
                setAiTensor: cwrap('bte_set_ai_tensor', null, ['number', 'number', 'number']),
                update: cwrap('bte_update', null, ['number']),
                injectStimulus: cwrap('bte_inject_stimulus', null,
                    ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']),
                getTensorData: cwrap('bte_get_tensor_data', null, ['number', 'number', 'number']),
                setTensorData: cwrap('bte_set_tensor_data', null, ['number', 'number', 'number']),
                reset: cwrap('bte_reset', null, ['number']),
                benchmark: cwrap('bte_benchmark', 'number', ['number', 'number', 'number']),
            };

            // ABI guard: a .wasm built before a layout change would read every
            // parameter at a shifted offset and silently simulate something
            // else. Refuse instead, and fall back to the WebGPU compute path.
            const wasmParamsSize = this._bte.paramsByteSize();
            if (wasmParamsSize !== COMPUTE_UNIFORM_BYTE_SIZE) {
                throw new Error(
                    `BrainTensorParams is ${wasmParamsSize} bytes in the .wasm but ` +
                    `${COMPUTE_UNIFORM_BYTE_SIZE} in COMPUTE_UNIFORM_LAYOUT — rebuild with ` +
                    `npm run build:wasm (the header is generated by scripts/gen_wasm_params.mjs).`
                );
            }

            this._handle = this._bte.create(this.voxelDim);
            if (!this._handle) throw new Error('bte_create returned null');

            this._outPtr = this._module._malloc(this.voxelCount * 4);
            this._paramsPtr = this._module._malloc(COMPUTE_UNIFORM_BYTE_SIZE);
            if (!this._outPtr || !this._paramsPtr) throw new Error('malloc failed for the engine buffers');

            this.available = true;
            console.log('[WasmTensorEngine] Initialised — voxelDim:', this.voxelDim, 'from', url);
            return true;
        } catch (err) {
            console.warn('[WasmTensorEngine] Unavailable — falling back to WebGPU compute:', err.message);
            this.available = false;
            return false;
        }
    }

    /**
     * The module's *current* heaps.
     *
     * Never cache these across a call into WASM: any allocation can trigger
     * memory growth, which allocates a new WebAssembly.Memory buffer and
     * detaches every view onto the old one. A detached Float32Array reads as
     * length 0, so a cached view turns into a silent upload of nothing.
     *
     * @returns {{f32: Float32Array, view: DataView}}
     */
    _heap() {
        const buffer = this._module.HEAPF32.buffer;
        return { f32: new Float32Array(buffer), view: new DataView(buffer) };
    }

    /** Grow (or allocate) the staging buffer used for bulk uploads. */
    _scratch(bytes) {
        if (this._scratchBytes >= bytes) return this._scratchPtr;
        if (this._scratchPtr) this._module._free(this._scratchPtr);
        this._scratchPtr = this._module._malloc(bytes);
        this._scratchBytes = this._scratchPtr ? bytes : 0;
        return this._scratchPtr;
    }

    /**
     * Write a full `TensorParams` block into the engine.
     *
     * Field names and offsets come from the shared layout, so this is the same
     * byte image the WebGPU compute shader receives. A parameter the renderer
     * sets but this method does not name is a bug in *this* list — the spec's
     * §6.14 is the place that records a field as deliberately unread.
     *
     * @param {number} time
     * @param {Object<string, any>} params  the renderer's params object
     * @param {{pos: number[], active: number, radius: number, erase: boolean,
     *          electricalActive: number, mercuryActive: number}} [stimulus]
     */
    setParams(time, params, stimulus = null) {
        if (!this.available) return;
        const { view } = this._heap();
        const base = this._paramsPtr;
        const f = (name, value) => view.setFloat32(base + cOff(name), Number.isFinite(value) ? value : 0, true);

        // Zero first: an unwritten field must read as 0, not as whatever the
        // previous frame or another allocation left in the heap.
        new Uint8Array(this._module.HEAPF32.buffer, base, COMPUTE_UNIFORM_BYTE_SIZE).fill(0);

        view.setFloat32(base + cOff('time'), time, true);
        view.setUint32(base + cOff('voxelDim'), this.voxelDim, true);
        f('frequency', params.frequency ?? 2.0);
        f('amplitude', params.amplitude ?? 0.5);
        f('spikeThreshold', params.spikeThreshold ?? 0.6);
        f('smoothing', params.smoothing ?? 0.9);
        f('style', params.style ?? 0.0);

        const pos = stimulus?.pos ?? [0, 0, 0];
        view.setFloat32(base + cOff('stimulusPos') + 0, pos[0] ?? 0, true);
        view.setFloat32(base + cOff('stimulusPos') + 4, pos[1] ?? 0, true);
        view.setFloat32(base + cOff('stimulusPos') + 8, pos[2] ?? 0, true);
        f('stimulusActive', stimulus?.active ?? 0.0);
        f('stimulusRadius', stimulus?.radius ?? 0.0);
        f('stimulusErase', stimulus?.erase ? 1.0 : 0.0);

        f('hypoxiaStress', params.hypoxiaStress ?? 0.0);
        f('metabolicRate', params.metabolicRate ?? 1.0);
        f('mitochondrialFunction', params.mitochondrialFunction ?? 1.0);
        f('fluidActive', params.fluidActive ?? 0.0);
        f('electricalActive', stimulus?.electricalActive ?? 0.0);
        f('mercuryActive', stimulus?.mercuryActive ?? 0.0);
        f('cognitiveLoad', params.cognitiveLoad ?? 0.0);
        f('stress', params.stress ?? 0.0);
        f('heavyMetal', params.heavyMetal ?? 0.0);

        // SynaptiX coupling is visual-only on the WebGPU path too — see the
        // matching note in brain-renderer/uniforms.js.
        f('aiInfluence', 0.0);
        f('resonanceThreshold', params.resonanceThreshold ?? 0.2);
        f('synaptiXActive', 0.0);
        f('fiberCoupling', params.fiberCoupling ?? 0.5);
        f('cognitiveDissonance', params.cognitiveDissonance ?? 0.0);

        f('decayRate', params.decayRate ?? 0.96);
        f('diffusionRate', params.diffusionRate ?? 0.1);
        f('pulseSaturation', params.pulseSaturation ?? 1.0);
        f('trailLength', params.trailLength ?? 1.0);
        view.setFloat32(base + cOff('retentionBias') + 0, params.retentionBiasX ?? 0.5, true);
        view.setFloat32(base + cOff('retentionBias') + 4, params.retentionBiasY ?? 0.0, true);
        view.setFloat32(base + cOff('retentionBias') + 8, params.retentionBiasZ ?? 0.2, true);
        view.setFloat32(base + cOff('retentionBias') + 12, params.retentionBiasW ?? 0.2, true);

        view.setFloat32(base + cOff('lesionCenter') + 0, params.lesionCenterX ?? 0, true);
        view.setFloat32(base + cOff('lesionCenter') + 4, params.lesionCenterY ?? 0, true);
        view.setFloat32(base + cOff('lesionCenter') + 8, params.lesionCenterZ ?? 0, true);
        f('lesionActive', params.lesionActive ?? 0.0);
        f('lesionRadius', params.lesionRadius ?? 0.0);
        f('decimation', params.decimation ?? 0.0);

        this._bte.setParams(this._handle, this._paramsPtr);
    }

    /**
     * Advance the simulation by one step.
     * @param {number} time
     * @param {Object<string, any>} params
     * @param {Object} [stimulus] the renderer's stimulus block
     */
    update(time, params, stimulus = null) {
        if (!this.available) return;
        this.setParams(time, params, stimulus);
        this._bte.update(this._handle);
    }

    /**
     * Upload per-voxel fiber tract affinities (voxelCount × 3 × vec4).
     * Without these the engine diffuses isotropically, which is a different
     * simulation — the WebGPU path always has them.
     * @param {Float32Array|null} data
     */
    setFiberAffinities(data) {
        if (!this.available) return false;
        if (!data) { this._bte.setFiberAffinities(this._handle, 0, 0); return true; }
        const expected = this.voxelCount * 12;
        if (data.length !== expected) {
            console.warn(`[WasmTensorEngine] Fiber affinity buffer is ${data.length} floats, expected ${expected} — ignoring.`);
            return false;
        }
        const ptr = this._scratch(expected * 4);
        if (!ptr) return false;
        this._heap().f32.set(data, ptr / 4);
        this._bte.setFiberAffinities(this._handle, ptr, expected);
        return true;
    }

    /**
     * Upload the SynaptiX AI tensor (voxelCount floats), or null to clear it.
     * @param {Float32Array|null} data
     */
    setAiTensor(data) {
        if (!this.available) return false;
        if (!data) { this._bte.setAiTensor(this._handle, 0, 0); return true; }
        const ptr = this._scratch(this.voxelCount * 4);
        if (!ptr) return false;
        this._heap().f32.set(data.subarray(0, this.voxelCount), ptr / 4);
        this._bte.setAiTensor(this._handle, ptr, this.voxelCount);
        return true;
    }

    /**
     * Inject a Gaussian stimulus pulse. Radius and eraser mode are forwarded —
     * the old 5-argument C entry point could not express them, so WASM mode
     * silently painted with a fixed brush.
     */
    injectStimulus(x, y, z, intensity, { radius = 0.0, erase = false, mitochondrialFunction = 1.0 } = {}) {
        if (!this.available) return;
        this._bte.injectStimulus(this._handle, x, y, z, intensity, radius, erase ? 1.0 : 0.0, mitochondrialFunction);
    }

    /**
     * Current tensor data as a Float32Array.
     *
     * The returned array is a *copy-free view* onto the WASM heap and is only
     * valid until the next call into the module, so it is taken fresh here
     * rather than cached across frames (see `_heap()`).
     * @returns {Float32Array|null}
     */
    getTensorData() {
        if (!this.available) return null;
        this._bte.getTensorData(this._handle, this._outPtr, this.voxelCount);
        return new Float32Array(this._module.HEAPF32.buffer, this._outPtr, this.voxelCount);
    }

    /** Overwrite the engine's field (used when another source seeds the tensor). */
    setTensorData(data) {
        if (!this.available || !data) return false;
        const ptr = this._scratch(this.voxelCount * 4);
        if (!ptr) return false;
        this._heap().f32.set(data.subarray(0, this.voxelCount), ptr / 4);
        this._bte.setTensorData(this._handle, ptr, this.voxelCount);
        return true;
    }

    /** Zero all tensor activity (mirrors renderer.resetActivity()). */
    reset() {
        if (!this.available) return;
        this._bte.reset(this._handle);
    }

    /**
     * Run a micro-benchmark.
     * @param {number} steps
     * @param {number} dt
     * @returns {{steps: number, elapsedMs: number, stepsPerSec: number}|null}
     */
    benchmark(steps = 100, dt = 0.016) {
        if (!this.available) return null;
        const elapsedMs = this._bte.benchmark(this._handle, steps, dt);
        const stepsPerSec = (steps / elapsedMs) * 1000;
        this._benchmarkResults = { steps, elapsedMs, stepsPerSec };
        console.log(
            `[WasmTensorEngine] Benchmark: ${steps} steps in ${elapsedMs.toFixed(2)} ms` +
            ` (${stepsPerSec.toFixed(0)} steps/sec)`
        );
        return this._benchmarkResults;
    }

    /** Free WASM heap resources. Call when tearing down the renderer. */
    dispose() {
        if (!this.available) return;
        if (this._scratchPtr) this._module._free(this._scratchPtr);
        if (this._paramsPtr) this._module._free(this._paramsPtr);
        if (this._outPtr) this._module._free(this._outPtr);
        if (this._handle) this._bte.destroy(this._handle);
        this._handle = null;
        this._outPtr = null;
        this._paramsPtr = null;
        this._scratchPtr = null;
        this._scratchBytes = 0;
        this.available = false;
    }
}

// wasm-engine.js
// [Phase 1 WASM] JavaScript loader and bridge for the C++ BrainTensorEngine WASM module.
//
// Provides a clean, async-initialised API that mirrors the WebGPU compute-shader path so
// brain-renderer.js can swap between the two with a single flag.
//
// Usage (hybrid mode):
//   const wasmEngine = new WasmTensorEngine();
//   await wasmEngine.init();                    // loads + compiles WASM
//   wasmEngine.update(time, params);            // advance simulation
//   wasmEngine.injectStimulus(x, y, z, int);   // region stimulus
//   const data = wasmEngine.getTensorData();    // Float32Array view into WASM heap
//   renderer.setVoxelData(data);                // upload to WebGPU storage buffer
//
// If the WASM module is unavailable (e.g., build not run yet, unsupported env),
// init() sets this.available = false and callers fall back to WebGPU compute.

const WASM_MODULE_URL = '/wasm/brain_tensor_engine.js';

export class WasmTensorEngine {
    constructor(voxelDim = 32) {
        this.voxelDim    = voxelDim;
        this.voxelCount  = voxelDim ** 3;
        this.available   = false; // set to true after successful init()
        this._module     = null;  // Emscripten module instance
        this._handle     = null;  // opaque C++ engine pointer (number)
        this._outPtr     = null;  // pointer to output buffer in WASM heap
        this._outView    = null;  // Float32Array view into WASM heap
        this._benchmarkResults = null;

        // C-function wrappers (populated in init)
        this._bte_create          = null;
        this._bte_destroy         = null;
        this._bte_update          = null;
        this._bte_inject_stimulus = null;
        this._bte_get_tensor_data = null;
        this._bte_reset           = null;
        this._bte_benchmark       = null;
    }

    /**
     * Load and initialise the WASM module.
     * Safe to call multiple times; subsequent calls are no-ops.
     * @returns {Promise<boolean>}  true if WASM is now available.
     */
    async init() {
        if (this.available) return true;

        try {
            // Dynamically import the Emscripten-generated JS glue
            const moduleFactory = (await import(/* @vite-ignore */ WASM_MODULE_URL)).default;
            if (typeof moduleFactory !== 'function') {
                throw new Error('WASM module factory not a function — did you run npm run build:wasm?');
            }

            this._module = await moduleFactory();

            // Wrap exported C functions
            this._bte_create = this._module.cwrap('bte_create', 'number', ['number']);
            this._bte_destroy = this._module.cwrap('bte_destroy', null, ['number']);
            this._bte_update = this._module.cwrap('bte_update', null, [
                'number', // engine handle
                'number', // time
                'number', // frequency
                'number', // amplitude
                'number', // smoothing
                'number', // style
                'number', // hypoxiaStress
                'number', // metabolicRate
                'number', // mitochondrialFn
                'number', // fluidActive
                'number', // electricalActive
                'number', // mercuryActive
                'number'  // heavyMetal
            ]);
            this._bte_inject_stimulus = this._module.cwrap('bte_inject_stimulus', null, [
                'number', // engine handle
                'number', // x
                'number', // y
                'number', // z
                'number', // intensity
                'number'  // mitochondrialFn
            ]);
            this._bte_get_tensor_data = this._module.cwrap('bte_get_tensor_data', null, [
                'number', // engine handle
                'number', // outBuffer pointer
                'number'  // bufferLen
            ]);
            this._bte_reset     = this._module.cwrap('bte_reset', null, ['number']);
            this._bte_benchmark = this._module.cwrap('bte_benchmark', 'number', [
                'number', // engine handle
                'number', // steps
                'number'  // dt
            ]);

            // Allocate the engine instance on the WASM heap
            this._handle = this._bte_create(this.voxelDim);
            if (!this._handle) throw new Error('bte_create returned null');

            // Allocate a persistent output buffer on the WASM heap for zero-copy reads
            this._outPtr = this._module._malloc(this.voxelCount * 4);
            if (!this._outPtr) throw new Error('malloc failed for tensor output buffer');

            // Create a typed-array view directly into the WASM heap (zero-copy)
            this._outView = new Float32Array(
                this._module.HEAPF32.buffer,
                this._outPtr,
                this.voxelCount
            );

            this.available = true;
            console.log('[WasmTensorEngine] Initialised — voxelDim:', this.voxelDim);
            return true;

        } catch (err) {
            console.warn('[WasmTensorEngine] Unavailable — falling back to WebGPU compute:', err.message);
            this.available = false;
            return false;
        }
    }

    /**
     * Advance the simulation by one time step.
     * Mirrors the params block sent to the WebGPU compute uniform buffer.
     */
    update(time, params) {
        if (!this.available) return;
        this._bte_update(
            this._handle,
            time,
            params.frequency          ?? 2.0,
            params.amplitude          ?? 0.5,
            params.smoothing          ?? 0.9,
            params.style              ?? 0.0,
            params.hypoxiaStress      ?? 0.0,
            params.metabolicRate      ?? 1.0,
            params.mitochondrialFunction ?? 1.0,
            params.fluidActive        ?? 0.0,
            params._electricalActive  ?? 0.0,
            params._mercuryActive     ?? 0.0,
            params.heavyMetal         ?? 0.0
        );
    }

    /**
     * Inject a Gaussian stimulus pulse.
     * Mirrors injectStimulus() in brain-renderer.js / the compute shader.
     */
    injectStimulus(x, y, z, intensity, mitochondrialFn = 1.0) {
        if (!this.available) return;
        this._bte_inject_stimulus(this._handle, x, y, z, intensity, mitochondrialFn);
    }

    /**
     * Return the current tensor data as a Float32Array.
     * The array is a view into the WASM heap — valid until the next update() call.
     * Pass it directly to renderer.setVoxelData() without copying.
     */
    getTensorData() {
        if (!this.available) return null;
        this._bte_get_tensor_data(this._handle, this._outPtr, this.voxelCount);
        return this._outView;
    }

    /**
     * Zero all tensor activity (mirrors renderer.resetActivity()).
     */
    reset() {
        if (!this.available) return;
        this._bte_reset(this._handle);
    }

    /**
     * Run a micro-benchmark.
     * @param {number} steps  Number of update steps to run.
     * @param {number} dt     Time delta per step (seconds).
     * @returns {{ steps, elapsedMs, stepsPerSec }}
     */
    benchmark(steps = 100, dt = 0.016) {
        if (!this.available) return null;
        const elapsedMs = this._bte_benchmark(this._handle, steps, dt);
        const stepsPerSec = (steps / elapsedMs) * 1000;
        this._benchmarkResults = { steps, elapsedMs, stepsPerSec };
        console.log(
            `[WasmTensorEngine] Benchmark: ${steps} steps in ${elapsedMs.toFixed(2)} ms` +
            ` (${stepsPerSec.toFixed(0)} steps/sec)`
        );
        return this._benchmarkResults;
    }

    /**
     * Free WASM heap resources.  Call when tearing down the renderer.
     */
    dispose() {
        if (!this.available) return;
        if (this._outPtr)  this._module._free(this._outPtr);
        if (this._handle)  this._bte_destroy(this._handle);
        this._handle  = null;
        this._outPtr  = null;
        this._outView = null;
        this.available = false;
    }
}

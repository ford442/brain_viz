// inference-engine.js
import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';

const DEFAULT_MODEL_PATH = `${import.meta.env.BASE_URL}squeezenet1.1.onnx`;

ort.env.wasm.wasmPaths = {
    mjs: ortWasmModuleUrl,
    wasm: ortWasmBinaryUrl
};
ort.env.wasm.numThreads = globalThis.crossOriginIsolated
    ? Math.max(1, Math.min(navigator.hardwareConcurrency || 1, 4))
    : 1;

export class InferenceEngine {
    constructor() {
        this.session = null;
        this.isRunning = false;
        this.inputName = null;
        this.outputName = null;
        this.initializingPromise = null;
    }

    async initialize(modelPath = DEFAULT_MODEL_PATH) {
        if (this.isRunning && this.session) {
            return true;
        }

        if (this.initializingPromise) {
            return this.initializingPromise;
        }

        this.initializingPromise = this.createSession(modelPath).finally(() => {
            this.initializingPromise = null;
        });

        return this.initializingPromise;
    }

    async createSession(modelPath) {
        try {
            const resolvedModelPath = new URL(modelPath, window.location.href).toString();
            console.log(`Loading model from ${resolvedModelPath}...`);
            this.session = await ort.InferenceSession.create(resolvedModelPath, {
                executionProviders: ['wasm']
            });

            this.inputName = this.session.inputNames[0];
            this.outputName = this.session.outputNames[0];
            this.isRunning = true;
            console.log('Model loaded successfully');
            return true;
        } catch (e) {
            this.session = null;
            this.isRunning = false;
            console.error('Failed to init inference engine:', e);
            return false;
        }
    }

    createDummyInput() {
        // SqueezeNet: 1x3x224x224
        const size = 1 * 3 * 224 * 224;
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.random();
        }
        return new ort.Tensor('float32', data, [1, 3, 224, 224]);
    }

    async runInference() {
        if (!this.session || !this.isRunning) return null;

        try {
            const feeds = {};
            feeds[this.inputName] = this.createDummyInput();

            const results = await this.session.run(feeds);
            const output = results[this.outputName]; // Float32Array(1000)

            return this.getTopK(output.data, 5);
        } catch (e) {
            console.error('Inference failed:', e);
            return null;
        }
    }

    getTopK(data, k) {
        const indices = Array.from(data.keys());
        indices.sort((a, b) => data[b] - data[a]);
        return indices.slice(0, k).map(idx => ({
            index: idx,
            value: data[idx]
        }));
    }
}

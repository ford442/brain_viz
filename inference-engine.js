// inference-engine.js
import * as ort from 'onnxruntime-web';

// Point to WASM files in public/
ort.env.wasm.wasmPaths = "./";

export class InferenceEngine {
    constructor() {
        this.session = null;
        this.isRunning = false;
        this.inputName = null;
        this.outputName = null;
    }

    async initialize(modelPath = './squeezenet1.1.onnx') {
        try {
            console.log(`Loading model from ${modelPath}...`);
            this.session = await ort.InferenceSession.create(modelPath, {
                executionProviders: ['webgl', 'wasm']
            });

            this.inputName = this.session.inputNames[0];
            this.outputName = this.session.outputNames[0];
            this.isRunning = true;
            console.log('Model loaded successfully');
            return true;
        } catch (e) {
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

import * as ort from 'onnxruntime-web';
import ortWasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortWasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';

const MODEL_FILE_NAME = 'squeezenet1.1.onnx';
const DEFAULT_MODEL_PATH = `${import.meta.env.BASE_URL}${MODEL_FILE_NAME}`;
const MAX_WORKER_THREADS = 4;
const DEFAULT_LAYER_COUNT = 12;
const TOKEN_TRACE_LENGTH = 8;

ort.env.wasm.wasmPaths = {
    mjs: ortWasmModuleUrl,
    wasm: ortWasmBinaryUrl
};

const hardwareConcurrencyCount = navigator.hardwareConcurrency || 1;
const preferredThreadCount = Math.max(1, Math.min(hardwareConcurrencyCount, MAX_WORKER_THREADS));
ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? preferredThreadCount : 1;

export class InferenceEngine {
    constructor() {
        this.session = null;
        this.isRunning = false;
        this.inputName = null;
        this.outputName = null;
        this.initializingPromise = null;
        this.lastError = null;
        this.mode = 'synthetic';
        this.sequenceMode = 'token';
        this.layerCount = DEFAULT_LAYER_COUNT;
        this.liveFrameRate = 4;
        this.lastStepTime = 0;
        this.tokenCounter = 0;
        this.lastToken = 'seed';
        this.lastActivations = [];
        this.lastFrameSequence = [];
        this.status = 'idle';
    }

    async initialize(modelPath = DEFAULT_MODEL_PATH) {
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
            this.session = await ort.InferenceSession.create(resolvedModelPath, {
                executionProviders: ['wasm']
            });

            this.inputName = this.session.inputNames[0];
            this.outputName = this.session.outputNames[0];
            this.isRunning = true;
            this.mode = 'onnx';
            this.status = 'onnx-ready';
            this.lastError = null;
            return true;
        } catch (e) {
            this.session = null;
            this.isRunning = false;
            this.mode = 'synthetic';
            this.status = 'synthetic-fallback';
            this.lastError = e;
            console.warn('[InferenceEngine] Falling back to synthetic activations:', e);
            return false;
        }
    }

    createDummyInput(tokenSeed = 0) {
        const size = 1 * 3 * 224 * 224;
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            const phase = tokenSeed * 0.17 + i * 0.00031;
            data[i] = 0.5 + 0.5 * Math.sin(phase) * Math.cos(phase * 0.61);
        }
        return new ort.Tensor('float32', data, [1, 3, 224, 224]);
    }

    async captureActivations(prompt = 'neuro-weaver', tokenIndex = 0) {
        if (this.session && this.isRunning) {
            return this.captureOnnxActivations(prompt, tokenIndex);
        }
        return this.captureSyntheticActivations(prompt, tokenIndex);
    }

    async captureOnnxActivations(prompt = 'neuro-weaver', tokenIndex = 0) {
        try {
            const feeds = {};
            feeds[this.inputName] = this.createDummyInput(tokenIndex);
            const results = await this.session.run(feeds);
            const output = results[this.outputName];
            const layers = this.buildLayerSlicesFromVector(output.data, prompt, tokenIndex);
            this.lastActivations = layers;
            this.status = 'onnx-live';
            return {
                layers,
                token: this.deriveToken(prompt, tokenIndex),
                source: 'onnx',
                hallucinating: this.shouldHallucinate(prompt, tokenIndex)
            };
        } catch (e) {
            this.lastError = e;
            this.mode = 'synthetic';
            this.status = 'synthetic-fallback';
            return this.captureSyntheticActivations(prompt, tokenIndex);
        }
    }

    captureSyntheticActivations(prompt = 'neuro-weaver', tokenIndex = 0) {
        const layers = new Array(this.layerCount);
        const baseSeed = this.hashPrompt(prompt) + tokenIndex * 31;
        const hallucinating = this.shouldHallucinate(prompt, tokenIndex);
        for (let layer = 0; layer < this.layerCount; layer++) {
            const length = 192 + (layer % 4) * 64;
            const data = new Float32Array(length);
            const depth = layer / Math.max(1, this.layerCount - 1);
            for (let i = 0; i < length; i++) {
                const phase = baseSeed * 0.013 + i * 0.09 + layer * 0.37;
                const carrier = 0.5 + 0.5 * Math.sin(phase) * Math.cos(phase * (1.1 + depth));
                const attention = Math.max(0, Math.sin(phase * (2.0 + depth * 3.0)));
                const spike = Math.max(0, Math.sin(phase * 4.0 + tokenIndex * 0.7));
                let value = carrier * 0.55 + attention * 0.35 + spike * 0.1;
                if (hallucinating) {
                    value = Math.pow(Math.max(0, Math.sin(phase * 5.5 + layer)), 3.0) * (0.6 + depth * 0.6);
                }
                data[i] = value;
            }
            layers[layer] = data;
        }
        this.lastActivations = layers;
        this.status = hallucinating ? 'synthetic-hallucination' : 'synthetic-live';
        return {
            layers,
            token: this.deriveToken(prompt, tokenIndex),
            source: 'synthetic',
            hallucinating
        };
    }

    buildLayerSlicesFromVector(vector, prompt, tokenIndex) {
        const layers = new Array(this.layerCount);
        const chunkSize = Math.max(32, Math.floor(vector.length / this.layerCount));
        for (let layer = 0; layer < this.layerCount; layer++) {
            const layerData = new Float32Array(chunkSize);
            const offset = (layer * chunkSize) % vector.length;
            for (let i = 0; i < chunkSize; i++) {
                const sample = vector[(offset + i) % vector.length];
                const phase = Math.sin((tokenIndex + 1) * 0.3 + i * 0.07 + layer * 0.29);
                layerData[i] = Math.max(0, sample * (0.75 + 0.25 * phase));
            }
            layers[layer] = layerData;
        }
        return layers;
    }

    buildTokenFrameSequence(layers, projector, prompt = 'neuro-weaver') {
        const frames = [];
        const tokenBias = this.hashPrompt(prompt) % layers.length;
        for (let tokenStep = 0; tokenStep < TOKEN_TRACE_LENGTH; tokenStep++) {
            const layerIndex = (tokenBias + tokenStep) % layers.length;
            const nextLayerIndex = (layerIndex + 1) % layers.length;
            const projectedA = projector.project(layers[layerIndex], layerIndex, layers.length);
            const projectedB = projector.project(layers[nextLayerIndex], nextLayerIndex, layers.length);
            const frame = new Float32Array(projectedA.length);
            const mixFactor = tokenStep / Math.max(1, TOKEN_TRACE_LENGTH - 1);
            for (let i = 0; i < frame.length; i++) {
                frame[i] = projectedA[i] * (1.0 - mixFactor) + projectedB[i] * mixFactor;
            }
            frames.push(frame);
        }
        this.lastFrameSequence = frames;
        return frames;
    }

    async stepSynaptiX(synaptixEngine, renderer, options = {}) {
        if (!synaptixEngine) return null;
        const prompt = options.prompt || this.lastToken || 'neuro-weaver';
        const tokenIndex = options.tokenIndex ?? this.tokenCounter;
        const layerIndex = Math.max(0, Math.min(this.layerCount - 1, options.layerIndex ?? Math.round((renderer?.params?.aiLayer || 0) * Math.max(0, this.layerCount - 1))));
        const packet = await this.captureActivations(prompt, tokenIndex);
        const layers = packet.layers;
        if (!layers || layers.length === 0) return null;

        const selected = layers[layerIndex % layers.length];
        synaptixEngine.projectActivation(selected, layerIndex, layers.length);
        const frames = this.buildTokenFrameSequence(layers, synaptixEngine.projector, prompt);
        synaptixEngine.loadFrameSequence(frames);
        synaptixEngine.frameIndex = Math.min(synaptixEngine.frameIndex, Math.max(0, frames.length - 1));
        synaptixEngine.lastSourceInfo = `${packet.source} live token "${packet.token}" layer ${layerIndex + 1}/${layers.length}`;

        if (packet.hallucinating) {
            synaptixEngine.currentPattern = 'hallucination-spike';
            synaptixEngine.lastSourceInfo += ' [hallucination]';
        }

        this.lastToken = packet.token;
        this.tokenCounter += 1;
        return {
            token: packet.token,
            layerIndex,
            layerCount: layers.length,
            hallucinating: packet.hallucinating,
            frames
        };
    }

    deriveToken(prompt, tokenIndex) {
        const words = String(prompt).trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return `tok-${tokenIndex}`;
        return words[tokenIndex % words.length];
    }

    shouldHallucinate(prompt, tokenIndex) {
        const text = String(prompt).toLowerCase();
        return text.includes('hallucination') || text.includes('uncanny') || ((this.hashPrompt(text) + tokenIndex) % 11 === 0);
    }

    hashPrompt(prompt) {
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            hash = ((hash << 5) - hash + prompt.charCodeAt(i)) | 0;
        }
        return Math.abs(hash);
    }
}

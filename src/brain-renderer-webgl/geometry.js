import { BrainGeometry } from '../brain-geometry.js';
import { BRAIN_RANGE } from './constants.js';

export function applyGeometryMethods(Klass) {
    Object.assign(Klass.prototype, {
        buildGeometry() {
            const geometry = new BrainGeometry({
                baseRadius: 1.5,
                foldScale: this.params.foldScale,
                foldStrength: this.params.foldStrength,
                fissureDepth: this.params.fissureDepth,
                lobeFoldBias: this.params.lobeFoldBias,
                corticalThickness: this.params.corticalThickness,
                growth: this.params.growth,
                fiberSymmetry: this.params.fiberSymmetry,
                bundleCoherence: this.params.bundleCoherence
            });
            geometry.generate(this.geometryRows, this.geometryCols);
            return geometry;
        },

        buildAndUploadGeometry() {
            const gl = this.gl;
            const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
            this.geometry = this.buildGeometry();
            this.baseVertices = this.geometry.getVertexData();
            const paddedNormals = this.geometry.getNormalData();
            this.baseNormals = new Float32Array(paddedNormals.length / 4 * 3);
            for (let i = 0, j = 0; i < paddedNormals.length; i += 4, j += 3) {
                this.baseNormals[j + 0] = paddedNormals[i + 0];
                this.baseNormals[j + 1] = paddedNormals[i + 1];
                this.baseNormals[j + 2] = paddedNormals[i + 2];
            }
            this.baseIndices = this.geometry.getIndexData();
            this.baseFiberVertices = this.geometry.getFiberData();
            this.baseFiberPaths = this.geometry.getFiberPathData();
            this.baseFiberMeta = this.geometry.getFiberDataWithMetadata();
            this.basePathwayMeta = this.geometry.getPathwayMetadata();
            this.pathwaySelections = this.geometry.getPathwaySelections();
            this.baseSomaInstances = this.geometry.getSomaInstanceData();
            this.fiberAffinityData = this.geometry.getFiberAffinityData();

            this.meshPositions = new Float32Array(this.baseVertices);
            this.meshColors = new Float32Array(this.baseVertices.length);
            this.partnerMeshPositions = new Float32Array(this.baseVertices);
            this.partnerMeshColors = new Float32Array(this.baseVertices.length);
            this.fiberColors = new Float32Array(this.baseFiberVertices.length);
            this.pathwayEmissions = new Float32Array(this.baseFiberVertices.length / 3);
            this.somaColorSize = new Float32Array((this.baseSomaInstances.length / 9) * 4);

            const wireIndices = new Uint32Array(this.baseIndices.length * 2);
            for (let i = 0, w = 0; i < this.baseIndices.length; i += 3) {
                const a = this.baseIndices[i + 0];
                const b = this.baseIndices[i + 1];
                const c = this.baseIndices[i + 2];
                wireIndices[w++] = a; wireIndices[w++] = b;
                wireIndices[w++] = b; wireIndices[w++] = c;
                wireIndices[w++] = c; wireIndices[w++] = a;
            }

            this.meshBuffers.position = gl.createBuffer();
            this.meshBuffers.color = gl.createBuffer();
            this.meshBuffers.partnerPosition = gl.createBuffer();
            this.meshBuffers.partnerColor = gl.createBuffer();
            this.meshBuffers.index = gl.createBuffer();
            this.meshBuffers.wireIndex = gl.createBuffer();
            this.meshBuffers.fiberPosition = gl.createBuffer();
            this.meshBuffers.fiberColor = gl.createBuffer();
            this.meshBuffers.somaPosition = gl.createBuffer();
            this.meshBuffers.somaColorSize = gl.createBuffer();

            this.meshVao = gl.createVertexArray();
            gl.bindVertexArray(this.meshVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
            gl.bufferData(gl.ARRAY_BUFFER, this.meshPositions, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
            gl.bufferData(gl.ARRAY_BUFFER, this.meshColors, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffers.index);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.baseIndices, gl.STATIC_DRAW);

            this.partnerMeshVao = gl.createVertexArray();
            gl.bindVertexArray(this.partnerMeshVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.partnerPosition);
            gl.bufferData(gl.ARRAY_BUFFER, this.partnerMeshPositions, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.partnerColor);
            gl.bufferData(gl.ARRAY_BUFFER, this.partnerMeshColors, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffers.index);

            this.wireVao = gl.createVertexArray();
            gl.bindVertexArray(this.wireVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.meshBuffers.wireIndex);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireIndices, gl.STATIC_DRAW);
            this.wireIndexCount = wireIndices.length;

            this.fiberVao = gl.createVertexArray();
            gl.bindVertexArray(this.fiberVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberPosition);
            gl.bufferData(gl.ARRAY_BUFFER, this.baseFiberVertices, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberColor);
            gl.bufferData(gl.ARRAY_BUFFER, this.fiberColors, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

            const somaCount = this.baseSomaInstances.length / 9;
            const somaPositions = new Float32Array(somaCount * 3);
            for (let i = 0; i < somaCount; i++) {
                somaPositions[i * 3 + 0] = this.baseSomaInstances[i * 9 + 0];
                somaPositions[i * 3 + 1] = this.baseSomaInstances[i * 9 + 1];
                somaPositions[i * 3 + 2] = this.baseSomaInstances[i * 9 + 2];
            }
            this.somaVao = gl.createVertexArray();
            gl.bindVertexArray(this.somaVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaPosition);
            gl.bufferData(gl.ARRAY_BUFFER, somaPositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaColorSize);
            gl.bufferData(gl.ARRAY_BUFFER, this.somaColorSize, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);

            gl.bindVertexArray(null);

            this.buildBridgeResources();

            this.geometryDirty = false;
            this.lastGeometryRebuildTime = typeof performance !== 'undefined' ? performance.now() : 0;
            this.lastGeometryGenerationMs = startedAt ? this.lastGeometryRebuildTime - startedAt : 0;
        },

        buildBridgeResources() {
            const gl = this.gl;
            if (!this.meshBuffers.bridgePosition) this.meshBuffers.bridgePosition = gl.createBuffer();
            if (!this.meshBuffers.bridgeColor) this.meshBuffers.bridgeColor = gl.createBuffer();
            if (!this.bridgeVao) this.bridgeVao = gl.createVertexArray();
            gl.bindVertexArray(this.bridgeVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.bridgePosition);
            gl.bufferData(gl.ARRAY_BUFFER, this.bridgePositions.byteLength, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.bridgeColor);
            gl.bufferData(gl.ARRAY_BUFFER, this.bridgeColors.byteLength, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);
        },

        buildTensorDebugGrid() {
            const pointCount = this.voxelCount;
            this.tensorPointPositions = new Float32Array(pointCount * 3);
            this.tensorPointColorSize = new Float32Array(pointCount * 4);
            const dim = this.voxelDim;
            let ptr = 0;
            for (let z = 0; z < dim; z++) {
                for (let y = 0; y < dim; y++) {
                    for (let x = 0; x < dim; x++) {
                        this.tensorPointPositions[ptr * 3 + 0] = ((x / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                        this.tensorPointPositions[ptr * 3 + 1] = ((y / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                        this.tensorPointPositions[ptr * 3 + 2] = ((z / (dim - 1)) * 2.0 - 1.0) * (BRAIN_RANGE * 0.85);
                        ptr++;
                    }
                }
            }

            const gl = this.gl;
            this.meshBuffers.tensorPosition = gl.createBuffer();
            this.meshBuffers.tensorColorSize = gl.createBuffer();
            this.tensorVao = gl.createVertexArray();
            gl.bindVertexArray(this.tensorVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorPosition);
            gl.bufferData(gl.ARRAY_BUFFER, this.tensorPointPositions, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorColorSize);
            gl.bufferData(gl.ARRAY_BUFFER, this.tensorPointColorSize, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);
        },

        // [Phase 6] Immune cell migration — simplified CPU particle path.
        buildImmuneResources() {
            const gl = this.gl;
            this.meshBuffers.immunePosition = gl.createBuffer();
            this.meshBuffers.immuneColorSize = gl.createBuffer();
            this.immuneVao = gl.createVertexArray();
            gl.bindVertexArray(this.immuneVao);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.immunePosition);
            gl.bufferData(gl.ARRAY_BUFFER, this.immunePositions.byteLength, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.immuneColorSize);
            gl.bufferData(gl.ARRAY_BUFFER, this.immuneColorSize.byteLength, gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(1);
            gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
            gl.bindVertexArray(null);
        },

        resize() {
            const gl = this.gl;
            const load = Math.max(0, Math.min(1, this.params.cognitiveLoad));
            const scale = Math.max(0.1, 1.0 - load);
            const targetWidth = Math.max(1, Math.floor(this.canvas.clientWidth * scale));
            const targetHeight = Math.max(1, Math.floor(this.canvas.clientHeight * scale));
            if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
                this.canvas.width = targetWidth;
                this.canvas.height = targetHeight;
            }
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        },
    });
}

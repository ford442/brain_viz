// @ts-check
import { clamp01 } from '../webgl-gl-utils.js';
import { computePathwayEmission } from '../pathway-renderer.js';
import { forEachBridgeVertex } from '../multi-brain-layout.js';

/** @param {import('./types.js').WebGLRendererClass} Klass */
export function applyDynamicBufferMethods(Klass) {
    Object.assign(Klass.prototype, /** @satisfies {import('./types.js').WebGLMixin} */ ({
        updateDynamicBuffers() {
            const gl = this.gl;
            this.updateImmuneParticles();
            const style = this.params.style || 0;
            const pathwayRenderState = this.getPathwayRenderState();
            const pathwayColor = pathwayRenderState.selected?.color || [0, 0, 0];
            const lesion = {
                center: [this.params.lesionCenterX || 0, this.params.lesionCenterY || 0, this.params.lesionCenterZ || 0],
                radius: this.params.lesionRadius || 0,
                active: this.params.lesionActive || 0,
            };
            const noLesion = { center: lesion.center, radius: lesion.radius, active: 0 };
            const edgeIds = new Map((pathwayRenderState.selected?.edges || []).map((edge) => [edge.numericId, edge.id]));
            const pathwayMetrics = { selectedVertexCount: 0, emissiveVertexCount: 0, maxEmission: 0, peakProgress: 0, lesionSuppressedVertexCount: 0, edges: {} };

            for (let i = 0; i < this.baseVertices.length; i += 3) {
                const pos = [this.baseVertices[i + 0], this.baseVertices[i + 1], this.baseVertices[i + 2]];
                const normal = [this.baseNormals[i + 0], this.baseNormals[i + 1], this.baseNormals[i + 2]];
                const humanVal = this.sampleField(pos, false);
                const aiVal = this.sampleField(pos, true);
                const displacement = humanVal * (0.018 + this.params.amplitude * 0.05);
                this.meshPositions[i + 0] = pos[0] + normal[0] * displacement;
                this.meshPositions[i + 1] = pos[1] + normal[1] * displacement;
                this.meshPositions[i + 2] = pos[2] + normal[2] * displacement;
                const color = style >= 4.0 ? [0.02 + humanVal * 0.15, 0.28 + humanVal * 0.72, 0.38 + humanVal * 0.62] : this.getFieldColor(humanVal, aiVal, pos, style);
                this.meshColors[i + 0] = color[0];
                this.meshColors[i + 1] = color[1];
                this.meshColors[i + 2] = color[2];
                if (style >= 4.0) {
                    const partnerDisplacement = aiVal * (0.018 + this.params.amplitude * 0.05);
                    const partnerGain = 0.18 + (this.params.partnerInfluence ?? 0.5) * 0.82;
                    const partnerColor = [0.22 + aiVal * 0.78, 0.02 + aiVal * 0.18, 0.3 + aiVal * 0.7];
                    this.partnerMeshPositions[i + 0] = pos[0] + normal[0] * partnerDisplacement;
                    this.partnerMeshPositions[i + 1] = pos[1] + normal[1] * partnerDisplacement;
                    this.partnerMeshPositions[i + 2] = pos[2] + normal[2] * partnerDisplacement;
                    this.partnerMeshColors[i + 0] = partnerColor[0] * partnerGain;
                    this.partnerMeshColors[i + 1] = partnerColor[1] * partnerGain;
                    this.partnerMeshColors[i + 2] = partnerColor[2] * partnerGain;
                }
            }

            for (let i = 0; i < this.baseFiberVertices.length; i += 3) {
                const vertexIndex = i / 3;
                const pathIndex = (i / 3) * 6;
                const midpoint = [
                    (this.baseFiberPaths[pathIndex + 0] + this.baseFiberPaths[pathIndex + 3]) * 0.5,
                    (this.baseFiberPaths[pathIndex + 1] + this.baseFiberPaths[pathIndex + 4]) * 0.5,
                    (this.baseFiberPaths[pathIndex + 2] + this.baseFiberPaths[pathIndex + 5]) * 0.5
                ];
                const humanVal = this.sampleField(midpoint, false);
                const aiVal = this.sampleField(midpoint, true);
                const resonance = this.computeResonance(humanVal, aiVal);
                const metaIndex = (i / 3) * 4;
                const myelin = clamp01(this.baseFiberMeta[metaIndex + 2] || 0.2);
                const baseColor = style >= 4.0
                    ? [0.75 + resonance * 0.2, 0.35 + humanVal * 0.3, 0.95]
                    : [0.1 + humanVal * 0.9, 0.65 + myelin * 0.2, 0.95 - myelin * 0.35];
                const pathwayMetaIndex = vertexIndex * 4;
                const isSelectedPathway = this.basePathwayMeta[pathwayMetaIndex] === pathwayRenderState.selectedNumericId;
                const pathwayMeta = isSelectedPathway ? this.basePathwayMeta.subarray(pathwayMetaIndex, pathwayMetaIndex + 4) : null;
                const vertexPosition = isSelectedPathway
                    ? [this.baseFiberVertices[i], this.baseFiberVertices[i + 1], this.baseFiberVertices[i + 2]]
                    : null;
                const emission = isSelectedPathway ? computePathwayEmission(pathwayMeta, pathwayRenderState, vertexPosition, lesion) : 0;
                const rawEmission = isSelectedPathway && lesion.active > 0
                    ? computePathwayEmission(pathwayMeta, pathwayRenderState, vertexPosition, noLesion)
                    : emission;
                this.pathwayEmissions[vertexIndex] = emission;
                this.fiberColors[i + 0] = clamp01(baseColor[0] + pathwayColor[0] * emission);
                this.fiberColors[i + 1] = clamp01(baseColor[1] + pathwayColor[1] * emission);
                this.fiberColors[i + 2] = clamp01(baseColor[2] + pathwayColor[2] * emission);
                if (isSelectedPathway) {
                    pathwayMetrics.selectedVertexCount++;
                    if (emission > 0.01) pathwayMetrics.emissiveVertexCount++;
                    if (rawEmission > 0.01 && emission < rawEmission * 0.8) pathwayMetrics.lesionSuppressedVertexCount++;
                    if (emission > pathwayMetrics.maxEmission) {
                        pathwayMetrics.maxEmission = emission;
                        pathwayMetrics.peakProgress = pathwayMeta[2];
                    }
                    const edgeId = edgeIds.get(pathwayMeta[1]) || String(pathwayMeta[1]);
                    const edgeMetric = pathwayMetrics.edges[edgeId] || { vertexCount: 0, emissiveVertexCount: 0, lesionSuppressedVertexCount: 0, maxEmission: 0, meanEmission: 0 };
                    edgeMetric.vertexCount++;
                    if (emission > 0.01) edgeMetric.emissiveVertexCount++;
                    if (rawEmission > 0.01 && emission < rawEmission * 0.8) edgeMetric.lesionSuppressedVertexCount++;
                    edgeMetric.maxEmission = Math.max(edgeMetric.maxEmission, emission);
                    edgeMetric.meanEmission += emission;
                    pathwayMetrics.edges[edgeId] = edgeMetric;
                }
            }
            for (const edgeMetric of Object.values(pathwayMetrics.edges)) {
                edgeMetric.meanEmission /= Math.max(1, edgeMetric.vertexCount);
            }
            this.pathwayState.metrics = pathwayMetrics;

            const somaCount = this.baseSomaInstances.length / 9;
            for (let i = 0; i < somaCount; i++) {
                const pos = [
                    this.baseSomaInstances[i * 9 + 0],
                    this.baseSomaInstances[i * 9 + 1],
                    this.baseSomaInstances[i * 9 + 2]
                ];
                const humanVal = this.sampleField(pos, false);
                const aiVal = this.sampleField(pos, true);
                const resonance = this.computeResonance(humanVal, aiVal);
                const color = this.getFieldColor(humanVal, aiVal, pos, style);
                this.somaColorSize[i * 4 + 0] = color[0];
                this.somaColorSize[i * 4 + 1] = color[1];
                this.somaColorSize[i * 4 + 2] = color[2];
                this.somaColorSize[i * 4 + 3] = 3.0 + humanVal * 8.0 + resonance * 2.5;
            }

            for (let i = 0; i < this.voxelCount; i++) {
                const humanVal = this._lastHumanTensor[i];
                const aiVal = this._lastAITensor[i];
                const color = this.getFieldColor(humanVal, aiVal, [0, 0, 0], style >= 4.0 ? 4.0 : 3.0);
                const alpha = style >= 3.0 || this.debugOptions.tensorField
                    ? clamp01((Math.max(humanVal, aiVal) - 0.08) * 1.6)
                    : 0.0;
                this.tensorPointColorSize[i * 4 + 0] = color[0];
                this.tensorPointColorSize[i * 4 + 1] = color[1];
                this.tensorPointColorSize[i * 4 + 2] = color[2];
                this.tensorPointColorSize[i * 4 + 3] = alpha > 0.01 ? 1.5 + Math.max(humanVal, aiVal) * 7.0 : 0.0;
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.position);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.meshPositions);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.color);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.meshColors);
            if (style >= 4.0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.partnerPosition);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partnerMeshPositions);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.partnerColor);
                gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.partnerMeshColors);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.fiberColor);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.fiberColors);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.somaColorSize);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.somaColorSize);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.tensorColorSize);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.tensorPointColorSize);
            if (style >= 4.0) this.updateBridgeBuffers();
        },

        updateBridgeBuffers() {
            const gl = this.gl;
            if (!gl || !this.bridgeVao) return;
            let offset = 0;
            const vertex = forEachBridgeVertex(this.synaptixCouplingState, performance.now(), (position, color) => {
                this.bridgePositions.set(position, offset);
                this.bridgeColors.set(color, offset);
                offset += 3;
            });
            this.bridgeVertexCount = vertex;
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.bridgePosition);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.bridgePositions.subarray(0, vertex * 3));
            gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuffers.bridgeColor);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.bridgeColors.subarray(0, vertex * 3));
        },
    }));
}

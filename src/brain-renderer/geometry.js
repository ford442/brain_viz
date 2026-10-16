// @ts-check
import { BrainGeometry } from '../brain-geometry.js';

export function applyGeometryMethods(Target) {
    Target.prototype.buildGeometry = function() {
        const geometry = new BrainGeometry({
    foldScale: this.params.foldScale,
    foldStrength: this.params.foldStrength,
    fissureDepth: this.params.fissureDepth,
    lobeFoldBias: this.params.lobeFoldBias,
    corticalThickness: this.params.corticalThickness,
    growth: this.params.growth,
    networkTopology: this.params.networkTopology,
    fiberSymmetry: this.params.fiberSymmetry,
    bundleCoherence: this.params.bundleCoherence,
    // [Field Resolution] Bakes the fiber affinity map at the field's dim.
    voxelDim: this.voxelDim
        });
        // [Clipmap] Shared, byte-bounded affinity cache: a coarse map already
        // baked for this geometry at this dim is reused, not re-rasterised.
        // @ts-expect-error affinityCache is attached here, not declared on the class.
        geometry.affinityCache = this.clipmap?.cache ?? null;
        // @ts-expect-error generate() is attached to BrainGeometry.prototype by
        // applyMeshMethods() in brain-geometry.js — not visible to TS across
        // the mixin boundary (same pattern as setupInputHandlers() below).
        geometry.generate(this.geometryRows, this.geometryCols);
        return geometry;
    };

    /**
     * [Clipmap] Hand a freshly uploaded geometry to the clipmap and release
     * its upload arrays (BrainGeometry#releaseRenderData). The clipmap keeps
     * the centerlines for fine affinity bakes and the surface function for the
     * cortical patch; a changed geometry invalidates both.
     * @param {any} geometry
     */
    Target.prototype.adoptGeometry = function(geometry) {
        this.geometry = geometry;
        this.clipmap?.setGeometry(geometry);
        geometry.releaseRenderData();
    };

    Target.prototype.destroyGeometryBuffers = function() {
        [
    this.vertexBuffer,
    this.normalBuffer,
    this.indexBuffer,
    this.fiberBuffer,
    this.fiberNormalBuffer,
    this.fiberMetaBuffer,
    this.fiberPathBuffer,
    this.pathwayMetaBuffer,
    this.somaInstanceBuffer,
    this.somaVertexBuffer,
    this.somaIndexBuffer,
    this.sparkInstanceBuffer,
    this.sparkQuadBuffer,
    this.pointCloudInstanceBuffer,
    this.pointCloudQuadBuffer
        ].forEach((buffer) => buffer?.destroy?.());
    };

    Target.prototype.rebuildGeometry = function() {
        if (!this.device) return;
        const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
        const geometry = this.buildGeometry();
        this.destroyGeometryBuffers();

        this.vertexBuffer = this.createBuffer(geometry.getVertexData(), GPUBufferUsage.VERTEX);
        this.normalBuffer = this.createBuffer(geometry.getNormalData(), GPUBufferUsage.VERTEX);
        this.indexBuffer = this.createBuffer(geometry.getIndexData(), GPUBufferUsage.INDEX);
        this.indexCount = geometry.getIndexCount();
        this.fiberBuffer = this.createBuffer(geometry.getFiberData(), GPUBufferUsage.VERTEX);
        this.fiberNormalBuffer = this.createBuffer(geometry.getFiberNormalData(), GPUBufferUsage.VERTEX);
        this.fiberMetaBuffer = this.createBuffer(geometry.getFiberDataWithMetadata(), GPUBufferUsage.VERTEX);
        this.fiberPathBuffer = this.createBuffer(geometry.getFiberPathData(), GPUBufferUsage.VERTEX);
        this.pathwayMetaBuffer = this.createBuffer(geometry.getPathwayMetadata(), GPUBufferUsage.VERTEX);
        this.pathwaySelections = geometry.getPathwaySelections();
        this.fiberVertexCount = geometry.getFiberVertexCount();
        this.initSomaResources(geometry);
        this.initSparkResources(geometry);
        this.uploadFiberDirections(geometry);
        this.adoptGeometry(geometry);

        this.geometryDirty = false;
        this.lastGeometryRebuildTime = typeof performance !== 'undefined' ? performance.now() : 0;
        this.lastGeometryGenerationMs = startedAt ? this.lastGeometryRebuildTime - startedAt : 0;
    };

}

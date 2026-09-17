// src/brain-renderer-webgl/resolution.js
// [Field Resolution] Runtime resolution switching for the WebGL2 fallback.
//
// This path has no compute shader — it steps the CPU reference field in
// src/physics/tensor-field.js, which has always taken `dim` as a parameter.
// So switching resolution here is simply: resample the live field, resize the
// three Float32Arrays, rebuild the geometry (the fiber affinity map is baked
// per-dim), and rebuild the debug point grid whose vertex count is dim³.
//
// The capability matrix in docs/webgl-fallback.md records what this costs: the
// fallback steps the whole field on the CPU every frame, so 64³ is an
// eightfold step cost, not a free upgrade.

import {
    assertVoxelDim,
    resampleField,
    voxelCountFor,
} from '../voxel-dim.js';

export function applyResolutionMethods(Klass) {
    Object.assign(Klass.prototype, {
        /**
         * Changes the neural field's grid resolution at runtime. Mirrors
         * `BrainRenderer#setVoxelDim` (see src/renderer-contract.js).
         *
         * @param {number} dim - A member of SUPPORTED_VOXEL_DIMS.
         * @returns {boolean} true if the resolution changed.
         */
        setVoxelDim(dim) {
            assertVoxelDim(dim, 'BrainRendererWebGL.setVoxelDim');
            if (dim === this.voxelDim) return false;

            const previousDim = this.voxelDim;
            // Resample first: a throw here leaves the renderer untouched.
            const human = resampleField(this._lastHumanTensor, previousDim, dim);
            const ai = resampleField(this._lastAITensor, previousDim, dim);

            this.voxelDim = dim;
            this.voxelCount = voxelCountFor(dim);
            this._lastHumanTensor = new Float32Array(human);
            this._lastAITensor = new Float32Array(ai);
            this._nextHumanTensor = new Float32Array(this.voxelCount);

            if (this.gl) {
                // Affinity data is baked per-dim, so the cached normalisation
                // is stale; buildAndUploadGeometry() rebuilds both.
                this._normalizedFiberAffinity = null;
                this.buildAndUploadGeometry();
                this.rebuildTensorDebugGrid();
            }

            return true;
        },

        /** @returns {number} The field's current grid resolution. */
        getVoxelDim() {
            return this.voxelDim;
        },

        /**
         * Releases the dim³ debug point grid and rebuilds it at the current
         * resolution. buildTensorDebugGrid() allocates fresh GL objects every
         * call, so the old ones are deleted here rather than leaked.
         */
        rebuildTensorDebugGrid() {
            const gl = this.gl;
            if (!gl) return;
            if (this.tensorVao) gl.deleteVertexArray(this.tensorVao);
            if (this.meshBuffers?.tensorPosition) gl.deleteBuffer(this.meshBuffers.tensorPosition);
            if (this.meshBuffers?.tensorColorSize) gl.deleteBuffer(this.meshBuffers.tensorColorSize);
            this.tensorVao = null;
            this.buildTensorDebugGrid();
        },
    });
}

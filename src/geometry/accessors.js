export function applyAccessorsMethods(Target) {
    Target.prototype.getFiberAffinityData = function() {
        return this.fiberAffinityData || new Float32Array(32*32*32*12);
    };

    Target.prototype.getVertexData = function() {
 return new Float32Array(this.vertices); 
    };

    Target.prototype.getNormalData = function() {
        const padded = new Float32Array(this.normals.length / 3 * 4);
        for (let i = 0; i < this.normals.length / 3; i++) {
    padded[i * 4 + 0] = this.normals[i * 3 + 0];
    padded[i * 4 + 1] = this.normals[i * 3 + 1];
    padded[i * 4 + 2] = this.normals[i * 3 + 2];
    padded[i * 4 + 3] = 0.0;
        }
        return padded;
    };

    Target.prototype.getIndexData = function() {
 return new Uint32Array(this.indices); 
    };

    Target.prototype.getIndexCount = function() {
 return this.indices.length; 
    };

    Target.prototype.getFiberData = function() {
 return new Float32Array(this.fibers); 
    };

    Target.prototype.getFiberNormalData = function() {
 return new Float32Array(this.fiberNormals); 
    };

    Target.prototype.getFiberDataWithMetadata = function() {
 return new Float32Array(this.fiberMetadata); 
    };

    Target.prototype.getFiberPathData = function() {
 return new Float32Array(this.fiberPaths); 
    };

    Target.prototype.getPathwayMetadata = function() {
 return this.pathwayMetadata instanceof Float32Array ? this.pathwayMetadata : new Float32Array(this.pathwayMetadata);
    };

    Target.prototype.getPathwaySelections = function() {
 return this.pathwaySelections.map((selection) => ({ ...selection, samplePosition: [...selection.samplePosition] }));
    };

    Target.prototype.getSparkSourceData = function() {
 return new Float32Array(this.sparkSources); 
    };

    Target.prototype.getFiberVertexCount = function() {
 return this.fibers.length / 3; 
    };

    Target.prototype.getVertexCount = function() {
 return this.vertices.length / 3; 
    };

    Target.prototype.getSomaInstanceData = function() {
 return new Float32Array(this.somaInstances); 
    };

    Target.prototype.getPointCloudData = function() {
 return new Float32Array(this.pointCloudInstances); 
    };

    Target.prototype.getSomaPositions = function() {
        // Back-compat: flatten positions from rich instances
        const out = new Float32Array(this.somaInstances.length / 9 * 3);
        for (let i = 0; i < this.somaInstances.length / 9; i++) {
    out[i*3+0] = this.somaInstances[i*9+0];
    out[i*3+1] = this.somaInstances[i*9+1];
    out[i*3+2] = this.somaInstances[i*9+2];
        }
        return out;
    };

    Target.prototype.getFiberMetadata = function() {
 return new Float32Array(this.fiberMetadata); 
    };

}

// brain-geometry.js
// Procedural Brain Generation with Organic Connectome Fibers - V3.1 Dense Points
import { applyNoiseMethods } from './geometry/noise.js';
import { applyDeformationMethods } from './geometry/deformation.js';
import { applyMeshMethods } from './geometry/mesh.js';
import { applyInstancesMethods } from './geometry/instances.js';
import { applyFibersMethods } from './geometry/fibers.js';
import { applyAccessorsMethods } from './geometry/accessors.js';

export class BrainGeometry {
    constructor(options = {}) {
        this.vertices = [];
        this.normals = [];
        this.indices = [];
        this.fibers = [];
        this.fiberNormals = [];
        this.fiberMetadata = [];
        this.fiberPaths = [];
        this.somaInstances = [];
        this.pointCloudInstances = [];
        this.sparkSources = [];
        this.fiberCenterlines = [];
        this.seed = options.seed ?? 1337;
        this.randomState = this.seed >>> 0;
        this.options = {
            baseRadius: 1.5,
            foldScale: 1.0,
            foldStrength: 0.16,
            fissureDepth: 0.52,
            lobeFoldBias: 1.0,
            corticalThickness: 0.11,
            growth: 1.0,
            networkTopology: 0.0,
            fiberSymmetry: 0.85,
            bundleCoherence: 0.6,
            ...options
        };
    }
}

applyNoiseMethods(BrainGeometry);
applyDeformationMethods(BrainGeometry);
applyMeshMethods(BrainGeometry);
applyInstancesMethods(BrainGeometry);
applyFibersMethods(BrainGeometry);
applyAccessorsMethods(BrainGeometry);

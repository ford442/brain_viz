// brain-renderer.js
// Verified Neuro-Weaver V2.6 Implementation
import { WasmTensorEngine } from './wasm-engine.js';
import { applyPipelineMethods } from './brain-renderer/pipelines.js';
import { applyGeometryMethods } from './brain-renderer/geometry.js';
import { applyStimulusMethods } from './brain-renderer/stimulus.js';
import { applyUniformsMethods } from './brain-renderer/uniforms.js';
import { applyRenderLoopMethods } from './brain-renderer/render-loop.js';
import { applyCoreMethods } from './brain-renderer/core-methods.js';

export class BrainRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;

        // Pipelines
        this.pipeline = null;      // Solid Mesh
        this.fiberPipeline = null; // Lines
        this.somaPipeline = null;  // Instanced Spheres (Somas)
        this.sparkPipeline = null; // Emissive Sparks
        this.postPipeline = null;  // [Phase 7] Cinematic Post-Process
        
        this.rotation = { x: 0, y: 0 };
        this.targetRotation = { x: 0.3, y: 0 };
        this.zoom = 3.5;
        this.targetZoom = 3.5; // [Neuro-Weaver] Smooth Zoom Target
        this.fov = Math.PI / 4;
        this.targetFov = Math.PI / 4;
        this.time = 0;
        this.isRunning = false;
        this.tensorPlaybackMode = false; // [BCI] When true, compute shader skipped; TensorPlayer drives the voxel buffer
        this.geometryRows = 80;
        this.geometryCols = 50;
        this.geometryDirty = false;
        this.geometryRebuildIntervalMs = 80;
        this.lastGeometryRebuildTime = 0;
        this.lastGeometryGenerationMs = 0;

        // [Phase 1 WASM] Hybrid simulation mode.
        // When wasmMode is true the C++ BrainTensorEngine drives the tensor physics
        // instead of the WebGPU compute shader.  Falls back to WebGPU automatically
        // if the WASM build has not been run or the browser does not support it.
        this.wasmMode   = false;
        this.wasmEngine = new WasmTensorEngine(32); // lazy-initialised on first enable

        this.params = {
            cognitiveLoad: 0.0, // [Phase 9] Visual Cortex Fatigue (Dynamic LoD)
            cognitiveDissonance: 0.0, // [Phase 2.5] Cognitive Dissonance
            frequency: 2.0,
            amplitude: 0.5,
            spikeThreshold: 0.8,
            smoothing: 0.9,
            style: 0.0, // 0=Organic, 1=Cyber, 2=Connectome, 3=Heatmap
            sliceZ: 2.0,  // Slice plane Z value (Starts outside bounds)
            flowSpeed: 4.0, // V2.3: Signal Speed
            colorShift: 0.0, // [Phase 5] Serotonin Color Shift

            // [Phase 21] Neuromodulator physics defaults
            decayRate: 0.96,
            diffusionRate: 0.1,
            pulseSaturation: 1.0,
            trailLength: 1.0,
            retentionBiasX: 0.5,
            retentionBiasY: 0.0,
            retentionBiasZ: 0.2,
            retentionBiasW: 0.2,

            sparkle: 0.0, // [Phase 5] Synaptic Sparkles
            growth: 1.0, // [Phase 6] Dendritic Growth (0.0 - 1.0)
            shake: 0.0, // [Phase 2] Camera Shake Intensity (Trauma/Panic)
            aberration: 0.0, // [Phase 7] Chromatic Aberration Intensity
            grain: 0.0, // [Phase 7] Film Grain Intensity
            focus: 0.5, // [Phase 7] Focus Distance (0.0 - 1.0)
            aperture: 0.0, // [Phase 7] Blur Strength (DoF)
            lightDirX: 1.0, // [Phase 2] Directional Light X
            lightDirY: 1.0, // [Phase 2] Directional Light Y
            lightDirZ: 1.0, // [Phase 2] Directional Light Z
            ambientLight: 0.2, // [Phase 2] Ambient Light Intensity
            dirIntensity: 0.8, // [Phase 2] Directional Light Intensity
            stress: 0.0, // [Phase 2] Cognitive Stress Distortion
            cortisol: 0.0, // [Phase 5] Cortisol Structural Decay
            lesionActive: 0.0,
            lesionCenterX: 0.0,
            lesionCenterY: 0.0,
            lesionCenterZ: 0.0,
            lesionRadius: 0.0,
            decimation: 0.0,
            myelin_degradation: 0.0, // [V3.1] Connectome myelin loss visualization
            fluidActive: 0.0, // [Phase 6] Procedural Volumetric Fluid Dynamics
            edgeDetection: 0.0, // Visual Cortex Edge Detection
            // Altitude/Hypoxia Simulation Parameters
            altitude: 0.0, // Altitude in meters (0-8000)
            oxygenLevel: 1.0, // Oxygen saturation (1.0-0.3)
            hypoxiaStress: 0.0, // Cellular stress response (0.0-1.0)
            metabolicRate: 1.0, // ATP consumption multiplier (0.5-2.0)
            mitochondrialFunction: 1.0, // ATP synthesis efficiency (0.0-1.0)
            fogDensity: 0.0, // Volumetric Fog
            aiInfluence: 0.5,
            resonanceThreshold: 0.2,
            aiLayer: 0.0,
            pointCloudDensity: 1.0,
            fiberCoupling: 0.5,
            foldScale: 1.0,
            foldStrength: 0.16,
            fissureDepth: 0.52,
            lobeFoldBias: 1.0,
            corticalThickness: 0.11,
            networkTopology: 0.0,
            fiberSymmetry: 0.85,      // [V3.3] Bilateral connectome symmetry (0=free, 1=mirrored)
            bundleCoherence: 0.6,     // [V3.3] Tightness of fibers within a tract bundle
            connectomeVariant: 0.0,   // [V3.3] 0=Anatomical (DTI tracts), 1=Reasoning Pathways
        };

        // Voxel Grid Settings
        // 32x32x32 flattened buffer
        this.voxelDim = 32;
        this.voxelCount = this.voxelDim * this.voxelDim * this.voxelDim;
        this._lastHumanTensor = new Float32Array(this.voxelCount);
        this._lastAITensor = new Float32Array(this.voxelCount);

        // Stimulus State (V2.2 Initialized)
        // Stores position and intensity for compute shader injection
        this.stimulus = {
            pos: [0, 0, 0],
            active: 0.0,
            electricalActive: 0.0,
            mercuryActive: 0.0,
            decayRate: 0.0,
            lastTime: 0
        };

        // Altitude/Hypoxia Internal State
        // Tracks activation time for cumulative hypoxia effects
        this._altitudeInternal = {
            activationTime: 0,
            lastAltitude: 0.0
        };

        this.renderTarget = null;
        this.sampler = null;
        this.postBindGroup = null;

        this.setupInputHandlers();
    }
    

}

applyPipelineMethods(BrainRenderer);
applyGeometryMethods(BrainRenderer);
applyStimulusMethods(BrainRenderer);
applyUniformsMethods(BrainRenderer);
applyRenderLoopMethods(BrainRenderer);
applyCoreMethods(BrainRenderer);

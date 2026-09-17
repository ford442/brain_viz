// @ts-check
import { Mat4 } from '../math-utils.js';
import { COMPUTE_UNIFORM_BUFFER_SIZE, RENDER_UNIFORM_FLOAT_COUNT } from './constants.js';
import { RENDER_UNIFORM_OFFSETS as R, COMPUTE_UNIFORM_OFFSETS } from '../shaders/uniform-layout.js';

// Byte offset of a compute (`TensorParams`) field, for the DataView writes below.
const cOff = (name) => COMPUTE_UNIFORM_OFFSETS[name] * 4;

export function applyUniformsMethods(Target) {
    Target.prototype.updateUniforms = function() {
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.1;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.1;
        this.zoom += (this.targetZoom - this.zoom) * 0.1;
        this.fov += (this.targetFov - this.fov) * 0.1;
        
        const aspect = this.canvas.width / this.canvas.height;
        const projection = Mat4.perspective(this.fov, aspect, 0.1, 100.0);
        const view = Mat4.lookAt([0, 0, this.zoom], [0, 0, 0], [0, 1, 0]);

        // [Phase 2] Camera Shake Logic
        let shakeX = 0;
        let shakeY = 0;
        if (this.params.shake > 0.001) {
     shakeX = (Math.random() - 0.5) * this.params.shake;
     shakeY = (Math.random() - 0.5) * this.params.shake;
        }

        const model = Mat4.multiply(Mat4.rotateX(this.rotation.x + shakeX), Mat4.rotateY(this.rotation.y + shakeY));

        const pv = Mat4.multiply(view, projection);
        const mvp = Mat4.multiply(model, pv);
        
        // Uniform Buffer Layout
        // Every offset below is generated from RENDER_UNIFORM_LAYOUT in
        // src/shaders/uniform-layout.js, which also emits the WGSL `struct
        // Uniforms` the shaders interpolate. The two can no longer drift:
        // there is one declaration and these are its WGSL-aligned offsets.

        const OFFSET_MVP = R.mvpMatrix;
        const OFFSET_MODEL = R.modelMatrix;
        const OFFSET_TIME = R.time;
        const OFFSET_STYLE = R.style;
        const OFFSET_FLOW = R.flowSpeed;
        const OFFSET_COLOR = R.colorShift;
        const OFFSET_DOPAMINE = R.dopamineTrails;
        const OFFSET_SLICE = R.slicePlane;
        const OFFSET_SPARKLE = R.sparkle;
        const OFFSET_GROWTH = R.growth;
        const OFFSET_ABERRATION = R.aberration;
        const OFFSET_GRAIN = R.grain;
        const OFFSET_FOCUS = R.focus;
        const OFFSET_APERTURE = R.aperture;
        const OFFSET_LIGHT_DIR = R.lightDir;
        const OFFSET_AMBIENT = R.ambientLight;
        const OFFSET_DIR_INTENSITY = R.dirIntensity;
        const OFFSET_STRESS = R.stress;
        const OFFSET_CORTISOL = R.cortisol;
        const OFFSET_ALTITUDE = R.altitude;
        const OFFSET_OXYGEN = R.oxygenLevel;
        const OFFSET_HYPOXIA_STRESS = R.hypoxiaStress;
        const OFFSET_METABOLIC_RATE = R.metabolicRate;
        const OFFSET_MITOCHONDRIAL = R.mitochondrialFunction;
        const OFFSET_FOG_DENSITY = R.fogDensity;
        const OFFSET_ZOOM = R.zoom;
        const OFFSET_HEAVY_METAL = R.heavyMetal;
        const OFFSET_FLUID_ACTIVE = R.fluidActive;
        const OFFSET_AI_INFLUENCE = R.aiInfluence;
        const OFFSET_RESONANCE_THRESHOLD = R.resonanceThreshold;
        const OFFSET_SYNAPTIX_ACTIVE = R.synaptiXActive;
        const OFFSET_AI_LAYER = R.aiLayer;
        const OFFSET_POINT_CLOUD_DENSITY = R.pointCloudDensity;
        const OFFSET_FIBER_COUPLING = R.fiberCoupling;
        const OFFSET_CONNECTOME_VARIANT = R.connectomeVariant;
        const OFFSET_TMS_ACTIVE = R.tmsActive;
        const OFFSET_TMS_CENTER = R.tmsCenter;
        const OFFSET_TMS_PULSE = R.tmsPulse;
        const OFFSET_TMS_RADIUS = R.tmsRadius;
        const OFFSET_EDGE_DETECTION = R.edgeDetection;
        const OFFSET_PULSE_SATURATION = R.pulseSaturation;
        const OFFSET_TRAIL_LENGTH = R.trailLength;
        const OFFSET_LESION_CENTER = R.lesionCenter;
        const OFFSET_LESION_ACTIVE = R.lesionActive;
        const OFFSET_LESION_RADIUS = R.lesionRadius;
        const OFFSET_DECIMATION = R.decimation;
        const OFFSET_PSYCHEDELIC = R.psychedelic;
        const OFFSET_IMMUNE_ACTIVITY = R.immuneActivity;
        const OFFSET_PLASTICITY_DECAY = R.plasticityDecay;
        const OFFSET_VISUAL_FATIGUE = R.visualFatigue;
        const OFFSET_SENSORY_DEPRIVATION = R.sensoryDeprivation;
        const OFFSET_SPATIAL_MEMORY = R.spatialMemory;
        const OFFSET_APOPTOSIS = R.apoptosis;
        const OFFSET_PARTICLE_SPEED = R.particleSpeed;

        // Shared with the buffer allocation in ./constants.js.
        const uData = new Float32Array(RENDER_UNIFORM_FLOAT_COUNT);
        uData.set(mvp, OFFSET_MVP);
        uData.set(model, OFFSET_MODEL);
        uData[OFFSET_TIME] = this.time;
        uData[OFFSET_STYLE] = this.params.style;
        uData[OFFSET_FLOW] = this.params.flowSpeed;
        uData[OFFSET_COLOR] = this.params.colorShift;
        uData[OFFSET_DOPAMINE] = this.params.dopamineTrails || 0.0;

        // Slice Plane Logic
        uData[OFFSET_SLICE] = 0.0;      // Px
        uData[OFFSET_SLICE + 1] = 0.0;  // Py
        uData[OFFSET_SLICE + 2] = -1.0; // Pz (Normal pointing backward)
        uData[OFFSET_SLICE + 3] = this.params.sliceZ; // Distance

        uData[OFFSET_SPARKLE] = this.params.sparkle;
        uData[OFFSET_GROWTH] = this.params.growth;
        uData[OFFSET_ABERRATION] = this.params.aberration;
        uData[OFFSET_GRAIN] = this.params.grain;
        uData[OFFSET_FOCUS] = this.params.focus;
        uData[OFFSET_APERTURE] = this.params.aperture;
        uData[OFFSET_LIGHT_DIR] = this.params.lightDirX;
        uData[OFFSET_LIGHT_DIR + 1] = this.params.lightDirY;
        uData[OFFSET_LIGHT_DIR + 2] = this.params.lightDirZ;
        uData[OFFSET_AMBIENT] = this.params.ambientLight;
        uData[OFFSET_DIR_INTENSITY] = this.params.dirIntensity;
        uData[OFFSET_STRESS] = this.params.stress;
        uData[OFFSET_CORTISOL] = Math.max(this.params.cortisol, this.params.myelin_degradation || 0.0);
        uData[OFFSET_ALTITUDE] = this.params.altitude;
        uData[OFFSET_OXYGEN] = this.params.oxygenLevel;
        uData[OFFSET_HYPOXIA_STRESS] = this.params.hypoxiaStress;
        uData[OFFSET_METABOLIC_RATE] = this.params.metabolicRate;
        uData[OFFSET_MITOCHONDRIAL] = this.params.mitochondrialFunction;
        uData[OFFSET_FOG_DENSITY] = this.params.fogDensity;
        uData[OFFSET_ZOOM] = this.zoom;
        uData[OFFSET_HEAVY_METAL] = this.params.heavyMetal;
        uData[OFFSET_FLUID_ACTIVE] = this.params.fluidActive;
        uData[OFFSET_AI_INFLUENCE] = this.params.partnerInfluence;
        uData[OFFSET_RESONANCE_THRESHOLD] = this.params.resonanceThreshold;
        uData[OFFSET_SYNAPTIX_ACTIVE] = this.params.style >= 4.0 ? 1.0 : 0.0;
        uData[OFFSET_AI_LAYER] = this.params.aiLayer;
        uData[OFFSET_POINT_CLOUD_DENSITY] = this.params.pointCloudDensity ?? 1.0;
        uData[OFFSET_FIBER_COUPLING] = this.params.fiberCoupling ?? 0.5;
        uData[OFFSET_CONNECTOME_VARIANT] = this.params.connectomeVariant ?? 0.0;
        uData[OFFSET_TMS_ACTIVE] = this.params.tmsActive;
        uData[OFFSET_TMS_CENTER] = this.params.tmsCenterX;
        uData[OFFSET_TMS_CENTER + 1] = this.params.tmsCenterY;
        uData[OFFSET_TMS_CENTER + 2] = this.params.tmsCenterZ;
        uData[OFFSET_TMS_PULSE] = this.params.tmsPulse;
        uData[OFFSET_TMS_RADIUS] = this.params.tmsRadius;
        uData[OFFSET_EDGE_DETECTION] = this.params.edgeDetection || 0.0;
        uData[OFFSET_PULSE_SATURATION] = this.params.pulseSaturation !== undefined ? this.params.pulseSaturation : 1.0;
        uData[OFFSET_TRAIL_LENGTH] = this.params.trailLength !== undefined ? this.params.trailLength : 1.0;
        uData[OFFSET_LESION_CENTER] = this.params.lesionCenterX;
        uData[OFFSET_LESION_CENTER + 1] = this.params.lesionCenterY;
        uData[OFFSET_LESION_CENTER + 2] = this.params.lesionCenterZ;
        uData[OFFSET_LESION_ACTIVE] = this.params.lesionActive;
        uData[OFFSET_LESION_RADIUS] = this.params.lesionRadius;
        uData[OFFSET_DECIMATION] = this.params.decimation;
        uData[OFFSET_PSYCHEDELIC] = this.params.psychedelic || 0.0;
        uData[OFFSET_IMMUNE_ACTIVITY] = this.params.immuneActivity || 0.0;
        uData[OFFSET_PLASTICITY_DECAY] = this.params.plasticityDecay || 0.0;
        uData[OFFSET_VISUAL_FATIGUE] = this.params.visualFatigue || 0.0;
        uData[OFFSET_SENSORY_DEPRIVATION] = this.params.sensoryDeprivation || 0.0;
        uData[OFFSET_SPATIAL_MEMORY] = this.params.spatialMemory || 0.0;
        uData[OFFSET_APOPTOSIS] = this.params.apoptosis || 0.0;
        uData[OFFSET_PARTICLE_SPEED] = this.params.particleSpeed !== undefined ? this.params.particleSpeed : 1.0;
        // [Field Resolution] The grid resolution the render pipelines index
        // `activityTensor` at. Uploaded every frame rather than baked into the
        // shader, so setVoxelDim() takes effect on the next frame.
        uData[R.voxelDim] = this.voxelDim;

        // [SynaptiX Multi-Brain] Each avatar gets the same camera rotation but a
        // distinct local transform and tensor-only bind group.
        const avatarALocal = Mat4.composeTranslationScale(-1.05, 0, 0, 0.62);
        const partnerLocal = Mat4.composeTranslationScale(1.05, 0, 0, 0.62);
        const avatarAModel = Mat4.multiply(avatarALocal, model);
        const partnerModel = Mat4.multiply(partnerLocal, model);
        const avatarAData = new Float32Array(uData);
        const partnerData = new Float32Array(uData);
        avatarAData.set(Mat4.multiply(avatarAModel, pv), OFFSET_MVP);
        avatarAData.set(avatarAModel, OFFSET_MODEL);
        avatarAData[OFFSET_AI_INFLUENCE] = 0.0; // palette selector: cyan
        avatarAData[OFFSET_AI_LAYER] = 1.0;
        partnerData.set(Mat4.multiply(partnerModel, pv), OFFSET_MVP);
        partnerData.set(partnerModel, OFFSET_MODEL);
        partnerData[OFFSET_AI_INFLUENCE] = 1.0; // palette selector: magenta
        partnerData[OFFSET_AI_LAYER] = this.params.partnerInfluence ?? 0.5;

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        this.device.queue.writeBuffer(this.avatarAUniformBuffer, 0, avatarAData);
        this.device.queue.writeBuffer(this.partnerUniformBuffer, 0, partnerData);
        
        // Compute `TensorParams` upload. Every byte offset comes from
        // COMPUTE_UNIFORM_LAYOUT in src/shaders/uniform-layout.js, which also
        // emits the WGSL struct the compute shader declares, so the two
        // cannot drift.
        const cBuf = new ArrayBuffer(COMPUTE_UNIFORM_BUFFER_SIZE);
        const dv = new DataView(cBuf);
        dv.setFloat32(cOff('time'), this.time, true);
        dv.setUint32(cOff('voxelDim'), this.voxelDim, true);
        dv.setFloat32(cOff('frequency'), this.params.frequency, true);
        dv.setFloat32(cOff('amplitude'), this.params.amplitude, true);
        dv.setFloat32(cOff('spikeThreshold'), this.params.spikeThreshold, true);
        dv.setFloat32(cOff('smoothing'), this.params.smoothing, true);
        dv.setFloat32(cOff('style'), this.params.style, true);

        // [Neuro-Weaver] Stimulus
        dv.setFloat32(cOff('stimulusPos'), this.stimulus.pos[0], true);
        dv.setFloat32(cOff('stimulusPos') + 4, this.stimulus.pos[1], true);
        dv.setFloat32(cOff('stimulusPos') + 8, this.stimulus.pos[2], true);
        dv.setFloat32(cOff('stimulusActive'), this.stimulus.active, true);

        // Altitude/Hypoxia parameters for compute shader
        dv.setFloat32(cOff('hypoxiaStress'), this.params.hypoxiaStress, true);
        dv.setFloat32(cOff('metabolicRate'), this.params.metabolicRate, true);
        dv.setFloat32(cOff('mitochondrialFunction'), this.params.mitochondrialFunction, true);

        // Fluid Dynamics and Environmental Hazard variables
        dv.setFloat32(cOff('fluidActive'), this.params.fluidActive, true);
        dv.setFloat32(cOff('electricalActive'), this.stimulus.electricalActive, true);
        dv.setFloat32(cOff('mercuryActive'), this.stimulus.mercuryActive, true);
        dv.setFloat32(cOff('cognitiveLoad'), this.params.cognitiveLoad, true);
        dv.setFloat32(cOff('stress'), this.params.stress, true);

        // [SynaptiX] AI Tensor Mirror params.
        // Multi-Brain coupling is visual-only. Never feed partner data back into tensor physics.
        dv.setFloat32(cOff('aiInfluence'), 0.0, true);
        dv.setFloat32(cOff('resonanceThreshold'), this.params.resonanceThreshold, true);
        dv.setFloat32(cOff('synaptiXActive'), 0.0, true);

        // [V3.2] Fiber-volume coupling strength
        dv.setFloat32(cOff('fiberCoupling'), this.params.fiberCoupling ?? 0.5, true);
        dv.setFloat32(cOff('cognitiveDissonance'), this.params.cognitiveDissonance ?? 0.0, true);

        // [Phase 21] Neuromodulator physics
        dv.setFloat32(cOff('decayRate'), this.params.decayRate !== undefined ? this.params.decayRate : 0.96, true);
        dv.setFloat32(cOff('diffusionRate'), this.params.diffusionRate !== undefined ? this.params.diffusionRate : 0.1, true);
        dv.setFloat32(cOff('pulseSaturation'), this.params.pulseSaturation !== undefined ? this.params.pulseSaturation : 1.0, true);
        dv.setFloat32(cOff('trailLength'), this.params.trailLength !== undefined ? this.params.trailLength : 1.0, true);

        dv.setFloat32(cOff('retentionBias') + 0, this.params.retentionBiasX !== undefined ? this.params.retentionBiasX : 0.5, true); // frontal
        dv.setFloat32(cOff('retentionBias') + 4, this.params.retentionBiasY !== undefined ? this.params.retentionBiasY : 0.0, true); // occipital
        dv.setFloat32(cOff('retentionBias') + 8, this.params.retentionBiasZ !== undefined ? this.params.retentionBiasZ : 0.2, true); // temporal
        dv.setFloat32(cOff('retentionBias') + 12, this.params.retentionBiasW !== undefined ? this.params.retentionBiasW : 0.2, true); // parietal

        dv.setFloat32(cOff('lesionCenter') + 0, this.params.lesionCenterX, true);
        dv.setFloat32(cOff('lesionCenter') + 4, this.params.lesionCenterY, true);
        dv.setFloat32(cOff('lesionCenter') + 8, this.params.lesionCenterZ, true);
        dv.setFloat32(cOff('lesionActive'), this.params.lesionActive, true);
        dv.setFloat32(cOff('lesionRadius'), this.params.lesionRadius, true);
        dv.setFloat32(cOff('decimation'), this.params.decimation, true);

        // [Paint Energy] brush radius (0 = legacy fixed sigma 0.5 for
        // single-click/region-button callers) and erase/damping flag.
        dv.setFloat32(cOff('stimulusRadius'), this.stimulus.radius ?? 0.0, true);
        dv.setFloat32(cOff('stimulusErase'), this.stimulus.erase ? 1.0 : 0.0, true);

        // Upload to GPU
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);

        // Auto-reset pulse (single frame injection)
        if (this.stimulus.active > 0) {
    if (this.stimulus.decayHalfLife > 0) {
        // [Paint Energy] Exponential half-life decay — set by injectStimulus()
        // when a caller (the paint brush) passes decayHalfLife. Takes
        // priority over the legacy linear decayRate ramp below. lastDecayTime
        // is re-stamped on every injectStimulus() call, so active intensity
        // only actually decays once injections stop (e.g. after pointerup).
        const now = performance.now();
        const dt = (now - this.stimulus.lastDecayTime) / 1000.0;
        this.stimulus.active *= Math.pow(0.5, dt / this.stimulus.decayHalfLife);
        this.stimulus.lastDecayTime = now;
        if (this.stimulus.active < 0.001) {
            this.stimulus.active = 0.0;
            this.stimulus.decayHalfLife = 0.0;
        }
    } else if (this.stimulus.decayRate > 0) {
        const now = performance.now();
        const dt = (now - this.stimulus.lastTime) / 1000.0; // convert to seconds
        this.stimulus.active = Math.max(0.0, this.stimulus.active - this.stimulus.decayRate * dt);
        this.stimulus.lastTime = now;
        if (this.stimulus.active === 0.0) {
            this.stimulus.decayRate = 0.0; // stop decaying once zero
        }
    } else {
        this.stimulus.active = 0.0;
    }
        }
        if (this.stimulus.electricalActive > 0) {
     this.stimulus.electricalActive = 0.0;
        }
        if (this.stimulus.mercuryActive > 0) {
     this.stimulus.mercuryActive = 0.0;
        }
    };

}

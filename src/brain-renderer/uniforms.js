import { Mat4 } from '../math-utils.js';
import { COMPUTE_UNIFORM_BUFFER_SIZE } from './constants.js';

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
        
        // Uniform Buffer Layout (Verified)
        // [0-15]: MVP (64 bytes)
        // [16-31]: Model (64 bytes)
        // [32]: Time
        // [33]: Style
        // [34]: FlowSpeed
        // [35]: ColorShift
        // [36-39]: SlicePlane (Vec4, 16 bytes)
        // [40]: Sparkle (4 bytes)
        // [41]: Growth (4 bytes)
        // [42]: Aberration (4 bytes)
        // [43]: Grain (4 bytes)
        // [44]: Focus (4 bytes)
        // [45]: Aperture (4 bytes)
        // [48-50]: LightDir (12 bytes)
        // [51]: AmbientLight (4 bytes)
        // [52]: DirIntensity (4 bytes)
        // [53]: Stress (4 bytes)
        // [54]: Cortisol (4 bytes)

        const OFFSET_MVP = 0;
        const OFFSET_MODEL = 16;
        const OFFSET_TIME = 32;
        const OFFSET_STYLE = 33;
        const OFFSET_FLOW = 34;
        const OFFSET_COLOR = 35;
        const OFFSET_SLICE = 36;
        const OFFSET_SPARKLE = 40;
        const OFFSET_GROWTH = 41;
        const OFFSET_ABERRATION = 42;
        const OFFSET_GRAIN = 43;
        const OFFSET_FOCUS = 44;
        const OFFSET_APERTURE = 45;
        const OFFSET_LIGHT_DIR = 48;
        const OFFSET_AMBIENT = 51;
        const OFFSET_DIR_INTENSITY = 52;
        const OFFSET_STRESS = 53;
        const OFFSET_CORTISOL = 54;
        const OFFSET_ALTITUDE = 55;
        const OFFSET_OXYGEN = 56;
        const OFFSET_HYPOXIA_STRESS = 57;
        const OFFSET_METABOLIC_RATE = 58;
        const OFFSET_MITOCHONDRIAL = 59;
        const OFFSET_FOG_DENSITY = 60;
        const OFFSET_ZOOM = 61;
        const OFFSET_HEAVY_METAL = 62;
        const OFFSET_FLUID_ACTIVE = 63;
        const OFFSET_AI_INFLUENCE = 64;
        const OFFSET_RESONANCE_THRESHOLD = 65;
        const OFFSET_SYNAPTIX_ACTIVE = 66;
        const OFFSET_AI_LAYER = 67;
        const OFFSET_POINT_CLOUD_DENSITY = 68;
        const OFFSET_FIBER_COUPLING = 69;
        const OFFSET_CONNECTOME_VARIANT = 70; // [V3.3] formerly pad5
        const OFFSET_TMS_ACTIVE = 71;
        const OFFSET_TMS_CENTER = 72; // vec3 takes 3
        const OFFSET_TMS_PULSE = 75;
        const OFFSET_PAD3 = 76;
        const OFFSET_EDGE_DETECTION = 77;
        const OFFSET_PULSE_SATURATION = 78;
        const OFFSET_TRAIL_LENGTH = 79;
        const OFFSET_LESION_CENTER = 80;
        const OFFSET_LESION_ACTIVE = 83;
        const OFFSET_LESION_RADIUS = 84;
        const OFFSET_DECIMATION = 85;
        const OFFSET_PSYCHEDELIC = 86;

        const RENDER_UNIFORM_FLOAT_COUNT = 88;
        const uData = new Float32Array(RENDER_UNIFORM_FLOAT_COUNT);
        uData.set(mvp, OFFSET_MVP);
        uData.set(model, OFFSET_MODEL);
        uData[OFFSET_TIME] = this.time;
        uData[OFFSET_STYLE] = this.params.style;
        uData[OFFSET_FLOW] = this.params.flowSpeed;
        uData[OFFSET_COLOR] = this.params.colorShift;

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
        uData[OFFSET_AI_INFLUENCE] = this.params.aiInfluence;
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
        uData[OFFSET_PAD3] = this.params.tmsRadius; // OFFSET_PAD3 is offset 76
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

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uData);
        
        // Compute Uniforms layout (112 bytes total):
        // 32 bytes scalar block + 16 bytes stimulus block + 12 bytes hypoxia block
        // + 20 bytes hazards + 16 bytes padding + 16 bytes SynaptiX params.
        const cBuf = new ArrayBuffer(COMPUTE_UNIFORM_BUFFER_SIZE);
        const dv = new DataView(cBuf);
        dv.setFloat32(0, this.time, true);
        dv.setUint32(4, this.voxelDim, true);
        dv.setFloat32(8, this.params.frequency, true);
        dv.setFloat32(12, this.params.amplitude, true);
        dv.setFloat32(16, this.params.spikeThreshold, true);
        dv.setFloat32(20, this.params.smoothing, true);
        dv.setFloat32(24, this.params.style, true);
        dv.setFloat32(28, 0.0, true);

        // [Neuro-Weaver] Upload Stimulus Data
        // Layout must match TensorParams struct in WGSL (std140)
        // Offset 32: stimulusPos (vec3)
        // Offset 44: stimulusActive (f32)
        dv.setFloat32(32, this.stimulus.pos[0], true);
        dv.setFloat32(36, this.stimulus.pos[1], true);
        dv.setFloat32(40, this.stimulus.pos[2], true);

        dv.setFloat32(44, this.stimulus.active, true);

        // Altitude/Hypoxia parameters for compute shader
        // Offset 48: hypoxiaStress
        // Offset 52: metabolicRate
        // Offset 56: mitochondrialFunction
        dv.setFloat32(48, this.params.hypoxiaStress, true);
        dv.setFloat32(52, this.params.metabolicRate, true);
        dv.setFloat32(56, this.params.mitochondrialFunction, true);

        // Fluid Dynamics and Environmental Hazard variables
        dv.setFloat32(60, this.params.fluidActive, true);
        dv.setFloat32(64, this.stimulus.electricalActive, true);
        dv.setFloat32(68, this.stimulus.mercuryActive, true);
        dv.setFloat32(72, this.params.cognitiveLoad, true);
        dv.setFloat32(76, this.params.stress, true);

        // [SynaptiX] AI Tensor Mirror params (offset 88)
        dv.setFloat32(88, this.params.aiInfluence, true);
        dv.setFloat32(92, this.params.resonanceThreshold, true);
        dv.setFloat32(96, this.params.style >= 4.0 ? 1.0 : 0.0, true);

        // [V3.2] Fiber-volume coupling strength (offset 100)
        dv.setFloat32(100, this.params.fiberCoupling ?? 0.5, true);
        dv.setFloat32(104, this.params.cognitiveDissonance ?? 0.0, true);

        // [Phase 21] Neuromodulator physics (offset 112 & 128)
        dv.setFloat32(112, this.params.decayRate !== undefined ? this.params.decayRate : 0.96, true);
        dv.setFloat32(116, this.params.diffusionRate !== undefined ? this.params.diffusionRate : 0.1, true);
        dv.setFloat32(120, this.params.pulseSaturation !== undefined ? this.params.pulseSaturation : 1.0, true);
        dv.setFloat32(124, this.params.trailLength !== undefined ? this.params.trailLength : 1.0, true);

        dv.setFloat32(128, this.params.retentionBiasX !== undefined ? this.params.retentionBiasX : 0.5, true); // frontal
        dv.setFloat32(132, this.params.retentionBiasY !== undefined ? this.params.retentionBiasY : 0.0, true); // occipital
        dv.setFloat32(136, this.params.retentionBiasZ !== undefined ? this.params.retentionBiasZ : 0.2, true); // temporal
        dv.setFloat32(140, this.params.retentionBiasW !== undefined ? this.params.retentionBiasW : 0.2, true); // parietal

        dv.setFloat32(144, this.params.lesionCenterX, true);
        dv.setFloat32(148, this.params.lesionCenterY, true);
        dv.setFloat32(152, this.params.lesionCenterZ, true);
        dv.setFloat32(156, this.params.lesionActive, true);
        dv.setFloat32(160, this.params.lesionRadius, true);
        dv.setFloat32(164, this.params.decimation, true);

        // Upload to GPU
        this.device.queue.writeBuffer(this.computeUniformBuffer, 0, cBuf);

        // Auto-reset pulse (single frame injection)
        if (this.stimulus.active > 0) {
    if (this.stimulus.decayRate > 0) {
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

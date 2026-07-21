// main-dom.js
export function collectInputsAndLabels() {
    const inputs = {
    frequency: document.getElementById('freq'),
    amplitude: document.getElementById('amp'),
    spikeThreshold: document.getElementById('thresh'),
    smoothing: document.getElementById('smooth'),
    sliceZ: document.getElementById('clip'),
    flowSpeed: document.getElementById('speed'),
    colorShift: document.getElementById('shift'), // [Phase 5]
    sparkle: document.getElementById('sparkle'), // [Phase 5]
    growth: document.getElementById('growth'), // [Phase 6]
    pointCloudDensity: document.getElementById('pointCloudDensity'), // [V3.1]
    fiberCoupling: document.getElementById('fiberCoupling'), // [V3.2]
    connectomeVariant: document.getElementById('connectomeVariant'), // [V3.3]
    fiberSymmetry: document.getElementById('fiberSymmetry'), // [V3.3]
    bundleCoherence: document.getElementById('bundleCoherence'), // [V3.3]
    shake: document.getElementById('shake'), // [Phase 2]
    stress: document.getElementById('stress'), // [Phase 2] Stress Distortion
    cortisol: document.getElementById('cortisol'), // [Phase 5] Cortisol Decay
    heavyMetal: document.getElementById('heavyMetal'), // [Phase 6] Heavy Metal Accumulation
    fluidActive: document.getElementById('fluidActive'), // [Phase 6] Fluid Dynamics
    fogDensity: document.getElementById('fogDensity'),
    aberration: document.getElementById('aberration'), // [Phase 7]
    grain: document.getElementById('grain'), // [Phase 7]
    focus: document.getElementById('focus'), // [Phase 7]
    aperture: document.getElementById('aperture'), // [Phase 7]
    ambientLight: document.getElementById('ambientLight'), // [Phase 2]
    dirIntensity: document.getElementById('dirIntensity'), // [Phase 2]
    lightDirX: document.getElementById('lightDirX'), // [Phase 2]
    lightDirY: document.getElementById('lightDirY'), // [Phase 2]
    lightDirZ: document.getElementById('lightDirZ'), // [Phase 2]
    altitude: document.getElementById('altitude'), // Altitude/Hypoxia
    oxygen: document.getElementById('oxygen'), // Altitude/Hypoxia (read-only)
    metabolicRate: document.getElementById('metabolic'), // Altitude/Hypoxia
    style: document.getElementById('style-mode'),
    aiInfluence: document.getElementById('aiInfluence'),
    resonanceThreshold: document.getElementById('resonanceThreshold'),
    aiLayer: document.getElementById('aiLayer'),
    fusionParticles: document.getElementById('fusion-particles'),
    frameScrubber: document.getElementById('frame-scrubber'),
    frameRate: document.getElementById('frame-rate'),
    liveSourceEnable: document.getElementById('live-source-enable')
    };

    const labels = {
    frequency: document.getElementById('val-freq'),
    amplitude: document.getElementById('val-amp'),
    spikeThreshold: document.getElementById('val-thresh'),
    smoothing: document.getElementById('val-smooth'),
    sliceZ: document.getElementById('val-clip'),
    flowSpeed: document.getElementById('val-speed'),
    colorShift: document.getElementById('val-shift'), // [Phase 5]
    sparkle: document.getElementById('val-sparkle'), // [Phase 5]
    growth: document.getElementById('val-growth'), // [Phase 6]
    pointCloudDensity: document.getElementById('val-pointCloudDensity'), // [V3.1]
    fiberCoupling: document.getElementById('val-fiberCoupling'), // [V3.2]
    connectomeVariant: document.getElementById('val-connectomeVariant'), // [V3.3]
    fiberSymmetry: document.getElementById('val-fiberSymmetry'), // [V3.3]
    bundleCoherence: document.getElementById('val-bundleCoherence'), // [V3.3]
    shake: document.getElementById('val-shake'), // [Phase 2]
    stress: document.getElementById('val-stress'), // [Phase 2] Stress Distortion
    cortisol: document.getElementById('val-cortisol'), // [Phase 5] Cortisol Decay
    heavyMetal: document.getElementById('val-heavyMetal'), // [Phase 6] Heavy Metal Accumulation
    fluidActive: document.getElementById('val-fluidActive'), // [Phase 6] Fluid Dynamics
    fogDensity: document.getElementById('val-fogDensity'),
    aberration: document.getElementById('val-aberration'), // [Phase 7]
    grain: document.getElementById('val-grain'), // [Phase 7]
    focus: document.getElementById('val-focus'), // [Phase 7]
    aperture: document.getElementById('val-aperture'), // [Phase 7]
    ambientLight: document.getElementById('val-ambientLight'), // [Phase 2]
    dirIntensity: document.getElementById('val-dirIntensity'), // [Phase 2]
    lightDirX: document.getElementById('val-lightDirX'), // [Phase 2]
    lightDirY: document.getElementById('val-lightDirY'), // [Phase 2]
    lightDirZ: document.getElementById('val-lightDirZ'), // [Phase 2]
    altitude: document.getElementById('val-altitude'), // Altitude/Hypoxia
    oxygen: document.getElementById('val-oxygen'), // Altitude/Hypoxia (read-only)
    metabolicRate: document.getElementById('val-metabolic'), // Altitude/Hypoxia
    aiInfluence: document.getElementById('val-aiInfluence'),
    resonanceThreshold: document.getElementById('val-resonanceThreshold'),
    aiLayer: document.getElementById('val-aiLayer'),
    frameIndex: document.getElementById('val-frame-index'),
    frameTotal: document.getElementById('val-frame-total'),
    frameRate: document.getElementById('val-frame-rate')
    };

    return { inputs, labels };
}

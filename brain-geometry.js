// shaders.js (Partial - Update Compute Shader only)

export const computeShader = `
struct TensorParams {
    time: f32,
    dataSize: u32,
    frequency: f32,
    amplitude: f32,
    spikeThreshold: f32,
    smoothing: f32,
    style: f32, 
    padding: f32,
}

@group(0) @binding(0) var<storage, read_write> tensorData: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;

fn hash(n: f32) -> f32 { return fract(sin(n) * 43758.5453123); }

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    if (index >= params.dataSize) { return; }
    
    let fi = f32(index);
    let t = params.time;
    var signal = 0.0;
    
    if (params.style >= 2.0) {
        // --- CONNECTOME MODE ---
        // Fast, traveling pulses along fibers
        let wave = sin(fi * 0.05 + t * params.frequency);
        let pulse = step(0.98, hash(fi * 0.001 + t)); // Random firing
        signal = (wave * 0.1 + pulse) * params.amplitude;
        
    } else {
        // --- MEDICAL / ELECTRODE SIMULATION ---
        // Instead of global waves, simulate "Focal Points" of activity
        // These look like the glowing spheres in VisualizeBCI2000
        
        // 1. Define moving focal centers
        let center1 = f32(params.dataSize) * (0.5 + 0.4 * sin(t * 0.5));
        let center2 = f32(params.dataSize) * (0.5 + 0.4 * cos(t * 0.3));
        
        // 2. Calculate distance from vertex index to centers
        // (Index is a rough proxy for spatial location in this procedural mesh)
        let d1 = abs(fi - center1);
        let d2 = abs(fi - center2);
        
        // 3. Gaussian falloff (Bell curve)
        // width depends on "frequency" slider
        let width = 0.00005 * params.frequency; 
        let activity1 = exp(-d1 * d1 * width);
        let activity2 = exp(-d2 * d2 * width);
        
        // 4. Base background rhythm (Alpha waves)
        let alpha = sin(fi * 0.1 + t * 5.0) * 0.1;
        
        signal = (activity1 + activity2) * params.amplitude * 2.0 + alpha;
        
        // 5. Hard Thresholding (Spikes)
        if (signal < (1.0 - params.spikeThreshold)) {
            signal *= 0.1; // Suppress noise
        }
    }

    // Temporal Smoothing (trails)
    let prev = tensorData[index];
    tensorData[index] = mix(prev, signal, 1.0 - params.smoothing);
}
`;

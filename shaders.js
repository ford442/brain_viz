// Vertex shader - Updated for Heatmap Coloring
export const vertexShader = `
struct Uniforms {
    modelViewProjectionMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    padding: vec3<f32>,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> tensorData: array<f32>;

// Helper function for Heatmap Gradient (Blue -> Cyan -> Yellow -> Red)
fn getHeatmapColor(value: f32) -> vec3<f32> {
    let t = clamp(value, 0.0, 1.0);
    // Color stops
    let col0 = vec3<f32>(0.0, 0.0, 0.5); // Deep Blue (Low)
    let col1 = vec3<f32>(0.0, 1.0, 1.0); // Cyan
    let col2 = vec3<f32>(1.0, 1.0, 0.0); // Yellow
    let col3 = vec3<f32>(1.0, 0.0, 0.0); // Red (High)
    
    if (t < 0.33) {
        return mix(col0, col1, t * 3.0);
    } else if (t < 0.66) {
        return mix(col1, col2, (t - 0.33) * 3.0);
    } else {
        return mix(col2, col3, (t - 0.66) * 3.0);
    }
}

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    
    // Get tensor value
    let dataIndex = vertexIndex % arrayLength(&tensorData);
    let activityLevel = tensorData[dataIndex];
    
    // Sharp displacement for "Spiking" look
    // We square the activity to make low values flat and high values pointy
    let displacementAmount = activityLevel * activityLevel * 0.4; 
    let displacement = input.normal * displacementAmount;
    let animatedPos = input.position + displacement;
    
    // Transform position
    output.position = uniforms.modelViewProjectionMatrix * vec4<f32>(animatedPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(animatedPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    
    // Map activity to Heatmap
    // Normalize activity (-1 to 1 range -> 0 to 1 range for color)
    let normalizedActivity = (activityLevel + 0.2) * 0.8; 
    output.color = getHeatmapColor(normalizedActivity);
    output.activity = activityLevel; // Pass to fragment for glow
    
    return output;
}
`;

// Fragment shader - Updated for "Electric" feel
export const fragmentShader = `
struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Lighting
    let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.5));
    let normal = normalize(input.normal);
    
    let ambient = 0.2;
    let diffuse = max(dot(normal, lightDir), 0.0) * 0.8;
    
    // Specular highlight for "wet/shiny" brain look
    let viewDir = normalize(-input.worldPos);
    let reflectDir = reflect(-lightDir, normal);
    let specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * 0.5;
    
    // Add "Self-Illumination" based on activity level
    // High activity regions emit their own light
    let emission = input.color * max(input.activity, 0.0) * 0.8;
    
    let finalColor = input.color * (ambient + diffuse) + specular + emission;
    
    return vec4<f32>(finalColor, 1.0);
}
`;

// Compute shader - Simulating EEG Frequency Bands
export const computeShader = `
struct TensorParams {
    time: f32,
    dataSize: u32,
    frequency: f32,
    amplitude: f32,
    spikeThreshold: f32,  // New param
    smoothing: f32,       // New param
    padding1: f32,        // Align to 16 bytes
    padding2: f32,
}

@group(0) @binding(0) var<storage, read_write> tensorData: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;

fn hash(n: f32) -> f32 {
    return fract(sin(n) * 43758.5453123);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    if (index >= params.dataSize) { return; }
    
    let fi = f32(index);
    let t = params.time;
    
    // 1. Base Waves
    let slowWave = sin(fi * 0.05 + t * params.frequency * 0.2) * 0.2;
    let betaWave = sin(fi * 0.1 - t * params.frequency) * 0.3;
    
    // 2. High Freq Noise
    let gammaNoise = hash(fi + t) * 2.0 - 1.0; 
    let gammaWave = gammaNoise * 0.15 * (sin(t * params.frequency * 1.5) * 0.5 + 0.5);
    
    // 3. Spikes based on Threshold
    // We map the slider (0.0 - 1.0) to a trigger value
    let triggerVal = sin(fi * 0.02 + t * params.frequency * 0.5) + sin(fi * 0.03 - t * params.frequency * 0.3);
    // Invert threshold logic: Lower slider = More spikes
    let effectiveThresh = 2.0 - (params.spikeThreshold * 2.0); 
    
    let spike = 0.0;
    if (triggerVal > effectiveThresh) {
        spike = 1.0 * params.amplitude;
    }
    
    let signal = (slowWave + betaWave + gammaWave) * params.amplitude + spike;
    
    // 4. Smoothing / Decay
    // Use the smoothing parameter from UI
    let prevValue = tensorData[index];
    // smoothing 0.9 = 90% old value, 10% new value (slow trails)
    // smoothing 0.1 = 10% old value, 90% new value (fast twitch)
    let smoothFactor = 1.0 - params.smoothing; 
    tensorData[index] = mix(prevValue, signal, smoothFactor);
}
`;

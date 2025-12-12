// Unified shaders with Organic and Cyber visual modes
export const vertexShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32, // 0 = Organic, 1 = Cyber
    padding1: f32,
    padding2: f32,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,     // Used for Organic
    @location(3) activity: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> tensorData: array<f32>;

// Heatmap function
fn getHeatmapColor(t: f32) -> vec3<f32> {
    let t_clamped = clamp(t, 0.0, 1.0);
    let col0 = vec3<f32>(0.0, 0.0, 0.5); 
    let col1 = vec3<f32>(0.0, 1.0, 1.0); 
    let col2 = vec3<f32>(1.0, 1.0, 0.0); 
    let col3 = vec3<f32>(1.0, 0.0, 0.0); 
    if (t_clamped < 0.33) { return mix(col0, col1, t_clamped * 3.0); }
    else if (t_clamped < 0.66) { return mix(col1, col2, (t_clamped - 0.33) * 3.0); }
    else { return mix(col2, col3, (t_clamped - 0.66) * 3.0); }
}

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    let dataIndex = vertexIndex % arrayLength(&tensorData);
    let activity = tensorData[dataIndex];
    var displacement = vec3<f32>(0.0);
    
    // STYLE SWITCHING LOGIC
    if (uniforms.style < 0.5) {
        // ORGANIC MODE --- Smooth, round swelling
        let amount = activity * activity * 0.4;
        displacement = input.normal * amount;
        output.color = getHeatmapColor((activity + 0.2) * 0.8);
    } else {
        // CYBER MODE --- Sharp, glitchy spikes
        let glitch = floor(activity * 5.0) / 5.0;
        displacement = input.normal * glitch * 0.6;
        output.color = vec3<f32>(0.0, 0.2, 0.3);
    }

    let animatedPos = input.position + displacement;
    output.position = uniforms.mvpMatrix * vec4<f32>(animatedPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(animatedPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    output.activity = activity;
    return output;
}
`;

export const fragmentShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding1: f32,
    padding2: f32,
}
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
    @location(3) activity: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    var finalColor = vec3<f32>(0.0);
    if (uniforms.style < 0.5) {
        // ORGANIC: wet, shiny look
        let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.5));
        let ambient = 0.2;
        let diffuse = max(dot(normal, lightDir), 0.0) * 0.8;
        let reflectDir = reflect(-lightDir, normal);
        let specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * 0.6;
        let emission = input.color * max(input.activity, 0.0) * 0.5;
        finalColor = input.color * (ambient + diffuse) + specular + emission;
    } else {
        // CYBER: holographic wireframe + neon
        let fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
        let rimColor = vec3<f32>(0.0, 0.8, 1.0);
        let scanline = step(0.9, fract(input.worldPos.y * 5.0 + uniforms.time * 0.5));
        let signal = max(input.activity, 0.0);
        let spikeColor = vec3<f32>(1.0, 0.0, 0.8) * signal * 2.5;
        finalColor = (vec3<f32>(0.02) + (rimColor * fresnel) + (spikeColor * 0.8) + (rimColor * scanline * 0.3));
    }
    return vec4<f32>(finalColor, 1.0);
}
`;

export const computeShader = `
struct TensorParams {
    time: f32,
    dataSize: u32,
    frequency: f32,
    amplitude: f32,
    spikeThreshold: f32,
    smoothing: f32,
    style: f32, // Passed here too
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
    if (params.style < 0.5) {
        // ORGANIC MATH
        let slow = sin(fi * 0.05 + t * params.frequency * 0.2);
        let fast = sin(fi * 0.1 - t * params.frequency);
        let noise = (hash(fi + t) * 2.0 - 1.0) * 0.1;
        signal = (slow + fast + noise) * params.amplitude;
        if ((sin(fi * 0.02 + t) + sin(fi * 0.03 - t)) > (2.0 - params.spikeThreshold * 2.0)) {
            signal += params.amplitude;
        }
    } else {
        // CYBER MATH
        let carrier = sin(fi * 0.05 + t * params.frequency);
        let digi = sign(carrier) * pow(abs(carrier), 0.2);
        let noise = step(0.98, hash(fi * 0.01 + t * 0.5));
        signal = (digi * 0.1 + noise) * params.amplitude;
        if (signal > (1.0 - params.spikeThreshold)) {
            signal *= 2.0;
        } else {
            signal = 0.0;
        }
    }
    // Smoothing
    let smoothVal = select(params.smoothing, params.smoothing * 0.5, params.style > 0.5);
    let prev = tensorData[index];
    tensorData[index] = mix(prev, signal, 1.0 - smoothVal);
}
`;
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
    
    var spike = 0.0;
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

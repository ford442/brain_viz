// shaders.js
export const vertexShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding1: f32,
    padding2: f32,
}

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>, // Only used in solid mode
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

// Helper for Heatmap (Organic)
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
    var finalPos = input.position;
    var finalNormal = input.normal;
    var finalColor = vec3<f32>(0.0);
    
    // --- CONNECTOME MODE (Style 2) ---
    if (uniforms.style >= 2.0) {
        // In Fiber Mode, we have 2 vertices per fiber.
        // Even indices = Roots, Odd indices = Tips.
        let isTip = f32(vertexIndex % 2);
        let dataIndex = vertexIndex / 2; // Map pair to single data point
        
        // Safe data lookup
        let activity = tensorData[dataIndex % arrayLength(&tensorData)];
        
        // Calculate normal for fiber (approximate as direction from center)
        let normalDir = normalize(input.position);
        finalNormal = normalDir;
        
        // Animate the Tip
        if (isTip > 0.5) {
            // "Angular" radiation: Fibers grow based on activity
            // Length multiplier
            let length = 0.1 + (activity * 0.4); 
            
            // Add some "curl" or "flow" using sine waves on position
            let curl = vec3<f32>(
                sin(input.position.y * 10.0 + uniforms.time),
                cos(input.position.z * 10.0 + uniforms.time),
                sin(input.position.x * 10.0)
            ) * 0.05 * activity;
            
            finalPos = input.position + (normalDir * length) + curl;
            
            // Tip Color (Bright)
            // Color mapping based on direction (DTI style) or activity
            let dirColor = abs(normalDir); // RGB = XYZ direction
            finalColor = mix(dirColor, vec3<f32>(1.0, 1.0, 1.0), activity); 
        } else {
            // Root Color (Darker)
            finalColor = vec3<f32>(0.0, 0.0, 0.1); 
        }
        
        output.activity = activity;
        
    } else {
        // --- SOLID MODES (0 & 1) ---
        let dataIndex = vertexIndex % arrayLength(&tensorData);
        let activity = tensorData[dataIndex];
        
        var displacement = vec3<f32>(0.0);
        
        if (uniforms.style < 0.5) {
            // Organic
            displacement = input.normal * activity * activity * 0.4;
            finalColor = getHeatmapColor((activity + 0.2) * 0.8);
        } else {
            // Cyber
            let glitch = floor(activity * 5.0) / 5.0;
            displacement = input.normal * glitch * 0.6;
            finalColor = vec3<f32>(0.0, 0.2, 0.3);
        }
        
        finalPos = input.position + displacement;
        output.activity = activity;
    }

    // Common Transforms
    output.position = uniforms.mvpMatrix * vec4<f32>(finalPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(finalPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(finalNormal, 0.0)).xyz);
    output.color = finalColor;
    
    return output;
}
`;

export const fragmentShader = `
struct Uniforms {
    mvpMatrix: mat4x4<f32>,
    modelMatrix: mat4x4<f32>,
    time: f32,
    style: f32,
    padding: vec2<f32>,
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
    if (uniforms.style >= 2.0) {
        // --- CONNECTOME MODE ---
        // Glowing lines. Alpha fades based on activity to make inactive fibers subtle
        let alpha = 0.3 + (input.activity * 0.7);
        return vec4<f32>(input.color, alpha);
    }
    
    // ... (Keep existing Organic/Cyber logic from previous steps) ...
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    var finalColor = vec3<f32>(0.0);
    
    if (uniforms.style < 0.5) {
        // Organic
        let lightDir = normalize(vec3<f32>(0.5, 1.0, 0.5));
        let diffuse = max(dot(normal, lightDir), 0.0) * 0.8;
        let specular = pow(max(dot(viewDir, reflect(-lightDir, normal)), 0.0), 32.0) * 0.6;
        finalColor = input.color * (0.2 + diffuse) + specular + (input.color * max(input.activity,0.0)*0.5);
    } else {
        // Cyber
        let fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
        let rim = vec3<f32>(0.0, 0.8, 1.0);
        let spike = vec3<f32>(1.0, 0.0, 0.8) * max(input.activity, 0.0) * 2.5;
        finalColor = vec3<f32>(0.02) + (rim * fresnel) + spike;
    }
    return vec4<f32>(finalColor, 1.0);
}
`;
// Compute shader remains the same as previous steps
export const computeShader = `
struct TensorParams {
    time: f32, dataSize: u32, frequency: f32, amplitude: f32, 
    spikeThreshold: f32, smoothing: f32, style: f32, padding: f32
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
    
    // Universal Math (mix of styles for general data movement)
    let wave = sin(fi * 0.05 + t * params.frequency);
    let noise = hash(fi + t) * 2.0 - 1.0;
    
    if (params.style >= 2.0) {
        // Connectome math: Fast pulses
        let pulse = step(0.95, hash(fi * 0.01 + t * 2.0));
        signal = (wave * 0.2 + pulse) * params.amplitude;
    } else if (params.style < 0.5) {
        signal = (wave + noise * 0.1) * params.amplitude;
        if (sin(fi*0.02+t) > (2.0-params.spikeThreshold*2.0)) { signal += params.amplitude; }
    } else {
        signal = (sign(wave)*pow(abs(wave),0.2) * 0.1 + step(0.98, noise)) * params.amplitude;
        if (signal > (1.0 - params.spikeThreshold)) { signal *= 2.0; } else { signal = 0.0; }
    }
    
    let prev = tensorData[index];
    tensorData[index] = mix(prev, signal, 1.0 - params.smoothing);
}
`;

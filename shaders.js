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

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    var finalPos = input.position;
    var finalNormal = input.normal;
    var finalColor = vec3<f32>(0.0);
    
    // --- CONNECTOME MODE (Style 2) ---
    if (uniforms.style >= 2.0) {
        let isTip = f32(vertexIndex % 2);
        let dataIndex = vertexIndex / 2;
        let activity = tensorData[dataIndex % arrayLength(&tensorData)];
        
        let normalDir = normalize(input.position);
        
        if (isTip > 0.5) {
            let length = 0.1 + (activity * 0.4); 
            let curl = vec3<f32>(
                sin(input.position.y * 10.0 + uniforms.time),
                cos(input.position.z * 10.0 + uniforms.time),
                sin(input.position.x * 10.0)
            ) * 0.05 * activity;
            finalPos = input.position + (normalDir * length) + curl;
            finalColor = vec3<f32>(0.8, 0.9, 1.0) * (0.5 + activity * 0.5);
        } else {
            finalColor = vec3<f32>(0.1, 0.2, 0.3);
        }
        output.activity = activity;
        finalNormal = normalDir;
        
    } else {
        // --- TRANSPARENT OUTLINE MODE (Organic/Cyber) ---
        let dataIndex = vertexIndex % arrayLength(&tensorData);
        let activity = tensorData[dataIndex];
        
        // Use the activity to slightly pulse the position along normal
        let displacement = input.normal * activity * 0.02;
        
        finalPos = input.position + displacement;
        finalColor = vec3<f32>(0.2, 0.6, 1.0); // Base Cyan/Blue

        if (uniforms.style > 0.5) {
             // Cyber variation: Green/Teal
             finalColor = vec3<f32>(0.0, 0.9, 0.5);
        }

        output.activity = activity;
    }

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
        // Connectome fibers
        let alpha = 0.3 + (input.activity * 0.7);
        return vec4<f32>(input.color, alpha);
    }
    
    // --- GHOST / OUTLINE SHADER ---
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    
    // Fresnel
    let NdotV = abs(dot(normal, viewDir));
    let rim = pow(1.0 - NdotV, 2.5); // Slightly softer rim for more visibility

    // Alpha Calculation
    // Base alpha for the "surface" to ensure it's not invisible
    let baseAlpha = 0.1;

    // Rim alpha
    let rimAlpha = smoothstep(0.5, 1.0, rim);

    // Combine
    let finalAlpha = baseAlpha + rimAlpha * 0.8;

    // Color
    var col = input.color;

    // Highlights on Rim
    col += vec3<f32>(0.5) * rimAlpha;

    // Activity Glow on Rim
    let activityGlow = input.activity * 2.0;
    col += vec3<f32>(0.8, 0.4, 0.0) * activityGlow * rimAlpha;

    // Ensure we don't exceed 1.0 alpha logic visually if we want "mostly transparent"
    // But since we use OneMinusSrcAlpha, we just return correct alpha.

    return vec4<f32>(col, clamp(finalAlpha, 0.0, 1.0));
}
`;

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
    
    let wave = sin(fi * 0.05 + t * params.frequency);
    let noise = hash(fi + t) * 2.0 - 1.0;
    
    if (params.style >= 2.0) {
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

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
    
    // --- CONNECTOME / CIRCUIT MODE (Style 2) ---
    if (uniforms.style >= 2.0) {
        // In this mode, we draw LINE_LIST.
        // 2 vertices per segment. Data is mapped per segment (index/2).
        let dataIndex = vertexIndex / 2;
        let activity = tensorData[dataIndex % arrayLength(&tensorData)];
        
        // No displacement for circuits, they are rigid grid lines
        finalPos = input.position;

        // Color based on activity (Energy pulse)
        // Base color: Dark Gray/Blue
        // Active color: Bright Cyan/White
        let baseColor = vec3<f32>(0.05, 0.1, 0.15);
        let pulseColor = vec3<f32>(0.0, 0.8, 1.0);

        // Visualize the pulse
        finalColor = mix(baseColor, pulseColor, activity);
        
        output.activity = activity;
        finalNormal = vec3<f32>(0.0, 1.0, 0.0); // Dummy normal for lines
        
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
        // --- CIRCUIT LINES ---
        // Additive blending feel
        let alpha = 0.4 + (input.activity * 0.6);
        return vec4<f32>(input.color, alpha);
    }
    
    // --- GHOST / OUTLINE SHADER (Brain Shell) ---
    let normal = normalize(input.normal);
    let viewDir = normalize(vec3<f32>(0.0, 0.0, 5.0) - input.worldPos);
    
    // Fresnel
    let NdotV = abs(dot(normal, viewDir));
    // Sharp rim for "outline" look
    let rim = pow(1.0 - NdotV, 3.0);

    // Alpha Calculation
    // Very transparent base to see the circuits inside
    let baseAlpha = 0.02;

    // Rim alpha
    let rimAlpha = smoothstep(0.6, 1.0, rim);

    // Combine
    let finalAlpha = baseAlpha + rimAlpha * 0.5;

    // Color
    var col = input.color;

    // Highlights on Rim
    col += vec3<f32>(0.8) * rimAlpha;

    // Activity Glow on Rim
    let activityGlow = input.activity * 1.5;
    col += vec3<f32>(0.5, 0.8, 1.0) * activityGlow * rimAlpha;

    return vec4<f32>(col, clamp(finalAlpha, 0.0, 1.0));
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
        // --- CIRCUIT MODE ---
        // Discrete packets / pulses moving through the array

        // We simulate "packets" by checking if the index falls within a moving window
        // Since the geometry generates lines in spatial order (X loops, then Y loops, then Z),
        // sequential indices roughly correspond to spatial proximity or lines along an axis.

        // 1. Packet Movement Speed
        let speed = 20.0 * params.frequency;

        // 2. Multiple independent packet streams
        // Stream A
        let packetPosA = (t * speed) % f32(params.dataSize);
        var distA = abs(fi - packetPosA);
        // Handle wrap-around distance for smooth looping (optional, but good for array)
        let sizeF = f32(params.dataSize);
        if (distA > sizeF * 0.5) { distA = sizeF - distA; }

        let pulseA = exp(-distA * 0.1); // Sharp pulse

        // Stream B (Different speed/direction)
        let packetPosB = ((t + 10.0) * speed * 0.7) % f32(params.dataSize);
        let distB = abs(fi - packetPosB);
        let pulseB = exp(-distB * 0.1);

        // Stream C (Random bursts)
        let burstTime = floor(t * 2.0);
        let burstLoc = hash(burstTime) * sizeF;
        let distC = abs(fi - burstLoc);
        let burstAlpha = smoothstep(1.0, 0.0, (t * 2.0) - burstTime); // Fade out
        let pulseC = exp(-distC * 0.05) * burstAlpha;

        signal = (pulseA + pulseB + pulseC) * params.amplitude;

        // Hard clamp for "Digital" look
        if (signal > 0.1) { signal = 1.0; } else { signal = 0.0; }

    } else {
        // --- MEDICAL / ELECTRODE SIMULATION ---
        let center1 = f32(params.dataSize) * (0.5 + 0.4 * sin(t * 0.5));
        let center2 = f32(params.dataSize) * (0.5 + 0.4 * cos(t * 0.3));

        let d1 = abs(fi - center1);
        let d2 = abs(fi - center2);

        let width = 0.00005 * params.frequency;
        let activity1 = exp(-d1 * d1 * width);
        let activity2 = exp(-d2 * d2 * width);

        let alpha = sin(fi * 0.1 + t * 5.0) * 0.1;

        signal = (activity1 + activity2) * params.amplitude * 2.0 + alpha;

        if (signal < (1.0 - params.spikeThreshold)) {
            signal *= 0.1;
        }
    }

    // Temporal Smoothing
    let prev = tensorData[index];
    // Less smoothing in circuit mode for snappy digital look
    let smoothFactor = select(params.smoothing, 0.5, params.style >= 2.0);
    tensorData[index] = mix(prev, signal, 1.0 - smoothFactor);
}
`;

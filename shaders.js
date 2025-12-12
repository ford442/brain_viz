// Vertex shader
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
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> tensorData: array<f32>;

@vertex
fn main(input: VertexInput, @builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    
    // Get tensor value for this vertex (animated)
    let dataIndex = vertexIndex % arrayLength(&tensorData);
    let tensorValue = tensorData[dataIndex];
    
    // Apply tensor-based displacement
    let displacement = input.normal * tensorValue * 0.3;
    let animatedPos = input.position + displacement;
    
    // Transform position
    output.position = uniforms.modelViewProjectionMatrix * vec4<f32>(animatedPos, 1.0);
    output.worldPos = (uniforms.modelMatrix * vec4<f32>(animatedPos, 1.0)).xyz;
    output.normal = normalize((uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    
    // Color based on tensor value (gradient from blue to red)
    let t = (tensorValue + 1.0) * 0.5; // normalize to 0-1
    output.color = mix(vec3<f32>(0.2, 0.4, 1.0), vec3<f32>(1.0, 0.3, 0.2), t);
    
    return output;
}
`;

// Fragment shader
export const fragmentShader = `
struct FragmentInput {
    @location(0) worldPos: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) color: vec3<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Simple lighting
    let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    let normal = normalize(input.normal);
    
    let ambient = 0.3;
    let diffuse = max(dot(normal, lightDir), 0.0) * 0.7;
    let lighting = ambient + diffuse;
    
    let finalColor = input.color * lighting;
    
    return vec4<f32>(finalColor, 1.0);
}
`;

// Compute shader for tensor data animation
export const computeShader = `
struct TensorParams {
    time: f32,
    dataSize: u32,
    frequency: f32,
    amplitude: f32,
}

@group(0) @binding(0) var<storage, read_write> tensorData: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    
    if (index >= params.dataSize) {
        return;
    }
    
    // Generate animated tensor field
    let fi = f32(index);
    let t = params.time;
    
    // Create complex wave patterns
    let wave1 = sin(fi * 0.1 + t * params.frequency) * params.amplitude;
    let wave2 = cos(fi * 0.05 - t * params.frequency * 0.7) * params.amplitude * 0.5;
    let wave3 = sin(fi * 0.15 + t * params.frequency * 1.3) * params.amplitude * 0.3;
    
    // Combine waves to create flowing tensor field
    tensorData[index] = wave1 + wave2 + wave3;
}
`;

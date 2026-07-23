export const synaptixBridgeVertexShader = `
struct BridgeUniforms { mvpMatrix: mat4x4<f32>, }
@group(0) @binding(0) var<uniform> uniforms: BridgeUniforms;

struct Input {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
}
struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
}

@vertex fn main(input: Input) -> Output {
    var output: Output;
    output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
    output.color = input.color;
    return output;
}`;

export const synaptixBridgeFragmentShader = `
@fragment fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color, clamp(max(color.r, max(color.g, color.b)), 0.08, 0.9));
}`;

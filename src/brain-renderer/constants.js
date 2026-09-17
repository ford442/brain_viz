export const UNIFORM_BUFFER_ALIGNMENT = 256;

// Number of f32s updateUniforms() writes into the render uniform buffer each
// frame. Single source of truth: src/brain-renderer/uniforms.js imports this,
// and it is validated against the Uniforms struct in shaders.js by
// assertShaderUniformsMatch() in src/shaders/uniform-layout.js.
export const RENDER_UNIFORM_FLOAT_COUNT = 100;

// 100 floats = 400 bytes, rounded up to the 256-byte uniform binding alignment.
export const RENDER_UNIFORM_BUFFER_SIZE = Math.ceil(
    (RENDER_UNIFORM_FLOAT_COUNT * Float32Array.BYTES_PER_ELEMENT) / UNIFORM_BUFFER_ALIGNMENT
) * UNIFORM_BUFFER_ALIGNMENT;

export const COMPUTE_UNIFORM_BUFFER_SIZE = 176;

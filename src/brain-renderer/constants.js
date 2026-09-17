import {
    RENDER_UNIFORM_BYTE_SIZE,
    RENDER_UNIFORM_FLOAT_COUNT as LAYOUT_RENDER_UNIFORM_FLOAT_COUNT,
    COMPUTE_UNIFORM_BYTE_SIZE,
} from '../shaders/uniform-layout.js';

export const UNIFORM_BUFFER_ALIGNMENT = 256;

// Number of f32s updateUniforms() writes into the render uniform buffer each
// frame. Derived from the generated render `Uniforms` struct in
// src/shaders/uniform-layout.js — there is no hand-maintained float count.
export const RENDER_UNIFORM_FLOAT_COUNT = LAYOUT_RENDER_UNIFORM_FLOAT_COUNT;

// The struct's own size, rounded up to the 256-byte uniform binding alignment.
export const RENDER_UNIFORM_BUFFER_SIZE = Math.ceil(
    RENDER_UNIFORM_BYTE_SIZE / UNIFORM_BUFFER_ALIGNMENT
) * UNIFORM_BUFFER_ALIGNMENT;

// Compute `TensorParams` is bound as a whole struct, so its exact generated
// size is the buffer size (no 256-byte rounding needed for a uniform buffer
// that is bound at offset 0 with its full range).
export const COMPUTE_UNIFORM_BUFFER_SIZE = COMPUTE_UNIFORM_BYTE_SIZE;

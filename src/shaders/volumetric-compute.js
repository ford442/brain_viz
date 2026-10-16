// src/shaders/volumetric-compute.js
// [Neuro-Weaver] Compute shader updating the volumetric tensor buffer (signal propagation/diffusion).
// Split out of the former monolithic shaders.js.
import { CONSTANTS, HELPERS, VOXEL_DIM_FROM_PARAMS } from './render-shared.js';
import { TENSOR_PARAMS_STRUCT_WGSL } from './uniform-layout.js';
import { fieldStepWGSL, COARSE_FIELD_STEP, FIELD_STEP_HELPERS } from './field-step.js';

export const computeShader = `
// V3.2 Compute Logic: Multi-direction fiber-coupled diffusion
${CONSTANTS}
${VOXEL_DIM_FROM_PARAMS}
${HELPERS}
${FIELD_STEP_HELPERS}

${TENSOR_PARAMS_STRUCT_WGSL}

// [Tensor Physics] §6: the step reads activityTensor and writes nextTensor;
// the renderer copies nextTensor back into the field buffer after the pass.
@group(0) @binding(0) var<storage, read> activityTensor: array<f32>;
@group(0) @binding(1) var<uniform> params: TensorParams;
@group(0) @binding(2) var<storage, read> fiberDirections: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> aiTensor: array<f32>;
@group(0) @binding(4) var<storage, read_write> nextTensor: array<f32>;

fn getIndex(x: u32, y: u32, z: u32) -> u32 {
    return z * params.voxelDim * params.voxelDim + y * params.voxelDim + x;
}

fn indexToWorld(index: u32, dim: u32) -> vec3<f32> {
    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;
    let normalizedPosition = vec3<f32>(f32(x), f32(y), f32(z)) / f32(dim);
    return (normalizedPosition * 2.0 - 1.0) * BRAIN_RANGE;
}

fn worldToIndex(worldPosition: vec3<f32>, dim: u32) -> u32 {
    let normalized = clamp((worldPosition / BRAIN_RANGE) * 0.5 + 0.5, vec3<f32>(0.0), vec3<f32>(0.99999));
    let x = u32(normalized.x * f32(dim));
    let y = u32(normalized.y * f32(dim));
    let z = u32(normalized.z * f32(dim));
    return getIndex(x, y, z);
}

fn sampleAIActivation(worldPosition: vec3<f32>, dim: u32) -> f32 {
    return aiTensor[worldToIndex(worldPosition, dim)];
}

// [V3.2] Read 3 fiber affinities for a voxel: each vec4 = (dir.xyz, weight)
fn getFiberAffinity(index: u32, slot: u32) -> vec4<f32> {
    return fiberDirections[index * 3u + slot];
}

fn sampleDirectionalActivity(worldPosition: vec3<f32>, axis: vec3<f32>, step: f32) -> f32 {
    let axisN = normalize(axis + vec3<f32>(0.0001, 0.0001, 0.0001));
    let center = getVoxelValue(worldPosition);
    let forward = getVoxelValue(worldPosition + axisN * step);
    let backward = getVoxelValue(worldPosition - axisN * step);
    return center * 0.34 + max(forward, backward) * 0.46 + min(forward, backward) * 0.20;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    let dim = params.voxelDim;
    let total = dim * dim * dim;
    
    if (index >= total) { return; }

    let z = index / (dim * dim);
    let rem = index % (dim * dim);
    let y = rem / dim;
    let x = rem % dim;

${fieldStepWGSL(COARSE_FIELD_STEP)}
}
`;

// [Phase 7] Post-Processing Shaders


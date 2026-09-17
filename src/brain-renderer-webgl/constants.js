// [Tensor Physics] Re-exported rather than redeclared: the fallback renderer
// and the neural field must agree on the world extent to the last bit. The
// physics module holds it as the float32 value of 1.6, because world
// coordinates get quantised to voxel indices and `a * 1.6` (double) picks a
// different voxel from `a * 1.6f` near a cell boundary — see
// docs/tensor-physics.md §8.3.
export { BRAIN_RANGE } from '../physics/tensor-field.js';

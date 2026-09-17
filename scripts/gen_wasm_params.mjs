#!/usr/bin/env node
// scripts/gen_wasm_params.mjs
// [Tensor Physics] Regenerates wasm/brain_tensor_params.h — the C ABI mirror of
// the WGSL `TensorParams` struct — from COMPUTE_UNIFORM_LAYOUT.
//
//   node scripts/gen_wasm_params.mjs          # write the header
//   node scripts/gen_wasm_params.mjs --check  # exit 1 if it is out of date
//
// tests/test_uniform_layout.js performs the --check comparison in `npm test`,
// so a layout edit that is not regenerated fails the build instead of silently
// mismatching the WASM ABI.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { generateTensorParamsHeader } from '../src/shaders/uniform-layout.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(repoRoot, 'wasm', 'brain_tensor_params.h');
const expected = generateTensorParamsHeader();

if (process.argv.includes('--check')) {
    let actual = null;
    try {
        actual = readFileSync(target, 'utf8');
    } catch {
        console.error('[gen_wasm_params] wasm/brain_tensor_params.h is missing. Run: node scripts/gen_wasm_params.mjs');
        process.exit(1);
    }
    if (actual !== expected) {
        console.error('[gen_wasm_params] wasm/brain_tensor_params.h is stale. Run: node scripts/gen_wasm_params.mjs');
        process.exit(1);
    }
    console.log('[gen_wasm_params] header is up to date.');
} else {
    writeFileSync(target, expected);
    console.log(`[gen_wasm_params] wrote ${target}`);
}

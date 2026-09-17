#!/usr/bin/env node
// scripts/gen_compile_commands.mjs
// [Tensor Physics] Emits compile_commands.json for wasm/ so clangd can analyse
// the C++ engine. Before this, editors had no compile graph for the directory
// at all: no diagnostics, no navigation, no idea that brain_tensor_params.h is
// generated.
//
//   node scripts/gen_compile_commands.mjs
//
// The flags mirror scripts/wasm_flags.sh minus the Emscripten `-s` linker
// settings, which clangd does not understand. wasm/compile_flags.txt carries
// the same set for editors that prefer it and needs no generation step.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const flags = ['-std=c++17', '-Wall', '-Wextra', `-I${join(repoRoot, 'wasm')}`];

const entries = [
    { file: join(repoRoot, 'wasm', 'brain_tensor_engine.cpp'), output: 'brain_tensor_engine.o' },
    { file: join(repoRoot, 'wasm', 'tests', 'golden_step_test.cpp'), output: 'golden_step_test.o' },
].map(({ file, output }) => ({
    directory: repoRoot,
    file,
    output,
    arguments: ['c++', ...flags, '-c', file, '-o', output],
}));

const target = join(repoRoot, 'compile_commands.json');
writeFileSync(target, JSON.stringify(entries, null, 2) + '\n');
console.log(`[gen_compile_commands] wrote ${target} (${entries.length} translation units)`);

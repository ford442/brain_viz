#!/usr/bin/env node
// scripts/gen_compile_commands.mjs
// [Tensor Physics] Emits wasm/compile_commands.json so clangd can analyse the
// C++ engine with the flags it is really built with.
//
//   node scripts/gen_compile_commands.mjs               # host graph (no em++ needed)
//   node scripts/gen_compile_commands.mjs --emscripten  # wasm32 + simd128 graph
//   (npm run gen:compile-commands / gen:compile-commands:wasm)
//
// Two graphs, because the engine has two compilers:
//
//   host        BTE_HOST_FLAGS — exactly what scripts/test_golden.sh compiles
//               with, -ffp-contract=off included. Needs nothing but node and
//               bash. src/stencil.cpp's SIMD branch reads as inactive.
//   emscripten  BTE_CLANG_FLAGS + BTE_TARGET_FLAGS, plus the target/sysroot
//               flags `em++ --cflags` reports, so clangd sees __EMSCRIPTEN__,
//               __wasm_simd128__ and <wasm_simd128.h>. Needs emsdk: em++ on
//               PATH or $EMSDK set. scripts/build_wasm.sh writes this one.
//
// Both read the source list and flags from scripts/wasm_flags.sh (via bash), so
// there is no second copy here to drift. Emscripten's `-s` settings are
// link-time and are deliberately absent — clangd does not understand them.
//
// The file lands in wasm/, not the repo root: clangd uses the nearest
// directory with a compile_commands.json *or* compile_flags.txt, so a
// root-level file is shadowed by the checked-in wasm/compile_flags.txt. In
// wasm/ it takes precedence over compile_flags.txt instead, and a fresh clone
// with neither generated still gets compile_flags.txt. Gitignored (absolute
// paths).
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const emscripten = process.argv.includes('--emscripten');

/** Read the named bash arrays out of scripts/wasm_flags.sh. */
function readWasmFlags(names) {
    const script = [
        'set -euo pipefail',
        'source "$REPO_ROOT/scripts/wasm_flags.sh" 2>/dev/null',
        ...names.map((n) => `printf '%s\\0' "@@${n}" "\${${n}[@]}"`),
    ].join('\n');
    const out = execFileSync('bash', ['-c', script], {
        env: { ...process.env, REPO_ROOT: repoRoot, WASM_PTHREADS: '0' },
        encoding: 'utf8',
    });
    const arrays = {};
    let current = null;
    for (const token of out.split('\0').slice(0, -1)) {
        if (token.startsWith('@@')) arrays[(current = token.slice(2))] = [];
        else arrays[current].push(token);
    }
    return arrays;
}

/** em++ on PATH, else under $EMSDK; null if neither. */
function findEmxx() {
    const candidates = [];
    try {
        candidates.push(execFileSync('bash', ['-c', 'command -v em++'], { encoding: 'utf8' }).trim());
    } catch { /* not on PATH */ }
    if (process.env.EMSDK) candidates.push(join(process.env.EMSDK, 'upstream', 'emscripten', 'em++'));
    return candidates.find((c) => c && existsSync(c)) ?? null;
}

const flags = readWasmFlags(['BTE_SRCS', 'BTE_GOLDEN_SRC', 'BTE_BENCH_SRC',
    'BTE_HOST_FLAGS', 'BTE_CLANG_FLAGS', 'BTE_TARGET_FLAGS']);
const files = [...flags.BTE_SRCS, ...flags.BTE_GOLDEN_SRC, ...flags.BTE_BENCH_SRC];

let compiler;
let args;
if (emscripten) {
    const emxx = findEmxx();
    if (!emxx) {
        console.error('[gen_compile_commands] --emscripten needs em++ on PATH or $EMSDK set. ' +
            'Without emsdk, run with no flag for the host graph.');
        process.exit(1);
    }
    // The flags em++ adds before handing off to clang: -target, --sysroot and
    // the sysroot include dirs. Asking em++ keeps this right across emsdk
    // versions instead of hard-coding a sysroot layout.
    const emCflags = execFileSync(emxx, ['--cflags'], { encoding: 'utf8' }).trim().split(/\s+/);
    // Name em++'s own clang++ as the compiler, so clangd's driver-mode and
    // resource-dir inference sees a clang, not a python wrapper.
    const clangxx = join(dirname(emxx), '..', 'bin', 'clang++');
    compiler = existsSync(clangxx) ? clangxx : 'clang++';
    args = [...emCflags, ...flags.BTE_CLANG_FLAGS, ...flags.BTE_TARGET_FLAGS];
} else {
    compiler = 'c++';
    args = flags.BTE_HOST_FLAGS;
}

const entries = files.map((file) => {
    const output = relative(repoRoot, file).replace(/[\\/]/g, '_').replace(/\.cpp$/, '.o');
    return {
        directory: repoRoot,
        file,
        output,
        arguments: [compiler, ...args, '-c', file, '-o', output],
    };
});

const target = join(repoRoot, 'wasm', 'compile_commands.json');
writeFileSync(target, JSON.stringify(entries, null, 2) + '\n');
console.log(`[gen_compile_commands] wrote ${relative(repoRoot, target)} — ` +
    `${emscripten ? 'emscripten (wasm32, simd128)' : 'host (golden-test flags)'} graph, ` +
    `${entries.length} translation units`);

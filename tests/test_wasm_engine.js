// tests/test_wasm_engine.js
// [Tensor Physics] Pins the WASM engine's build contract — the parts that can
// be checked with no Emscripten and no browser.
//
// What this guards:
//   1. A pthreads build is refused, with a reason that names the missing
//      COOP/COEP headers, whenever the page is not cross-origin isolated; a
//      default (single-threaded) or pre-manifest build is never refused.
//   2. scripts/wasm_flags.sh lists every engine TU in wasm/src/, so a new
//      spec-section file cannot be compiled by the golden test's glob of habit
//      but silently left out of the shipped .wasm (or vice versa).
//   3. The flags that hold the golden epsilon stay where they are: no relaxed
//      SIMD, -ffp-contract=off in the shared clang flags *and* in the clangd
//      fallback a fresh clone uses.
//   4. The docs no longer tell the next agent to "turn on -msimd128", and
//      describe the release build that actually ships (O3/LTO, .mjs glue).

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wasmBuildRefusal } from '../src/wasm-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

// ── 1. Threads vs cross-origin isolation ────────────────────────────────────
assert.equal(wasmBuildRefusal(null, false), null, 'a build without a manifest predates pthreads and must load');
assert.equal(wasmBuildRefusal({ simd128: true, pthreads: false }, false), null);
assert.equal(wasmBuildRefusal({ simd128: true, pthreads: true }, true), null);
const refusal = wasmBuildRefusal({ simd128: true, pthreads: true }, false);
assert.ok(refusal, 'a pthreads build on a non-isolated page must be refused before import');
assert.match(refusal, /Cross-Origin-Opener-Policy: same-origin/);
assert.match(refusal, /Cross-Origin-Embedder-Policy: require-corp/);

// ── 2. Every engine TU is built ─────────────────────────────────────────────
const flags = read('scripts/wasm_flags.sh');
for (const file of readdirSync(join(root, 'wasm', 'src')).filter((f) => f.endsWith('.cpp'))) {
    assert.ok(flags.includes(`/wasm/src/${file}"`),
        `wasm/src/${file} is not in BTE_SRCS (scripts/wasm_flags.sh) — it would be missing from the .wasm`);
}
assert.ok(flags.includes('/wasm/brain_tensor_engine.cpp"'), 'the C ABI TU must be in BTE_SRCS');
assert.ok(/"_bte_build_features"/.test(flags), 'bte_build_features must be exported');

// ── 3. The flags the golden epsilon depends on ──────────────────────────────
const activeFlagLines = flags.split('\n').filter((l) => !l.trim().startsWith('#'));
assert.ok(!activeFlagLines.some((l) => l.includes('-mrelaxed-simd')),
    '-mrelaxed-simd allows FMA and breaks the golden epsilon (src/stencil.cpp relies on no FMA)');
const clangFlags = flags.slice(flags.indexOf('BTE_CLANG_FLAGS=('), flags.indexOf('BTE_HOST_FLAGS=('));
assert.ok(clangFlags.includes('-ffp-contract=off'), '-ffp-contract=off must be in BTE_CLANG_FLAGS, shared by every graph');
const fallback = read('wasm/compile_flags.txt').split('\n').filter((l) => !l.startsWith('#'));
assert.ok(fallback.includes('-ffp-contract=off'), 'wasm/compile_flags.txt must carry -ffp-contract=off');
assert.ok(fallback.includes('-std=c++17'));

// ── 4. No stale "-msimd128 is not on" advice ────────────────────────────────
for (const doc of ['docs/field-resolution.md', 'docs/wasm-engine.md', 'docs/webgl-fallback.md']) {
    const text = read(doc);
    assert.ok(!/-msimd128` is not yet on/.test(text) && !/without `-msimd128`/.test(text),
        `${doc} still says -msimd128 is off; it is on (scripts/wasm_flags.sh) — the open item is kernels/threads`);
}
const wasmDoc = read('docs/wasm-engine.md');
assert.ok(wasmDoc.includes('brain_tensor_engine.mjs') && wasmDoc.includes('-O3 -flto -msimd128'),
    'docs/wasm-engine.md must describe the release build in scripts/wasm_flags.sh');

console.log('test_wasm_engine passed');

// tests/test_wgsl_naga.js
// [Tensor Physics] Parse and validate every WGSL source the renderer compiles,
// with naga — docs/tensor-physics.md §9.1.
//
// The other shader tests are string greps: they can tell that a struct was
// generated or that no reserved word is declared, but not that the shader is
// valid WGSL. Until now the first real validator a shader met was the
// browser's, at createShaderModule()/create*Pipeline() time — which is how
// `let target = …` shipped in the immune shader. naga is a full WGSL front end
// and validator (types, address spaces, uniformity), so this catches that whole
// class in Node, without a GPU.
//
// naga is a dev tool, not a dependency: `cargo install naga-cli`, or point
// $NAGA at a binary. Without one this test says loudly that WGSL was NOT
// validated and exits 0 (the posture `npm run test:golden` takes without a C++
// compiler) — unless REQUIRE_NAGA=1, which makes the skip a failure.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Every exported string in src/shaders/*.js that declares an entry point. */
async function collectWgslSources() {
    const shaderDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shaders');
    const sources = [];
    for (const file of readdirSync(shaderDir).filter((f) => f.endsWith('.js')).sort()) {
        const mod = await import(pathToFileURL(join(shaderDir, file)).href);
        for (const [name, value] of Object.entries(mod)) {
            if (typeof value === 'string' && /@(vertex|fragment|compute)\b/.test(value)) {
                sources.push({ id: `${file}:${name}`, file: `${file.replace(/\.js$/, '')}__${name}.wgsl`, code: value });
            }
        }
    }
    return sources;
}

/** $NAGA, then `naga` on PATH, then cargo's default install location. */
function findNaga() {
    const candidates = [process.env.NAGA, 'naga', join(homedir(), '.cargo', 'bin', 'naga')].filter(Boolean);
    for (const bin of candidates) {
        if (bin.includes('/') && !existsSync(bin)) continue;
        const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' });
        if (probe.status === 0) return { bin, version: probe.stdout.trim() };
    }
    return null;
}

const sources = await collectWgslSources();
assert.ok(sources.length > 15, `expected to find the WGSL entry-point sources, found ${sources.length}`);

const naga = findNaga();
if (!naga) {
    const banner = [
        '',
        '!!! test_wgsl_naga SKIPPED — naga not found. WGSL was NOT validated. !!!',
        `!!! ${sources.length} shader sources went unchecked. Install: cargo install naga-cli`,
        '!!! (or set $NAGA). Set REQUIRE_NAGA=1 to make this a failure.',
        '',
    ].join('\n');
    console.warn(banner);
    if (process.env.REQUIRE_NAGA === '1') {
        console.error('[test_wgsl_naga] REQUIRE_NAGA=1 and naga is missing.');
        process.exit(1);
    }
    process.exit(0);
}

const workDir = mkdtempSync(join(tmpdir(), 'wgsl-naga-'));
const failures = [];
try {
    for (const { id, file, code } of sources) {
        const path = join(workDir, file);
        writeFileSync(path, code);
        // With only an input file, naga parses and validates and writes nothing.
        const result = spawnSync(naga.bin, [path], { encoding: 'utf8' });
        if (result.status !== 0) {
            failures.push(`${id}\n${(result.stderr || result.stdout || '').trim()}`);
        }
    }
} finally {
    rmSync(workDir, { recursive: true, force: true });
}

assert.equal(
    failures.length, 0,
    `naga rejected ${failures.length} of ${sources.length} WGSL sources. Each would fail ` +
    `createShaderModule() in the browser:\n\n${failures.join('\n\n')}`
);
console.log(`test_wgsl_naga passed (${sources.length} WGSL sources validated by naga ${naga.version.replace(/^naga\s*/i, "")})`);

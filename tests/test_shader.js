import assert from 'node:assert/strict';
import { BrainGeometry } from '../src/brain-geometry.js';
import { vertexShader, fragmentShader, fiberVertexShader, fiberFragmentShader } from '../src/shaders.js';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const geometry = new BrainGeometry();
geometry.generate(24, 24);

const fibers = geometry.getFiberData();
const metadata = geometry.getFiberDataWithMetadata();

assert.ok(fibers.length > 0, 'fibers should be generated');
assert.ok(metadata.length > 0, 'fiber metadata should be generated');
assert.equal(
  metadata.length / 4,
  fibers.length / 3,
  'fiber metadata must align 1:1 with fiber vertices'
);

let minRadius = Number.POSITIVE_INFINITY;
let maxRadius = 0;
let minMyelin = Number.POSITIVE_INFINITY;
let maxMyelin = 0;

for (let i = 0; i < metadata.length; i += 4) {
  const radius = metadata[i + 0];
  const myelin = metadata[i + 2];
  assert.ok(radius > 0, `radius must be > 0 (got ${radius})`);
  assert.ok(myelin >= 0 && myelin <= 1, `myelin must be in [0,1] (got ${myelin})`);
  minRadius = Math.min(minRadius, radius);
  maxRadius = Math.max(maxRadius, radius);
  minMyelin = Math.min(minMyelin, myelin);
  maxMyelin = Math.max(maxMyelin, myelin);
}

assert.ok(maxRadius > minRadius * 1.5, 'fibers should have clear radius hierarchy');
assert.ok(maxMyelin > minMyelin + 0.2, 'fibers should have distinct myelin levels');

assert.ok(fiberVertexShader.includes('effectiveMyelin'), 'fiber vertex shader should use myelin in connectome shading');
assert.ok(fiberVertexShader.includes('conductionSpeed'), 'fiber vertex shader should vary pulse conduction speed');
assert.ok(fiberFragmentShader.includes('glowLuma'), 'fiber fragment shader should derive alpha from hierarchical fiber brightness');

// [Clipmap] WGSL reserved words. Tint (Chrome) refuses a shader that uses one
// as an identifier, but nothing here would notice until a pipeline fails to
// build in the browser: the immune shader shipped `let target = …` that way,
// which invalidated its pipeline on current Chrome, and `meta` nearly shipped
// in the cortical patch. Scan every WGSL source in src/shaders/ for declared
// names (let/var/const, fn and struct names, `name: type` members and params).

// WGSL §15.4 "Reserved Words" (identifiers reserved for future use).
const WGSL_RESERVED = new Set(`NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto
await become cast catch class co_await co_return co_yield coherent column_major common compile
compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote
demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final
finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface
layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept
noinline nointerpolation non_coherent noncoherent noperspective null nullptr of operator package
packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public
readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth
snorm static static_assert static_cast std subroutine super target template this thread_local throw
trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual
volatile wgsl where with writeonly yield`.split(/\s+/));

const shaderDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shaders');
const wgslSources = [];
for (const file of readdirSync(shaderDir).filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(join(shaderDir, file)).href);
    for (const [name, value] of Object.entries(mod)) {
        if (typeof value === 'string' && /@(vertex|fragment|compute)\b/.test(value)) wgslSources.push([`${file}:${name}`, value]);
    }
}
assert.ok(wgslSources.length > 15, 'expected to find the WGSL entry-point sources');
const DECLARATION_PATTERNS = [
    /\b(?:let|const|override)\s+([A-Za-z_]\w*)/g,
    /\bvar(?:<[^>]*>)?\s+([A-Za-z_]\w*)/g,
    /\bfn\s+([A-Za-z_]\w*)/g,
    /\bstruct\s+([A-Za-z_]\w*)/g,
    /\b([A-Za-z_]\w*)\s*:\s*(?:vec|mat|array|texture|sampler|ptr|atomic|f32|f16|i32|u32|bool|[A-Z])/g,
];
for (const [name, source] of wgslSources) {
    const code = source.replace(/\/\/[^\n]*/g, '');
    for (const pattern of DECLARATION_PATTERNS) {
        for (const match of code.matchAll(pattern)) {
            assert.ok(!WGSL_RESERVED.has(match[1]),
                `${name} declares '${match[1]}', a WGSL reserved word — Chrome rejects the whole shader module`);
        }
    }
}
console.log(`test_shader passed (${wgslSources.length} WGSL sources free of reserved identifiers)`);

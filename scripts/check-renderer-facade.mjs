#!/usr/bin/env node
// scripts/check-renderer-facade.mjs
// [Neuro-Weaver] Mixin-aware guard for the renderer contract.
//
// BrainRenderer (WebGPU) and BrainRendererWebGL assemble most of their public
// surface from applyXMethods(Target) mixins spread across many files, which
// hides missing methods from both code review and `tsc --noEmit` (a JSDoc
// `@implements` check needs everything declared in the class body itself —
// see the comments on both classes in brain-renderer.js / brain-renderer-webgl.js
// for why that isn't used here). This script is the documented fallback: it
// statically greps every source file that contributes to each backend for
// the method names declared in `BrainRendererFacade`
// (src/renderer-contract.js) and fails if either backend is missing one.
//
// Run directly: node scripts/check-renderer-facade.mjs
// Wired into: npm run check:facade (and npm test).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relPath) => readFileSync(join(ROOT, relPath), 'utf8');

/**
 * Every source file whose top-level `applyXMethods()` mixin calls (or class
 * body) can attach a method onto the given backend's renderer class. Keep in
 * sync with the `import`/`applyXMethods(...)` lines in brain-renderer.js and
 * brain-renderer-webgl.js — this list is intentionally explicit rather than
 * "every file in the directory" so an unrelated helper file never silently
 * counts as satisfying the contract.
 */
const BACKENDS = {
    webgpu: {
        label: 'BrainRenderer (WebGPU, brain-renderer.js)',
        files: [
            'src/brain-renderer.js',
            'src/brain-renderer/pipelines.js',
            'src/brain-renderer/geometry.js',
            'src/brain-renderer/stimulus.js',
            'src/brain-renderer/uniforms.js',
            'src/brain-renderer/render-loop.js',
            'src/brain-renderer/core-methods.js',
            'src/brain-renderer/synaptix-bridges.js',
            'src/pathway-renderer.js'
        ]
    },
    webgl: {
        label: 'BrainRendererWebGL (WebGL2 fallback, brain-renderer-webgl.js)',
        files: [
            'src/brain-renderer-webgl.js',
            'src/brain-renderer-webgl/geometry.js',
            'src/brain-renderer-webgl/immune.js',
            'src/brain-renderer-webgl/state.js',
            'src/brain-renderer-webgl/tensor-sim.js',
            'src/brain-renderer-webgl/dynamic-buffers.js',
            'src/brain-renderer-webgl/draw.js',
            'src/brain-renderer-webgl/lifecycle.js',
            'src/pathway-renderer.js'
        ]
    }
};

/**
 * Pull every method name out of the `BrainRendererFacade` typedef: JSDoc
 * `@property {(...) => ...} name` lines (function-typed properties only —
 * plain data properties like `canvas` or `params` aren't part of either
 * backend's method surface and are skipped).
 * @returns {string[]}
 */
function extractFacadeMethods() {
    const text = read('src/renderer-contract.js');
    const methods = [];
    for (const line of text.split('\n')) {
        const m = line.match(/@property\s+\{(.*)\}\s+([a-zA-Z0-9_]+)(?:\s*-|\s*$)/);
        if (!m) continue;
        const [, type, name] = m;
        if (type.includes('=>')) methods.push(name);
    }
    if (methods.length === 0) {
        throw new Error('extractFacadeMethods() found zero methods — did the @property format in renderer-contract.js change?');
    }
    return methods;
}

/**
 * True if `name` is defined somewhere in `files`, as either a
 * `Target.prototype.name = ...` / `Klass.prototype.name = ...` mixin
 * assignment or a class/object-literal method shorthand `name(...) {`.
 * @param {string} name
 * @param {string[]} files
 */
function isImplemented(name, files) {
    const prototypeAssign = new RegExp(`\\bprototype\\.${name}\\s*=`);
    const methodShorthand = new RegExp(`^\\s*(?:async\\s+)?${name}\\s*\\(`, 'm');
    return files.some((file) => {
        const text = read(file);
        return prototypeAssign.test(text) || methodShorthand.test(text);
    });
}

function main() {
    const facadeMethods = extractFacadeMethods();
    /** @type {string[]} */
    const failures = [];

    for (const [key, backend] of Object.entries(BACKENDS)) {
        const missing = facadeMethods.filter((name) => !isImplemented(name, backend.files));
        if (missing.length > 0) {
            failures.push(`${backend.label} is missing: ${missing.join(', ')}`);
        }
    }

    if (failures.length > 0) {
        console.error(`[check-renderer-facade] ${facadeMethods.length} facade methods checked. FAILED:\n`);
        for (const failure of failures) console.error(`  - ${failure}`);
        console.error('\nEvery method in BrainRendererFacade (src/renderer-contract.js) must exist on');
        console.error('both backends — see docs/webgl-fallback.md for how to add the WebGL2 side of a');
        console.error('WebGPU-only feature (or vice versa).');
        process.exit(1);
    }

    console.log(`[check-renderer-facade] OK — ${facadeMethods.length} facade methods present on both backends.`);
}

main();

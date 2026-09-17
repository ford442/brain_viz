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
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (relPath) => readFileSync(join(ROOT, relPath), 'utf8');

/**
 * Every source file whose top-level `applyXMethods()` mixin calls (or class
 * body) can attach a method onto the given backend's renderer class. Keep in
 * sync with the `import`/`applyXMethods(...)` lines in brain-renderer.js and
 * brain-renderer-webgl.js — this list is intentionally explicit rather than
 * "every file in the directory" so an unrelated helper file never silently
 * counts as satisfying the contract. `resolveLiveMixinFiles()` below verifies
 * this list against the entry point's actual import/invoke graph on every
 * run, so a stale entry (a file listed here whose applyXMethods() call was
 * since removed from the entry point) is a hard failure rather than a
 * method search that silently keeps trusting a mixin nothing attaches
 * anymore.
 */
const BACKENDS = {
    webgpu: {
        label: 'BrainRenderer (WebGPU, brain-renderer.js)',
        entryFile: 'src/brain-renderer.js',
        files: [
            'src/brain-renderer.js',
            'src/brain-renderer/pipelines.js',
            'src/brain-renderer/geometry.js',
            'src/brain-renderer/stimulus.js',
            'src/brain-renderer/uniforms.js',
            'src/brain-renderer/render-loop.js',
            'src/brain-renderer/core-methods.js',
            'src/brain-renderer/synaptix-bridges.js',
            'src/brain-renderer/resolution.js',
            'src/pathway-renderer.js'
        ]
    },
    webgl: {
        label: 'BrainRendererWebGL (WebGL2 fallback, brain-renderer-webgl.js)',
        entryFile: 'src/brain-renderer-webgl.js',
        files: [
            'src/brain-renderer-webgl.js',
            'src/brain-renderer-webgl/geometry.js',
            'src/brain-renderer-webgl/immune.js',
            'src/brain-renderer-webgl/state.js',
            'src/brain-renderer-webgl/tensor-sim.js',
            'src/brain-renderer-webgl/dynamic-buffers.js',
            'src/brain-renderer-webgl/draw.js',
            'src/brain-renderer-webgl/lifecycle.js',
            'src/brain-renderer-webgl/resolution.js',
            'src/pathway-renderer.js'
        ]
    }
};

/**
 * Parse `entryFile` for `import { applyFoo } from './bar.js'` plus a
 * top-level `applyFoo(SomeClass);` call, and resolve each to a repo-relative
 * path (POSIX-style, matching how BACKENDS.files spells it). This is the
 * actual "what does this backend's prototype get built from" graph — the
 * static `files` list above is expected to equal it exactly.
 * @param {string} entryFile
 * @returns {Set<string>}
 */
function resolveLiveMixinFiles(entryFile) {
    const text = read(entryFile);
    const entryDir = posix.dirname(entryFile);

    /** @type {Map<string, string>} imported identifier -> repo-relative file path */
    const importedFrom = new Map();
    for (const m of text.matchAll(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
        const [, names, from] = m;
        if (!from.startsWith('.')) continue; // ignore package imports
        const resolved = posix.normalize(posix.join(entryDir, from));
        for (const rawName of names.split(',')) {
            const name = rawName.trim();
            if (name) importedFrom.set(name, resolved);
        }
    }

    // Top-level invocations only (column 0) — a call inside a function body
    // doesn't run at module-load time and doesn't attach anything.
    const invoked = new Set([...text.matchAll(/^([A-Za-z_$][A-Za-z0-9_$]*)\(/gm)].map((m) => m[1]));

    const live = new Set([entryFile]);
    for (const [name, file] of importedFrom) {
        if (name.startsWith('apply') && invoked.has(name)) live.add(file);
    }
    return live;
}

/**
 * Fail loudly if BACKENDS.files has drifted from the entry point's real
 * import/invoke graph, in either direction: a listed file whose
 * applyXMethods() call was removed (the bug CodeRabbit flagged — silently
 * "passing" on a mixin that no longer attaches anything), or a live mixin
 * that was never added to the list (silently unchecked).
 * @param {{label: string, entryFile: string, files: string[]}} backend
 */
function assertFileListMatchesEntryPoint(backend) {
    const live = resolveLiveMixinFiles(backend.entryFile);
    const listed = new Set(backend.files);
    const stale = backend.files.filter((f) => !live.has(f));
    const untracked = [...live].filter((f) => !listed.has(f));
    if (stale.length > 0 || untracked.length > 0) {
        const parts = [];
        if (stale.length > 0) parts.push(`listed in BACKENDS but no longer applied by ${backend.entryFile}: ${stale.join(', ')}`);
        if (untracked.length > 0) parts.push(`applied by ${backend.entryFile} but missing from BACKENDS: ${untracked.join(', ')}`);
        throw new Error(`[check-renderer-facade] ${backend.label} file list is stale — ${parts.join('; ')}. Update BACKENDS in scripts/check-renderer-facade.mjs.`);
    }
}

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
    for (const backend of Object.values(BACKENDS)) {
        try {
            assertFileListMatchesEntryPoint(backend);
        } catch (err) {
            console.error(/** @type {Error} */ (err).message);
            process.exit(1);
        }
    }

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

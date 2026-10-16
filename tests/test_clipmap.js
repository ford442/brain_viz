// tests/test_clipmap.js
// [Clipmap] Pins the contracts behind the fine brick (Phase B) and the
// cortical patch (Phase C) — docs/field-resolution.md §7,
// docs/tensor-physics.md §11. No GPU: the policy, the lattice math, the
// affinity bakes, the patch geometry and the shader text are all checkable in
// Node, and they are where this feature is most likely to regress silently.
//
//   1. Lattice math: toroidal addressing round-trips, the brick snaps to whole
//      chunks inside the lattice, and a move exposes exactly the chunks the
//      old placement did not cover.
//   2. Affinity: one rasteriser for every level — a block baked on its own is
//      bit-identical to the same voxels of a whole-lattice bake, chunked fine
//      bakes assemble into the monolithic one, and the cache is used.
//   3. Budget governor: GPU pressure lowers the tier with hysteresis and
//      backoff, cognitiveLoad lowers it too, and the governor never writes
//      cognitiveLoad (it is a physics input).
//   4. Controller: zoom-gated, style-gated, pulls back to idle, reseeds after
//      idle, forces a step when the brick moves, swaps in the patch.
//   5. Cortical patch: outward unit normals, laminar somas under the surface.
//   6. Shaders: the §6 step body exists once (field-step.js) and both GPU
//      levels emit it; brick reads only appear where the brick is bound.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BrainGeometry } from '../src/brain-geometry.js';
import { Mat4 } from '../src/math-utils.js';
import {
    BRICK_CHUNK_DIM,
    BRICK_DIM,
    FINE_LATTICE_DIM,
    MAX_BRICK_DIM,
    AFFINITY_SLOTS,
    brickCenterWorld,
    brickOriginFor,
    chunkKey,
    chunksExposedByMove,
    chunksInBrick,
    latticeInBrick,
    latticeToWorld,
    texelToLattice,
    toroidalTexel,
    worldToLattice,
} from '../src/clipmap/brick-layout.js';
import {
    AffinityCache,
    AffinityChunkBaker,
    EMPTY_CHUNK,
    fineChunkCacheKey,
    planarizeChunk,
} from '../src/clipmap/affinity-chunks.js';
import { BRICK_TIERS, FrameBudget } from '../src/clipmap/frame-budget.js';
import {
    CLIPMAP_ZOOM,
    ClipmapController,
    cameraDirectionInModel,
    mergeClipmapOptions,
    DEFAULT_CLIPMAP_OPTIONS,
} from '../src/clipmap/clipmap-controller.js';
import {
    PATCH_CORTEX_DEPTH,
    PATCH_GRID,
    PATCH_SOMA_FLOATS,
    PATCH_VERTEX_FLOATS,
    generateCorticalPatch,
    patchFrameFor,
} from '../src/clipmap/cortical-patch.js';
import { computeShader } from '../src/shaders/volumetric-compute.js';
import { BRICK_FIELD_STEP, BRICK_MEAN_CELL, BRICK_WORKGROUP, brickComputeShader, brickCorrectShader, brickRestrictShader } from '../src/shaders/brick-compute.js';
import { COARSE_FIELD_STEP, fieldStepWGSL } from '../src/shaders/field-step.js';
import { HELPERS } from '../src/shaders/render-shared.js';
import * as patchShaders from '../src/shaders/cortical-patch.js';
import * as shaders from '../src/shaders.js';
import { BRICK_PARAMS_STRUCT_WGSL, BRICK_UNIFORM_LAYOUT, RENDER_UNIFORM_LAYOUT } from '../src/shaders/uniform-layout.js';
import { REQUIRED_GPU_FEATURES, deriveRequiredLimits, spanDurationsMs } from '../src/brain-renderer/gpu-context.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- 1. Lattice math ---------------------------------------------------------

assert.equal(FINE_LATTICE_DIM % BRICK_DIM, 0, 'the brick must tile the fine lattice');
assert.equal(BRICK_DIM % BRICK_CHUNK_DIM, 0, 'the brick must be a whole number of chunks');
assert.equal(BRICK_DIM % BRICK_WORKGROUP, 0, 'the brick dispatch must cover the brick exactly');
assert.equal(BRICK_DIM % BRICK_MEAN_CELL, 0, 'restriction cells must tile the brick');
assert.equal(BRICK_CHUNK_DIM % BRICK_MEAN_CELL, 0,
    'brick moves (whole chunks) must keep restriction cells lattice-aligned');
assert.ok(MAX_BRICK_DIM >= BRICK_DIM);

for (const g of [0, 1, 63, 64, 100, 255]) {
    assert.ok(Math.abs(worldToLattice(latticeToWorld(g)) - g) < 1e-9, `lattice ↔ world round trip at ${g}`);
}

for (const origin of [0, 16, 48, 112, 192]) {
    const seen = new Set();
    for (let s = 0; s < BRICK_DIM; s++) {
        const g = texelToLattice(s, origin);
        assert.ok(g >= origin && g < origin + BRICK_DIM, `texel ${s} of a brick at ${origin} maps outside it (${g})`);
        assert.equal(toroidalTexel(g), s, 'toroidal addressing must round-trip');
        seen.add(g);
    }
    assert.equal(seen.size, BRICK_DIM, 'every lattice voxel of the window must have exactly one texel');
}

// Snapping and clamping.
for (const center of [[0, 0, 0], [1.59, -1.59, 0.3], [-1.6, 1.6, -1.2], [0.33, -0.71, 1.05]]) {
    const origin = brickOriginFor(center);
    for (const g of origin) {
        assert.equal(g % BRICK_CHUNK_DIM, 0, 'the brick origin must be chunk-aligned');
        assert.ok(g >= 0 && g <= FINE_LATTICE_DIM - BRICK_DIM, 'the brick must stay inside the lattice');
    }
    const lattice = center.map((w) => Math.max(0, Math.min(FINE_LATTICE_DIM - 1, Math.floor(worldToLattice(w)))));
    // Inside the field the brick covers its centre (at the field's faces it is clamped).
    if (center.every((w) => Math.abs(w) < 1.2)) {
        assert.ok(latticeInBrick(lattice, origin), `the brick at ${origin} must contain its centre ${center}`);
    }
}
// Hysteresis: a small drift keeps the placement, a large one moves it.
{
    const origin = brickOriginFor([0.1, 0.0, -1.2]);
    const c = brickCenterWorld(origin);
    // The dead zone is ±¾ chunk = ±12 fine voxels (0.15 world units) around the brick centre.
    const drift = brickOriginFor([c[0] + 0.12, c[1] - 0.12, c[2] + 0.12], origin);
    assert.deepEqual(drift, origin, 'a drift inside the dead zone must not move the brick');
    const far = brickOriginFor([c[0] + 0.3, c[1], c[2]], origin);
    assert.notDeepEqual(far, origin, 'leaving the dead zone must move the brick');
    // 0.3 world units = 24 fine voxels: the nearest whole-chunk re-centring is one chunk.
    assert.equal(far[0] - origin[0], BRICK_CHUNK_DIM, 'and move it by whole chunks toward the focus');
}

assert.equal(chunksInBrick([0, 0, 0]).length, (BRICK_DIM / BRICK_CHUNK_DIM) ** 3);
assert.equal(chunksExposedByMove(null, [64, 64, 64]).length, (BRICK_DIM / BRICK_CHUNK_DIM) ** 3,
    'a first placement exposes every chunk');
assert.equal(chunksExposedByMove([64, 64, 64], [64, 64, 64]).length, 0, 'no move exposes nothing');
{
    const moved = chunksExposedByMove([64, 64, 64], [80, 64, 64]);
    assert.equal(moved.length, (BRICK_DIM / BRICK_CHUNK_DIM) ** 2, 'a one-chunk move exposes one slab');
    for (const chunk of moved) assert.equal(chunk[0], 64 + BRICK_DIM, 'only the leading slab is new');
    const focused = chunksExposedByMove(null, [64, 64, 64], latticeToWorldVec([64, 64, 64]));
    assert.deepEqual(focused[0], [64, 64, 64], 'chunks are ordered nearest-first to the focus');
}
const centre = brickCenterWorld([96, 96, 96]);
assert.ok(centre.every((w) => Math.abs(w - latticeToWorld(96 + (BRICK_DIM - 1) / 2)) < 1e-12));

function latticeToWorldVec(g) {
    return g.map((v) => latticeToWorld(v + 1));
}

// --- 2. Affinity: one rasteriser, every level -----------------------------------

const geometry = new BrainGeometry();
geometry.generate(24, 24);

{
    // A block of the coarse lattice baked on its own equals the same voxels of
    // the whole-lattice bake: splats outside the block are dropped, not
    // clamped onto its border, while the lattice's own edges still clamp.
    const dim = 32;
    const full = geometry.buildFiberAffinityRegion({ latticeDim: dim, origin: [0, 0, 0], size: dim });
    for (const [origin, size] of [[[8, 12, 4], 16], [[0, 0, 0], 8], [[24, 24, 24], 8]]) {
        const block = geometry.buildFiberAffinityRegion({ latticeDim: dim, origin, size });
        let mismatches = 0;
        for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const li = (z * size + y) * size + x;
            const gi = ((origin[2] + z) * dim + (origin[1] + y)) * dim + (origin[0] + x);
            for (let k = 0; k < 12; k++) if (!Object.is(block[li * 12 + k], full[gi * 12 + k])) mismatches++;
        }
        assert.equal(mismatches, 0, `block ${origin}+${size} differs from the whole-lattice bake`);
    }
    const viaMap = new BrainGeometry({ voxelDim: dim });
    viaMap.generate(24, 24);
    assert.deepEqual(viaMap.getFiberAffinityData(), full, 'buildFiberAffinityMap is the whole-lattice region bake');
}

{
    // Fine chunks assemble into the monolithic fine bake.
    const origin = [96, 112, 32];
    const size = 2 * BRICK_CHUNK_DIM;
    const mono = geometry.buildFiberAffinityRegion({ latticeDim: FINE_LATTICE_DIM, origin, size });
    let mismatches = 0;
    let tractVoxels = 0;
    for (let cz = 0; cz < 2; cz++) for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
        const chunkOrigin = [origin[0] + cx * BRICK_CHUNK_DIM, origin[1] + cy * BRICK_CHUNK_DIM, origin[2] + cz * BRICK_CHUNK_DIM];
        const steps = geometry.bakeFiberAffinityRegion({ latticeDim: FINE_LATTICE_DIM, origin: chunkOrigin, size: BRICK_CHUNK_DIM });
        let result = steps.next();
        let yields = 0;
        while (!result.done) { yields++; result = steps.next(); }
        const chunk = result.value;
        const n = BRICK_CHUNK_DIM;
        for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const li = (z * n + y) * n + x;
            const mi = ((cz * n + z) * size + (cy * n + y)) * size + (cx * n + x);
            for (let k = 0; k < 12; k++) if (!Object.is(chunk[li * 12 + k], mono[mi * 12 + k])) mismatches++;
            if (chunk[li * 12 + 3] >= 0.01) tractVoxels++;
        }
        assert.ok(yields >= 0);
    }
    assert.equal(mismatches, 0, 'chunked fine bakes must equal the monolithic bake');
    assert.ok(tractVoxels > 0, 'the test region should contain tracts (it would prove nothing otherwise)');
}

{
    // The coarse map is cached per geometry and dim; voxelDim alone does not change the key.
    const cache = new AffinityCache();
    const a = new BrainGeometry({ voxelDim: 32 });
    a.affinityCache = cache;
    a.generate(24, 24);
    const b = new BrainGeometry({ voxelDim: 32 });
    b.affinityCache = cache;
    b.generate(24, 24);
    assert.equal(b.getFiberAffinityData(), a.getFiberAffinityData(), 'an identical geometry must reuse the cached map');
    assert.ok(cache.hits >= 1);
    const c = new BrainGeometry({ voxelDim: 64 });
    assert.equal(c.getFiberGeometryKey === undefined, false);
    const d = new BrainGeometry({ voxelDim: 32, fiberSymmetry: 0.2 });
    a.generatedRows = d.generatedRows = 24;
    a.generatedCols = d.generatedCols = 24;
    assert.notEqual(a.getFiberGeometryKey(), d.getFiberGeometryKey(), 'tract-shaping options must change the key');
    const e = new BrainGeometry({ voxelDim: 64 });
    e.generatedRows = e.generatedCols = 24;
    assert.equal(a.getFiberGeometryKey(), e.getFiberGeometryKey(), 'voxelDim must not change the tract key');
}

{
    // Planar layout + empty detection.
    const n = BRICK_CHUNK_DIM;
    const empty = new Float32Array(n ** 3 * 12);
    assert.equal(planarizeChunk(empty), EMPTY_CHUNK);
    const one = new Float32Array(n ** 3 * 12);
    one[5 * 12 + 4] = 0.25; one[5 * 12 + 5] = 0.5; one[5 * 12 + 6] = 0.75; one[5 * 12 + 7] = 0.9; // slot 1 of voxel 5
    const planar = /** @type {Float32Array} */ (planarizeChunk(one));
    assert.ok(planar instanceof Float32Array);
    assert.equal(planar.length, n ** 3 * 4 * AFFINITY_SLOTS);
    assert.deepEqual([...planar.subarray(n ** 3 * 4 + 5 * 4, n ** 3 * 4 + 5 * 4 + 4)], [0.25, 0.5, 0.75, Math.fround(0.9)]);
}

{
    // Byte-bounded LRU.
    const cache = new AffinityCache(1000);
    cache.set('a', new Float32Array(100)); // 400 B
    cache.set('b', new Float32Array(100));
    cache.get('a'); // a is now most recent
    cache.set('c', new Float32Array(100)); // 1200 B > 1000: evict LRU = b
    assert.ok(cache.has('a') && cache.has('c') && !cache.has('b'));
    assert.ok(cache.bytes <= 1000);
}

{
    // The baker honours its time budget and completes chunks across pumps.
    let clock = 0;
    const fakeGeometry = {
        getFiberGeometryKey: () => 'fake',
        *bakeFiberAffinityRegion() {
            for (let i = 0; i < 5; i++) { clock += 1; yield; }
            clock += 1;
            return new Float32Array(BRICK_CHUNK_DIM ** 3 * 12);
        },
    };
    const cache = new AffinityCache();
    const baker = new AffinityChunkBaker({ cache, now: () => clock });
    baker.setGeometry(fakeGeometry);
    baker.request([[0, 0, 0], [16, 0, 0], [32, 0, 0]]);
    const ready = [];
    baker.pump(3, (chunk) => ready.push(chunkKey(chunk)));
    assert.equal(ready.length, 0, 'a 6-tick chunk cannot finish in a 3-tick budget');
    baker.pump(4, (chunk) => ready.push(chunkKey(chunk)));
    assert.deepEqual(ready, ['0,0,0'], 'the chunk resumes where it left off');
    baker.request([[32, 0, 0]]); // [16,0,0] no longer wanted
    baker.pump(100, (chunk) => ready.push(chunkKey(chunk)));
    assert.deepEqual(ready, ['0,0,0', '32,0,0']);
    assert.ok(cache.has(fineChunkCacheKey('fake', [32, 0, 0])));
    baker.request([[32, 0, 0]]);
    const before = clock;
    baker.pump(100, (chunk) => ready.push(chunkKey(chunk)));
    assert.equal(clock, before, 'a cached chunk is served without baking');
}

// --- 3. Budget governor ---------------------------------------------------------

{
    const budget = new FrameBudget({ budgetMs: 10 });
    for (let i = 0; i < 100; i++) budget.observe({ gpuMs: 5 });
    assert.equal(budget.pressure, 0, 'half the budget is no pressure');
    let now = 0;
    assert.equal(budget.chooseTier(0, now), BRICK_TIERS.FULL);
    for (let i = 0; i < 200; i++) budget.observe({ gpuMs: 30 });
    assert.equal(budget.pressure, 1, 'three times the budget saturates pressure');
    assert.equal(budget.chooseTier(0, now += 16), BRICK_TIERS.OFF, 'saturated pressure drops to OFF');
    // Recover: pressure falls, the tier climbs one level at a time, after backoff.
    for (let i = 0; i < 200; i++) budget.observe({ gpuMs: 2 });
    assert.equal(budget.pressure, 0);
    assert.equal(budget.chooseTier(0, now += 16), BRICK_TIERS.OFF, 'a budget downgrade arms a backoff');
    assert.equal(budget.chooseTier(0, now += 2500), BRICK_TIERS.REDUCED, 'after the backoff the tier climbs one step');
    assert.equal(budget.chooseTier(0, now += 16), BRICK_TIERS.REDUCED, 'the next step waits for the cost to settle');
    assert.equal(budget.chooseTier(0, now += 1100), BRICK_TIERS.FULL);
    // A second budget event doubles the backoff (2 s → 4 s).
    for (let i = 0; i < 200; i++) budget.observe({ gpuMs: 30 });
    assert.equal(budget.chooseTier(0, now += 16), BRICK_TIERS.OFF);
    for (let i = 0; i < 200; i++) budget.observe({ gpuMs: 2 });
    assert.equal(budget.chooseTier(0, now += 2500), BRICK_TIERS.OFF, 'repeat offenders back off longer');
    assert.equal(budget.chooseTier(0, now += 2000), BRICK_TIERS.REDUCED);

    // cognitiveLoad lowers the tier on its own, with no backoff, and is never written.
    const params = { cognitiveLoad: 0.5 };
    const calm = new FrameBudget({ budgetMs: 10 });
    calm.observe({ gpuMs: 1 });
    assert.equal(calm.chooseTier(params.cognitiveLoad, 0), BRICK_TIERS.REDUCED);
    assert.equal(calm.chooseTier(0.95, 16), BRICK_TIERS.OFF);
    assert.equal(calm.chooseTier(0.0, 1100), BRICK_TIERS.REDUCED, 'a cognitiveLoad downgrade recovers without backoff');
    assert.equal(params.cognitiveLoad, 0.5, 'the governor must never write cognitiveLoad (it is a physics input)');
    assert.equal(calm.lodLoad, 0, 'lodLoad = max(cognitiveLoad, pressure)');

    // Hysteresis: hovering just under the downgrade line does not climb back.
    const hover = new FrameBudget({ budgetMs: 10 });
    hover.observe({ gpuMs: 1 });
    assert.equal(hover.chooseTier(0.45, 0), BRICK_TIERS.REDUCED);
    assert.equal(hover.chooseTier(0.35, 16), BRICK_TIERS.REDUCED, 'between the lines the tier holds');

    // auto: false ignores pressure (verification on software adapters).
    const pinned = new FrameBudget({ budgetMs: 10 });
    for (let i = 0; i < 200; i++) pinned.observe({ gpuMs: 100 });
    assert.equal(pinned.chooseTier(0, 0, { auto: false }), BRICK_TIERS.FULL);

    // Without timestamps the frame interval is the signal; stalls are ignored.
    const interval = new FrameBudget();
    for (let i = 0; i < 100; i++) interval.observe({ intervalMs: 16.7 });
    assert.equal(interval.pressure, 0, 'a vsync-bound 60 Hz frame is not over budget');
    assert.equal(interval.source, 'interval');
    interval.observe({ intervalMs: 5000 });
    assert.equal(interval.pressure, 0, 'a 5 s stall (tab switch) is not a cost');
    for (let i = 0; i < 200; i++) interval.observe({ intervalMs: 1000 / 30 });
    assert.ok(interval.pressure > 0.95, 'a 30 fps frame interval is full pressure');
}

// --- 4. Controller --------------------------------------------------------------

{
    for (let i = 0; i < 20; i++) {
        const rotation = { x: (i * 0.37) % 1.4 - 0.7, y: i * 0.91 };
        const d = cameraDirectionInModel(rotation);
        const model = Mat4.multiply(Mat4.rotateX(rotation.x), Mat4.rotateY(rotation.y));
        // model * d (column-major) must be world +Z.
        const world = [0, 1, 2].map((r) => model[r] * d[0] + model[4 + r] * d[1] + model[8 + r] * d[2]);
        assert.ok(Math.abs(world[0]) < 1e-5 && Math.abs(world[1]) < 1e-5 && Math.abs(world[2] - 1) < 1e-5,
            `camera direction must map to world +Z (got ${world})`);
    }

    assert.throws(() => mergeClipmapOptions(DEFAULT_CLIPMAP_OPTIONS, { focus: 'nowhere' }), /focus must be one of/);
    assert.throws(() => mergeClipmapOptions(DEFAULT_CLIPMAP_OPTIONS, { budgetMs: -1 }), /non-negative/);
    assert.equal(mergeClipmapOptions(DEFAULT_CLIPMAP_OPTIONS, { nudge: 4 }).nudge, 1, 'nudge is capped at dead-beat');

    const calls = { upload: 0, clear: 0, patch: 0 };
    let clock = 0;
    const controller = new ClipmapController({
        now: () => clock,
        gpu: {
            uploadAffinityChunk: () => { calls.upload++; },
            clearAffinityChunk: () => { calls.clear++; },
            uploadPatch: () => { calls.patch++; },
        },
    });
    controller.setGeometry(geometry);
    controller.setOptions({ jobBudgetMs: 1000 });
    const occipital = { x: 0, y: Math.PI };
    const frame = (inputs) => {
        clock += 16;
        return controller.update({
            zoom: 3.5, style: 0, cognitiveLoad: 0, voxelDim: 32, stimulus: null,
            cameraDir: cameraDirectionInModel(occipital), now: clock, ...inputs,
        });
    };

    let f = frame({ zoom: 2.4 });
    assert.equal(f.active, false, 'an unsupported backend never runs the brick');
    controller.setSupported(true);

    f = frame({});
    assert.equal(f.active, false, 'at the boot zoom (3.5) the brick is off');
    assert.equal(f.weight, 0);

    f = frame({ zoom: 2.4 });
    assert.equal(f.active, true, 'zooming in turns the brick on');
    assert.equal(f.dispatch, true);
    assert.equal(f.prevValid, 0, 'the first step reseeds from the coarse field');
    assert.equal(f.mode, 2, 'simulate by default');
    const center = brickCenterWorld(f.latticeOrigin);
    assert.ok(center[2] < -0.5, `facing the occipital pole the brick must sit in occipital cortex (z=${center[2]})`);
    assert.equal(calls.clear, 0, 'a fresh atlas is already zero: a first placement clears nothing');
    assert.equal(controller.getState().affinity.resident + controller.getState().affinity.pending,
        (BRICK_DIM / BRICK_CHUNK_DIM) ** 3, 'every chunk of the brick is resident or queued');
    f = frame({ zoom: 2.4 });
    assert.equal(f.prevValid, 1, 'subsequent steps carry the state');
    for (let i = 0; i < 40; i++) f = frame({ zoom: 2.4 });
    assert.ok(f.weight > 0.95, 'the brick fades in fully');
    assert.equal(controller.getState().affinity.pending, 0, 'with a generous job budget every chunk bakes');

    f = frame({ zoom: 2.4, playback: true });
    assert.equal(f.mode, 1, 'tensor playback only interpolates the recording');

    // Moving forces a step and re-plans affinity for the exposed slab only.
    const before = { ...calls };
    const placed = [...f.latticeOrigin];
    // A small turn (~0.25 world units at the cortex) moves the brick by about one chunk.
    f = frame({ zoom: 2.4, cameraDir: cameraDirectionInModel({ x: 0, y: Math.PI - 0.2 }) });
    assert.notDeepEqual(f.latticeOrigin, placed, 'the turn should move the brick');
    assert.ok(f.dispatch, 'a move always steps, so the render copy matches the new placement');
    assert.equal(f.prevValid, 1, 'a partial move carries the overlapping state');
    const reloaded = calls.clear + calls.upload - before.clear - before.upload;
    assert.ok(reloaded > 0, 'a move loads the exposed chunks');
    assert.ok(reloaded <= 2 * (BRICK_DIM / BRICK_CHUNK_DIM) ** 2,
        `a one-chunk move must reload at most the exposed slabs, not the brick (reloaded ${reloaded})`);

    // Phase C: close in, organic style → the patch is generated and swapped in.
    for (let i = 0; i < 60 && !controller.getState().patch.vertices; i++) f = frame({ zoom: 2.2 });
    assert.ok(calls.patch >= 1, 'below the patch zoom a cortical patch is uploaded');
    for (let i = 0; i < 40; i++) f = frame({ zoom: 2.2 });
    assert.ok(f.patch.draw && f.patch.blend > 0.9, 'the patch fades in');
    assert.equal(f.patch.impostor, false, 'at the full tier the patch is a mesh');
    f = frame({ zoom: 2.2, cognitiveLoad: 0.5 });
    assert.equal(f.tier, BRICK_TIERS.REDUCED);
    assert.equal(f.patch.impostor, true, 'at the reduced tier the patch falls back to impostors');
    assert.equal(f.fineSteps < 48, true, 'and the in-brick raymarch is shortened');

    // Heatmap keeps the brick (raymarch) but has no patch; connectome / SynaptiX have neither.
    for (let i = 0; i < 60; i++) f = frame({ zoom: 2.2, style: 3 });
    assert.ok(f.active && !f.patch.draw);
    for (const style of [2, 4]) {
        for (let i = 0; i < 80; i++) f = frame({ zoom: 2.2, style });
        assert.equal(f.active, false, `style ${style} reads no brick, so none is stepped`);
    }

    // Pulling back drops it; coming back reseeds.
    for (let i = 0; i < 30; i++) f = frame({ zoom: 2.4 });
    for (let i = 0; i < 80; i++) f = frame({ zoom: 3.6 });
    assert.equal(f.active, false, 'pulling back turns the brick off');
    f = frame({ zoom: 2.4 });
    assert.equal(f.prevValid, 0, 'a brick that was idle reseeds rather than resuming a stale state');

    // A recent stimulus captures 'auto' focus.
    for (let i = 0; i < 10; i++) f = frame({ zoom: 2.4 });
    f = frame({ zoom: 2.4, stimulus: { pos: [0.9, 0.7, 0.9], injectedAt: clock } });
    const stimCentre = brickCenterWorld(f.latticeOrigin);
    assert.ok(stimCentre[0] > 0.4 && stimCentre[2] > 0.4, `'auto' focus must follow a fresh stimulus (${stimCentre})`);

    // cognitiveLoad ≥ 0.75 is the OFF tier.
    for (let i = 0; i < 80; i++) f = frame({ zoom: 2.4, cognitiveLoad: 0.9 });
    assert.equal(f.active, false);
}

// --- 5. Cortical patch ----------------------------------------------------------

{
    const frame = patchFrameFor(geometry, brickCenterWorld(brickOriginFor([0, 0, -1.3])));
    const steps = generateCorticalPatch(geometry, frame, { seed: 7 });
    let result = steps.next();
    let slices = 0;
    while (!result.done) { slices++; result = steps.next(); }
    const patch = result.value;
    assert.ok(slices > 10, 'generation is time-sliced');
    assert.equal(patch.vertexCount, PATCH_GRID * PATCH_GRID);
    assert.equal(patch.vertices.length, patch.vertexCount * PATCH_VERTEX_FLOATS);
    assert.equal(patch.indexCount, (PATCH_GRID - 1) ** 2 * 6);
    assert.ok(Math.max(...patch.indices) < patch.vertexCount);
    let centreFade = 0;
    for (let k = 0; k < patch.vertexCount; k++) {
        const o = k * PATCH_VERTEX_FLOATS;
        const p = [patch.vertices[o], patch.vertices[o + 1], patch.vertices[o + 2]];
        const n = [patch.vertices[o + 3], patch.vertices[o + 4], patch.vertices[o + 5]];
        assert.ok(Math.abs(Math.hypot(...n) - 1) < 1e-4, 'patch normals are unit length');
        assert.ok(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] > 0, 'patch normals face outward');
        const r = Math.hypot(...p);
        const s = geometry.sampleCorticalSurface(p[0] / r, p[1] / r, p[2] / r, true);
        assert.ok(Math.abs(s.radius - r) < 1e-6, 'patch vertices lie on the geometry\'s own cortical surface');
        const u = patch.vertices[o + 8];
        const v = patch.vertices[o + 9];
        if (u === 0 || u === 1 || v === 0 || v === 1) assert.equal(patch.vertices[o + 6], 0, 'the patch rim fades to zero');
        if (Math.hypot(u - 0.5, v - 0.5) < 0.05) centreFade = Math.max(centreFade, patch.vertices[o + 6]);
    }
    assert.equal(centreFade, 1, 'the patch centre is fully opaque');
    assert.ok(frame.cosInner > frame.cosOuter, 'the mesh hand-off cone must have inner inside outer');

    for (let i = 0; i < patch.somaCount; i++) {
        const o = i * PATCH_SOMA_FLOATS;
        const p = [patch.somas[o], patch.somas[o + 1], patch.somas[o + 2]];
        const r = Math.hypot(...p);
        const surface = geometry.sampleCorticalSurface(p[0] / r, p[1] / r, p[2] / r, true).radius;
        assert.ok(r < surface + 1e-3, 'somas sit under the pial surface');
        assert.ok(r > surface - PATCH_CORTEX_DEPTH * 1.6, 'somas stay within the cortical sheet');
        const layer = patch.somas[o + 11];
        assert.ok(layer >= 0 && layer <= 3 && Number.isInteger(layer));
    }
    const again = generateCorticalPatch(geometry, frame, { seed: 7 });
    let r2 = again.next();
    while (!r2.done) r2 = again.next();
    assert.deepEqual(r2.value.somas, patch.somas, 'patches are deterministic per placement');
}

// --- 6. Shaders -----------------------------------------------------------------

// The step body is emitted verbatim into both GPU levels…
assert.ok(computeShader.includes(fieldStepWGSL(COARSE_FIELD_STEP)), 'the coarse compute shader must emit the shared step body');
assert.ok(brickComputeShader.includes(fieldStepWGSL(BRICK_FIELD_STEP)), 'the brick compute shader must emit the shared step body');
// …and written nowhere else: distinctive §6 identifiers appear in exactly one shader source file.
const shaderDir = join(ROOT, 'src', 'shaders');
for (const token of ['avalancheThreshold', 'directionalTransport', 'ambientWave', 'tractBias']) {
    const files = readdirSync(shaderDir).filter((f) => f.endsWith('.js') && readFileSync(join(shaderDir, f), 'utf8').includes(token));
    assert.deepEqual(files, ['field-step.js'], `'${token}' (a §6 stage) must live only in field-step.js, found in ${files}`);
}

for (const source of [brickComputeShader, brickCorrectShader]) {
    assert.ok(source.includes(BRICK_PARAMS_STRUCT_WGSL), 'BrickParams must be the generated struct');
}
for (const field of BRICK_UNIFORM_LAYOUT) {
    assert.ok((brickComputeShader + brickCorrectShader).includes(`brick.${field.name}`),
        `BrickParams.${field.name} is uploaded but never read`);
}
// The correction runs after the step, on the stepped state, never inside the step body.
assert.ok(!brickComputeShader.includes('brick.nudge'), 'the §11.3 correction belongs in the correct pass, after restriction');
assert.ok(brickCorrectShader.includes('brick.nudge'));
for (const name of ['brickLatticeOrigin', 'brickWeight', 'brickLatticeDim', 'brickDim', 'brickFineSteps', 'lodLoad', 'patchAxis', 'patchBlend', 'patchCosInner', 'patchCosOuter']) {
    assert.ok(RENDER_UNIFORM_LAYOUT.some((f) => f.name === name), `render uniforms must carry ${name}`);
}
assert.ok(brickRestrictShader.includes('workgroupBarrier'), 'the restriction pass must reduce within the workgroup');

// HELPERS is in every shader, compute included: it must not reference the brick bindings.
for (const name of ['brickTexture', 'brickSampler', 'sampleBrickTexel', 'uniforms.brick']) {
    assert.ok(!HELPERS.includes(name), `HELPERS must not reference ${name} — every pipeline would have to bind the brick`);
}
// Every render shader that reads the brick declares its bindings.
const renderSources = { ...Object.fromEntries(Object.entries(shaders).filter(([, v]) => typeof v === 'string')), ...patchShaders };
for (const [name, source] of Object.entries(renderSources)) {
    if (typeof source !== 'string') continue;
    if (/sampleBrickTexel\(|detailedFieldValue\(|brickBlendAt\(/.test(source)) {
        assert.match(source, /@binding\(5\) var brickTexture/, `${name} reads the brick without binding it`);
        assert.match(source, /@binding\(6\) var brickSampler/, `${name} reads the brick without its sampler`);
    }
}
assert.ok(shaders.fragmentShader.includes('patchFootprint(input.modelPos)'), 'the mesh must fade out under the cortical patch');

// --- 7. GPU plumbing ------------------------------------------------------------

assert.deepEqual(REQUIRED_GPU_FEATURES, [],
    'the brick must not require optional features (rgba16float render copy is filterable in core)');
{
    const adapter = { limits: new Proxy({}, { get: () => 1 << 30 }) };
    const limits = deriveRequiredLimits(/** @type {any} */ (adapter));
    assert.ok(limits.maxTextureDimension3D >= MAX_BRICK_DIM * AFFINITY_SLOTS, 'the affinity atlas must fit the 3D limit');
    assert.ok(limits.maxStorageTexturesPerShaderStage >= 2);
}
{
    const times = new BigUint64Array([100n, 2_100_100n, 0n, 0n, 5_000_000n, 1_000_000n, 10n, 1_000_010n]);
    const ms = spanDurationsMs(times, ['field', 'brick', 'scene', 'post'], ['field', 'scene', 'post']);
    assert.equal(ms.field, 2.1);
    assert.equal(ms.brick, 0, 'an unwritten span reads 0, never a stale value');
    assert.equal(ms.scene, 0, 'out-of-order timestamps clamp to 0');
    assert.equal(ms.post, 1);
}

console.log('test_clipmap passed');

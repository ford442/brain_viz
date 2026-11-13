// verification/verify_styles_webgpu.mjs
// [Neuro-Weaver] Pixel-level visual regression for the five render styles on
// WebGPU (SwiftShader). Each style is rendered from a pinned state — seeded
// Math.random, every rAF loop frozen, fixed camera/params/field, a fixed
// stimulus, exactly FRAMES manual render() calls — and compared with a
// committed PNG in verification/goldens/ by pixelmatch. Catches washouts and
// blackouts (e.g. #384) that no headless assertion sees.
//
//   node verification/verify_styles_webgpu.mjs            # compare
//   node verification/verify_styles_webgpu.mjs --update   # rewrite goldens
//
// Diff images for failures go to verification/diffs/ (gitignored). Goldens are
// SwiftShader output: regenerate them with --update after an intended visual
// change, and look at them before committing. SKIP (exit 0) without a WebGPU
// adapter unless REQUIRE_WEBGPU=1. MAX_DIFF_RATIO (default 0.01) is the
// fraction of pixels allowed to differ beyond pixelmatch's perceptual
// threshold (PIXEL_THRESHOLD, default 0.1).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { launchBrowser } from '../scripts/lib/chromium.mjs';
import { ROOT, startDevServer } from '../scripts/lib/dev-server.mjs';

const PORT = Number(process.env.PORT || 5185);
const UPDATE = process.argv.includes('--update');
const REQUIRE = process.env.REQUIRE_WEBGPU === '1';
const MAX_DIFF_RATIO = Number(process.env.MAX_DIFF_RATIO || 0.01);
const PIXEL_THRESHOLD = Number(process.env.PIXEL_THRESHOLD || 0.1);
const FRAMES = 24;
const GOLDENS = join(ROOT, 'verification', 'goldens');
const DIFFS = join(ROOT, 'verification', 'diffs');
const STYLES = [
    { style: 0, name: 'organic' },
    { style: 1, name: 'cyber' },
    { style: 2, name: 'connectome' },
    { style: 3, name: 'heatmap' },
    { style: 4, name: 'synaptix' },
];

/** @param {string} reason @returns {never} */
function skip(reason) {
    console.warn(`\n!!! verify_styles_webgpu SKIPPED — ${reason}`);
    console.warn('!!! Set REQUIRE_WEBGPU=1 to make this a failure.\n');
    process.exit(REQUIRE ? 1 : 0);
}

/** Runs in the page before any app script: a seeded Math.random. */
function seedRandom() {
    let a = 0x9e3779b9;
    Math.random = () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Runs in the page: pin the state, render `frames` frames, return a PNG data URL. */
async function renderStyle({ style, frames }) {
    const { player, renderer: r } = window.__routineDebug;
    player.stop();
    r.calmState();
    r.setParams({ style, cognitiveLoad: 0, shake: 0, aberration: 0, grain: 0 });
    r.setCameraParams({ rotation: { x: 0.25, y: 0.6 }, zoom: 4.5 });
    r.rotation.x = r.targetRotation.x; r.rotation.y = r.targetRotation.y;
    r.zoom = r.targetZoom;
    if ('autoFrame' in r) r.autoFrame = false;
    r.resetActivity();
    r.setPartnerTensorData(new Float32Array(r.voxelCount));
    r.time = 0;
    r.injectStimulus(0.0, 0.3, 0.6, 1.0);
    r.isRunning = true;
    for (let i = 0; i < frames; i++) r.render();
    await r.device.queue.onSubmittedWorkDone();
    r.render(); // read back in the same task as the frame that produced it
    return r.canvas.toDataURL('image/png');
}

const server = await startDevServer(PORT);
let browser;
let failures = 0;
try {
    browser = await launchBrowser(skip);
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    await page.addInitScript(seedRandom);
    await page.goto(`${server.url}?renderer=webgpu`);
    await page.waitForFunction(() => window.__routineDebug?.renderer?.isRunning, null, { timeout: 180_000 });
    const backend = await page.evaluate(() => window.__routineDebug.renderer.backendType);
    if (backend !== 'webgpu') skip(`the app fell back to ${backend}.`);

    // Freeze every rAF-driven loop (render, routine, UI); frames are driven by hand.
    await page.evaluate(() => {
        window.__routineDebug.player.stop();
        window.__routineDebug.renderer.stop();
        window.requestAnimationFrame = () => 0;
    });
    await page.waitForTimeout(500);

    mkdirSync(GOLDENS, { recursive: true });
    for (const { style, name } of STYLES) {
        const dataUrl = await page.evaluate(renderStyle, { style, frames: FRAMES });
        const actual = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
        const goldenPath = join(GOLDENS, `style-${name}.png`);

        if (UPDATE || !existsSync(goldenPath)) {
            writeFileSync(goldenPath, PNG.sync.write(actual));
            console.log(`[verify_styles_webgpu] ${UPDATE ? 'updated' : 'created (no golden yet)'} ${goldenPath}`);
            continue;
        }

        const golden = PNG.sync.read(readFileSync(goldenPath));
        if (golden.width !== actual.width || golden.height !== actual.height) {
            console.error(`[verify_styles_webgpu] FAIL ${name}: size ${actual.width}x${actual.height}, golden ${golden.width}x${golden.height}`);
            failures++;
            continue;
        }
        const diff = new PNG({ width: golden.width, height: golden.height });
        const mismatched = pixelmatch(golden.data, actual.data, diff.data, golden.width, golden.height, { threshold: PIXEL_THRESHOLD });
        const ratio = mismatched / (golden.width * golden.height);
        const ok = ratio <= MAX_DIFF_RATIO;
        console.log(`[verify_styles_webgpu] ${ok ? 'ok  ' : 'FAIL'} ${name}: ${(ratio * 100).toFixed(3)}% of pixels differ (limit ${(MAX_DIFF_RATIO * 100).toFixed(2)}%)`);
        if (!ok) {
            failures++;
            mkdirSync(DIFFS, { recursive: true });
            writeFileSync(join(DIFFS, `style-${name}.actual.png`), PNG.sync.write(actual));
            writeFileSync(join(DIFFS, `style-${name}.diff.png`), PNG.sync.write(diff));
        }
    }
} finally {
    await browser?.close();
    server.stop();
}
if (failures) {
    console.error(`[verify_styles_webgpu] ${failures} style(s) regressed — see verification/diffs/. Intended? Re-run with --update and review the PNGs.`);
    process.exit(1);
}
console.log('[verify_styles_webgpu] PASS');

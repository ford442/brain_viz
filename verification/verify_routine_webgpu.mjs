// verification/verify_routine_webgpu.mjs
// [Neuro-Weaver] WebGPU routine-playback check. Every other routine check in
// verification/ runs on the WebGL2 fallback, which is how a WebGPU-only halt
// (RoutinePlayer reading the always-truthy `device.lost` Promise as "device
// lost") shipped unnoticed. This one loads `?renderer=webgpu` on SwiftShader,
// plays a routine for 5 s and asserts it keeps playing and its clock advances.
//
//   node verification/verify_routine_webgpu.mjs
//
// Prints SKIP and exits 0 when no WebGPU adapter comes up (the app falls back
// to WebGL2); REQUIRE_WEBGPU=1 makes that a failure. WGSL_ORACLE_GPU=hardware
// and CHROME_PATH behave as in scripts/wgsl_oracle.mjs.
import { launchBrowser } from '../scripts/lib/chromium.mjs';
import { startDevServer } from '../scripts/lib/dev-server.mjs';

const PORT = Number(process.env.PORT || 5184);
const PLAY_SECONDS = 5;
const REQUIRE = process.env.REQUIRE_WEBGPU === '1';

/** @param {string} reason @returns {never} */
function skip(reason) {
    console.warn(`\n!!! verify_routine_webgpu SKIPPED — ${reason}`);
    console.warn('!!! Set REQUIRE_WEBGPU=1 to make this a failure.\n');
    process.exit(REQUIRE ? 1 : 0);
}

/** @param {string} msg @returns {never} */
function fail(msg) {
    console.error(`[verify_routine_webgpu] FAIL: ${msg}`);
    process.exit(1);
}

// Long enough to outlast the sampling window; touches params, stimulus and
// camera so a handler that throws on WebGPU surfaces too.
const ROUTINE = [
    { time: 0.0, type: 'text', message: 'WebGPU routine check', duration: 2.0 },
    { time: 0.2, type: 'stimulus', target: 'frontal', intensity: 1.0 },
    { time: 0.5, type: 'lerp', key: 'flowSpeed', value: 4.0, duration: 2.0 },
    { time: 1.5, type: 'stimulus', target: 'occipital', intensity: 1.0 },
    { time: 3.0, type: 'heartbeat', intensity: 1.0, duration: 1.0 },
    { time: 30.0, type: 'calm' },
];

const server = await startDevServer(PORT);
let browser;
try {
    browser = await launchBrowser(skip);
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e)));

    await page.goto(`${server.url}?renderer=webgpu`);
    await page.waitForFunction(() => window.__routineDebug?.renderer?.isRunning, null, { timeout: 180_000 });
    const backend = await page.evaluate(() => window.__routineDebug.renderer.backendType);
    if (backend !== 'webgpu') {
        const reason = await page.evaluate(() => window.__routineDebug.renderer.rendererFallbackReason);
        skip(`the app fell back to ${backend} (${reason || 'no WebGPU adapter'}).`);
    }

    await page.evaluate((routine) => {
        const { player } = window.__routineDebug;
        player.loop = false;
        player.loadRoutine(routine, false);
        player.play();
    }, ROUTINE);

    const samples = [];
    for (let i = 0; i <= PLAY_SECONDS; i++) {
        if (i > 0) await page.waitForTimeout(1000);
        samples.push(await page.evaluate(() => {
            const { player, renderer } = window.__routineDebug;
            return {
                isPlaying: player.isPlaying,
                currentTime: player.currentTime,
                deviceLostFlag: Boolean(player._deviceLost),
                contextLost: Boolean(renderer.isContextLost),
            };
        }));
    }
    console.log('[verify_routine_webgpu] samples:', samples.map((s) => `${s.isPlaying ? 'playing' : 'STOPPED'}@${s.currentTime.toFixed(2)}s`).join(' '));

    const stopped = samples.find((s) => !s.isPlaying);
    if (stopped) fail(`the routine stopped on WebGPU (deviceLost flag ${stopped.deviceLostFlag}, renderer.isContextLost ${stopped.contextLost}).`);
    // Non-decreasing, not strictly increasing: on SwiftShader the first frames
    // (pipeline compilation) can take longer than one sampling interval.
    for (let i = 1; i < samples.length; i++) {
        if (samples[i].currentTime < samples[i - 1].currentTime) {
            fail(`currentTime went backwards between samples ${i - 1} and ${i} (${samples[i - 1].currentTime} → ${samples[i].currentTime}).`);
        }
    }
    // Software adapters run well below 60 fps and routine dt is capped per
    // frame, so routine time can trail wall time; it must still clearly move.
    const advanced = samples.at(-1).currentTime - samples[0].currentTime;
    if (advanced < 0.2) fail(`routine time advanced only ${advanced.toFixed(2)} s over ${PLAY_SECONDS} s of playback.`);
    if (pageErrors.length) fail(`uncaught page errors:\n  ${pageErrors.join('\n  ')}`);

    console.log(`[verify_routine_webgpu] PASS: routine kept playing on WebGPU, ${advanced.toFixed(2)} s of routine time in ${PLAY_SECONDS} s.`);
} finally {
    await browser?.close();
    server.stop();
}

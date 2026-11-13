// scripts/lib/chromium.mjs
// [Neuro-Weaver] Shared headless-Chromium launcher for the WebGPU checks
// (scripts/wgsl_oracle.mjs, verification/verify_routine_webgpu.mjs,
// verification/verify_styles_webgpu.mjs). SwiftShader WebGPU by default, so it
// runs on a GPU-less CI box; WGSL_ORACLE_GPU=hardware uses the real adapter.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * $CHROME_PATH alone if set. Otherwise Playwright's pinned build (undefined =
 * its default), then any build in its cache, newest first: the npm package and
 * the browsers installed on a machine drift independently.
 */
export function chromiumCandidates() {
    if (process.env.CHROME_PATH) return [process.env.CHROME_PATH];
    return [undefined, ...cachedChromiumBuilds()];
}

function cachedChromiumBuilds() {
    const cache = join(homedir(), '.cache', 'ms-playwright');
    if (!existsSync(cache)) return [];
    return readdirSync(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
        .flatMap((d) => ['chrome-linux64', 'chrome-linux', 'chrome-mac', 'chrome-win']
            .map((sub) => join(cache, d, sub, sub.startsWith('chrome-win') ? 'chrome.exe' : 'chrome')))
        .filter(existsSync);
}

export const SOFTWARE_WEBGPU_ARGS = [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-vulkan=swiftshader',
    '--use-webgpu-adapter=swiftshader',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-watchdog',
];
const HARDWARE_WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--enable-features=Vulkan'];

/**
 * Launch headless Chromium with WebGPU on. Calls `skip(reason)` (which should
 * exit) when Playwright or every Chromium build is unavailable.
 * @param {(reason: string) => never} skip
 * @param {string[]} [extraArgs]
 */
export async function launchBrowser(skip, extraArgs = []) {
    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        skip('the playwright package is not installed (npm install).');
    }
    const args = [...(process.env.WGSL_ORACLE_GPU === 'hardware' ? HARDWARE_WEBGPU_ARGS : SOFTWARE_WEBGPU_ARGS), ...extraArgs];
    const errors = [];
    for (const executablePath of chromiumCandidates()) {
        try {
            return await chromium.launch({ headless: true, executablePath, args });
        } catch (err) {
            errors.push(`${executablePath ?? "playwright's default"}: ${String(err.message).split('\n')[0]}`);
        }
    }
    skip(`no Chromium build could be launched (npx playwright install chromium, or set CHROME_PATH).\n    ${errors.join('\n    ')}`);
}

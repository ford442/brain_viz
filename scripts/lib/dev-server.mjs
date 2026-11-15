// scripts/lib/dev-server.mjs
// [Neuro-Weaver] Start/stop a Vite dev server for the Playwright checks in
// verification/*.mjs. Spawns vite directly in its own process group so one
// signal stops the whole tree (npm does not forward SIGTERM to vite).
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<{ url: string, stop: () => void }>}
 */
export async function startDevServer(port, timeoutMs = 60_000) {
    const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
        cwd: ROOT,
        stdio: 'ignore',
        detached: true,
    });
    const stop = () => {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    };
    process.once('exit', stop);
    const url = `http://127.0.0.1:${port}/`;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`vite exited with code ${child.exitCode} (port ${port} in use?)`);
        try {
            const res = await fetch(url);
            if (res.ok) return { url, stop };
        } catch { /* not up yet */ }
        await new Promise((r) => setTimeout(r, 300));
    }
    stop();
    throw new Error(`timed out waiting for the dev server at ${url}`);
}

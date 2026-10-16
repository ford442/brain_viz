"""[Clipmap] Optional WebGPU-only verification of the fine brick (Phase B) and
the cortical patch (Phase C) — docs/field-resolution.md §7.

Not part of verify_suite.py: that suite runs against the WebGL2 fallback in
CI, where the brick does not exist. Run this one by hand (or in a job that has
a WebGPU adapter):

    python3 verification/verify_clipmap_webgpu.py

By default it asks Chromium for SwiftShader's software WebGPU adapter with a
SwiftShader Vulkan back end, which works headless with no GPU. Set
CLIPMAP_GPU=hardware to use the machine's real adapter instead, and
CHROME_PATH to point at a specific Chrome/Chromium build. If no WebGPU adapter
comes up, the script prints SKIP and exits 0.

What it checks, against the live app:
  - zooming toward the occipital pole brings the brick in, placed in
    occipital cortex, simulating, with no GPU validation error;
  - the brick agrees with the coarse field at the coarse scale (restriction
    cell means, docs/tensor-physics.md §11.3) and carries more spatial detail
    than the coarse field over the same volume (gradient energy);
  - in Organic style below the patch threshold, the cortical patch swaps in as
    a mesh, and as impostors at the reduced tier (cognitiveLoad 0.5);
  - pulling back turns the brick off;
  - GPUTimer reports compute and render pass times when timestamp-query exists.

Software adapters cannot meet a real-time budget, so the budget governor is
pinned (autoQuality: false); cognitiveLoad still drives the tier.
"""

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
PORT = 5182
APP_URL = f"http://127.0.0.1:{PORT}/?renderer=webgpu"
OUT = ROOT / "verification"

SOFTWARE_WEBGPU_ARGS = [
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan",
    "--use-vulkan=swiftshader",
    "--use-webgpu-adapter=swiftshader",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-gpu-watchdog",
]
HARDWARE_WEBGPU_ARGS = ["--enable-unsafe-webgpu", "--enable-features=Vulkan"]


def wait_for_server(url: str, timeout: float = 30.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f"Timed out waiting for dev server: {url}")


def launch_dev_server() -> subprocess.Popen:
    # Own process group: `npm run dev` does not pass SIGTERM on to vite, so
    # terminating just the npm process would leave the dev server running.
    return subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", str(PORT), "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def stop_dev_server(server: subprocess.Popen) -> None:
    try:
        os.killpg(server.pid, signal.SIGTERM)
        server.wait(timeout=10)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(server.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def wait_sim_seconds(page, seconds: float, timeout_ms: int = 900_000) -> None:
    """Wait until the renderer has advanced `seconds` of simulation time (0.016 per frame)."""
    page.evaluate("() => { window.__simMark = window.__clipmapDebug.renderer.time; }")
    page.wait_for_function(
        "(s) => window.__clipmapDebug.renderer.time - window.__simMark >= s - 1e-6",
        arg=seconds,
        timeout=timeout_ms,
        polling=100,
    )


def state(page) -> dict:
    return page.evaluate(
        """() => {
            const d = window.__clipmapDebug;
            return { ...d.getState(), timings: d.getTimings(),
                     gpuError: String(d.renderer.lastGPUError || ''), lost: d.renderer.isContextLost };
        }"""
    )


BRICK_METRICS_JS = """async () => {
    const snap = await window.__clipmapDebug.renderer.readBrickSnapshot();
    if (!snap) return null;
    const n = snap.dim;
    const at = (a, x, y, z) => a[(z * n + y) * n + x];
    const energy = (a) => {
        let e = 0, c = 0;
        for (let z = 8; z < n - 8; z++) for (let y = 8; y < n - 8; y++) for (let x = 8; x < n - 8; x++) {
            const v = at(a, x, y, z);
            const gx = at(a, x + 1, y, z) - v, gy = at(a, x, y + 1, z) - v, gz = at(a, x, y, z + 1) - v;
            e += gx * gx + gy * gy + gz * gz; c++;
        }
        return e / c;
    };
    let err = 0, worst = 0, cells = 0;
    for (let cz = 1; cz < 7; cz++) for (let cy = 1; cy < 7; cy++) for (let cx = 1; cx < 7; cx++) {
        let f = 0, c = 0;
        for (let z = 0; z < 8; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
            f += at(snap.fine, cx * 8 + x, cy * 8 + y, cz * 8 + z);
            c += at(snap.coarse, cx * 8 + x, cy * 8 + y, cz * 8 + z);
        }
        const d = Math.abs(f - c) / 512;
        err += d; worst = Math.max(worst, d); cells++;
    }
    return { detailRatio: energy(snap.fine) / Math.max(1e-12, energy(snap.coarse)),
             cellMeanErr: err / cells, cellMeanWorst: worst };
}"""


def verify() -> None:
    hardware = os.environ.get("CLIPMAP_GPU") == "hardware"
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.split("?")[0])
        with sync_playwright() as p:
            launch = {"headless": True, "args": HARDWARE_WEBGPU_ARGS if hardware else SOFTWARE_WEBGPU_ARGS}
            if os.environ.get("CHROME_PATH"):
                launch["executable_path"] = os.environ["CHROME_PATH"]
            browser = p.chromium.launch(**launch)
            # Small viewport: a software adapter renders every pixel on the CPU.
            page = browser.new_page(viewport={"width": 360, "height": 270})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" and "404" not in msg.text else None)

            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_function("() => window.__clipmapDebug && window.__clipmapDebug.renderer.isRunning", timeout=180_000)
            backend = page.evaluate("() => window.__clipmapDebug.renderer.backendType")
            if backend != "webgpu":
                print(f"SKIP: no WebGPU adapter (app fell back to {backend})")
                return

            # Heatmap, facing the occipital pole, cascades off so the stroke reads.
            page.evaluate(
                """() => {
                    const d = window.__clipmapDebug, r = d.renderer;
                    d.setOptions({ autoQuality: false, focus: 'camera', jobBudgetMs: 60 });
                    r.setParams({ style: 3, spikeThreshold: 1.0, amplitude: 0.1 });
                    r.zoom = r.targetZoom = 2.5;
                    r.rotation.y = r.targetRotation.y = Math.PI;
                    r.rotation.x = r.targetRotation.x = 0.0;
                    // A deterministic paint stroke keyed to simulation time, not wall clock.
                    const t0 = r.time, step = r.updateClipmapFrame.bind(r);
                    r.updateClipmapFrame = function() {
                        const t = this.time - t0;
                        if (t > 0.3 && t < 0.5) {
                            const u = (t - 0.3) / 0.2;
                            this.injectStimulus(-0.18 + 0.4 * u, -0.12 + 0.25 * u, -1.25, 0.8, 0, 0.06);
                        }
                        return step();
                    };
                }"""
            )
            wait_sim_seconds(page, 0.8)
            s = state(page)
            assert s["active"] and s["mode"] == "simulate", f"brick should be simulating: {s['mode']}"
            assert s["center"][2] < -0.5, f"brick should sit in occipital cortex, centre {s['center']}"
            assert not s["gpuError"] and not s["lost"], f"GPU error: {s['gpuError']}"
            metrics = page.evaluate(BRICK_METRICS_JS)
            print("brick metrics:", json.dumps(metrics))
            assert metrics["cellMeanErr"] < 0.02, f"brick drifted from the coarse field: {metrics}"
            assert metrics["detailRatio"] > 1.5, f"brick adds no detail over the coarse field: {metrics}"
            page.screenshot(path=str(OUT / "clipmap_heatmap.png"))

            # Phase C: organic style below the patch threshold.
            page.evaluate("() => { const r = window.__clipmapDebug.renderer; r.setParams({ style: 0 }); r.zoom = r.targetZoom = 2.25; }")
            page.wait_for_function("() => window.__clipmapDebug.getState().patch.state === 'mesh'", timeout=900_000, polling=250)
            wait_sim_seconds(page, 0.3)
            s = state(page)
            assert s["patch"]["blend"] > 0.5, f"patch should be swapped in: {s['patch']}"
            page.evaluate("() => { for (const el of document.querySelectorAll('body > *:not(canvas)')) el.style.visibility = 'hidden'; }")
            page.screenshot(path=str(OUT / "clipmap_patch.png"))
            page.evaluate("() => { for (const el of document.querySelectorAll('body > *:not(canvas)')) el.style.visibility = ''; }")

            page.evaluate("() => window.__clipmapDebug.renderer.setParams({ cognitiveLoad: 0.5 })")
            wait_sim_seconds(page, 0.05)
            s = state(page)
            assert s["tierName"] == "reduced" and s["patch"]["state"] == "impostor", f"cognitiveLoad 0.5 should give impostors: {s['tierName']} {s['patch']}"

            # Pull back: the brick fades and stops.
            page.evaluate("() => { const r = window.__clipmapDebug.renderer; r.setParams({ cognitiveLoad: 0.0 }); r.targetZoom = 3.6; }")
            page.wait_for_function("() => !window.__clipmapDebug.getState().active", timeout=900_000, polling=250)

            timings = state(page)["timings"]
            print("timings:", json.dumps(timings))
            if timings["gpuTimestamps"]:
                assert timings["fieldMs"] is not None and timings["renderMs"] is not None, "GPUTimer should report compute and render"

            fatal = [e for e in errors if "WebGPU" in e or "GPUValidationError" in e]
            assert not fatal, f"WebGPU errors in console: {fatal}"
            print("verify_clipmap_webgpu: OK")
            browser.close()
    finally:
        stop_dev_server(server)


if __name__ == "__main__":
    try:
        verify()
    except AssertionError as exc:
        print(f"FAIL: {exc}")
        sys.exit(1)

"""Visual/behavioural verification for [Phase 6] immune cell migration.

Runs against the WebGL2 fallback (headless CI has no WebGPU) and checks that:
  * an `immune_migration` event seeds the particle pool and raises immuneActivity
  * particles actually move along their vascular path between frames
  * the WebGL fallback draws simplified CPU point sprites
  * `glial_cleanup` releases the particles once cleanup completes
  * a `histamine` event recruits immune cells to the inflamed region

Headless Chromium throttles requestAnimationFrame almost to a standstill, so the
renderer clock is stepped explicitly rather than waiting on wall-clock time.
"""

import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5186/?renderer=webgl"


def wait_for_server(url: str, timeout: float = 25.0) -> None:
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
    return subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5186", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def immune_state(page):
    return page.evaluate(
        """() => {
            const r = window.routineEngine.renderer;
            return {
                activity: r.params.immuneActivity || 0,
                active: r.immunePool ? r.immunePool.activeCount : -1,
                drawn: r.immuneDrawCount ?? -1,
                positions: Array.from(r.immunePositions ? r.immunePositions.slice(0, 30) : []),
            };
        }"""
    )


def run_event(page, event: str) -> None:
    page.evaluate(f"() => window.routineEngine.executeEvent({event})")


def step_clock(page, seconds: float) -> None:
    """Advance the renderer clock and re-integrate the CPU particles.

    rAF is throttled to a couple of frames per second in headless Chromium, so
    the fallback's own render loop cannot be relied on to animate anything.
    """
    page.evaluate(
        f"""() => {{
            const r = window.routineEngine.renderer;
            r.time += {seconds};
            r.updateImmuneParticles();
        }}"""
    )


def verify() -> None:
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.replace("?renderer=webgl", ""))
        output_dir = ROOT / "verification"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#canvas", state="attached", timeout=10000)
            page.wait_for_timeout(2000)

            if page.locator("#error.visible").count() > 0:
                raise AssertionError("Error overlay became visible")

            idle = immune_state(page)
            if idle["active"] < 0:
                raise AssertionError("Renderer has no immune particle pool")
            if idle["drawn"] != 0:
                raise AssertionError(f"Immune particles drawn while idle: {idle['drawn']}")

            # --- Surge -------------------------------------------------------
            run_event(page, "{ type: 'immune_migration', target: 'frontal', intensity: 1.0, duration: 0 }")
            step_clock(page, 2.0)
            surged = immune_state(page)
            if surged["active"] <= 0:
                raise AssertionError("immune_migration did not seed the particle pool")
            if surged["activity"] <= 0.0:
                raise AssertionError("immuneActivity stayed at zero after immune_migration")
            if surged["drawn"] <= 0:
                raise AssertionError("WebGL fallback drew no immune particles during a surge")

            first = surged["positions"]
            step_clock(page, 0.5)
            moved = immune_state(page)
            drift = max(
                (abs(a - b) for a, b in zip(first, moved["positions"])),
                default=0.0,
            )
            if drift < 1e-3:
                raise AssertionError(f"Immune particles are not migrating (max drift {drift:.5f})")

            page.screenshot(path=str(output_dir / "immune_migration.png"))

            # --- Cleanup releases the particles ------------------------------
            run_event(page, "{ type: 'glial_cleanup', intensity: 1.0, duration: 0.2 }")
            page.wait_for_timeout(1200)
            cleaned = immune_state(page)
            if cleaned["active"] != 0 or cleaned["drawn"] != 0:
                raise AssertionError(
                    f"glial_cleanup left immune particles behind (active={cleaned['active']}, drawn={cleaned['drawn']})"
                )
            page.screenshot(path=str(output_dir / "immune_cleanup.png"))

            # --- Histamine recruits immune cells -----------------------------
            run_event(page, "{ type: 'histamine', target: 'frontal', intensity: 1.5, duration: 0 }")
            step_clock(page, 2.0)
            inflamed = immune_state(page)
            if inflamed["drawn"] <= 0:
                raise AssertionError("A histamine event produced no immune particle streams")
            page.screenshot(path=str(output_dir / "immune_histamine.png"))

            run_event(page, "{ type: 'immune_resolve', duration: 0 }")
            step_clock(page, 0.1)
            resolved = immune_state(page)
            if resolved["drawn"] != 0:
                raise AssertionError("immune_resolve did not clear the particles")

            browser.close()

            if errors:
                raise AssertionError(f"Console/page errors: {errors[:5]}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()

    print("[verify_immune] OK")


if __name__ == "__main__":
    try:
        verify()
    except Exception as exc:  # noqa: BLE001 - surface failures to CI
        print(f"[verify_immune] FAILED: {exc}")
        sys.exit(1)

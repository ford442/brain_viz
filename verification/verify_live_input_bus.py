"""Live Input Bus verification (docs/live-input-bus.md).

Confirms the Live tab renders, a mapping can be added through the UI (mirrors
verify_neuromodulators.py's panel-interaction style), and — the WebGL-fallback
mocked-feature tick the feature's acceptance criteria calls for — that a
registered source with a mocked sample() drives a renderer param through one
`LiveInputBus.tick()` call.
"""
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5187/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5187", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify() -> None:
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.replace("?renderer=webgl", ""))
        output_dir = ROOT / "verification"
        output_dir.mkdir(exist_ok=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-gpu"],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#canvas", state="attached", timeout=10000)
            page.wait_for_timeout(2000)

            overlay_visible = page.locator("#error.visible").count() > 0
            if overlay_visible:
                raise AssertionError("Error overlay became visible")

            # Fresh mapping profile so this run's UI assertions are deterministic.
            page.evaluate("() => localStorage.removeItem('neuroWeaver.liveInputBus.mappings')")

            assert page.evaluate("() => !!window.__liveInputDebug?.bus"), (
                "window.__liveInputDebug.bus not exposed — live input bus failed to initialize"
            )

            # Switch to the Live tab.
            page.click('.tab-btn[data-tab="tab-live"]')
            page.wait_for_timeout(300)
            assert page.locator("#tab-live.tab-pane.active").count() > 0, (
                "Live tab did not become active"
            )
            assert page.locator("#live-bus-grid").count() > 0, "Live mapping grid missing"

            # --- UI interaction: add a mapping row via the panel ---
            assert page.locator("#live-bus-grid select").count() == 0, "expected no mapping rows before adding one"
            page.click("#btn-live-bus-add")
            page.wait_for_timeout(200)
            assert page.locator("#live-bus-grid select").count() >= 3, (
                "Adding a mapping should render source/feature/sink selects"
            )
            page.screenshot(path=str(output_dir / "live_input_bus_tab.png"))

            # --- Mocked-feature tick: register a test source with a fixed
            # sample(), add a mapping to a renderer param, tick once, and
            # confirm the param moved by scale * feature value. This is the
            # "WebGL verification covers at least one live-mapping tick
            # (mocked features)" acceptance criterion.
            result = page.evaluate(
                """() => {
                    const { bus } = window.__liveInputDebug;
                    const renderer = bus.renderer;
                    bus.registerSource('__verify_mock', {
                        hz: 1000,
                        features: ['level'],
                        sample: () => ({ level: 0.8 }),
                    });
                    const before = renderer.params.sparkle;
                    const mapping = bus.addMapping({
                        source: '__verify_mock', feature: 'level', sink: 'sparkle',
                        scale: 2, attack: 0.001, release: 0.001, enabled: true,
                    });
                    bus.tick(1, performance.now());
                    const after = renderer.params.sparkle;
                    bus.removeMapping(mapping.id);
                    bus.unregisterSource('__verify_mock');
                    return { before, after, delta: after - before };
                }"""
            )
            assert abs(result["delta"] - 1.6) < 1e-6, (
                f"Expected a mocked live-mapping tick to move sparkle by scale*feature=1.6, got {result}"
            )

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Live Input Bus verification passed.")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    verify()

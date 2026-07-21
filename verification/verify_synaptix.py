import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5180/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5180", "--strictPort"],
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
                args=[
                    "--no-sandbox",
                    "--disable-gpu",
                ],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#canvas", state="attached", timeout=10000)
            page.wait_for_timeout(2500)

            overlay_visible = page.locator("#error.visible").count() > 0
            if overlay_visible:
                raise AssertionError("Error overlay became visible")

            page.click('[data-tab="tab-synaptix"]')
            page.wait_for_timeout(300)
            page.select_option("#ai-pattern", "aligned-prefrontal")
            page.evaluate("() => document.querySelector('#btn-generate-ai')?.click()")
            page.wait_for_timeout(700)
            page.screenshot(path=str(output_dir / "synaptix_pure_ai.png"))

            page.evaluate("() => document.querySelector('#stim-frontal')?.click()")
            page.wait_for_timeout(400)
            page.screenshot(path=str(output_dir / "synaptix_pure_human.png"))

            page.evaluate("() => window.__synaptixDebug.runShowcase()")

            # The showcase routine ramps aiInfluence via a lerp starting at t=2.0s and
            # only reaches the resonant pattern (aiInfluence 0.82) around t=4.7s of
            # *routine* time. Headless/software rendering can stretch that wall-clock
            # window unpredictably (GPU readback stalls delay the routine's own
            # timeline compensation), so poll instead of trusting a fixed sleep.
            state = None
            deadline = time.time() + 20.0
            while time.time() < deadline:
                state = page.evaluate("() => window.__synaptixDebug.getState()")
                if state["aiInfluence"] >= 0.6 and state["resonanceThreshold"] <= 0.2:
                    break
                page.wait_for_timeout(500)

            assert state["style"] >= 4, state
            assert state["frameCount"] >= 4, state
            assert state["aiInfluence"] >= 0.6, state
            assert state["resonanceThreshold"] <= 0.2, state

            page.screenshot(path=str(output_dir / "synaptix_resonant_blend.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("SynaptiX verification passed.")
            print(f"State: {state}")
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    try:
        verify()
    except Exception as exc:
        print(f"verify_synaptix failed: {exc}")
        sys.exit(1)

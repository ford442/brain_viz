import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5188/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5188", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def set_slider(page, slider_id: str, value: str) -> None:
    page.evaluate(
        """([id, val]) => {
            const el = document.getElementById(id);
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }""",
        [slider_id, value],
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

            page.click('[data-tab="tab-cinematic"]')
            page.wait_for_timeout(300)

            set_slider(page, "shake", "0.3")
            set_slider(page, "aberration", "1.5")
            set_slider(page, "grain", "0.8")
            page.wait_for_timeout(600)
            page.screenshot(path=str(output_dir / "cinematic_fx_shake_aberration_grain.png"))

            # Reset the lens FX, then push depth-of-field controls instead.
            set_slider(page, "shake", "0.0")
            set_slider(page, "aberration", "0.0")
            set_slider(page, "grain", "0.0")
            set_slider(page, "focus", "0.9")
            set_slider(page, "aperture", "0.8")
            page.wait_for_timeout(600)
            page.screenshot(path=str(output_dir / "cinematic_fx_dof.png"))

            # Volumetric fog lives in the Activity tab alongside growth/sparkle.
            page.click('[data-tab="tab-activity"]')
            page.wait_for_timeout(300)
            set_slider(page, "fogDensity", "0.4")
            page.wait_for_timeout(600)
            page.screenshot(path=str(output_dir / "cinematic_fx_fog.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Cinematic FX verification passed.")
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
        print(f"verify_cinematic_fx failed: {exc}")
        sys.exit(1)

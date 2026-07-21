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
            # ONNX Runtime init (or its synthetic fallback) takes a moment.
            page.wait_for_timeout(3000)

            overlay_visible = page.locator("#error.visible").count() > 0
            if overlay_visible:
                raise AssertionError("Error overlay became visible")

            page.click('[data-tab="tab-synaptix"]')
            page.wait_for_timeout(300)

            status_text = page.locator("#live-source-status").text_content() or ""
            assert status_text.startswith("status:"), f"Unexpected initial status: {status_text}"
            page.screenshot(path=str(output_dir / "ai_inference_initial.png"))

            # No window.setSynaptiXLiveSource callback is defined in this smoke test,
            # so enabling the toggle must fail closed: uncheck itself and report the reason.
            page.evaluate(
                "() => { const el = document.getElementById('live-source-enable'); "
                "el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }"
            )
            page.wait_for_timeout(300)

            status_after = page.locator("#live-source-status").text_content() or ""
            assert "no callback defined" in status_after, (
                f"Expected live source to fail closed without a callback, got: {status_after}"
            )
            checked = page.evaluate("() => document.getElementById('live-source-enable').checked")
            assert checked is False, "Live source checkbox should auto-uncheck without a callback"
            page.screenshot(path=str(output_dir / "ai_inference_no_callback.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print(f"AI inference verification passed. Initial status: {status_text}")
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
        print(f"verify_ai_inference failed: {exc}")
        sys.exit(1)

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

            opened = page.evaluate(
                "() => { const btn = Array.from(document.querySelectorAll('button'))"
                ".find(b => b.textContent === 'Open Timeline Editor'); "
                "if (!btn) return false; btn.click(); return true; }"
            )
            assert opened, "Could not find 'Open Timeline Editor' button"
            page.wait_for_timeout(500)

            added = page.evaluate(
                "() => { const btn = Array.from(document.querySelectorAll('button'))"
                ".find(b => b.textContent === '+ Add Event'); "
                "if (!btn) return false; btn.click(); return true; }"
            )
            assert added, "Could not find '+ Add Event' button"
            page.wait_for_timeout(500)

            has_event_block = page.evaluate(
                "() => Array.from(document.querySelectorAll('div'))"
                ".some(d => d.textContent === 'text' && d.style.position === 'absolute')"
            )
            assert has_event_block, "Timeline did not render the newly added event block"
            page.screenshot(path=str(output_dir / "timeline_editor_populated.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Timeline editor verification passed.")
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
        print(f"verify_timeline_editor failed: {exc}")
        sys.exit(1)

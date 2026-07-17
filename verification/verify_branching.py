import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5190/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5190", "--strictPort"],
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

            # 'q' starts the interactive neuro-storytelling mini-routine, which
            # pauses on a 'choice' event and renders #choice-btn-N buttons.
            page.keyboard.press("q")
            page.wait_for_timeout(4500)

            visible = page.evaluate(
                "() => document.getElementById('visual-overlay')?.style.display"
            )
            assert visible == "block", f"Expected choice overlay visible, got display={visible}"
            page.screenshot(path=str(output_dir / "branching_choice_overlay.png"))

            # Pick the "Investigate Signal" branch (choice-btn-0) and confirm the
            # routine continues into the q_investigate sub-routine.
            page.click("#choice-btn-0")
            page.wait_for_timeout(600)

            hidden = page.evaluate(
                "() => document.getElementById('visual-overlay')?.style.display"
            )
            assert hidden == "none", f"Expected choice overlay to close after selection, got display={hidden}"

            narrative_opacity = page.evaluate(
                "() => document.getElementById('narrative-overlay')?.style.opacity"
            )
            assert narrative_opacity == "1", (
                f"Expected branch narrative visible after choosing, got opacity={narrative_opacity}"
            )
            page.screenshot(path=str(output_dir / "branching_investigate_branch.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Branching verification passed.")
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
        print(f"verify_branching failed: {exc}")
        sys.exit(1)

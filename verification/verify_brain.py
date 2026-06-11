import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5181/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5181", "--strictPort"],
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

            # Verify backend is WebGL
            backend_text = page.locator("#renderer-status").text_content() or ""
            assert "webgl" in backend_text.lower(), f"Expected WebGL backend, got: {backend_text}"

            page.screenshot(path=str(output_dir / "brain_initial.png"))

            # Cycle through all styles
            styles = [
                ("0", "brain_organic"),
                ("1", "brain_cyber"),
                ("2", "brain_connectome"),
                ("3", "brain_heatmap"),
                ("4", "brain_synaptix"),
            ]
            for value, name in styles:
                page.select_option("#style-mode", value)
                page.wait_for_timeout(800)
                page.screenshot(path=str(output_dir / f"{name}.png"))

            # Test WebGL debug controls via JS to bypass collapsible-section overlays
            page.evaluate("""
                () => {
                    const wf = document.getElementById('webgl-debug-wireframe');
                    const iso = document.getElementById('webgl-debug-isolate');
                    const tf = document.getElementById('webgl-debug-tensor');
                    wf.checked = true;
                    wf.dispatchEvent(new Event('change', { bubbles: true }));
                    iso.value = 'mesh';
                    iso.dispatchEvent(new Event('change', { bubbles: true }));
                    tf.checked = false;
                    tf.dispatchEvent(new Event('change', { bubbles: true }));
                }
            """)
            page.wait_for_timeout(500)
            page.screenshot(path=str(output_dir / "brain_wireframe_mesh.png"))

            # Isolate fibers
            page.evaluate("""
                () => {
                    const wf = document.getElementById('webgl-debug-wireframe');
                    const iso = document.getElementById('webgl-debug-isolate');
                    wf.checked = false;
                    wf.dispatchEvent(new Event('change', { bubbles: true }));
                    iso.value = 'fibers';
                    iso.dispatchEvent(new Event('change', { bubbles: true }));
                }
            """)
            page.wait_for_timeout(500)
            page.screenshot(path=str(output_dir / "brain_isolate_fibers.png"))

            # Isolate tensor
            page.evaluate("""
                () => {
                    const iso = document.getElementById('webgl-debug-isolate');
                    const tf = document.getElementById('webgl-debug-tensor');
                    iso.value = 'tensor';
                    iso.dispatchEvent(new Event('change', { bubbles: true }));
                    tf.checked = true;
                    tf.dispatchEvent(new Event('change', { bubbles: true }));
                }
            """)
            page.wait_for_timeout(500)
            page.screenshot(path=str(output_dir / "brain_isolate_tensor.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Brain rendering verification passed.")
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
        print(f"verify_brain failed: {exc}")
        sys.exit(1)

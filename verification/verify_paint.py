import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5183/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5183", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def tensor_sum(page) -> float:
    return page.evaluate(
        "() => Array.from(window.routineEngine.renderer._lastHumanTensor)"
        ".reduce((a, b) => a + b, 0)"
    )


def stimulus_pos(page):
    return page.evaluate("() => window.routineEngine.renderer.stimulus.pos.slice()")


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

            # Open Stimulus tab so the Paint Energy controls are visible
            page.click('[data-tab="tab-stimulus"]')
            page.wait_for_timeout(300)

            has_paint_controller = page.evaluate("() => !!window.routineEngine?.paintController")
            if not has_paint_controller:
                raise AssertionError("window.routineEngine.paintController is not wired up")

            # Enable paint mode. The Paint Energy section is collapsed by
            # default (accordion UI), so click via evaluate() rather than
            # Playwright's actionability-checked click() — matches the
            # pattern used for the (also-collapsed-by-default) region
            # buttons in verify_stimulus.py.
            page.evaluate("() => document.getElementById('paint-toggle')?.click()")
            page.wait_for_timeout(200)
            enabled = page.evaluate("() => window.routineEngine.paintController.enabled")
            if not enabled:
                raise AssertionError("Paint mode did not enable after clicking #paint-toggle")

            canvas = page.locator("#canvas")
            box = canvas.bounding_box()
            if not box:
                raise AssertionError("Canvas has no bounding box")

            baseline_sum = tensor_sum(page)

            # Drag stroke across two distinct points on the canvas.
            point_a = (box["x"] + box["width"] * 0.3, box["y"] + box["height"] * 0.4)
            point_b = (box["x"] + box["width"] * 0.7, box["y"] + box["height"] * 0.6)

            page.mouse.move(*point_a)
            page.mouse.down()
            page.wait_for_timeout(150)
            pos_a = stimulus_pos(page)

            page.mouse.move(*point_b, steps=10)
            page.wait_for_timeout(150)
            pos_b = stimulus_pos(page)

            page.mouse.up()
            page.wait_for_timeout(300)
            page.screenshot(path=str(output_dir / "paint_stroke.png"))

            dx = pos_a[0] - pos_b[0]
            dy = pos_a[1] - pos_b[1]
            dz = pos_a[2] - pos_b[2]
            drag_distance = (dx * dx + dy * dy + dz * dz) ** 0.5
            if drag_distance < 0.05:
                raise AssertionError(
                    f"Brush target barely moved across the drag ({drag_distance:.4f}); "
                    "raycast may not be tracking the pointer"
                )

            painted_sum = tensor_sum(page)
            if painted_sum <= baseline_sum + 0.01:
                raise AssertionError(
                    f"Tensor energy did not increase while painting (before={baseline_sum:.4f}, "
                    f"after={painted_sum:.4f})"
                )

            # Disable paint mode and confirm further drags stop injecting.
            page.evaluate("() => document.getElementById('paint-toggle')?.click()")
            page.wait_for_timeout(200)
            disabled = page.evaluate("() => !window.routineEngine.paintController.enabled")
            if not disabled:
                raise AssertionError("Paint mode did not disable after clicking #paint-toggle again")

            after_disable_sum = tensor_sum(page)
            page.mouse.move(*point_a)
            page.mouse.down()
            page.mouse.move(*point_b, steps=10)
            page.wait_for_timeout(300)
            page.mouse.up()
            post_disable_sum = tensor_sum(page)
            if post_disable_sum > after_disable_sum + 0.01:
                raise AssertionError(
                    "Tensor energy increased from a drag after disabling paint mode "
                    f"(before={after_disable_sum:.4f}, after={post_disable_sum:.4f})"
                )

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Paint verification passed.")
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
        print(f"verify_paint failed: {exc}")
        sys.exit(1)

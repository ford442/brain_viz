import json
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

            # Clear any prior session history so this run's assertions are clean.
            page.evaluate("() => localStorage.removeItem('neuro_weaver_training_history')")

            # Switch to the Training tab.
            page.click('.tab-btn[data-tab="tab-training"]')
            page.wait_for_timeout(300)
            assert page.locator("#tab-training.tab-pane.active").count() > 0, (
                "Training tab did not become active"
            )
            assert page.locator("#training-course-select").count() > 0, (
                "Training course picker missing"
            )

            # --- Full completion pass: Panic Recovery (key '7', 15s hold) ---
            page.keyboard.press("7")
            page.wait_for_timeout(3000)
            objective_text = page.locator("#training-objective-label").inner_text()
            assert "Panic Recovery" in objective_text, (
                f"Expected Panic Recovery objective active, got: {objective_text!r}"
            )

            # Poll until the course completes (holdTime must accumulate for 15s
            # inside the demo-driven calm band) or a generous timeout elapses.
            deadline = time.time() + 25
            completed = False
            while time.time() < deadline:
                history_raw = page.evaluate(
                    "() => localStorage.getItem('neuro_weaver_training_history')"
                )
                history = json.loads(history_raw) if history_raw else []
                if history and history[0].get("courseId") == "panic-recovery":
                    completed = history[0]
                    break
                page.wait_for_timeout(1000)

            assert completed, "Panic Recovery course never completed within the timeout"
            assert completed["success"] is True, f"Panic Recovery did not succeed: {completed}"
            assert completed["stars"] >= 1, f"Expected at least 1 star, got: {completed}"
            page.screenshot(path=str(output_dir / "training_panic_recovery_complete.png"))

            # --- Quick smoke pass for the other two built-in courses ---
            for key, name in [("6", "Calm Focus"), ("8", "Flow Sustain")]:
                page.keyboard.press(key)
                page.wait_for_timeout(2500)
                objective_text = page.locator("#training-objective-label").inner_text()
                assert name in objective_text, (
                    f"Expected {name} objective active after pressing '{key}', got: {objective_text!r}"
                )
                metric_val = page.evaluate(
                    "() => document.getElementById('training-metric-val')?.textContent"
                )
                assert metric_val and "value:" in metric_val, (
                    f"Expected live metric readout for {name}, got: {metric_val!r}"
                )
                page.screenshot(path=str(output_dir / f"training_{name.lower().replace(' ', '_')}.png"))

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print("Training mode verification passed.")
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
        print(f"verify_training failed: {exc}")
        sys.exit(1)

"""[Neuro-Script] Gallery, sandboxed import, fork lineage, .nwroutine export,
and the Multi-Brain demo, end to end on the WebGL2 fallback."""

import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5196/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5196", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def gallery_row_click(page, title: str, button_title: str) -> None:
    clicked = page.evaluate(
        """([title, buttonTitle]) => {
            const rows = Array.from(document.querySelectorAll('.nwroutine-gallery > div > div'));
            const row = rows.find(r => r.firstChild && r.firstChild.firstChild
                && r.firstChild.firstChild.textContent === title);
            if (!row) return false;
            const btn = Array.from(row.querySelectorAll('button')).find(b => b.title.startsWith(buttonTitle));
            if (!btn) return false;
            btn.click();
            return true;
        }""",
        [title, button_title],
    )
    assert clicked, f"Could not click {button_title!r} on gallery row {title!r}"


def status_text(page) -> str:
    return page.evaluate("() => document.querySelector('.nwroutine-gallery [role=status]').textContent")


def wait_for_status(page, needle: str) -> None:
    """FileReader is async; wait for the status line instead of sleeping."""
    try:
        page.wait_for_function(
            "(needle) => document.querySelector('.nwroutine-gallery [role=status]').textContent.includes(needle)",
            arg=needle,
            timeout=10000,
        )
    except Exception:
        pass  # the assertion that follows reports what the status actually says


def verify() -> None:
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.replace("?renderer=webgl", ""))
        output_dir = ROOT / "verification"

        sneaky = {
            "format": "nwroutine",
            "formatVersion": "1.0.0",
            "manifest": {"id": "test-sneaky", "title": "Sneaky Drip", "author": "stranger"},
            "routine": [
                {"time": 0, "type": "text", "message": "hello"},
                {"time": 0.5, "type": "drug_delivery", "target": "frontal", "intensity": 0.2},
            ],
        }
        tmp = Path(tempfile.mkdtemp())
        sneaky_path = tmp / "sneaky.nwroutine"
        sneaky_path.write_text(json.dumps(sneaky))

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            page = browser.new_page(viewport={"width": 1440, "height": 960}, accept_downloads=True)
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector(".nwroutine-gallery", state="attached", timeout=15000)
            page.wait_for_timeout(1500)

            # 1. Gallery lists every built-in.
            titles = page.evaluate(
                "() => Array.from(document.querySelectorAll('.nwroutine-gallery > div > div'))"
                ".map(r => r.firstChild && r.firstChild.firstChild ? r.firstChild.firstChild.textContent : '')"
            )
            for expected in ["Deep Thought", "SynaptiX: Two Minds", "Multi-Brain: I Reach, You Move"]:
                assert expected in titles, f"Gallery is missing {expected!r}: {titles}"

            # 2. Untrusted import of a sandboxed type is refused.
            file_input = page.locator(".nwroutine-gallery input[type=file]")
            file_input.set_input_files(str(sneaky_path))
            wait_for_status(page, "sneaky.nwroutine was not loaded")
            text = status_text(page)
            assert "was not loaded" in text and "I trust this file" in text, f"Untrusted import not refused: {text}"
            active = page.evaluate("() => window.routineEngine.activePackage?.manifest?.id ?? null")
            assert active != "test-sneaky", "Refused package was loaded anyway"

            # 3. With the override it loads.
            page.check("#nwroutine-trust")
            file_input.set_input_files(str(sneaky_path))
            wait_for_status(page, 'Loaded "Sneaky Drip"')
            text = status_text(page)
            assert 'Loaded "Sneaky Drip"' in text, f"Trusted import failed: {text}"
            assert page.evaluate("() => window.routineEngine.activePackage.manifest.id") == "test-sneaky"
            page.uncheck("#nwroutine-trust")
            page.evaluate("() => window.routineEngine.stop()")

            # 4. Fork a built-in: the fork is loaded and points at its parent.
            gallery_row_click(page, "Deep Thought", "Fork")
            page.wait_for_function(
                "() => window.routineEngine.activePackage?.manifest?.parentId != null", timeout=10000
            )
            fork = page.evaluate("() => window.routineEngine.activePackage.manifest")
            assert fork["parentId"] == "builtin:deep_thought", f"Fork lineage wrong: {fork}"
            assert fork["title"] == "Deep Thought (fork)"
            assert "Deep Thought (fork)" in page.evaluate(
                "() => document.querySelector('.nwroutine-gallery').textContent"
            )
            assert "forked from Deep Thought" in page.evaluate(
                "() => document.querySelector('.nwroutine-gallery').textContent"
            )

            # 5. Export the fork from the timeline editor (no prompt: it was made
            #    this session, so it keeps its id and parent).
            page.evaluate(
                "() => Array.from(document.querySelectorAll('button'))"
                ".find(b => b.textContent === 'Open Timeline Editor').click()"
            )
            page.wait_for_function(
                "() => Array.from(document.querySelectorAll('button'))"
                ".some(b => b.textContent === '📦 Export .nwroutine' && b.offsetParent !== null)",
                timeout=10000,
            )
            with page.expect_download() as download_info:
                page.evaluate(
                    "() => Array.from(document.querySelectorAll('button'))"
                    ".find(b => b.textContent === '📦 Export .nwroutine' && b.offsetParent !== null).click()"
                )
            download = download_info.value
            assert download.suggested_filename == "deep-thought-fork.nwroutine", download.suggested_filename
            exported = json.loads(Path(download.path()).read_text())
            assert exported["format"] == "nwroutine"
            assert exported["manifest"]["id"] == fork["id"]
            assert exported["manifest"]["parentId"] == "builtin:deep_thought"
            assert len(exported["routine"]) > 5
            page.evaluate(
                "() => Array.from(document.querySelectorAll('button'))"
                ".filter(b => b.textContent === 'Close' && b.offsetParent !== null).forEach(b => b.click())"
            )

            # 6. Multi-Brain demo: two cortices, each with its own tensor.
            gallery_row_click(page, "Multi-Brain: I Reach, You Move", "Play")
            page.wait_for_function(
                "() => window.routineEngine.activePackage?.manifest?.id === 'builtin:mirror_neuron_reach'",
                timeout=10000,
            )
            # Software WebGL ticks ~1 fps and routine time advances at most
            # 0.1 s per tick, so jump ahead; the next tick fires every event
            # up to 5.2 s in order.
            page.evaluate("() => { window.routineEngine.elapsedTime = 5.2; }")
            page.wait_for_function("() => window.routineEngine.elapsedTime > 5.2", timeout=15000)
            page.wait_for_timeout(1500)
            params = page.evaluate(
                "() => { const r = window.routineEngine.renderer; "
                "return { style: r.params.style, dual: r.params.dualAvatarEnabled ?? true, "
                "partnerMax: (r._lastAITensor || []).reduce((m, v) => Math.max(m, v), 0) }; }"
            )
            assert params["style"] >= 4 and params["dual"], f"Multi-Brain not active: {params}"
            # By 5.2 s of routine time the partner has received the parietal echo (WebGL keeps
            # the partner tensor in _lastAITensor).
            assert params["partnerMax"] > 0.3, f"Partner cortex was never driven: {params}"
            assert page.evaluate("() => document.getElementById('dual-avatar-toggle').checked")
            page.screenshot(path=str(output_dir / "multi_brain_demo.png"))

            hard_errors = [e for e in errors if "404" not in e and "favicon" not in e.lower()]
            if hard_errors:
                raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))

            browser.close()
            print(f"Neuro-Script verification passed. (partner max {params['partnerMax']:.3f})")
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
        print(f"verify_nwroutine failed: {exc}")
        sys.exit(1)

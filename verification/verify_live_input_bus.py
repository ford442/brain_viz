"""Live Input Bus verification (docs/live-input-bus.md).

Confirms the Live tab renders, a mapping can be added through the UI (mirrors
verify_neuromodulators.py's panel-interaction style), and — the WebGL-fallback
mocked heart-rate notification drives a renderer parameter through the bus.
"""
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5187/?renderer=webgl&external=wss%3A%2F%2Fexample.test%2Flive"


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
        [str(ROOT / "node_modules" / ".bin" / "vite"), "--host", "127.0.0.1", "--port", "5187", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify() -> None:
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.split("?")[0])
        output_dir = ROOT / "verification"
        output_dir.mkdir(exist_ok=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-gpu"],
            )
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            failed_requests = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.on("requestfailed", lambda request: failed_requests.append(request.url))
            page.route("https://fonts.googleapis.com/**", lambda route: route.fulfill(status=200, body="", content_type="text/css"))

            page.add_init_script("""(() => {
                class Characteristic extends EventTarget {
                    async startNotifications() { return this; }
                    async stopNotifications() { return this; }
                    emit(bpm) {
                        this.value = new DataView(Uint8Array.from([0, bpm]).buffer);
                        this.dispatchEvent(new Event('characteristicvaluechanged'));
                    }
                }
                const characteristic = window.__mockHrCharacteristic = new Characteristic();
                const device = new EventTarget();
                device.name = 'Mock strap';
                device.gatt = {
                    connected: false,
                    async connect() { this.connected = true; return this; },
                    async getPrimaryService() {
                        return { async getCharacteristic() { return characteristic; } };
                    },
                    disconnect() { this.connected = false; },
                };
                Object.defineProperty(navigator, 'bluetooth', {
                    configurable: true,
                    value: { async requestDevice() { return device; } },
                });
                const NativeWebSocket = window.WebSocket;
                window.WebSocket = class {
                    constructor(url, ...args) {
                        if (url !== 'wss://example.test/live') return new NativeWebSocket(url, ...args);
                        window.__mockExternalSocket = this;
                    }
                };
            })()""")
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

            # Unknown numeric channels become selectable; malformed entries do not.
            page.evaluate("""() => {
                window.__mockExternalSocket.onmessage({ data: JSON.stringify({
                    channels: { custom_knob: 0.75, bad_value: 'x', 'bad.name': 1 }
                }) });
            }""")
            # --- UI interaction: add a mapping row via the panel ---
            assert page.locator("#live-bus-grid select").count() == 0, "expected no mapping rows before adding one"
            page.click("#btn-live-bus-add")
            page.wait_for_timeout(200)
            assert page.locator("#live-bus-grid select").count() >= 3, (
                "Adding a mapping should render source/feature/sink selects"
            )
            selects = page.locator("#live-bus-grid select")
            selects.nth(0).select_option("external")
            assert selects.nth(1).locator('option[value="custom_knob"]').count() == 1
            assert selects.nth(1).locator('option[value="bad_value"]').count() == 0
            assert selects.nth(1).locator('option[value="bad.name"]').count() == 0
            page.click("#btn-live-hr-connect")
            page.wait_for_function("() => window.__liveInputDebug.bus.sources.has('hr')")
            assert "Connected" in page.locator("#live-hr-status").inner_text()
            page.screenshot(path=str(output_dir / "live_input_bus_tab.png"))

            # Route a mocked BLE notification through the actual device source.
            result = page.evaluate(
                """() => {
                    const { bus } = window.__liveInputDebug;
                    const renderer = bus.renderer;
                    window.__mockHrCharacteristic.emit(110);
                    const before = renderer.params.flowSpeed;
                    const mapping = bus.addMapping({
                        source: 'hr', feature: 'hr', sink: 'flowSpeed',
                        scale: 0.25, attack: 0.001, release: 0.001, enabled: true,
                    });
                    bus.tick(1, performance.now() + 100);
                    const after = renderer.params.flowSpeed;
                    const condition = bus.evaluateCondition('live.hr.bpm > 90');
                    bus.removeMapping(mapping.id);
                    return { before, after, delta: after - before, condition };
                }"""
            )
            assert abs(result["delta"] - 0.125) < 1e-6 and result["condition"], (
                f"Expected mocked HR to move flowSpeed by 0.125 and satisfy bpm condition, got {result}"
            )

            if errors:
                hard_errors = [
                    entry for entry in errors
                    if "404" not in entry and "favicon" not in entry.lower()
                ]
                if hard_errors:
                    raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]) +
                                         "\nFailed requests: " + ", ".join(failed_requests[:8]))

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

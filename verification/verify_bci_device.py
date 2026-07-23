import json
import math
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5192/?renderer=webgl"


def wait_for_server(url: str, timeout: float = 25.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=1.5) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.25)
    raise RuntimeError(f"Timed out waiting for dev server: {url}")


MOCK_BLUETOOTH = r"""
(() => {
  const ATHENA = __ATHENA__;
  const base = (id) => `273e${id}-4c4d-454d-96be-f03bac821358`;
  let sequence = 0;

  function pack12(values) {
    const bytes = new Uint8Array(20);
    bytes[0] = (sequence >> 8) & 255;
    bytes[1] = sequence++ & 255;
    for (let i = 0; i < values.length; i += 2) {
      const a = Math.max(0, Math.min(4095, Math.round(2048 + values[i] / 0.48828125)));
      const b = Math.max(0, Math.min(4095, Math.round(2048 + values[i + 1] / 0.48828125)));
      const o = 2 + (i / 2) * 3;
      bytes[o] = a >> 4;
      bytes[o + 1] = ((a & 15) << 4) | (b >> 8);
      bytes[o + 2] = b & 255;
    }
    return bytes;
  }

  function pack14(values) {
    const bytes = new Uint8Array(42);
    bytes[9] = 0x11;
    let bitOffset = 0;
    for (const value of values) {
      const raw = Math.max(0, Math.min(16383, Math.round(value / (1450 / 16383))));
      for (let bit = 0; bit < 14; bit++, bitOffset++) {
        if ((raw >> bit) & 1) bytes[14 + (bitOffset >> 3)] |= 1 << (bitOffset & 7);
      }
    }
    return bytes;
  }

  class MockCharacteristic {
    constructor(uuid) { this.uuid = uuid; this.handler = null; this.timer = null; this.phase = 0; }
    addEventListener(type, handler) { if (type === 'characteristicvaluechanged') this.handler = handler; }
    async startNotifications() {
      if (this.uuid === base('0013')) {
        this.timer = setInterval(() => {
          const values = [];
          for (let sample = 0; sample < 4; sample++) {
            for (let channel = 0; channel < 4; channel++) {
              values.push(725 + Math.sin(this.phase + channel * 0.25) * 85);
            }
            this.phase += 2 * Math.PI * 10 / 256;
          }
          this.emit(pack14(values));
        }, 15);
      } else if (/273e000[3-6]-/.test(this.uuid)) {
        this.timer = setInterval(() => {
          const values = Array.from({length: 12}, () => {
            const value = Math.sin(this.phase) * 70 + Math.sin(this.phase * 2.1) * 12;
            this.phase += 2 * Math.PI * 10 / 256;
            return value;
          });
          this.emit(pack12(values));
        }, 45);
      }
      return this;
    }
    async stopNotifications() { if (this.timer) clearInterval(this.timer); }
    async writeValue() {}
    async writeValueWithoutResponse() {}
    emit(bytes) {
      const view = new DataView(bytes.buffer);
      const handler = this.oncharacteristicvaluechanged || this.handler;
      handler?.({target: {value: view}});
    }
  }

  const uuids = [base('0001'), base('000b'), base('000a')];
  if (ATHENA) uuids.push(base('0013'));
  else uuids.push(base('0003'), base('0004'), base('0005'), base('0006'), base('0007'));
  const characteristics = new Map(uuids.map((uuid) => [uuid, new MockCharacteristic(uuid)]));
  const service = {
    getCharacteristics: async () => [...characteristics.values()],
    getCharacteristic: async (uuid) => {
      const characteristic = characteristics.get(String(uuid).toLowerCase());
      if (!characteristic) throw new Error(`Characteristic not found: ${uuid}`);
      return characteristic;
    },
  };
  const device = {
    id: ATHENA ? 'mock-athena' : 'mock-classic',
    name: ATHENA ? 'Muse S Athena Mock' : 'Muse 2 Mock',
    addEventListener() {}, removeEventListener() {},
    gatt: {connected: false, connect: async function() { this.connected = true; return {getPrimaryService: async () => service}; }, disconnect() { this.connected = false; }},
  };
  Object.defineProperty(navigator, 'bluetooth', {configurable: true, value: {requestDevice: async () => device}});
})();
"""


def run_device(browser, athena: bool) -> None:
    context = browser.new_context(viewport={"width": 1440, "height": 960})
    context.add_init_script(MOCK_BLUETOOTH.replace("__ATHENA__", "true" if athena else "false"))
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.goto(APP_URL, wait_until="domcontentloaded")
    page.wait_for_selector("#canvas", state="attached", timeout=10000)
    page.wait_for_timeout(1500)
    # Keep the deterministic input-rate assertion independent from software WebGL draw cost.
    page.evaluate("() => window.__bciDebug?.session.renderer.stop()")
    page.click('.tab-btn[data-tab="tab-bci"]')
    page.click("#btn-bci-connect")

    expected = "athena" if athena else "classic"
    page.wait_for_function(
        "expected => window.__bciDebug?.getState().protocol === expected",
        arg=expected,
        timeout=10000,
    )
    page.wait_for_function("() => window.__bciDebug.getState().tensorUpdateCount >= 10", timeout=15000)
    state = page.evaluate("() => window.__bciDebug.getState()")
    assert state["source"] == "bci", state
    assert state["updateRate"] >= 10, state
    assert state["features"]["quality"] > 0, state
    assert state["features"]["bands"]["alpha"] > 0, state
    assert page.locator("#bci-channel-mapping select").count() >= 4
    tensor_max = page.evaluate("() => Math.max(...window.__bciDebug.session.latestTensor)")
    assert tensor_max > 0.01, tensor_max

    page.click('[data-section="bci-recording"]')
    page.evaluate("() => document.querySelector('#btn-bci-record').click()")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelector('#btn-bci-record-stop').click()")
    page.wait_for_function("() => !document.querySelector('#btn-bci-download').disabled")
    blob_size = page.evaluate("() => window.__bciDebug.session.recorder.lastBlob?.size || 0")
    assert blob_size > 1000, blob_size

    page.click("#btn-bci-disconnect")
    page.wait_for_function("() => window.__bciDebug.getState().source === 'simulation'")
    assert page.evaluate("() => window.__bciDebug.session.renderer.tensorPlaybackMode") is False
    hard_errors = [entry for entry in errors if "404" not in entry and "favicon" not in entry.lower()]
    assert not hard_errors, hard_errors[:8]
    context.close()


def run_openbci(browser) -> None:
    bridge = subprocess.Popen(
        ["node", "scripts/openbci_ws_bridge.mjs", "--udp-port=12346", "--ws-port=8766", "--board=cyton"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    context = browser.new_context(viewport={"width": 1440, "height": 960})
    page = context.new_page()
    try:
        time.sleep(0.5)
        page.goto(APP_URL, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        page.evaluate("() => window.__bciDebug?.session.renderer.stop()")
        page.click('.tab-btn[data-tab="tab-bci"]')
        page.select_option("#bci-device-source", "cyton")
        page.fill("#bci-openbci-url", "ws://127.0.0.1:8766")
        page.click("#btn-bci-connect")
        page.wait_for_function("() => window.__bciDebug?.getState().state === 'connected'", timeout=8000)

        udp = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        phases = [0.0] * 8
        for _ in range(20):
            channels = []
            for channel in range(8):
                values = []
                for _sample in range(25):
                    values.append(65 * math.sin(phases[channel]))
                    phases[channel] += 2 * math.pi * 10 / 250
                channels.append(values)
            packet = json.dumps({"type": "timeSeriesRaw", "data": channels}).encode()
            udp.sendto(packet, ("127.0.0.1", 12346))
            time.sleep(0.055)
        udp.close()

        page.wait_for_function("() => window.__bciDebug.getState().tensorUpdateCount >= 5", timeout=10000)
        state = page.evaluate("() => window.__bciDebug.getState()")
        assert state["source"] == "bci", state
        assert len(state["mapping"]) == 8, state
        assert state["features"]["bands"]["alpha"] > 0, state
    finally:
        context.close()
        bridge.terminate()
        try:
            bridge.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bridge.kill()


def verify() -> None:
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5192", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(APP_URL.replace("?renderer=webgl", ""))
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            print("Verifying Muse Classic mocked GATT...", flush=True)
            run_device(browser, athena=False)
            print("Verifying Muse Athena mocked GATT...", flush=True)
            run_device(browser, athena=True)
            print("Verifying OpenBCI UDP bridge...", flush=True)
            run_openbci(browser)
            browser.close()
        print("BCI device verification passed (Muse Classic/Athena mocked GATT + OpenBCI UDP bridge).")
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
        print(f"verify_bci_device failed: {exc}")
        sys.exit(1)

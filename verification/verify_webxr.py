import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5194/?renderer=webgl&openTab=xr"


MOCK_XR = r"""
(() => {
  const identity = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  if (window.WebGL2RenderingContext) {
    Object.defineProperty(WebGL2RenderingContext.prototype, 'makeXRCompatible', {
      configurable: true, value: async () => {}
    });
  }
  class MockSession {
    constructor(mode) {
      this.mode = mode;
      this.renderState = {};
      this.inputSources = [];
      this.listeners = new Map();
      this.callbacks = new Map();
      this.nextId = 1;
    }
    updateRenderState(state) { this.renderState = {...this.renderState, ...state}; }
    async requestReferenceSpace(type) { return {type}; }
    addEventListener(type, fn) {
      const list = this.listeners.get(type) || [];
      list.push(fn); this.listeners.set(type, list);
    }
    requestAnimationFrame(callback) {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        callback(performance.now(), {
          session: this,
          getViewerPose: () => ({views: ['left', 'right'].map((eye) => ({
            eye,
            projectionMatrix: identity,
            transform: {inverse: {matrix: identity}},
          }))}),
          getPose: () => ({transform: {matrix: new Float32Array([
            1,0,0,0, 0,1,0,0, 0,0,1,0, 0,1.45,0,1
          ])}}),
        });
      }, 70);
      this.callbacks.set(id, timer);
      return id;
    }
    cancelAnimationFrame(id) { clearTimeout(this.callbacks.get(id)); this.callbacks.delete(id); }
    async end() {
      for (const timer of this.callbacks.values()) clearTimeout(timer);
      this.callbacks.clear();
      for (const fn of this.listeners.get('end') || []) fn({session: this});
    }
  }
  class MockLayer {
    constructor(session) {
      this.framebuffer = null;
      this.framebufferWidth = 1024;
      this.framebufferHeight = 512;
      session.renderState.baseLayer = this;
    }
    getViewport(view) { return {x: view.eye === 'left' ? 0 : 512, y: 0, width: 512, height: 512}; }
  }
  Object.defineProperty(window, 'XRWebGLLayer', {configurable: true, value: MockLayer});
  Object.defineProperty(navigator, 'xr', {configurable: true, value: {
    isSessionSupported: async () => true,
    requestSession: async (mode) => new MockSession(mode),
  }});
})();
"""


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


def verify() -> None:
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5194", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server(APP_URL.split("?")[0])
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            context = browser.new_context(viewport={"width": 1440, "height": 960})
            context.add_init_script(MOCK_XR)
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_function("() => window.__xrDebug?.getState().support.vr === true", timeout=10000)
            assert page.locator("#tab-xr.active").count() == 1
            page.click("#btn-xr-enter-vr")
            try:
                page.wait_for_function("() => window.__xrDebug.getState().frameCount >= 3", timeout=15000)
            except Exception as error:
                state = page.evaluate("() => window.__xrDebug.getState()")
                raise AssertionError(f"XR frames did not advance: state={state}, errors={errors[:8]}") from error
            state = page.evaluate("() => window.__xrDebug.getState()")
            assert state["presenting"] is True, state
            assert state["mode"] == "immersive-vr", state
            assert state["renderer"] == "webgl", state

            page.select_option("#xr-style", "2")
            page.wait_for_timeout(300)
            assert page.evaluate("() => window.__xrDebug.manager.renderer.params.style") == 2

            before = state["rig"]["position"]
            page.evaluate("() => window.__xrDebug.manager.player.playNow([{time:0, type:'camera', target:'occipital', duration:0.35}])")
            page.wait_for_timeout(1200)
            after = page.evaluate("() => window.__xrDebug.getState().rig.position")
            assert before != after, (before, after)
            assert page.evaluate("() => window.__xrDebug.manager.player.timerSource") in ("xr", None)

            injected = page.evaluate("""() => {
              const manager = window.__xrDebug.manager;
              return manager.injectFromInput({targetRaySpace:{}}, {
                getPose: () => ({transform:{matrix:new Float32Array([
                  1,0,0,0, 0,1,0,0, 0,0,1,0, 0,1.45,0,1
                ])}})
              }, 1.4);
            }""")
            assert injected is True

            page.evaluate("() => document.querySelector('#btn-xr-end').click()")
            page.wait_for_function("() => window.__xrDebug.getState().presenting === false")
            assert page.evaluate("() => window.__xrDebug.manager.renderer.isRunning") is True

            page.evaluate("() => document.querySelector('#btn-xr-enter-ar').click()")
            page.wait_for_function(
                "() => window.__xrDebug.getState().mode === 'immersive-ar' && window.__xrDebug.getState().frameCount >= 2",
                timeout=10000,
            )
            page.evaluate("() => document.querySelector('#btn-xr-end').click()")
            page.wait_for_function("() => window.__xrDebug.getState().presenting === false")
            hard_errors = [entry for entry in errors if "404" not in entry and "favicon" not in entry.lower()]
            assert not hard_errors, hard_errors[:8]
            context.close()

            fallback = browser.new_page(viewport={"width": 1200, "height": 800})
            fallback.goto(APP_URL, wait_until="domcontentloaded")
            fallback.wait_for_function(
                "() => { const s = window.__xrDebug?.getState().status || ''; return s.includes('unavailable') || s.includes('No immersive'); }",
                timeout=10000,
            )
            assert fallback.locator("#btn-xr-enter-vr").is_disabled()
            fallback.close()
            browser.close()
        print("WebXR verification passed (VR/AR stereo views, routine rig, ray stimulus, and unavailable fallback).")
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
        print(f"verify_webxr failed: {exc}")
        sys.exit(1)

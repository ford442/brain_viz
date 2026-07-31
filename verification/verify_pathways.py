import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
APP_URL = "http://127.0.0.1:5195/?renderer=webgl"


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
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5195", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def verify() -> None:
    server = launch_dev_server()
    try:
        wait_for_server(APP_URL.replace("?renderer=webgl", ""))
        output_dir = ROOT / "verification"
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
            page = browser.new_page(viewport={"width": 1440, "height": 960})
            errors = []
            page.on("pageerror", lambda exc: errors.append(str(exc)))
            page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
            page.goto(APP_URL, wait_until="domcontentloaded")
            page.wait_for_selector("#pathway-select option", state="attached", timeout=15000)
            page.wait_for_timeout(1800)

            if page.locator("#error.visible").count():
                raise AssertionError("Error overlay became visible")

            expected_labels = [
                "Dopamine", "VTA", "nucleus accumbens", "prefrontal cortex",
                "mesolimbic", "mesocortical", "Schematic",
            ]
            panel_text = page.locator("#pathway-panel").inner_text()
            for label in expected_labels:
                if label.lower() not in panel_text.lower():
                    raise AssertionError(f"Missing pathway legend label: {label}")
            options = page.locator("#pathway-select option").all_text_contents()
            if options != ["Mesocorticolimbic dopamine pathway"]:
                raise AssertionError(f"Unexpected pathway picker options: {options}")

            geometry_check = page.evaluate("""() => {
                const renderer = window.routineEngine.renderer;
                const meta = renderer.basePathwayMeta;
                const ids = [...new Set(Array.from(meta).filter((_, i) => i % 4 === 0 && meta[i] > 0))];
                return {
                    finite: Array.from(meta).every(Number.isFinite),
                    ids,
                    selections: renderer.getPathwayState().edges.map(edge => edge.selections.length),
                    demoEnd: Math.max(...window.routineEngine.subRoutines['dopamine-pathway-demo'].map(event => event.time)),
                };
            }""")
            if not geometry_check["finite"] or geometry_check["ids"] != [1]:
                raise AssertionError(f"Invalid pathway metadata: {geometry_check}")
            if geometry_check["selections"] != [3, 3, 3, 3]:
                raise AssertionError(f"Expected three unique centerlines per edge: {geometry_check}")
            if geometry_check["demoEnd"] >= 60:
                raise AssertionError(f"Demo exceeds 60 seconds: {geometry_check['demoEnd']}")

            page.evaluate("""() => {
                document.querySelector('[data-section="activity-pathways"]')?.click();
                document.getElementById('pathway-pulse')?.click();
            }""")
            samples = []
            peaks = []
            for elapsed, name in [(0.3, "early"), (1.5, "middle"), (2.7, "late")]:
                state = page.evaluate("""elapsed => {
                    const renderer = window.routineEngine.renderer;
                    renderer.pathwayState.pulse.startedAt = performance.now() - elapsed * 1000;
                    renderer.updateDynamicBuffers();
                    const gl = renderer.gl;
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                    renderer.drawScene(renderer.updateMatrices());
                    return renderer.getPathwayState();
                }""", elapsed)
                samples.append(state["progress"])
                peaks.append(state["metrics"]["peakProgress"])
                page.screenshot(path=str(output_dir / f"pathway_pulse_{name}.png"))
            if not (0 < samples[0] < samples[1] < samples[2] < 1):
                raise AssertionError(f"Pulse progress was not monotonic: {samples}")
            if not (peaks[0] < peaks[1] < peaks[2]):
                raise AssertionError(f"Highlighted peak did not travel forward: {peaks}")

            lesion_result = page.evaluate("""() => {
                const renderer = window.routineEngine.renderer;
                const state = renderer.getPathwayState();
                const point = state.edges[0].selections[0].samplePosition;
                renderer.triggerLesion(point, 0.24);
                renderer.setParams({ lesionActive: 1 });
                renderer.pulsePathway(state.selectedId, { duration: 3, intensity: 1 });
                return point;
            }""")
            if len(lesion_result) != 3:
                raise AssertionError("Could not resolve a selected branch midpoint")
            page.wait_for_timeout(1550)
            lesion_state = page.evaluate("() => window.routineEngine.renderer.getPathwayState()")
            if lesion_state["metrics"]["lesionSuppressedVertexCount"] <= 0:
                raise AssertionError("Lesion did not suppress any selected pathway vertices")
            unaffected = [
                metric for metric in lesion_state["metrics"]["edges"].values()
                if metric["lesionSuppressedVertexCount"] == 0 and metric["emissiveVertexCount"] > 0
            ]
            if not unaffected:
                raise AssertionError(f"No unaffected branch remained emissive: {lesion_state['metrics']}")
            page.screenshot(path=str(output_dir / "pathway_lesion_branch.png"))

            page.evaluate("""() => window.routineEngine.executeEvent({
                type: 'pathway_block', pathway: 'mesocorticolimbic-dopamine'
            })""")
            page.wait_for_timeout(250)
            blocked = page.evaluate("() => window.routineEngine.renderer.getPathwayState()")
            if not blocked["blocked"] or blocked["metrics"]["maxEmission"] != 0:
                raise AssertionError(f"Whole-path block did not suppress emission: {blocked}")

            page.evaluate("""() => {
                const renderer = window.routineEngine.renderer;
                window.routineEngine.executeEvent({ type: 'pathway_block', pathway: 'mesocorticolimbic-dopamine', blocked: false });
                renderer.setParams({ lesionActive: 0 });
            }""")
            page.wait_for_timeout(250)
            recovered = page.evaluate("() => window.routineEngine.renderer.getPathwayState()")
            if recovered["blocked"] or recovered["metrics"]["maxEmission"] <= 0:
                raise AssertionError(f"Pathway did not recover after unblock: {recovered}")

            hard_errors = [entry for entry in errors if "404" not in entry and "favicon" not in entry.lower()]
            if hard_errors:
                raise AssertionError("Console/page errors detected:\n" + "\n".join(hard_errors[:8]))
            browser.close()
            print("Pathway verification passed.")
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
        print(f"verify_pathways failed: {exc}")
        sys.exit(1)


from playwright.sync_api import sync_playwright
import time

def verify_full_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # 1. Verify Connectome Mode (should now show Spheres)
        page.select_option("#style-mode", "2")
        time.sleep(1)
        page.screenshot(path="verification/connectome_spheres.png")
        print("Connectome screenshot taken.")

        # 2. Verify Clipping
        # Set clipZ to 0.0 (middle of brain)
        page.fill("#clip", "0.0")
        # Trigger input event
        page.evaluate("document.getElementById('clip').dispatchEvent(new Event('input'))")
        time.sleep(1)
        page.screenshot(path="verification/clipped_brain.png")
        print("Clipped brain screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_full_suite()


from playwright.sync_api import sync_playwright
import time

def verify_full_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        # 1. Verify Connectome Mode
        print("Selecting Connectome Mode...")
        page.select_option("#style-mode", "2")
        time.sleep(2)
        page.screenshot(path="verification/connectome_spheres.png")
        print("Connectome screenshot taken.")

        # 2. Verify Heatmap Mode
        print("Selecting Heatmap Mode...")
        page.select_option("#style-mode", "3")
        time.sleep(2)
        page.screenshot(path="verification/brain_heatmap.png")
        print("Heatmap screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_full_suite()

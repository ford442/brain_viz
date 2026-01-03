
from playwright.sync_api import sync_playwright
import time

def verify_brain_viz():
    with sync_playwright() as p:
        # Launch browser with WebGPU enabled flags
        # WebGPU requires unsafe flag in headless currently for some envs,
        # and swiftshader for software rendering if no GPU.
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader"
            ]
        )
        page = browser.new_page()

        # Navigate to local server (Vite default port is usually 5173 or 3000)
        # We'll try 5173 first as it's standard for Vite
        try:
            page.goto("http://localhost:5173", timeout=10000)
        except:
            # Fallback to 3000 just in case
            page.goto("http://localhost:3000")

        page.wait_for_load_state("networkidle")

        # Wait a bit for the WebGPU canvas to initialize and render
        time.sleep(3)

        # Take a screenshot of the initial state
        page.screenshot(path="verification/brain_initial.png")
        print("Initial screenshot taken.")

        # Interact with UI: Change Style to Heatmap (Value 3)
        # We use select_option on the select element
        page.select_option("#style-mode", "3")
        time.sleep(1)
        page.screenshot(path="verification/brain_heatmap.png")
        print("Heatmap screenshot taken.")

        # Interact: Click 'Frontal' stimulus
        page.click("#stim-frontal")
        time.sleep(0.5) # Wait for pulse
        page.screenshot(path="verification/brain_stimulus.png")
        print("Stimulus screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_brain_viz()

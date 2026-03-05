import os
from playwright.sync_api import sync_playwright

def verify_brain_viz_glitch():
    with sync_playwright() as p:
        # Launch with WebGPU enabled flags
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader",
                "--no-sandbox"
            ]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000) # Give time for WebGPU init

            # Press 'g' to trigger Glitch Storm routine
            print("Triggering Glitch Storm routine...")
            page.keyboard.press("g")

            # Wait a bit for the glitch effect to reach its peak (intensity 2.0 at 0.5s)
            page.wait_for_timeout(600)

            # Take a screenshot
            page.screenshot(path="verification/viz_glitch.png")
            print("Screenshot glitch taken")

            # Check if narrative overlay shows DATA CORRUPTION DETECTED
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                print(f"Narrative Overlay: '{text}'")
            else:
                 print("Narrative Overlay NOT visible")

        except Exception as e:
            print(f"Script Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_brain_viz_glitch()

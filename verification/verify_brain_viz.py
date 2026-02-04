
import os
from playwright.sync_api import sync_playwright

def verify_brain_viz():
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

        # Capture console logs
        console_logs = []
        def log_console(msg):
            print(f"Console: {msg.text}")
            console_logs.append(msg.text)
        page.on("console", log_console)

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000) # Give time for WebGPU init

            # Check for error
            error_el = page.locator("#error")
            if error_el.is_visible():
                print(f"App Error: {error_el.text_content()}")

            # Check Title
            print(f"Page Title: {page.title()}")

            # Verify AI Model Loaded
            model_loaded = any("Model loaded successfully" in msg for msg in console_logs)
            if model_loaded:
                print("VERIFIED: AI Model loaded successfully")
            else:
                print("WARNING: AI Model failed to load (Message not found)")

            # 1. Screenshot: Connectome Mode
            print("Selecting Connectome Mode...")
            page.select_option("#style-mode", "2")

            print("Triggering Stimulus...")
            page.click("#stim-frontal")
            page.wait_for_timeout(1000)

            page.screenshot(path="verification/viz_connectome.png")
            print("Screenshot connectome taken")

            # 2. Screenshot: Heatmap Mode
            print("Selecting Heatmap Mode...")
            page.select_option("#style-mode", "3")
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/viz_heatmap.png")
            print("Screenshot heatmap taken")

            # 3. Screenshot: Clipped
            print("Testing Clip Plane...")
            # Set range value properly
            page.evaluate("document.getElementById('clip').value = '0.0'")
            page.evaluate("document.getElementById('clip').dispatchEvent(new Event('input'))")
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/viz_clipped.png")
            print("Screenshot clipped taken")

        except Exception as e:
            print(f"Script Error: {e}")
            page.screenshot(path="verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_brain_viz()

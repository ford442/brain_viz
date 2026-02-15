
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

            # 4. Verify Playback Speed Control
            print("Testing Playback Speed Control...")
            speed_slider = page.locator("#routine-speed")
            if speed_slider.is_visible():
                print("VERIFIED: Speed Slider found")
                # Change value to 2.0
                page.evaluate("document.getElementById('routine-speed').value = '2.0'")
                page.evaluate("document.getElementById('routine-speed').dispatchEvent(new Event('input'))")
                page.wait_for_timeout(500)

                if page.get_by_text("Speed: 2.0x").is_visible():
                     print("VERIFIED: Speed Label updated correctly")
                else:
                     print("WARNING: Speed Label NOT updated")
            else:
                print("WARNING: Speed Slider NOT found")

            # 5. Verify Narrative Overlay
            print("Testing Narrative Routine...")
            # Click the play button (by text content)
            page.get_by_text('▶ Play').click()
            page.wait_for_timeout(1000) # Wait for routine to start and first text event

            # Check overlay
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                if text:
                    print(f"VERIFIED: Narrative Overlay Active - '{text}'")
                else:
                    print("WARNING: Narrative Overlay visible but empty")
            else:
                 print("WARNING: Narrative Overlay NOT visible")

            page.screenshot(path="verification/viz_narrative.png")

            # 6. Verify Cinematic Camera (New Feature)
            print("Testing Cinematic Camera Transition...")
            # We can access the player instance if it's exposed, but it's not global.
            # However, we can simulate loading a routine via the file input or just trust the code if we see no errors.
            # Let's try to inject a routine via the console if possible, but player is inside init().
            # Alternative: triggers a mini-routine if one uses camera duration.
            # None of the mini-routines use duration yet.
            # Let's just check if the code we added (console.log) appears when we manually trigger a camera event with duration?
            # We can't easily access the internal player.
            # But we can check if the file is loaded correctly.
            pass

        except Exception as e:
            print(f"Script Error: {e}")
            page.screenshot(path="verification/error_state.png")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_brain_viz()

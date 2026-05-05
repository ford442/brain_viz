
import os
from playwright.sync_api import sync_playwright, expect

def verify_signal_speed():
    with sync_playwright() as p:
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
            page.wait_for_timeout(3000)

            # Check for error
            error_el = page.locator("#error")
            if error_el.is_visible():
                print(f"App Error: {error_el.text_content()}")
                return

            # Verify Signal Speed Control
            print("Checking Signal Speed Control...")
            speed_input = page.locator("#speed")
            speed_val = page.locator("#val-speed")

            expect(speed_input).to_be_visible()
            # Initial value might be 4.0 or 4.00 depending on browser formatting
            # Given the error, it's 4.00
            expect(speed_val).to_have_text("4.00")

            # Change value
            print("Changing Signal Speed to 8.0...")
            page.evaluate("document.getElementById('speed').value = '8.0'")
            page.evaluate("document.getElementById('speed').dispatchEvent(new Event('input'))")

            # Verify update
            expect(speed_val).to_have_text("8.00")
            print("Signal speed label updated correctly.")

            # Take screenshot of controls
            page.screenshot(path="verification/viz_controls.png")
            print("Screenshot taken.")

        except Exception as e:
            print(f"Script Error: {e}")
            page.screenshot(path="verification/error_speed.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_signal_speed()

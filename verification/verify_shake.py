import os
import sys
from playwright.sync_api import sync_playwright

def verify_shake():
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

        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(2000)

            # Check for error
            error_el = page.locator("#error")
            if error_el.is_visible():
                print(f"App Error: {error_el.text_content()}")
            else:
                print("No error message visible.")

            # 1. Verify Shake Slider Exists
            print("Verifying Shake Slider...")
            shake_slider = page.locator("#shake")
            if shake_slider.is_visible():
                print("VERIFIED: Shake Slider found")
                # Change value to 0.5
                page.evaluate("document.getElementById('shake').value = '0.5'")
                page.evaluate("document.getElementById('shake').dispatchEvent(new Event('input'))")
                page.wait_for_timeout(500)

                # Check label update
                shake_val = page.locator("#val-shake").text_content()
                if shake_val == "0.50":
                     print("VERIFIED: Shake Label updated correctly")
                else:
                     print(f"WARNING: Shake Label NOT updated correctly: {shake_val}")
            else:
                print("FAILURE: Shake Slider NOT found")
                sys.exit(1)

            # 2. Verify Panic Routine Trigger
            print("Verifying Panic Routine (Key '6')...")
            page.keyboard.press("6")
            page.wait_for_timeout(1000)

            # Check for console log: "[Main] Triggering Mini-Routine: 6"
            triggered = any("Triggering Mini-Routine: 6" in msg for msg in console_logs)
            if triggered:
                print("VERIFIED: Panic Routine triggered via keyboard")
            else:
                print("WARNING: Panic Routine trigger log NOT found")
                print("Console Logs:", console_logs)

            # Check Narrative Overlay for "PANIC!"
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                if "PANIC!" in text:
                    print(f"VERIFIED: Narrative Overlay shows '{text}'")
                else:
                    print(f"WARNING: Narrative Overlay does not show panic text: '{text}'")
            else:
                 print("WARNING: Narrative Overlay NOT visible")

            # 3. Take Screenshot
            page.screenshot(path="verification/shake_verification.png")
            print("Screenshot saved to verification/shake_verification.png")

        except Exception as e:
            print(f"Script Error: {e}")
            page.screenshot(path="verification/shake_error.png")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_shake()

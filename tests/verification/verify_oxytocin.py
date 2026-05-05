import sys
import time
from playwright.sync_api import sync_playwright

def verify_oxytocin_burst():
    print("Navigating to app...")
    with sync_playwright() as p:
        # Launch browser with WebGPU enabled
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu"]
        )
        page = browser.new_page()

        # Route console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        try:
            page.goto("http://localhost:5173")
            time.sleep(2) # Wait for init

            print("Triggering Oxytocin Burst Routine (key 'y')...")
            page.keyboard.press("y")
            time.sleep(1) # Wait for animation to start

            page.screenshot(path="verification/oxytocin_burst.png")
            print("Screenshot taken: verification/oxytocin_burst.png")

        except Exception as e:
            print(f"Test failed: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_oxytocin_burst()

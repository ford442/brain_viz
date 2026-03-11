import time
from playwright.sync_api import sync_playwright

def verify_spline():
    with sync_playwright() as p:
        # Launch with WebGPU enabled
        browser = p.chromium.launch(args=["--enable-unsafe-webgpu"])
        page = browser.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173/")

        # Wait for initialization
        time.sleep(2)

        print("Triggering Spline Path Demo (Key 'p')...")
        page.keyboard.press("p")

        # Wait a bit into the spline animation to capture it
        time.sleep(2.5)

        print("Taking screenshot...")
        screenshot_path = "verification/spline_demo.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_spline()

from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        # Launch browser with unsafe webgpu flag as noted in memory
        browser = p.chromium.launch(headless=True, args=["--enable-unsafe-webgpu"])
        page = browser.new_page()

        # Navigate to dev server
        page.goto("http://localhost:5173")

        # Wait for WebGPU canvas to initialize and render
        page.wait_for_selector("canvas", state="visible")
        page.wait_for_timeout(2000)

        # Press 'v' to trigger the Spline Camera Fly-Through Demo
        page.keyboard.press("v")

        # Wait a moment for the transition to begin and the UI to update
        page.wait_for_timeout(1000)

        # Take screenshot of the flythrough in progress
        page.screenshot(path="verification/spline_flythrough.png")

        print("Screenshot saved to verification/spline_flythrough.png")
        browser.close()

if __name__ == "__main__":
    verify()

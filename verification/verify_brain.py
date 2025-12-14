from playwright.sync_api import sync_playwright, expect

def verify_brain():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        context = browser.new_context()
        page = context.new_page()

        try:
            # Navigate to local server
            page.goto("http://localhost:5173")

            # Wait for canvas (id="canvas", not "glCanvas")
            page.wait_for_selector("#canvas", state="visible")

            # Wait a moment for the renderer to initialize and draw a frame
            page.wait_for_timeout(3000)

            # Take screenshot
            page.screenshot(path="verification/brain_screenshot.png")
            print("Screenshot saved to verification/brain_screenshot.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_brain()

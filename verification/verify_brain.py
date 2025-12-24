from playwright.sync_api import sync_playwright

def verify_brain_renderer():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader"
            ]
        )
        page = browser.new_page()
        try:
            # Navigate to the local dev server
            page.goto("http://localhost:5173")

            # Wait for the canvas to be present
            page.wait_for_selector("canvas", timeout=5000)

            # Take a screenshot
            page.screenshot(path="verification/brain_render.png")
            print("Screenshot saved to verification/brain_render.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_brain_renderer()

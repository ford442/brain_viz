from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--enable-unsafe-webgpu"])
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        page.goto("http://localhost:5173/")
        page.wait_for_selector("#canvas", state="visible")

        # Give it a moment to initialize
        page.wait_for_timeout(2000)

        # Press 'w' to trigger the Math/Variables routine
        page.keyboard.press("w")

        # Wait a bit for the routine to run and state to update
        page.wait_for_timeout(3000)

        # Check if the text overlay updated with variables
        overlay = page.locator("#narrative-overlay")
        print(f"Overlay text: {overlay.inner_text()}")

        # Take a screenshot
        page.screenshot(path="verification/math_feature.png")

        browser.close()

if __name__ == "__main__":
    verify()

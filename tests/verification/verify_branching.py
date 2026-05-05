from playwright.sync_api import sync_playwright
import time

def test_branching():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--enable-unsafe-webgpu"])
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_selector("#canvas", state="attached")
        time.sleep(1) # wait for init to complete

        # Give focus to the page first
        page.click("body")
        page.keyboard.press("b")

        try:
            # Wait for the overlay to become visible
            page.locator("#visual-overlay").wait_for(state="visible", timeout=6000)
            page.screenshot(path="verification/branching_overlay.png")
            page.locator("text=Go Deep").click()
            time.sleep(2) # wait for branch logic
            page.screenshot(path="verification/branching_deep.png")
        except Exception as e:
            print("Failed to find overlay:", e)
            page.screenshot(path="verification/branching_overlay_error.png")

        browser.close()

if __name__ == "__main__":
    test_branching()

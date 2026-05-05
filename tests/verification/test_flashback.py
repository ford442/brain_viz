from playwright.sync_api import Page, expect, sync_playwright
import time

def test_flashback(page: Page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")

    # Wait for the app to load
    page.wait_for_selector("canvas")
    print("App loaded.")

    # We need to trigger the 'm' key press to start the routine
    page.keyboard.press("m")
    print("Pressed 'm' key to trigger Memory Flashback.")

    # Wait a bit for the effect to start
    time.sleep(0.5)

    # Take a screenshot while the flashback is happening
    page.screenshot(path="verification/flashback.png")
    print("Screenshot taken.")

    time.sleep(1.0) # Wait for the next part of the flashback
    page.screenshot(path="verification/flashback_2.png")
    print("Second screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_flashback(page)
        finally:
            browser.close()

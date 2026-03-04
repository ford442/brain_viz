from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_selector("#canvas", state="attached")
        time.sleep(2) # let it load
        page.keyboard.press("g")
        time.sleep(0.5) # Wait for glitch to be active
        page.screenshot(path="verification/glitch_screenshot.png")
        browser.close()

if __name__ == "__main__":
    run()

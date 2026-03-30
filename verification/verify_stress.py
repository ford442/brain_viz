from playwright.sync_api import sync_playwright
import time
import os

def run_cuj(page):
    print("Navigating to local server...")
    page.goto("http://localhost:5173")
    page.wait_for_timeout(3000)

    print("Setting style to Organic to see surface distortion...")
    page.locator("#style-mode").select_option("0")
    page.wait_for_timeout(1000)

    print("Increasing stress level...")
    # The stress input is a range slider. Playwright can set its value directly or we can click it.
    page.evaluate("document.getElementById('stress').value = '2.0'; document.getElementById('stress').dispatchEvent(new Event('input'));")
    page.wait_for_timeout(2000)

    print("Taking screenshot of high stress distortion...")
    page.screenshot(path="verification/screenshots/viz_stress.png")
    page.wait_for_timeout(2000)

    print("Triggering Panic Attack routine (which uses stress)...")
    page.keyboard.press("6")
    page.wait_for_timeout(4000)

    print("Taking screenshot during panic attack...")
    page.screenshot(path="verification/screenshots/viz_panic_stress.png")
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    os.makedirs("verification/videos", exist_ok=True)
    os.makedirs("verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--enable-unsafe-webgpu"])
        context = browser.new_context(record_video_dir="verification/videos")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

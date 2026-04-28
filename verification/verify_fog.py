from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to app...")
    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    print("Triggering Fog routine...")
    page.keyboard.press("g")
    page.wait_for_timeout(1000) # Wait for fog lerp out

    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(2000) # Hold for video

    print("Routine completed.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

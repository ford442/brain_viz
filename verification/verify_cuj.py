from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173/?renderer=webgl")
    page.wait_for_timeout(2000)

    # Press '>' key to trigger the Binaural Easing feature
    page.keyboard.press("Shift+>")
    page.wait_for_timeout(4000)

    # Take screenshot
    page.screenshot(path="verification/screenshots/verification.png")
    page.wait_for_timeout(4000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()

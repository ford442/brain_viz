from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--enable-unsafe-webgpu"])
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.goto("http://localhost:5173/")

        # Wait until the renderer is started before triggering keys
        page.wait_for_timeout(2000)

        # Trigger the 'q' routine
        page.keyboard.press('q')

        # Take a screenshot right after pressing q to see what's happening
        page.wait_for_timeout(3500)
        page.screenshot(path="verification/viz_choice_overlay.png")

        browser.close()

if __name__ == "__main__":
    verify()

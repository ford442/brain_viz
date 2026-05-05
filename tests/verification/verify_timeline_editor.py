from playwright.sync_api import sync_playwright

def test_timeline_editor():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--disable-gpu-sandbox"]
        )
        page = browser.new_page()
        try:
            page.add_init_script("navigator.gpu = { requestAdapter: async () => ({ requestDevice: async () => ({}) }) }")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(2000)

            # Open Timeline Editor
            page.evaluate("Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === 'Open Timeline Editor').click()")
            page.wait_for_timeout(500)

            # Click Add Event
            page.evaluate("Array.from(document.querySelectorAll('button')).find(btn => btn.textContent === '+ Add Event').click()")
            page.wait_for_timeout(500)

            page.screenshot(path="verification/timeline_editor_populated.png")
            print("Screenshot taken.")

        finally:
            browser.close()

if __name__ == "__main__":
    test_timeline_editor()

from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--enable-unsafe-webgpu',
                '--disable-dawn-features=disallow_unsafe_apis',
            ]
        )
        page = browser.new_page()
        page.goto("http://localhost:5173")
        page.wait_for_selector("#keyboard-legend", state="attached", timeout=10000)
        text = page.locator("#keyboard-legend").inner_text()
        print(f"Legend: {text}")

        page.screenshot(path="verification/ui_legend.png")

        browser.close()

if __name__ == "__main__":
    verify_ui()

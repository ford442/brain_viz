from playwright.sync_api import sync_playwright

def verify_connectome_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader"
            ]
        )
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173")
            page.wait_for_selector("#style-mode", timeout=5000)

            # Select Connectome mode (value="2")
            page.select_option("#style-mode", "2")

            # Wait a bit for potential render updates
            page.wait_for_timeout(1000)

            # Take a screenshot
            page.screenshot(path="verification/connectome_mode.png")
            print("Screenshot saved to verification/connectome_mode.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_connectome_mode()

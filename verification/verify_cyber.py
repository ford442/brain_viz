
import os
from playwright.sync_api import sync_playwright

def verify_cyber_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader", "--no-sandbox"]
        )
        page = browser.new_page()
        try:
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000)

            print("Selecting Cyber Mode (Style 1)...")
            page.select_option("#style-mode", "1")
            page.wait_for_timeout(1000)

            print("Triggering Stimulus to see activity grid...")
            page.click("#stim-frontal")
            page.wait_for_timeout(500)

            page.screenshot(path="verification/viz_cyber.png")
            print("Screenshot cyber mode taken")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_cyber_mode()

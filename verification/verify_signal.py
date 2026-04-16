import time
from playwright.sync_api import sync_playwright

def verify_signal():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--enable-unsafe-webgpu"])
        page = browser.new_page()
        page.goto("http://localhost:5173") # Assuming vite runs on 5173

        # Wait for the canvas to be ready
        page.wait_for_selector('canvas#canvas')
        time.sleep(2) # let it initialize

        # Press 's' to trigger the Wait/Signal Demo routine
        page.keyboard.press('s')
        time.sleep(1) # wait for the first text to appear

        # take screenshot before signal
        page.screenshot(path="verification/viz_before_signal.png")

        # Press 'Space' to trigger the signal
        page.keyboard.press('Space')
        time.sleep(1) # wait for the routine to proceed

        # take screenshot after signal
        page.screenshot(path="verification/viz_after_signal.png")

        browser.close()

if __name__ == "__main__":
    verify_signal()

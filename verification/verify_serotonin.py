
import time
from playwright.sync_api import sync_playwright

def verify_serotonin():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-setuid-sandbox'])
        page = browser.new_page()

        print("Navigating to app...")
        page.goto("http://localhost:5173")

        # Wait for canvas
        page.wait_for_selector("#canvas")
        time.sleep(2) # Allow WebGPU init (though in headless it might be stubbed/slow)

        # Check if slider exists
        print("Checking for Serotonin Shift slider...")
        slider = page.wait_for_selector("#shift")

        # Set Style to Connectome (2)
        print("Setting Style to Connectome...")
        page.select_option("#style-mode", "2")
        time.sleep(1)

        # Move Slider to 1.0
        print("Moving Serotonin Slider to 1.0...")
        page.evaluate("document.getElementById('shift').value = 1.0")
        page.evaluate("document.getElementById('shift').dispatchEvent(new Event('input'))")
        time.sleep(1)

        page.screenshot(path="verification/serotonin_manual.png")
        print("Screenshot saved: serotonin_manual.png")

        # Trigger Routine 4
        print("Triggering Routine 4 (Serotonin Surge)...")
        page.keyboard.press("4")

        time.sleep(1) # Wait for text overlay and lerp start
        page.screenshot(path="verification/serotonin_routine.png")
        print("Screenshot saved: serotonin_routine.png")

        browser.close()

if __name__ == "__main__":
    verify_serotonin()

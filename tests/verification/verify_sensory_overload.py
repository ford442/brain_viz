from playwright.sync_api import sync_playwright
import time

def verify_sensory_overload():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        page.goto("http://localhost:5173")
        page.wait_for_load_state("networkidle")
        time.sleep(3)

        print("Triggering Sensory Overload (Key W)...")
        page.keyboard.press("W")
        time.sleep(2)

        # Capture screenshot of the overload state
        page.screenshot(path="verification/sensory_overload.png")
        print("Sensory Overload screenshot taken.")

        browser.close()

if __name__ == "__main__":
    verify_sensory_overload()

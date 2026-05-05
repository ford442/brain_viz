import os
from playwright.sync_api import sync_playwright

def verify_adrenaline_routine():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader",
                "--no-sandbox"
            ]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000)

            # Check for error
            error_el = page.locator("#error")
            if error_el.is_visible():
                print(f"App Error: {error_el.text_content()}")

            # Trigger Adrenaline Surge
            print("Triggering Adrenaline Surge (pressing 'a')...")
            page.keyboard.press("a")
            page.wait_for_timeout(500) # Wait a little for the flash to happen

            page.screenshot(path="verification/viz_adrenaline.png")
            print("Screenshot adrenaline taken")

            # Check narrative overlay
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                if text:
                    print(f"VERIFIED: Narrative Overlay Active - '{text}'")

        except Exception as e:
            print(f"Script Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_adrenaline_routine()

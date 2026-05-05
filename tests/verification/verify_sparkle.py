import os
from playwright.sync_api import sync_playwright

def verify_sparkle():
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

            # 1. Verify UI Slider
            print("Checking for Sparkle Slider...")
            slider = page.locator("#sparkle")
            label = page.locator("#val-sparkle")

            if slider.is_visible():
                print("VERIFIED: Sparkle Slider found")
            else:
                print("ERROR: Sparkle Slider NOT found")

            # 2. Verify Legend
            print("Checking Legend...")
            legend = page.locator("#keyboard-legend")
            if legend.is_visible():
                text = legend.text_content()
                if "5=Epiphany" in text:
                    print(f"VERIFIED: Legend contains '5=Epiphany' ({text})")
                else:
                    print(f"ERROR: Legend missing '5=Epiphany' ({text})")
            else:
                print("ERROR: Legend NOT found")

            # 3. Verify Routine '5' Trigger
            print("Triggering Epiphany (Key '5')...")
            page.keyboard.press("5")
            page.wait_for_timeout(500) # Text appears immediately

            # Check Overlay
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                if "EUREKA MOMENT!" in text:
                    print("VERIFIED: Overlay shows 'EUREKA MOMENT!'")
                else:
                    print(f"WARNING: Overlay shows '{text}' instead of 'EUREKA MOMENT!'")
            else:
                print("ERROR: Overlay NOT visible")

            # Screenshot
            page.screenshot(path="verification/sparkle_test.png")
            print("Screenshot saved to verification/sparkle_test.png")

            # Check for JS errors
            # (No explicit check here, but if script crashes we know)

        except Exception as e:
            print(f"Script Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_sparkle()

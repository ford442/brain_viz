
import os
from playwright.sync_api import sync_playwright

def verify_growth():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader", "--no-sandbox"]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        try:
            print("Navigating to app...")
            page.goto("http://localhost:5173")
            page.wait_for_timeout(3000)

            # Check Growth Slider Visibility
            growth_slider = page.locator("#growth")
            if growth_slider.is_visible():
                print("VERIFIED: Growth Slider found")

                # Change value to 0.5 via JS
                page.evaluate("document.getElementById('growth').value = '0.5'")
                page.evaluate("document.getElementById('growth').dispatchEvent(new Event('input'))")
                page.wait_for_timeout(500)

                # Check Label
                label = page.locator("#val-growth")
                # Wait for label update? No, sync is instant.
                content = label.text_content()
                if content == "0.50":
                    print("VERIFIED: Growth Label updated to 0.50")
                else:
                    print(f"WARNING: Growth Label mismatch: {content}")

                # Screenshot
                page.screenshot(path="verification/viz_growth_0.5.png")
                print("Screenshot taken: verification/viz_growth_0.5.png")

                # Change value to 0.0 (Should hide everything)
                page.evaluate("document.getElementById('growth').value = '0.0'")
                page.evaluate("document.getElementById('growth').dispatchEvent(new Event('input'))")
                page.wait_for_timeout(500)

                # Verify label for 0.0
                content = label.text_content()
                if content == "0.00":
                    print("VERIFIED: Growth Label updated to 0.00")

                page.screenshot(path="verification/viz_growth_0.0.png")
                print("Screenshot taken: verification/viz_growth_0.0.png")

            else:
                print("WARNING: Growth Slider NOT found")

        except Exception as e:
            print(f"Script Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_growth()

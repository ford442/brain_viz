
import os
from playwright.sync_api import sync_playwright

def verify_director_tools():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader",
                "--no-sandbox"
            ]
        )
        page = browser.new_page()
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        try:
            print("Navigating...")
            page.goto("http://localhost:5173")
            page.wait_for_selector("#director-tools", timeout=5000)

            tools = page.locator("#director-tools")
            if tools.is_visible():
                print("VERIFIED: Director Tools UI is visible.")

                # Check for labels
                content = tools.text_content()
                if "RotX" in content and "RotY" in content and "Zoom" in content:
                    print("VERIFIED: Labels (RotX, RotY, Zoom) are present.")
                else:
                    print(f"FAILED: Labels missing. Content: {content}")

                # Check for Copy Button
                btn = tools.locator("button", has_text="Copy State")
                if btn.is_visible():
                    print("VERIFIED: Copy State button is visible.")
                else:
                    print("FAILED: Copy State button missing.")

                page.screenshot(path="verification/director_tools.png")
                print("Screenshot taken: verification/director_tools.png")
            else:
                print("FAILED: Director Tools UI exists but is not visible.")

        except Exception as e:
            print(f"Test Failed: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_director_tools()

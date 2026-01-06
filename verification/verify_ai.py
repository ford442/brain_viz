from playwright.sync_api import sync_playwright

def verify_brain_viz():
    with sync_playwright() as p:
        # Launch Chromium with WebGPU flags enabled
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader"
            ]
        )
        page = browser.new_page()

        try:
            # Navigate to the app
            page.goto("http://localhost:5173")

            # Wait for canvas to load
            page.wait_for_selector("#canvas", state="visible")

            # Check for AI button
            ai_btn = page.get_by_text('Enable AI "Dreaming"')
            if ai_btn.is_visible():
                print("AI Button found!")
                ai_btn.click()
                print("AI Mode Toggled.")

                # Wait a bit for inference to run and visual to update
                page.wait_for_timeout(3000)

                # Screenshot
                page.screenshot(path="verification/ai_mode.png")
                print("Screenshot saved to verification/ai_mode.png")
            else:
                print("AI Button NOT found.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_brain_viz()

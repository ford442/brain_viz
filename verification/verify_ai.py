from playwright.sync_api import sync_playwright

def verify_brain_viz():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page()

        try:
            page.goto("http://localhost:5173")
            page.wait_for_selector("#canvas", state="visible")

            ai_btn = page.get_by_text('Enable AI "Dreaming"')
            if ai_btn.is_visible():
                print("AI Button found!")
                ai_btn.click()
                print("AI Mode Toggled.")
                page.wait_for_timeout(3000)
                page.screenshot(path="verification/ai_mode_clean.png")
                print("Screenshot saved.")
            else:
                print("AI Button NOT found.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_brain_viz()

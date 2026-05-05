from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        # Launch browser with WebGPU flags
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page()

        print("Navigating to app...")
        try:
            page.goto("http://localhost:5173/")
            page.wait_for_load_state("networkidle")

            # 1. Verify Legend Exists
            print("Verifying Legend UI...")
            legend = page.locator("#keyboard-legend")
            # Wait for it to be attached
            legend.wait_for(state="attached", timeout=5000)

            if legend.count() > 0:
                text = legend.inner_text()
                print(f"Legend found: {text}")
                if "Keys: 1=Surprise, 2=Calm, 3=Scan" in text:
                    print("Legend text correct.")
                else:
                    print("Legend text mismatch.")
            else:
                print("Legend NOT found.")

            # Take screenshot of UI
            page.screenshot(path="verification/keyboard_legend.png")
            print("Screenshot taken: verification/keyboard_legend.png")

            # 2. Trigger Key '1' (Surprise)
            print("Pressing '1'...")
            page.keyboard.press("1")
            time.sleep(1) # Wait for effect
            page.screenshot(path="verification/trigger_1_surprise.png")
            print("Screenshot taken: verification/trigger_1_surprise.png")

            # 3. Trigger Key '2' (Calm)
            print("Pressing '2'...")
            page.keyboard.press("2")
            time.sleep(2) # Wait for calm
            page.screenshot(path="verification/trigger_2_calm.png")
            print("Screenshot taken: verification/trigger_2_calm.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()

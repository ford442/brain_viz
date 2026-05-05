import time
from playwright.sync_api import sync_playwright

def verify_routine():
    print("🧪 Starting Routine Engine Verification...")

    with sync_playwright() as p:
        # Launch with WebGPU enabled flags
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

        # Capture console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        # 1. Load the App
        try:
            page.goto("http://localhost:5173")
            page.wait_for_load_state("networkidle")
            print("✅ App loaded")
        except Exception as e:
            print(f"❌ Failed to load app: {e}")
            return

        # 2. Find and Click the Routine Button
        try:
            # Look for the button created in main.js
            routine_btn = page.get_by_text('▶ Run "Deep Thought" Sequence')
            if routine_btn.is_visible():
                print("✅ Routine button found")
                routine_btn.click()
                print("▶️ Routine started")
            else:
                print("❌ Routine button not visible")
                return
        except Exception as e:
            print(f"❌ Error clicking routine button: {e}")
            return

        # 3. Verify Timeline Execution (Sample points)

        # T+0s: Should be Organic Mode (Style 0)
        time.sleep(0.5)
        style_val = page.eval_on_selector("#style-mode", "el => el.value")
        if style_val == "0":
            print("✅ T+0.5s: Organic Mode verified")
        else:
            print(f"⚠️ T+0.5s Mismatch: Style is {style_val} (Expected 0)")

        # T+4.5s: Should be Connectome Mode (Style 2) & Slow Speed
        print("⏳ Waiting for Phase 2 (Connectome)...")
        time.sleep(4.5)

        style_val = page.eval_on_selector("#style-mode", "el => el.value")
        speed_val = page.locator("#val-speed").inner_text() # Reads the label text

        if style_val == "2":
            print("✅ T+5s: Connectome Mode verified")
        else:
            print(f"❌ T+5s Mismatch: Style is {style_val} (Expected 2)")

        if float(speed_val) == 2.0:
            print("✅ T+5s: Speed 2.0 verified")
        else:
             print(f"⚠️ T+5s Mismatch: Speed is {speed_val} (Expected 2.00)")

        # T+9s: Heatmap Mode (Style 3)
        print("⏳ Waiting for Phase 3 (Heatmap)...")
        time.sleep(5.0)

        style_val = page.eval_on_selector("#style-mode", "el => el.value")
        if style_val == "3":
            print("✅ T+10s: Heatmap Mode verified")
        else:
            print(f"❌ T+10s Mismatch: Style is {style_val} (Expected 3)")

        browser.close()
        print("🎉 Routine Verification Complete!")

if __name__ == "__main__":
    verify_routine()

import time
from playwright.sync_api import sync_playwright

def verify_camera_routine():
    print("🎥 Starting Camera Routine Verification...")

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-webgpu", "--use-gl=swiftshader", "--no-sandbox"]
        )
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Capture console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        # Load App
        try:
            page.goto("http://localhost:5173")
            # Wait a bit for WebGPU init
            time.sleep(2)
            print("✅ App loaded")
        except Exception as e:
            print(f"❌ Failed to load app: {e}")
            return

        # Start Routine
        try:
            btn = page.get_by_text('▶ Run "Deep Thought" Sequence')
            btn.wait_for(state="visible", timeout=5000)
            btn.click()
            print("▶️ Routine started")
        except Exception as e:
            print(f"❌ Could not start routine: {e}")
            return

        # Capture Snapshots & Data

        # 1. Occipital View (Back) at T+1.5s
        time.sleep(1.5)
        print("--- T+1.5s ---")
        # Check style (should be 0 Organic)
        # Check camera? We can't check camera easily as it is internal state.
        # But we can check if routine is running.

        # 2. Frontal View (Front) at T+4.5s
        time.sleep(3.0)
        print("--- T+4.5s ---")
        # Style should be 2 (Connectome)
        style_val = page.eval_on_selector("#style-mode", "el => el.value")
        print(f"Style: {style_val} (Expected 2)")

        # 3. Parietal/Deep View (Top/Side) at T+6.5s
        time.sleep(2.0)
        print("--- T+6.5s ---")

        # 4. Heatmap Global View at T+9.5s
        time.sleep(3.0)
        print("--- T+9.5s ---")
        style_val = page.eval_on_selector("#style-mode", "el => el.value")
        print(f"Style: {style_val} (Expected 3)")

        # Take a screenshot to prove it ran
        page.screenshot(path="verification/final_state.png")

        browser.close()

if __name__ == "__main__":
    verify_camera_routine()

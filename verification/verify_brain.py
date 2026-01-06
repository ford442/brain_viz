from playwright.sync_api import sync_playwright

def verify_brain_viz():
    with sync_playwright() as p:
        # Launch Chromium with WebGPU enabled (unsafe-webgpu might be needed for headless in some envs)
        # Note: In standard headless, WebGPU might not work. SwiftShader is often used.
        # But we will try to just launch it and capture whatever we can.
        # The prompt mentioned: "Chromium must launch with --enable-unsafe-webgpu and --use-gl=swiftshader"
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--enable-unsafe-webgpu",
                "--use-gl=swiftshader",
                "--no-sandbox"
            ]
        )
        page = browser.new_page()

        try:
            # Navigate to the local dev server
            page.goto("http://localhost:5173")

            # Wait for canvas
            page.wait_for_selector("#canvas", timeout=5000)

            # Wait a bit for initialization (WebGPU init, geometry generation)
            page.wait_for_timeout(3000)

            # 1. Take initial screenshot (Organic Mode)
            page.screenshot(path="verification/1_organic_mode.png")
            print("Captured Organic Mode")

            # 2. Switch to Connectome Mode (Style 2) to see Pulses and Somas
            page.select_option("#style-mode", "2")
            page.wait_for_timeout(1000)
            page.screenshot(path="verification/2_connectome_mode.png")
            print("Captured Connectome Mode")

            # 3. Switch to Heatmap Mode (Style 3) to see Region Logic
            page.select_option("#style-mode", "3")
            page.wait_for_timeout(500)

            # Stimulate Frontal Lobe
            page.click("#stim-frontal")
            page.wait_for_timeout(200) # Wait for stimulus to register
            page.screenshot(path="verification/3_heatmap_frontal.png")
            print("Captured Heatmap Frontal Stimulus")

            # Stimulate Occipital Lobe
            page.click("#stim-occipital")
            page.wait_for_timeout(200)
            page.screenshot(path="verification/4_heatmap_occipital.png")
            print("Captured Heatmap Occipital Stimulus")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_brain_viz()

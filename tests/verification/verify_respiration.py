import os
from playwright.sync_api import sync_playwright

def verify_respiration_routine():
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

            # Trigger Respiration Cycle
            print("Triggering Respiration Cycle (pressing 'R')...")
            page.keyboard.press("R")
            page.wait_for_timeout(500) # Wait a little for the inhale phase

            page.screenshot(path="verification/viz_respiration.png")
            print("Screenshot respiration taken")

            # Check narrative overlay
            overlay = page.locator("#narrative-overlay")
            if overlay.is_visible():
                text = overlay.text_content()
                if text:
                    print(f"VERIFIED: Narrative Overlay Active - '{text}'")

            # Open Legend
            page.locator(".fab-help").click()
            page.wait_for_timeout(500)

            # Check legend for Respiration
            legend = page.evaluate("() => document.getElementById('keyboard-legend')?.textContent") or ""
            # Because it's dynamically added and not by ID in some cases we can check inner_text of the legend panel
            legend_text = page.locator(".legend-panel").inner_text()
            if "Respiration" in legend_text:
                print("VERIFIED: UI Legend contains 'R=Respiration'")
            else:
                print("ERROR: UI Legend missing 'R=Respiration'")

        except Exception as e:
            print(f"Script Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    os.makedirs("verification", exist_ok=True)
    verify_respiration_routine()

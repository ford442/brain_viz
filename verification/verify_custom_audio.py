from playwright.sync_api import sync_playwright

def verify_custom_audio():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--enable-unsafe-webgpu',
                '--disable-dawn-features=disallow_unsafe_apis',
            ]
        )
        page = browser.new_page()

        logs = []
        page.on("console", lambda msg: logs.append(msg.text))

        page.goto("http://localhost:5173")

        page.wait_for_selector("canvas", state="attached")
        page.wait_for_timeout(3000)

        page.keyboard.press('c')

        page.wait_for_timeout(3000)

        try:
            text = page.locator("#narrative-overlay").inner_text()
            print(f"Narrative Overlay: '{text}'")
        except Exception as e:
            print("Narrative overlay didn't appear.")

        page.screenshot(path="verification/custom_audio_test.png")

        for log in logs:
            if "[Routine]" in log or "[Main]" in log:
                print(log)

        browser.close()

if __name__ == "__main__":
    verify_custom_audio()

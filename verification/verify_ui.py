import os
from playwright.sync_api import sync_playwright

def run():
    cwd = os.getcwd()
    file_url = f"file://{cwd}/index.html"
    print(f"Navigating to {file_url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(file_url)

        # Check for new sliders
        if page.locator("#focus").count() > 0:
            print("Focus slider found.")
        else:
            print("Focus slider NOT found.")

        if page.locator("#aperture").count() > 0:
            print("Aperture slider found.")
        else:
            print("Aperture slider NOT found.")

        # Check legend text
        legend = page.locator("#keyboard-legend")
        if legend.count() > 0:
            text = legend.inner_text()
            print(f"Legend text: {text}")
            if "0=Focus" in text:
                print("Legend correctly lists 0=Focus.")
            else:
                print("Legend missing 0=Focus.")

        # Take screenshot
        page.screenshot(path="verification/ui_verification.png")
        print("Screenshot saved to verification/ui_verification.png")

        browser.close()

if __name__ == "__main__":
    run()

import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--enable-unsafe-webgpu"])
        page = await browser.new_page()

        logs = []
        page.on("console", lambda msg: logs.append(msg.text))

        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(2000)

        print("Triggering Noradrenaline Spike (key 'u')...")
        await page.keyboard.press("u")
        await page.wait_for_timeout(500)

        print("Checking UI Legend update...")
        legend = await page.evaluate("() => document.getElementById('keyboard-legend')?.textContent")
        if "u=Noradrenaline" in legend:
            print("VERIFIED: UI Legend contains 'u=Noradrenaline'")
        else:
            print("ERROR: UI Legend missing 'u=Noradrenaline'. Legend:", legend)

        await page.screenshot(path="verification/screenshots/viz_noradrenaline.png")
        print("Screenshot viz_noradrenaline.png taken")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

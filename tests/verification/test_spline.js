import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu'] });
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => console.log('Console:', msg.text()));

    await page.goto('http://localhost:5173/');

    // Wait for everything to load
    await page.waitForTimeout(2000);

    // Trigger the Spline Camera Fly-Through Demo
    await page.keyboard.press('v');

    // Wait for the routine to complete (8 seconds + some buffer)
    await page.waitForTimeout(10000);

    await browser.close();
})();

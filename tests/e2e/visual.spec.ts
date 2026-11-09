/**
 * Visual regression for the design-pass look (replaces the M1 prototype parity
 * test; see DECISIONS.md). Every key screen is compared with committed
 * baselines at 390 px and 1280 px. Reduced motion is emulated so count-ups,
 * confetti and transitions settle into a stable final frame.
 *
 * Update baselines after an intended visual change:
 *   npm run test:visual -- --update-snapshots
 */
import { expect, test, type Page } from "@playwright/test";
import { setSlider, syd, setClock } from "./helpers";

const GUESSES = [0.38, -0.5, 0.1, 1.2, 0];
const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

async function snap(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.001 });
}

for (const vp of VIEWPORTS) {
  test(`key screens at ${vp.name} px`, async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "en-US", timezoneId: "Australia/Sydney", reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await setClock(page, syd("2026-11-10T09:00:00"));
    await page.goto(baseURL!);
    await expect(page.locator("#startBtn")).toHaveText(/Play #/); // puzzle loaded

    await snap(page, `${vp.name}-1-intro`);
    await page.locator("#startBtn").click();
    await page.locator("#lockBtn").waitFor(); // session + play start are async
    await snap(page, `${vp.name}-2-round`);
    await setSlider(page, GUESSES[0]!);
    await snap(page, `${vp.name}-3-round-guess`);
    await page.locator("#lockBtn").click();
    await page.locator("#nextBtn").waitFor(); // reveal arrives from /api/reveal
    await snap(page, `${vp.name}-4-reveal`);
    for (let i = 1; i < 5; i++) {
      await page.locator("#nextBtn").click();
      await setSlider(page, GUESSES[i]!);
      await page.locator("#lockBtn").click();
      await page.locator("#nextBtn").waitFor();
    }
    await snap(page, `${vp.name}-5-reveal-last`);
    await page.locator("#nextBtn").click();
    await snap(page, `${vp.name}-6-final`);
    await page.goto(new URL("/how-to-play", baseURL!).toString());
    await page.locator("h1").waitFor();
    await snap(page, `${vp.name}-7-how-to-play`);
    await ctx.close();
  });
}

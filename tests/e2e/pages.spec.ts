import { expect, test } from "@playwright/test";
import { next, playRound, roundsFor, syd, setClock } from "./helpers";

const PAGES = [
  { label: "How to play", path: "/how-to-play", h1: "Guess the change." },
  { label: "Stats", path: "/stats", h1: "Your Changel" },
  { label: "Account", path: "/account", h1: "Your account" },
];

test.beforeEach(async ({ page }) => {
  await setClock(page, syd("2026-11-10T09:00:00"));
});

for (const p of PAGES) {
  test(`menu → ${p.label} by mouse`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("link", { name: p.label }).click();
    await expect(page).toHaveURL(p.path);
    await expect(page.locator("h1")).toHaveText(p.h1);
  });
}

test("/about redirects to How to play, and the menu has no About", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveURL("/how-to-play");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "About" })).toHaveCount(0);
});

test("menu by keyboard: opens, focuses the first item, Escape closes and returns focus", async ({ page }) => {
  await page.goto("/");
  const btn = page.getByRole("button", { name: "Menu" });
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "How to play" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  await expect(btn).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter"); // Stats
  await expect(page).toHaveURL("/stats");
});

test("no horizontal scroll at 320 px on any screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ["/", ...PAGES.map((p) => p.path)]) {
    await page.goto(path);
    await page.getByRole("button", { name: "Menu" }).click(); // open menu too
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/");
  await page.locator("#startBtn").click();
  await playRound(page, "2026-11-10", 0, 99); // clamps to the top of the range: the longest readout
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test("stats page reflects a completed game", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByText("No games yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to restore your stats" })).toHaveAttribute("href", "/account");
  await page.goto("/");
  await page.locator("#startBtn").click();
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += (await playRound(page, "2026-11-10", i, 0.25)).points;
    await next(page);
  }
  await page.goto("/stats");
  await expect(page.locator("#sPlayed")).toHaveText("1");
  await expect(page.locator("#sBest")).toHaveText(String(total));
  await expect(page.locator("#sAvg")).toHaveText(String(total));
  await expect(page.locator("#sStreak")).toHaveText("1");
  await expect(page.locator(".strip button.played")).toHaveCount(1);
  await expect(page.locator(".strip")).toHaveAttribute("aria-label", "Played 1 of the last 30 days");
  // Tapping the played day shows that day's score and each round.
  await page.locator(".strip button.played").click();
  const pop = page.getByRole("dialog");
  await expect(pop.locator("#dayPopTitle")).toHaveText(`${total}/500`);
  await expect(pop.getByText("Changel #2")).toBeVisible();
  await expect(pop.locator(".day-pop-rounds li")).toHaveCount(5);
  await expect(pop.getByText(roundsFor("2026-11-10")[0]!.prompt)).toBeVisible();
  await expect(pop.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  await expect(page.locator(".strip button.played")).toBeFocused();
  await expect(page.getByText("Stats are kept on this device.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add your email" })).toHaveAttribute("href", "/account");
  await expect(page.getByText("coming soon")).toHaveCount(0);
});

test("stats on a device with no local games still show the account's history (strip, results, day pop-up)", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += (await playRound(page, "2026-11-10", i, 0.25)).points;
    await next(page);
  }
  // Same session, but this device's saved games are gone (like signing in on a new phone).
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("changel:v1:")) localStorage.removeItem(k);
  });
  await page.goto("/stats");
  await expect(page.locator("#sPlayed")).toHaveText("1");
  await expect(page.locator(".strip button.played")).toHaveCount(1);
  await expect(page.locator("#sDist")).not.toContainText("Nailed it 0 Close 0 Meh 0 Way off 0 Wrong way! 0");
  await page.locator(".strip button.played").click();
  const pop = page.getByRole("dialog");
  await expect(pop.locator("#dayPopTitle")).toHaveText(`${total}/500`);
  await expect(pop.getByText(roundsFor("2026-11-10")[0]!.prompt)).toBeVisible();
});

test("account page on a fresh browser offers sign-in (no account created just by visiting)", async ({ page }) => {
  await page.goto("/account");
  await expect(page.locator(".save-title")).toHaveText("Sign in");
  await expect(page.getByRole("button", { name: "Email me a code" })).toBeVisible();
});

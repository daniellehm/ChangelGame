/** M6 task 6.1: share sheet on phones, `?r=` links, and the landing page they open (SPEC §10). */
import { expect, test, type Page } from "@playwright/test";
import { decodeShareCode, encodeShareCode } from "@/lib/game/share";
import { next, playRound, setClock, syd } from "./helpers";

const DAY = "2026-11-10";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
});

/** A phone with a share sheet: records what was shared, or fails the way `mode` says. */
async function fakeShareSheet(page: Page, mode: "ok" | "cancel" | "error" = "ok") {
  await page.addInitScript((mode) => {
    const w = window as unknown as { shared: unknown[] };
    w.shared = [];
    Object.defineProperty(navigator, "share", {
      value: (data: unknown) => {
        w.shared.push(data);
        if (mode === "cancel") return Promise.reject(new DOMException("closed", "AbortError"));
        if (mode === "error") return Promise.reject(new DOMException("nope", "NotAllowedError"));
        return Promise.resolve();
      },
    });
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q === "(pointer: coarse)" ? ({ matches: true } as MediaQueryList) : real(q));
  }, mode);
}

async function playAll(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" }); // the final score counts up otherwise
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY, i, 0.2);
    await next(page);
  }
}

test("on a phone, Share opens the share sheet with the result and a ?r= link that encodes it", async ({ page }) => {
  await fakeShareSheet(page);
  await playAll(page);
  const total = Number(await page.locator("#finalScore").textContent());
  const grid = (await page.locator("#finalGrid").textContent()) ?? "";
  await page.locator("#shareBtn").click();
  const shared = (await page.evaluate(() => (window as unknown as { shared: Array<{ text: string; url: string }> }).shared))[0]!;
  expect(shared.text).toBe(`Changel #2 ⇅ ${total}/500\n${grid}`);
  const code = new URL(shared.url).searchParams.get("r");
  expect(shared.url.startsWith("https://changel.app/?r=")).toBe(true);
  expect(decodeShareCode(code)).toMatchObject({ number: 2, total });
  await expect(page.locator("#toast")).not.toHaveClass(/show/); // no "Copied" toast
});

test("closing the share sheet does nothing; a share-sheet error falls back to copying", async ({ page, context }) => {
  await fakeShareSheet(page, "error");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await playAll(page);
  await page.locator("#shareBtn").click();
  await expect(page.locator("#toast")).toHaveText("Copied to clipboard");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Changel #2 ⇅ \d+\/500\n.{5,10}\nchangel\.app$/u);
});

test("a shared link shows the friend's score on the intro and unfurls as their result", async ({ page }) => {
  const code = encodeShareCode({ number: 2, total: 372, tiers: ["nailed", "close", "nailed", "wrong", "nailed"] });
  await page.goto(`/?r=${code}`);
  await expect(page.locator("#friendLine")).toContainText("A friend scored 372");
  await expect(page.locator("#friendLine")).toContainText("Can you beat it?");
  await expect(page.locator("#startBtn")).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `https://changel.app/api/og?r=${code}`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Changel #2 ⇅ 372/500");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("a returning player opening a shared link still sees the intro with the friend's score", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("changel:v1:stats", JSON.stringify({ v: 1, plays: [{ date: "2026-11-09", number: 1, tz: "Australia/Sydney", total: 300, tiers: ["meh", "meh", "close", "meh", "close"] }] })));
  const code = encodeShareCode({ number: 1, total: 300, tiers: ["meh", "meh", "close", "meh", "close"] });
  await page.goto(`/?r=${code}`);
  await expect(page.locator("#friendLine")).toContainText("A friend playing #1 scored 300");
  await expect(page.locator("#friendLine")).toContainText("Try today's.");
  await expect(page.locator("#startBtn")).toBeVisible();
});

test("a bad ?r= code is ignored", async ({ page }) => {
  await page.goto("/?r=c-0-00000");
  await expect(page.locator("#startBtn")).toBeVisible();
  await expect(page.locator("#friendLine")).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
});

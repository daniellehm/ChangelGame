import { expect, test } from "@playwright/test";
import { next, playRound, syd, setClock } from "./helpers";

const GUESSES = [0.3, -1.2, 0.05, 0.6, -0.02];
const DAY1 = "2026-11-10"; // puzzle #2 (launch 2026-11-09)

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY1}T09:00:00`));
});

test("intro shows the trimmed copy", async ({ page }) => {
  await page.goto("/");
  const intro = page.locator("#intro");
  await expect(intro.locator(".cat")).toHaveText("Daily · 5 rounds · 2 min");
  await expect(intro.locator("h1")).toHaveText("How much did it change?");
  await expect(intro.locator("p")).toHaveText("One number from the past. How big is it now?");
  await expect(intro.locator(".rules li")).toHaveText([
    "1Slide right if it grew, left if it shrank.",
    "2Closer guess, more points.",
    "3Wrong direction scores 0.",
  ]);
  await expect(page.locator("#startBtn")).toHaveText("Play #2");
  await expect(page.locator("#meta")).toContainText("#2");
  await expect(page.locator("#meta")).toContainText("Nov 10");
});

test("full game → exact share text → refresh shows the final screen", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  let total = 0;
  const tiers: string[] = [];
  for (let i = 0; i < 5; i++) {
    const s = await playRound(page, DAY1, i, GUESSES[i]!);
    total += s.points;
    tiers.push({ nailed: "🟩", close: "🟨", meh: "🟧", off: "🟥", wrong: "🟥" }[s.tier]);
    await expect(page.locator("#nextBtn")).toHaveText(i === 4 ? "Score" : "Next");
    if (i < 4) await expect(page.locator(`#progress i:nth-child(${i + 1})`)).toHaveAttribute("style", /background/);
    await next(page);
  }

  await expect(page.locator("#finalCat")).toHaveText("Changel #2", { ignoreCase: true });
  await expect(page.locator("#finalScore")).toHaveText(String(total));
  await expect(page.locator("#finalGrid")).toHaveText(tiers.join(""));
  await expect(page.locator("#finalRows .row")).toHaveCount(5);
  await expect(page.locator("#stPlayed")).toHaveText("1");
  await expect(page.locator("#stStreak")).toHaveText("1");
  await expect(page.locator("#stBest")).toHaveText(String(total));
  await expect(page.locator("#countdown")).toHaveText("Next in 15:00:00");

  await page.locator("#shareBtn").click();
  await expect(page.locator("#toast")).toHaveText("Copied to clipboard");
  await expect(page.locator("#toast")).toHaveClass(/show/);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(`Changel #2 ⇅ ${total}/500\n${tiers.join("")}\nchangel.app`);

  await page.reload();
  await expect(page.locator("#final")).toBeVisible();
  await expect(page.locator("#finalScore")).toHaveText(String(total));
  await expect(page.locator("#intro")).toHaveCount(0);
});

test("clipboard failure falls back to a selectable box", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
  });
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY1, i, 0);
    await next(page);
  }
  await page.locator("#shareBtn").click();
  await expect(page.locator("#toast")).toHaveText("Copy the text below");
  const box = page.locator("#shareBox");
  await expect(box).toBeVisible();
  await expect(box).toHaveValue(/^Changel #2 ⇅ \d+\/500\n[🟩🟨🟧🟥]{5}\nchangel\.app$/u);
});

test("refreshing mid-game resumes at the next unplayed round", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  await playRound(page, DAY1, 0, 0.3);
  await next(page);
  await playRound(page, DAY1, 1, -1.2);
  await page.reload(); // reload while viewing round 2's reveal
  await expect(page.locator("#cat")).toHaveText(/round 3 of 5/i);
  await expect(page.locator("#progress i.done")).toHaveCount(2);
  await expect(page.locator("#lockBtn")).toBeVisible();
});

test("a game started before midnight finishes after it; the new puzzle is offered after", async ({ page }) => {
  await setClock(page, syd(`${DAY1}T23:58:00`));
  await page.goto("/");
  await page.locator("#startBtn").click();
  await playRound(page, DAY1, 0, 0.1);
  await next(page);
  await playRound(page, DAY1, 1, 0.1);
  await next(page);

  await setClock(page, syd("2026-11-11T00:03:00"));
  await page.reload();
  await expect(page.locator("#meta")).toContainText("#2"); // still yesterday's puzzle
  for (let i = 2; i < 5; i++) {
    await playRound(page, DAY1, i, 0.1);
    await next(page);
  }
  await expect(page.locator("#finalCat")).toHaveText("Changel #2", { ignoreCase: true });

  await page.reload(); // next load offers today's puzzle (#3) to a returning player
  await expect(page.locator("#meta")).toContainText("#3");
  await expect(page.locator("#cat")).toHaveText(/round 1 of 5/i);
});

test("returning player next day skips the intro and builds a streak of 2", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY1, i, 0.2);
    await next(page);
  }
  await expect(page.locator("#stStreak")).toHaveText("1");

  await setClock(page, syd("2026-11-11T08:00:00"));
  await page.reload();
  await expect(page.locator("#intro")).toHaveCount(0);
  for (let i = 0; i < 5; i++) {
    await playRound(page, "2026-11-11", i, 0.2);
    await next(page);
  }
  await expect(page.locator("#finalCat")).toHaveText("Changel #3", { ignoreCase: true });
  await expect(page.locator("#stPlayed")).toHaveText("2");
  await expect(page.locator("#stStreak")).toHaveText("2");
});

test("no console errors or hydration warnings through a game", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY1, i, 0.4);
    await next(page);
  }
  await page.reload();
  await expect(page.locator("#final")).toBeVisible();
  expect(problems).toEqual([]);
});

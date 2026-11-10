/** M6 task 6.3: crowd line on each reveal, "Today's trap" on the final screen (SPEC §10). */
import { expect, test } from "@playwright/test";
import { next, playRound, roundsFor, setClock, syd } from "./helpers";

const DAY = "2026-11-10";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
});

test("with enough plays: crowd line on each reveal; today's trap, percentile and score graph on the final screen", async ({ page }) => {
  // Round 4 is where the crowd did worst.
  const rounds = [1, 2, 3, 4, 5].map((position) => ({ position, plays: 120, wrong_way: position === 4 ? 54 : 6, nailed: position === 2 ? 12 : 40, avg_points: position === 4 ? 21.5 : 60 }));
  // 200 players spread evenly over 0–497 (one per 2.5 points): your rank is easy to work out.
  const counts: Record<string, number> = {};
  for (let i = 0; i < 200; i++) counts[String(Math.floor(i * 2.5))] = (counts[String(Math.floor(i * 2.5))] ?? 0) + 1;
  await page.route("**/api/crowd?**", (route) => route.fulfill({ json: { date: DAY, rounds, scores: { n: 200, counts } } }));
  await page.emulateMedia({ reducedMotion: "reduce" }); // the final score counts up otherwise
  await page.goto("/");
  await page.locator("#startBtn").click();
  const want = ["33% of players nailed this", "Only 10% nailed this", "33% of players nailed this", "45% of players went the wrong way", "33% of players nailed this"];
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY, i, 0.2);
    await expect(page.locator("#crowdLine")).toHaveText(want[i]!);
    await next(page);
  }
  await expect(page.locator("#trapLine")).toHaveText(`Today's trap: ${roundsFor(DAY)[3]!.prompt}`);
  // Where you stand: a percentile line and the score graph with your bar marked.
  const total = Number(await page.locator("#finalScore").textContent());
  const above = Object.entries(counts).filter(([t]) => Number(t) > total).reduce((a, [, c]) => a + c, 0);
  const below = Object.entries(counts).filter(([t]) => Number(t) < total).reduce((a, [, c]) => a + c, 0);
  const top = Math.max(1, Math.ceil(((above + 1) / 200) * 100));
  await expect(page.locator("#standing")).toHaveText(top <= 50 ? `Top ${top}% today` : `Better than ${Math.floor((below / 200) * 100)}% of players today`);
  await expect(page.locator(".score-graph i")).toHaveCount(20);
  await expect(page.locator(".score-graph i.mine")).toHaveCount(1);
  await expect(page.locator(".score-graph i.mine .you")).toHaveText("YOU");
});

test("before 50 plays: a neutral line, and no trap", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY, i, 0.2);
    await expect(page.locator("#crowdLine")).toHaveText("Too early for crowd stats on this one.");
    await next(page);
  }
  await expect(page.locator("#final")).toBeVisible();
  await expect(page.locator("#trapLine")).toHaveCount(0);
  await expect(page.locator("#standing")).toHaveText(/^Too early to compare: \d+ players? so far today\.$/);
  await expect(page.locator(".score-graph")).toHaveCount(0);
});

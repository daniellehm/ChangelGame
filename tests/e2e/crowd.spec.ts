/** M6 task 6.3: crowd line on each reveal, "Today's trap" on the final screen (SPEC §10). */
import { expect, test } from "@playwright/test";
import { next, playRound, roundsFor, setClock, syd } from "./helpers";

const DAY = "2026-11-10";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
});

test("with enough plays: each reveal has a crowd line, and the final screen names today's trap", async ({ page }) => {
  // Round 4 is where the crowd did worst.
  const rounds = [1, 2, 3, 4, 5].map((position) => ({ position, plays: 120, wrong_way: position === 4 ? 54 : 6, nailed: position === 2 ? 12 : 40, avg_points: position === 4 ? 21.5 : 60 }));
  await page.route("**/api/crowd?**", (route) => route.fulfill({ json: { date: DAY, rounds } }));
  await page.goto("/");
  await page.locator("#startBtn").click();
  const want = ["33% of players nailed this", "Only 10% nailed this", "33% of players nailed this", "45% of players went the wrong way", "33% of players nailed this"];
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY, i, 0.2);
    await expect(page.locator("#crowdLine")).toHaveText(want[i]!);
    await next(page);
  }
  await expect(page.locator("#trapLine")).toHaveText(`Today's trap: ${roundsFor(DAY)[3]!.prompt}`);
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
});

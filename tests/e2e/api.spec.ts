/**
 * M2 acceptance: answers are absent from every network response before lock-in.
 * Spies on every response (document, scripts, API) during a full game.
 */
import { expect, test, type Page } from "@playwright/test";
import { TEST_CLOCK_HEADER } from "@/lib/api/clock";
import { next, playRound, roundsFor, setClock, syd } from "./helpers";

const DAY = "2026-11-10";

interface Captured { url: string; type: string; body: string; at: number }

function spy(page: Page): Captured[] {
  const seen: Captured[] = [];
  page.on("response", async (res) => {
    const type = res.request().resourceType();
    if (!["document", "script", "fetch", "xhr"].includes(type)) return;
    try {
      seen.push({ url: res.url(), type, body: await res.text(), at: Date.now() });
    } catch {
      /* redirects / aborted */
    }
  });
  return seen;
}

/** Strings that would give away a round's answer. */
function secretsFor(date: string, i: number): string[] {
  const q = roundsFor(date)[i]!;
  return [q.fact!.slice(0, 40), `"end_value":${q.end_value}`];
}

test("no answer reaches the browser before its round is locked in", async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
  const seen = spy(page);
  await page.goto("/");
  await page.locator("#startBtn").click();

  for (let i = 0; i < 5; i++) {
    await expect(page.locator("#lockBtn")).toBeVisible();
    // Before locking round i: no response so far may contain round i..5's answers.
    for (let j = i; j < 5; j++) {
      for (const secret of secretsFor(DAY, j)) {
        const leak = seen.find((r) => r.body.includes(secret));
        expect(leak?.url, `round ${j + 1} answer seen before round ${i + 1} lock-in`).toBeUndefined();
      }
    }
    await playRound(page, DAY, i, 0.25);
    // After locking: exactly one answer response for this position
    // (/api/guess with a session, /api/reveal in local mode).
    const reveals = seen.filter((r) => r.url.endsWith("/api/guess") || r.url.endsWith("/api/reveal"));
    expect(reveals).toHaveLength(i + 1);
    expect(JSON.parse(reveals[i]!.body).position).toBe(i + 1);
    await next(page);
  }

  const puzzleCalls = seen.filter((r) => r.url.includes("/api/puzzle"));
  expect(puzzleCalls.length).toBeGreaterThan(0);
  for (const r of puzzleCalls) {
    for (const k of ["end_value", "fact", "source_name", "source_url", "actual_log"]) expect(r.body).not.toContain(`"${k}"`);
  }
  // The page's own JS no longer bundles any question bank.
  const scripts = seen.filter((r) => r.type === "script");
  expect(scripts.length).toBeGreaterThan(0);
  for (let i = 0; i < 5; i++) {
    const fact = roundsFor(DAY)[i]!.fact!.slice(0, 40);
    expect(scripts.find((s) => s.body.includes(fact))?.url).toBeUndefined();
  }
});

test("device clock 3 days ahead shows 'Check your device clock'", async ({ page }) => {
  // Browser thinks it's the 13th; the server knows it's the 10th.
  await page.clock.setFixedTime(syd("2026-11-13T09:00:00"));
  await page.setExtraHTTPHeaders({ [TEST_CLOCK_HEADER]: syd(`${DAY}T09:00:00`).toISOString() });
  await page.goto("/");
  await expect(page.locator("#loadError h1")).toHaveText("Check your device clock");
  await expect(page.locator("#startBtn")).toHaveCount(0);

  // Fixing the clock and retrying loads the game.
  await page.clock.setFixedTime(syd(`${DAY}T09:00:00`));
  await page.locator("#retryBtn").click();
  await expect(page.locator("#startBtn")).toHaveText("Play #2");
});

test("a date with no puzzle shows 'No puzzle yet'", async ({ page }) => {
  await setClock(page, syd("2097-03-03T09:00:00")); // a date that never gets a puzzle
  await page.goto("/");
  await expect(page.locator("#loadError h1")).toHaveText("No puzzle yet");
});

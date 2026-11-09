/**
 * SPEC §12 M3 E2E (mobile viewport): full game anonymous → refresh mid-game
 * resumes → finish → share copies the exact text → next day (mocked clock)
 * offers a new puzzle and streak = 2. Plus: a browser without cookies falls
 * back to local play. Needs anonymous sign-ins enabled in Supabase; skips
 * otherwise. Test users are deleted afterwards.
 */
import { expect, test, type Page } from "@playwright/test";
import { TEST_CLOCK_HEADER } from "@/lib/api/clock";
import { adminClient } from "@/lib/supabase/admin";
import { next, playRound, setClock, syd } from "./helpers";

process.loadEnvFile?.(".env.local");

const DAY1 = "2026-11-10";
const DAY2 = "2026-11-11";
const created = new Set<string>();

function trackUsers(page: Page) {
  page.on("response", async (res) => {
    if (!res.url().endsWith("/api/session") || res.status() !== 200) return;
    try {
      const body = await res.json();
      if (body.created && body.user_id) created.add(body.user_id);
    } catch {
      /* ignore */
    }
  });
}

test.afterAll(async () => {
  for (const id of created) await adminClient().auth.admin.deleteUser(id);
});

test("anonymous player: play, resume, finish, share, next day streak 2", async ({ page }) => {
  trackUsers(page);
  await setClock(page, syd(`${DAY1}T09:00:00`));
  // page.request doesn't inherit page headers, so pass the test clock + a fake client IP explicitly.
  const probe = await page.request.post("/api/session", {
    data: { tz: "Australia/Sydney" },
    headers: { [TEST_CLOCK_HEADER]: syd(`${DAY1}T09:00:00`).toISOString(), "x-forwarded-for": "198.18.250.250" },
  });
  test.skip(probe.status() === 503, "Anonymous sign-ins are off in Supabase (Dani's checklist)");
  expect(probe.status()).toBe(200);
  const probeBody = await probe.json();
  if (probeBody.created) created.add(probeBody.user_id);

  await page.goto("/");
  await page.locator("#startBtn").click();
  const tiers: string[] = [];
  let total = 0;
  for (let i = 0; i < 2; i++) {
    const s = await playRound(page, DAY1, i, 0.3);
    total += s.points;
    tiers.push({ nailed: "🟩", close: "🟨", meh: "🟧", off: "🟥", wrong: "🟥" }[s.tier]);
    await next(page);
  }

  // Refresh mid-game: resumes at round 3 from the SERVER's record.
  await page.evaluate(() => localStorage.clear()); // prove it's not just the local mirror
  await page.reload();
  // With local storage gone the intro shows; Play resumes the existing server play.
  await page.locator("#startBtn").click();
  await expect(page.locator("#cat")).toHaveText(/round 3 of 5/i);
  await expect(page.locator("#progress i.done")).toHaveCount(2);

  for (let i = 2; i < 5; i++) {
    const s = await playRound(page, DAY1, i, 0.3);
    total += s.points;
    tiers.push({ nailed: "🟩", close: "🟨", meh: "🟧", off: "🟥", wrong: "🟥" }[s.tier]);
    await next(page);
  }
  await expect(page.locator("#finalScore")).toHaveText(String(total));
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.locator("#shareBtn").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`Changel #2 ⇅ ${total}/500\n${tiers.join("")}\nchangel.app`);

  // The play is stored server-side, completed, with the right total.
  const { data: plays } = await adminClient().from("plays").select("total, completed_at, source").eq("puzzle_date", DAY1).in("player_id", [...created]);
  expect(plays?.some((p) => p.total === total && p.completed_at && p.source === "server")).toBe(true);

  // Next day: a new puzzle, and the streak (from the server) is 2.
  await setClock(page, syd(`${DAY2}T08:00:00`));
  await page.reload();
  await expect(page.locator("#meta")).toContainText("#3");
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY2, i, 0.3);
    await next(page);
  }
  await expect(page.locator("#finalCat")).toHaveText("Changel #3", { ignoreCase: true });
  await expect(page.locator("#stStreak")).toHaveText("2");
  await expect(page.locator("#stPlayed")).toHaveText("2");
});

test("a browser that won't keep cookies falls back to local play", async ({ page }) => {
  await setClock(page, syd(`${DAY1}T09:00:00`));
  // Act like a browser that refuses cookies: whatever /api/session sets is thrown
  // away (route.fetch stores cookies in the context, so clear them), and the
  // reply carries no Set-Cookie. /api/play then has no session.
  await page.route("**/api/session", async (route) => {
    const res = await route.fetch();
    const body = await res.json().catch(() => ({}));
    if (body?.created && body?.user_id) created.add(body.user_id);
    await page.context().clearCookies();
    const headers = { ...res.headers() };
    delete headers["set-cookie"];
    await route.fulfill({ status: res.status(), headers, json: body });
  });
  await page.goto("/");
  await page.locator("#startBtn").click();
  for (let i = 0; i < 5; i++) {
    await playRound(page, DAY1, i, 0.1);
    await next(page);
  }
  await expect(page.locator("#final")).toBeVisible();
  const stored = await page.evaluate((d) => JSON.parse(localStorage.getItem(`changel:v1:play:${d}`) ?? "null"), DAY1);
  expect(stored.mode).toBe("local");
  expect(stored.results).toHaveLength(5);
});

test("returning local player auto-starting creates exactly ONE anonymous user (regression)", async ({ page }) => {
  await setClock(page, syd(`${DAY1}T09:00:00`));
  const createdHere: string[] = [];
  page.on("response", async (res) => {
    if (!res.url().endsWith("/api/session") || res.status() !== 200) return;
    const body = await res.json().catch(() => ({}));
    if (body.created) {
      createdHere.push(body.user_id);
      created.add(body.user_id);
    }
  });
  // Has played before on this device (so the intro is skipped), but has no session cookie.
  await page.addInitScript(() => {
    localStorage.setItem("changel:v1:stats", JSON.stringify({ v: 1, plays: [{ date: "2026-11-09", number: 1, tz: "Australia/Sydney", total: 200, tiers: ["meh", "meh", "meh", "meh", "meh"] }] }));
  });
  await page.goto("/");
  await playRound(page, DAY1, 0, 0.2); // locks in through /api/guess without "play not found"
  expect(createdHere).toHaveLength(1);
});

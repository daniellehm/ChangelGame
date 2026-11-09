/**
 * Dani's case (M4): the account already finished today's game; the same person
 * replays it in another browser without signing in, gets a different score,
 * then signs in with the same email. The account's FIRST score must stand, the
 * replay must be discarded, and this browser must show the account's result.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { TEST_NO_EMAIL_HEADER } from "@/lib/api/clock";
import { adminClient } from "@/lib/supabase/admin";
import { next, playRound, setClock, syd } from "./helpers";

process.loadEnvFile?.(".env.local");

const DAY = "2026-11-10";
const email = `e2e-${randomUUID()}@example.com`;
let accountId = "";

async function playAll(page: Page, guess: number): Promise<number> {
  await page.goto("/");
  await page.locator("#startBtn").click();
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += (await playRound(page, DAY, i, guess)).points;
    await next(page);
  }
  await expect(page.locator("#finalScore")).toHaveText(String(total));
  return total;
}

test.afterAll(async () => {
  if (accountId) await adminClient().auth.admin.deleteUser(accountId);
});

test("a replay in another browser never replaces the account's first score", async ({ browser }) => {
  // Browser A: plays first, then saves the streak (account = same user id).
  const a = await (await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Australia/Sydney", locale: "en-US" })).newPage();
  await setClock(a, syd(`${DAY}T09:00:00`));
  const sessionA = a.waitForResponse((r) => r.url().endsWith("/api/session") && r.status() === 200);
  const first = await playAll(a, 0.3);
  accountId = (await (await sessionA).json()).user_id;
  const { error } = await adminClient().auth.admin.updateUserById(accountId, { email, email_confirm: true });
  expect(error).toBeNull();

  // Browser B: same person, not signed in, replays the day with different guesses.
  const b = await (await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Australia/Sydney", locale: "en-US" })).newPage();
  await setClock(b, syd(`${DAY}T10:00:00`), { [TEST_NO_EMAIL_HEADER]: "1" });
  const replay = await playAll(b, -0.5);
  expect(replay).not.toBe(first);

  // Signs in with the account's email from the final screen.
  await b.locator("#saveBtn").click();
  await b.locator(".final-save input[type=email]").fill(email);
  await b.getByRole("button", { name: "Email me a code" }).click();
  const { data, error: e2 } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  expect(e2).toBeNull();
  await b.locator(".final-save input[autocomplete=one-time-code]").fill(data?.properties?.email_otp ?? "");
  await b.getByRole("button", { name: "Confirm" }).click();

  // This browser now shows the account's first score, and says why.
  // (generous timeout: the dev server compiles routes on first use)
  await expect(b.locator("#savedNote")).toContainText("your first score stands", { timeout: 20_000 });
  await expect(b.locator("#finalScore")).toHaveText(String(first));
  await expect(b.locator("#saveBtn")).toHaveCount(0); // signed in now

  // The account still has exactly one play for the day: the first one.
  const { data: plays } = await adminClient().from("plays").select("total").eq("player_id", accountId).eq("puzzle_date", DAY);
  expect(plays).toEqual([{ total: first }]);
});

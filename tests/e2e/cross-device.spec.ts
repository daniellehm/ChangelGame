/**
 * Dani 2026-11-10: "I did today's Changel, then logged in on another device and it says I
 * haven't. And sometimes I'm logged in but Stats tells me to log in to save."
 * Device A plays while signed in; device B signs in on the Account page and opens the game:
 * it must show the account's finished game (same score), and nothing may ask to save.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { TEST_NO_EMAIL_HEADER } from "@/lib/api/clock";
import { adminClient } from "@/lib/supabase/admin";
import { next, playRound, setClock, syd } from "./helpers";

process.loadEnvFile?.(".env.local");

const DAY = "2026-11-10";
const email = `e2e-${randomUUID()}@example.com`;
const created: string[] = [];

test.afterAll(async () => {
  for (const id of created) await adminClient().auth.admin.deleteUser(id);
});

async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Australia/Sydney", locale: "en-US", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await setClock(page, syd(`${DAY}T09:00:00`), { [TEST_NO_EMAIL_HEADER]: "1" });
  return page;
}

async function signIn(page: Page) {
  await page.goto("/account");
  await page.locator("input[type=email]").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.locator("input[autocomplete=one-time-code]").waitFor();
  const { data } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (data?.user?.id && !created.includes(data.user.id)) created.push(data.user.id);
  await page.locator("input[autocomplete=one-time-code]").fill(data?.properties?.email_otp ?? "");
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Delete my account" }).waitFor({ timeout: 20_000 });
}

test("a game finished on one device shows on another after signing in there; nothing asks a signed-in player to save", async ({ browser }) => {
  // Device A: signs in, then plays today's game.
  const a = await device(browser);
  await signIn(a);
  await a.goto("/");
  await a.locator("#startBtn").click();
  let total = 0;
  for (let i = 0; i < 5; i++) {
    total += (await playRound(a, DAY, i, 0.3)).points;
    await next(a);
  }
  await expect(a.locator("#finalScore")).toHaveText(String(total));
  await expect(a.locator("#saveBtn")).toHaveCount(0); // signed in: no "Save your streak"

  // Device B: a fresh browser, signs in on the Account page, then opens the game.
  const b = await device(browser);
  await signIn(b);
  await b.goto("/");
  await expect(b.locator("#final")).toBeVisible({ timeout: 20_000 });
  await expect(b.locator("#finalScore")).toHaveText(String(total));
  await expect(b.locator("#intro")).toHaveCount(0);
  await expect(b.locator("#saveBtn")).toHaveCount(0);

  // Stats on device B: the game counts, and no "add your email" note.
  await b.goto("/stats");
  await expect(b.locator("#sPlayed")).toHaveText("1");
  await expect(b.getByText("Stats are kept on this device.")).toHaveCount(0);
  await expect(b.getByRole("link", { name: "Add your email" })).toHaveCount(0);
});

test("a game half-done on one device resumes at the next round on another", async ({ browser }) => {
  const a = await device(browser);
  await signIn(a);
  await a.goto("/");
  await a.locator("#startBtn").click();
  await playRound(a, DAY, 0, 0.3);
  await next(a);
  await playRound(a, DAY, 1, -0.2);
  await next(a);

  const b = await device(browser);
  await signIn(b);
  await b.goto("/");
  await expect(b.locator("#lockBtn")).toBeVisible({ timeout: 20_000 });
  await expect(b.locator(".round-cat, #roundCat").first()).toContainText(/round 3 of 5/i);
});

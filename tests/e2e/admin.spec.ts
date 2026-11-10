/**
 * The admin portal is invisible to everyone but an admin (Dani 2026-11-10): a plain 404, no
 * sign-in prompt. The test server's ADMIN_EMAILS is e2e-admin@example.com (playwright.config).
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { TEST_NO_EMAIL_HEADER } from "@/lib/api/clock";
import { adminClient } from "@/lib/supabase/admin";
import { setClock, syd } from "./helpers";

process.loadEnvFile?.(".env.local");

const PAGES = [
  ["/admin", "Admin"],
  ["/admin/upcoming", "Upcoming"],
  ["/admin/flagged", "Flagged"],
  ["/admin/bank", "Question bank"],
  ["/admin/health", "Health"],
  ["/admin/analytics", "Analytics"],
  ["/admin/messages", "Messages"],
  ["/admin/reports", "Reports"],
  ["/admin/questions/1", "Question #1"],
] as const;

const created: string[] = [];
test.afterAll(async () => {
  for (const id of created) await adminClient().auth.admin.deleteUser(id);
});

/** Sign in on /account with a code, like a real player. */
async function signIn(page: Page, email: string) {
  await setClock(page, syd("2026-11-10T09:00:00"), { [TEST_NO_EMAIL_HEADER]: "1" });
  await page.goto("/account");
  await page.locator("input[type=email]").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.locator("input[autocomplete=one-time-code]").waitFor();
  const { data } = await adminClient().auth.admin.generateLink({ type: "magiclink", email });
  if (data?.user?.id) created.push(data.user.id);
  await page.locator("input[autocomplete=one-time-code]").fill(data?.properties?.email_otp ?? "");
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Delete my account" }).waitFor({ timeout: 20_000 });
}

test("signed out: every admin page is a plain 404 (no sign-in prompt, no admin menu)", async ({ page }) => {
  await setClock(page, syd("2026-11-10T09:00:00"));
  for (const [path] of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("navigation", { name: "Admin sections" })).toHaveCount(0);
    await expect(page.getByText("Sign in with your admin email")).toHaveCount(0);
  }
});

test("signed in with an account that isn't an admin: still 404", async ({ page }) => {
  await signIn(page, `e2e-${randomUUID()}@example.com`);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
});

test("the admin: every section loads, noindex, no sideways scroll at 320 px", async ({ page }) => {
  await signIn(page, "e2e-admin@example.com");
  await page.setViewportSize({ width: 320, height: 700 });
  for (const [path, title] of PAGES) {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1")).toHaveText(title);
    expect(errors, path).toEqual([]);
  }
  await page.goto("/admin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link")).toHaveCount(8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

import { expect, test } from "@playwright/test";
import { setClock, syd } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd("2026-11-10T09:00:00"));
});

test("admin signed out: sign-in prompt, every section reachable, noindex, no sideways scroll at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/admin");
  await expect(page.locator("h1")).toHaveText("Admin");
  await expect(page.getByText("Sign in with your admin email")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link")).toHaveCount(7);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const [path, title] of [
  ["/admin/upcoming", "Upcoming"],
  ["/admin/flagged", "Flagged"],
  ["/admin/bank", "Question bank"],
  ["/admin/health", "Health"],
  ["/admin/analytics", "Analytics"],
  ["/admin/questions/1", "Question #1"],
] as const) {
  test(`${path} loads and asks a signed-out visitor to sign in`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.getByText("Sign in with your admin email")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

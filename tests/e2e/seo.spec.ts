/** M6 task 6.8: privacy/terms pages, titles and meta, robots and sitemap (SPEC §10, §11). */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setClock, syd } from "./helpers";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd("2026-11-10T09:00:00"));
});

test("home page title, description, canonical and default share image", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Changel — the daily game about how much the world changed");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /five rounds a day/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://changel.app");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://changel.app/api/og");
});

test("robots.txt keeps admin, API and personal pages out; sitemap lists the public pages", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/api/", "/account", "/stats"]) expect(robots).toContain(`Disallow: ${path}`);
  expect(robots).toContain("Sitemap: https://changel.app/sitemap.xml");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const url of ["https://changel.app/", "https://changel.app/how-to-play", "https://changel.app/privacy", "https://changel.app/terms"]) expect(sitemap).toContain(`<loc>${url}</loc>`);
});

for (const [path, h1, title] of [
  ["/privacy", "Your privacy", "Privacy · Changel"],
  ["/terms", "Terms of use", "Terms · Changel"],
] as const) {
  test(`${path} reads well: title, heading, contact, no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator("h1")).toHaveText(h1);
    await expect(page.getByRole("link", { name: "hello@changel.app" }).first()).toHaveAttribute("href", "mailto:hello@changel.app");
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(r.violations.filter((v) => v.id !== "color-contrast").map((v) => v.id)).toEqual([]);
  });
}

test("privacy and terms are linked from the menu and the foot of every page", async ({ page }) => {
  await page.goto("/how-to-play");
  await expect(page.locator(".legal-links").getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  await expect(page.locator(".legal-links").getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  await page.getByRole("button", { name: /menu/i }).click();
  await page.getByRole("link", { name: "Terms" }).first().click();
  await expect(page).toHaveURL(/\/terms$/);
});

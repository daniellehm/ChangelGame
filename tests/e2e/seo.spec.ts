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
  for (const url of ["https://changel.app/", "https://changel.app/how-to-play", "https://changel.app/privacy", "https://changel.app/contact"]) expect(sitemap).toContain(`<loc>${url}</loc>`);
});

test("privacy & terms is one page: title, both sections, contact via the form (no email), no axe violations", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy & terms · Changel");
  await expect(page.locator("h1")).toHaveText("Privacy & terms");
  await expect(page.locator("#privacy h2")).toHaveText("Privacy");
  await expect(page.locator("#terms h2")).toHaveText("Terms");
  await expect(page.locator("text=@changel.app")).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.locator("#terms").getByRole("link", { name: "contact form" })).toHaveAttribute("href", "/contact");
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("/terms goes to the terms section", async ({ page }) => {
  await page.goto("/terms");
  await expect(page).toHaveURL(/\/privacy#terms$/);
});

test("privacy & terms and contact are linked at the bottom (game intro and other pages), not in the menu", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".legal-links").getByRole("link", { name: "Privacy & terms" })).toHaveAttribute("href", "/privacy");
  await expect(page.locator(".legal-links").getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  await page.getByRole("button", { name: /menu/i }).click();
  await expect(page.getByRole("link", { name: /privacy|terms/i })).toHaveCount(1); // only the footer link, none in the menu
  await page.goto("/how-to-play");
  await expect(page.locator(".legal-links").getByRole("link", { name: "Contact" })).toBeVisible();
});

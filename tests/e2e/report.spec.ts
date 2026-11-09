import { expect, test } from "@playwright/test";
import { playRound, setClock, syd } from "./helpers";

const DAY = "2026-11-10";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
});

test("a player can report a round from its reveal, once", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  await playRound(page, DAY, 0, 0.2);
  const link = page.getByRole("button", { name: "Something wrong with this?" });
  await expect(link).toBeVisible();
  await link.click();
  await page.getByLabel("Wrong year").check();
  await page.getByLabel("Anything to add? (optional)").fill("e2e report");
  const sent = page.waitForResponse((r) => r.url().endsWith("/api/report") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Send" }).click();
  expect((await sent).status()).toBe(200);
  await expect(page.getByText("Thanks. We'll take a look.")).toBeVisible();
  await expect(page.locator("#nextBtn")).toBeVisible(); // reporting never blocks the game
});

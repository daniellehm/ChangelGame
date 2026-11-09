import { expect, type Page } from "@playwright/test";
import { questionsForDay } from "@/lib/fixtures/prototype-pool";
import { daysBetween } from "@/lib/dates";
import { actualLog, scoreRound, TIERS } from "@/lib/scoring";
import { multLabel } from "@/lib/format";

/** Sydney wall-clock time → Date. */
export const syd = (local: string) => new Date(`${local}+11:00`);

/** Questions the fixture serves on a local date. */
export const roundsFor = (date: string) => questionsForDay(daysBetween("2026-11-09", date));

/** Set the slider to an exact value via the keyboard (Home → End → arrows would be slow). */
export async function setSlider(page: Page, value: number) {
  await page.locator("#slider").evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** Play one round at `guess`, verify the reveal, and return the expected points. */
export async function playRound(page: Page, date: string, i: number, guess: number) {
  const q = roundsFor(date)[i]!;
  await expect(page.locator("#cat")).toHaveText(`Round ${i + 1} of 5, ${q.cat}`, { ignoreCase: true });
  await expect(page.locator("#q")).toHaveText(q.q);
  await setSlider(page, guess);
  await page.locator("#lockBtn").click();
  const s = scoreRound(guess, actualLog(q.v0, q.v1));
  await expect(page.locator("#vText")).toHaveText(TIERS[s.tier].label);
  await expect(page.locator("#vPts")).toHaveText(`+${s.points}`);
  await expect(page.locator("#pinRealLbl")).toHaveText(`REAL ${multLabel(actualLog(q.v0, q.v1)).big}`);
  await expect(page.locator("#fact")).toHaveText(q.fact);
  await expect(page.locator("#src")).toHaveText(`Source: ${q.src}`);
  return s;
}

export async function next(page: Page) {
  await page.locator("#nextBtn").click();
}

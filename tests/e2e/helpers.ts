import { expect, type Page } from "@playwright/test";
import { TEST_CLOCK_HEADER } from "@/lib/api/clock";
import { formatValue, multLabel } from "@/lib/format";
import { actualLog, scoreRound, TIERS } from "@/lib/scoring";
import { seededRounds } from "../helpers/seed";

/** Sydney wall-clock time → Date. */
export const syd = (local: string) => new Date(`${local}+11:00`);

/**
 * Freeze the browser clock AND pin the server's clock to the same instant
 * (the dev server runs with ALLOW_TEST_CLOCK=1), so the date window agrees.
 */
export async function setClock(page: Page, when: Date) {
  await page.clock.setFixedTime(when);
  await page.setExtraHTTPHeaders({ [TEST_CLOCK_HEADER]: when.toISOString(), "x-forwarded-for": fakeIp(page) });
}

/**
 * A stable fake client IP per test page. Locally there's no proxy, so without
 * this every test sign-up would count against one IP in Supabase's per-IP
 * anonymous sign-in limit (30/hour). On Vercel the real player IP is used.
 */
const ips = new WeakMap<Page, string>();
function fakeIp(page: Page): string {
  let ip = ips.get(page);
  if (!ip) {
    ip = `198.18.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`; // RFC 2544 test range
    ips.set(page, ip);
  }
  return ip;
}

/** Questions the dev seed serves on a local date. */
export const roundsFor = (date: string) => seededRounds(date);

/** Set the slider to an exact value. */
export async function setSlider(page: Page, value: number) {
  await page.locator("#slider").evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** Play one round at `guess`, verify the reveal, and return the expected score. */
export async function playRound(page: Page, date: string, i: number, guess: number) {
  const q = roundsFor(date)[i]!;
  await expect(page.locator("#cat")).toHaveText(`Round ${i + 1} of 5, ${q.category}`, { ignoreCase: true });
  await expect(page.locator("#q")).toHaveText(q.prompt);
  await expect(page.locator("#v0")).toHaveText(formatValue(q.start_value, q.format));
  await setSlider(page, guess);
  await page.locator("#lockBtn").click();
  const a = actualLog(q.start_value, q.end_value);
  const s = scoreRound(guess, a);
  await expect(page.locator("#vText")).toHaveText(TIERS[s.tier].label);
  await expect(page.locator("#vPts")).toHaveText(`+${s.points}`);
  await expect(page.locator("#v1")).toHaveText(formatValue(q.end_value, q.format));
  await expect(page.locator("#pinRealLbl")).toHaveText(`REAL ${multLabel(a).big}`);
  await expect(page.locator("#fact")).toHaveText(q.fact ?? "");
  await expect(page.locator("#src")).toHaveText(`Source: ${q.source_name}`);
  return s;
}

export async function next(page: Page) {
  await page.locator("#nextBtn").click();
}

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { multSpoken } from "@/lib/format";
import { epsilon, questionRange } from "@/lib/range";
import { keyboardMove, nudge } from "@/lib/slider";
import { next, playRound, roundsFor, syd, setClock } from "./helpers";

const DAY = "2026-11-10";

test.beforeEach(async ({ page }) => {
  await setClock(page, syd(`${DAY}T09:00:00`));
});

/**
 * axe violations, excluding colour contrast. The prototype's verdict colours
 * and --muted on --bg are below AA by design until M6 (DECISIONS.md item 12),
 * and the contrast rule is asserted separately so we see exactly which elements fail.
 */
async function axe(page: Page) {
  // Let the reveal pop / pin slide finish, or axe measures half-faded text.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const other = r.violations.filter((v) => v.id !== "color-contrast");
  const contrast = r.violations.find((v) => v.id === "color-contrast")?.nodes.map((n) => n.target.join(" ")) ?? [];
  return { other, contrast };
}

/** Elements allowed to fail contrast until M6. */
const KNOWN_CONTRAST = /#meta|\.meta|#verdict|#vText|#vPts|\.verdict|\.pts/;

test("keyboard-only: a full game can be played without a pointer", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#startBtn")).toHaveText("Play #2"); // puzzle loaded from the API
  await page.keyboard.press("Tab"); // logo
  await page.keyboard.press("Tab"); // menu
  await page.keyboard.press("Tab"); // Play
  await expect(page.locator("#startBtn")).toBeFocused();
  await page.keyboard.press("Enter");

  for (let i = 0; i < 5; i++) {
    // Focus moves to the question on each new round.
    await expect(page.locator("#q")).toBeFocused();
    await page.keyboard.press("Tab"); // − (nudge down)
    await expect(page.locator("#nudgeDown")).toBeFocused();
    await page.keyboard.press("Tab"); // + (nudge up)
    await page.keyboard.press("Tab");
    await expect(page.locator("#slider")).toBeFocused();
    // Steps scale with each question's range: 2 pages + 1 step from "same".
    const r = questionRange(roundsFor(DAY)[i]!);
    const want = keyboardMove(r, keyboardMove(r, keyboardMove(r, 0, "PageUp")!, "PageUp")!, "ArrowRight")!;
    await page.keyboard.press("PageUp");
    await page.keyboard.press("PageUp");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#slider")).toHaveValue(String(want));
    await expect(page.locator("#slider")).toHaveAttribute("aria-valuetext", multSpoken(want, epsilon(r)));
    await page.keyboard.press("Tab"); // Lock in
    await expect(page.locator("#lockBtn")).toBeFocused();
    await page.keyboard.press("Enter");
    // Focus moves to the verdict; the result is announced.
    await expect(page.locator("#verdict")).toBeFocused();
    await expect(page.locator("#revealAnnounce")).toContainText("points");
    await page.keyboard.press("Tab"); // "Something wrong with this?" (report) comes before Next
    await expect(page.getByRole("button", { name: "Something wrong with this?" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#nextBtn")).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("#final")).toBeVisible();
  await expect(page.locator("#finalGrid")).toHaveAttribute("aria-label", /.+/);
});

test("arrow keys step away from 0 (no snap), nudges move 1/120 of the range, Home/End reach the bounds", async ({ page }) => {
  const r = questionRange(roundsFor(DAY)[0]!);
  const one = keyboardMove(r, 0, "ArrowRight")!;
  const minusOne = keyboardMove(r, 0, "ArrowLeft")!;
  await page.goto("/");
  await page.locator("#startBtn").click();
  await page.locator("#slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#slider")).toHaveValue(String(one));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#slider")).toHaveValue(String(minusOne));
  await page.getByRole("button", { name: "Nudge up" }).click();
  const nudged = nudge(r, minusOne, 1);
  await expect(page.locator("#slider")).toHaveValue(String(nudged));
  await expect(page.locator("#slider")).toHaveAttribute("aria-valuetext", multSpoken(nudged, epsilon(r)));
  await page.locator("#slider").focus(); // clicking the nudge button took focus
  // The browser re-serialises range values to ~15 digits, so compare numerically.
  const sliderValue = async () => Number(await page.locator("#slider").inputValue());
  await page.keyboard.press("End");
  await expect.poll(sliderValue).toBeCloseTo(r.hi, 10);
  await page.keyboard.press("Home");
  await expect.poll(sliderValue).toBeCloseTo(r.lo, 10);
});

test("slider touch target is at least 44 px tall", async ({ page }) => {
  await page.goto("/");
  await page.locator("#startBtn").click();
  const box = await page.locator("#slider").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("axe: no violations on any screen apart from known prototype contrast", async ({ page }) => {
  await page.goto("/");
  const screens: Record<string, Awaited<ReturnType<typeof axe>>> = {};
  screens.intro = await axe(page);
  await page.locator("#startBtn").click();
  screens.round = await axe(page);
  await playRound(page, DAY, 0, 0.3);
  screens.reveal = await axe(page);
  await next(page);
  for (let i = 1; i < 5; i++) {
    await playRound(page, DAY, i, 0.3);
    await next(page);
  }
  screens.final = await axe(page);

  for (const [name, r] of Object.entries(screens)) {
    expect(r.other.map((v) => `${v.id}: ${v.help}`), name).toEqual([]);
    const unexpected = r.contrast.filter((t) => !KNOWN_CONTRAST.test(t));
    expect(unexpected, `${name} unexpected contrast failures`).toEqual([]);
  }
});

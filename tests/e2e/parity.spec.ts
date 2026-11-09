/**
 * M1 acceptance: side-by-side screenshots of reference/prototype.html and the
 * app match at 390 px and 1280 px. Both run with the same frozen clock, locale,
 * time zone and slider inputs. Each step is compared with pixelmatch, and a
 * prototype | app | diff PNG is written to test-results/parity/ for review.
 *
 * The only masked area is the header's right-hand side, where the app adds the
 * menu button (not in the prototype). Its text is compared separately.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { setSlider, syd } from "./helpers";

const PROTO_URL = "file://" + path.resolve("reference/prototype.html");
const OUT = path.resolve("test-results/parity");
const NOW = syd("2026-11-10T09:00:00");
const GUESSES = [0.38, -0.5, 0.1, 1.2, 0];
/** Max share of differing pixels per screenshot. */
const MAX_DIFF_RATIO = 0.001; // currently 0 px differ; leaves room for AA noise only

const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "1280", width: 1280, height: 800 },
];

interface Rect { x: number; y: number; width: number; height: number }

async function open(browser: Browser, url: string, vp: { width: number; height: number }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, locale: "en-US", timezoneId: "Australia/Sydney" });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await page.goto(url);
  await page.locator("#startBtn").waitFor();
  return page;
}

async function headerRightBox(page: Page, selector: string): Promise<Rect> {
  const b = await page.locator(selector).boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

async function capture(page: Page): Promise<PNG> {
  await page.evaluate(() => document.fonts.ready);
  // Let the pins (set after two animation frames) start, then fast-forward all animations.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));
  const buf = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
  return PNG.sync.read(buf);
}

function fill(png: PNG, r: Rect, rgb: [number, number, number]) {
  for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(png.height, Math.ceil(r.y + r.height)); y++) {
    for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(png.width, Math.ceil(r.x + r.width)); x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
    }
  }
}

function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x: x - 2, y: y - 2, width: Math.max(a.x + a.width, b.x + b.width) - x + 4, height: Math.max(a.y + a.height, b.y + b.height) - y + 4 };
}

/** Pad to a common size with the page background so different heights still diff. */
function pad(png: PNG, w: number, h: number): PNG {
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h });
  fill(out, { x: 0, y: 0, width: w, height: h }, [0xf6, 0xf1, 0xe7]);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

function compare(name: string, proto: PNG, app: PNG, mask: Rect) {
  const w = Math.max(proto.width, app.width), h = Math.max(proto.height, app.height);
  const a = pad(proto, w, h), b = pad(app, w, h);
  fill(a, mask, [0xf6, 0xf1, 0xe7]);
  fill(b, mask, [0xf6, 0xf1, 0xe7]);
  const diff = new PNG({ width: w, height: h });
  const n = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });

  const gap = 16;
  const side = new PNG({ width: w * 3 + gap * 2, height: h });
  fill(side, { x: 0, y: 0, width: side.width, height: h }, [255, 255, 255]);
  PNG.bitblt(a, side, 0, 0, w, h, 0, 0);
  PNG.bitblt(b, side, 0, 0, w, h, w + gap, 0);
  PNG.bitblt(diff, side, 0, 0, w, h, 2 * (w + gap), 0);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, `${name}.png`), PNG.sync.write(side));

  const ratio = n / (w * h);
  return { name, diffPixels: n, ratio, sizeMatch: proto.width === app.width && proto.height === app.height, protoSize: `${proto.width}×${proto.height}`, appSize: `${app.width}×${app.height}` };
}

for (const vp of VIEWPORTS) {
  test(`app matches the prototype at ${vp.name} px`, async ({ browser, baseURL }) => {
    test.setTimeout(90_000);
    const proto = await open(browser, PROTO_URL, vp);
    const app = await open(browser, baseURL!, vp);
    const results: ReturnType<typeof compare>[] = [];

    const step = async (label: string) => {
      const mask = union(await headerRightBox(proto, ".meta"), await headerRightBox(app, ".head-right"));
      results.push(compare(`${vp.name}-${label}`, await capture(proto), await capture(app), mask));
      // Header meta text is masked in pixels, so compare it as text.
      // (The app's meta has a screen-reader-only "Puzzle " prefix, so drop .sr-only text.)
      const appMeta = await app.locator("#meta").evaluate((el) => {
        const c = el.cloneNode(true) as HTMLElement;
        c.querySelectorAll(".sr-only").forEach((n) => n.remove());
        return c.innerHTML.replace(/<br\s*\/?>/g, "\n").replace(/<[^>]+>/g, "");
      });
      const protoMeta = await proto.locator("#meta").evaluate((el) => el.innerHTML.replace(/<br\s*\/?>/g, "\n"));
      expect(appMeta).toBe(protoMeta);
    };
    const both = async (fn: (p: Page) => Promise<void>) => {
      await fn(proto);
      await fn(app);
    };

    await step("1-intro");
    await both((p) => p.locator("#startBtn").click());
    await step("2-round-slider-0");
    await both((p) => setSlider(p, GUESSES[0]!));
    await step("3-round-slider-0.38");
    await both((p) => p.locator("#lockBtn").click());
    await step("4-reveal");
    for (let i = 1; i < 5; i++) {
      await both((p) => p.locator("#nextBtn").click());
      await both((p) => setSlider(p, GUESSES[i]!));
      if (i === 3) await step("5-round4-slider-1.2");
      await both((p) => p.locator("#lockBtn").click());
      if (i === 4) await step("6-reveal-last");
    }
    await both((p) => p.locator("#nextBtn").click());
    await step("7-final");

    console.table(results.map((r) => ({ ...r, ratio: (r.ratio * 100).toFixed(3) + "%" })));
    for (const r of results) {
      expect.soft(r.sizeMatch, `${r.name}: page size ${r.appSize} vs prototype ${r.protoSize}`).toBe(true);
      expect.soft(r.ratio, `${r.name}: ${r.diffPixels} differing pixels`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
    }
  });
}

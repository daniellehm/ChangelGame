import { describe, expect, it } from "vitest";
import { stickerFor } from "@/lib/sticker";
import { POOL } from "@/lib/fixtures/prototype-pool";

describe("stickerFor", () => {
  it("is stable per category and ignores case/whitespace", () => {
    expect(stickerFor("Money")).toEqual(stickerFor(" money "));
  });
  it("uses only token colours and small tilts", () => {
    for (const q of POOL) {
      const s = stickerFor(q.cat);
      expect(s.color).toMatch(/^var\(--[a-z-]+\)$/);
      expect(Math.abs(s.tiltDeg)).toBeLessThanOrEqual(3);
      expect(s.tiltDeg).not.toBe(0);
    }
  });
  it("varies across the pool's categories", () => {
    const colours = new Set(POOL.map((q) => stickerFor(q.cat).color));
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });
});

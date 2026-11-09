import { describe, expect, it } from "vitest";
import { stickerFor } from "@/lib/sticker";
import { seedRows } from "../helpers/seed";

describe("stickerFor", () => {
  it("is stable per category and ignores case/whitespace", () => {
    expect(stickerFor("Money")).toEqual(stickerFor(" money "));
  });
  it("uses only token colours and small tilts", () => {
    for (const q of seedRows) {
      const s = stickerFor(q.category);
      expect(s.color).toMatch(/^var\(--[a-z-]+\)$/);
      expect(Math.abs(s.tiltDeg)).toBeLessThanOrEqual(3);
      expect(s.tiltDeg).not.toBe(0);
    }
  });
  it("varies across the pool's categories", () => {
    const colours = new Set(seedRows.map((q) => stickerFor(q.category).color));
    expect(colours.size).toBeGreaterThanOrEqual(3);
  });
});

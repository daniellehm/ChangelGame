import { describe, expect, it } from "vitest";
import { standing, standingText, withYou, type ScoreDistribution } from "@/lib/game/standing";

/** 100 players scoring 0, 5, 10, … 495. */
const spread: ScoreDistribution = { n: 100, counts: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i * 5), 1])) };
const text = (t: number, d: ScoreDistribution) => standingText(standing(t, d));

describe("standing sticker", () => {
  it("top half: Top X% = share who scored higher (the best is Top 1%), with a band", () => {
    expect(standing(495, spread)).toEqual({ kind: "top", pct: 1, band: "crown" });
    expect(standing(450, spread)).toEqual({ kind: "top", pct: 9, band: "rocket" });
    expect(standing(400, spread)).toEqual({ kind: "top", pct: 19, band: "star" });
    expect(standing(260, spread)).toEqual({ kind: "top", pct: 47, band: "thumbs" });
    expect(text(425, spread)).toBe("Top 14% today");
  });

  it("bottom half: Beat Y% of players instead (never a put-down)", () => {
    expect(standing(100, spread)).toEqual({ kind: "better", pct: 20, band: "flex" });
    expect(text(0, spread)).toBe("Beat 0% of players today"); // the sticker hides this case (StandingSticker)
  });

  it("works from the very first game, and counts you even if the cached data hasn't caught up", () => {
    expect(text(300, { n: 0, counts: {} })).toBe("Top 1% today"); // the only player so far
    expect(withYou(320, { n: 3, counts: { "100": 1, "200": 1, "400": 1 } })).toEqual({ n: 4, counts: { "100": 1, "200": 1, "400": 1, "320": 1 } });
    expect(text(320, { n: 3, counts: { "100": 1, "200": 1, "400": 1 } })).toBe("Top 25% today"); // 1 of 4 higher
    expect(withYou(300, { n: 2, counts: { "300": 2 } })).toEqual({ n: 2, counts: { "300": 2 } }); // already counted
  });

  it("ties count as neither above nor below", () => {
    expect(standing(300, { n: 40, counts: { "300": 40 } })).toMatchObject({ kind: "top", pct: 1 });
  });

  it("never mentions how many people played", () => {
    for (const t of [0, 100, 260, 450, 495]) expect(text(t, spread)).not.toMatch(/100|players so far/);
  });
});

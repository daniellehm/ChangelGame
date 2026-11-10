import { describe, expect, it } from "vitest";
import { scoreBars, standing, standingText, type ScoreDistribution } from "@/lib/game/standing";

/** 100 players scoring 0, 5, 10, … 495. */
const spread: ScoreDistribution = { n: 100, counts: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i * 5), 1])) };

describe("standing", () => {
  it("waits for 20 finished games", () => {
    expect(standing(300, { n: 19, counts: { "300": 19 } })).toEqual({ kind: "early", n: 19 });
    expect(standingText(standing(300, null))).toBe("Too early to compare: 0 players so far today.");
    expect(standingText({ kind: "early", n: 1 })).toBe("Too early to compare: 1 player so far today.");
  });

  it("top half: Top X% (the best score is Top 1%)", () => {
    expect(standingText(standing(495, spread))).toBe("Top 1% today");
    expect(standingText(standing(425, spread))).toBe("Top 15% today"); // 14 scored higher
    expect(standingText(standing(250, spread))).toBe("Top 50% today");
  });

  it("bottom half: better than Y% instead", () => {
    expect(standingText(standing(100, spread))).toBe("Better than 20% of players today");
    expect(standingText(standing(0, spread))).toBe("Better than 0% of players today");
  });

  it("ties count as neither above nor below", () => {
    expect(standing(300, { n: 40, counts: { "300": 40 } })).toEqual({ kind: "top", pct: 3, n: 40 });
  });

  it("bars: 20 buckets of 25 points, 500 in the last, with yours marked", () => {
    const b = scoreBars(425, spread);
    expect(b.counts).toHaveLength(20);
    expect(b.counts.reduce((a, c) => a + c, 0)).toBe(100);
    expect(b.mine).toBe(17);
    expect(scoreBars(500, { n: 1, counts: { "500": 1 } }).counts[19]).toBe(1);
  });
});

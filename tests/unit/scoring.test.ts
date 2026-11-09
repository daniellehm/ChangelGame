import { describe, expect, it } from "vitest";
import {
  actualLog,
  clampGuess,
  finalTitle,
  isWrongWay,
  scoreRound,
  tierFor,
  TIERS,
  totalOf,
} from "@/lib/scoring";
import { FULL_RANGE as F, rangeFromFactor } from "@/lib/range";

describe("scoreRound: points depend on distance as a share of the slider", () => {
  it("scores an exact hit as 100 / Nailed it", () => {
    const a = actualLog(4.07e9, 8.2e9);
    expect(scoreRound(a, a, F)).toEqual({ points: 100, wrongWay: false, tier: "nailed" });
  });

  it("scores exactly no change guessed as no change as 100", () => {
    expect(scoreRound(0, 0, F)).toEqual({ points: 100, wrongWay: false, tier: "nailed" });
  });

  it("loses 1 point per 1/300 of the slider: a third of the slider away is 0", () => {
    const r = rangeFromFactor(8);
    const w = r.hi - r.lo;
    const a = Math.log10(3.8);
    expect(scoreRound(a + w / 6, a, r).points).toBe(50);
    expect(scoreRound(a - w / 6, a, r).points).toBe(50);
    expect(scoreRound(a - w / 3, a, r).points).toBe(0);
    expect(scoreRound(a + w / 30, a, r).points).toBe(90);
  });

  it("the same slider distance scores the same on every range", () => {
    for (const frac of [0.01, 0.05, 0.1, 0.2, 0.3]) {
      const pts = [1.05, 1.5, 8, 100, 1000].map((k) => {
        const r = rangeFromFactor(k);
        const a = r.hi * 0.4;
        return scoreRound(a - frac * (r.hi - r.lo), a, r).points;
      });
      expect(new Set(pts).size, `frac ${frac}: ${pts}`).toBe(1);
    }
  });

  it("never goes negative", () => {
    expect(scoreRound(3, 0.5, F).points).toBe(0);
    expect(scoreRound(-3, 0.001, F).points).toBe(0);
  });

  it("marks the wrong direction as 0 / Wrong way", () => {
    expect(scoreRound(0.1, -0.1, F)).toEqual({ points: 0, wrongWay: true, tier: "wrong" });
    expect(scoreRound(-0.5, 0.02, F)).toEqual({ points: 0, wrongWay: true, tier: "wrong" });
  });

  it("is not wrong-way when either side is within ε (no-change threshold)", () => {
    // guess within ε, actual negative
    expect(isWrongWay(0.004, -0.5, F)).toBe(false);
    expect(scoreRound(0.003, -0.05, F).wrongWay).toBe(false);
    // actual within ε, guess opposite sign
    expect(isWrongWay(-0.2, 0.004, F)).toBe(false);
    expect(scoreRound(-0.2, 0.0035, F).wrongWay).toBe(false);
    // just beyond ε on both sides → wrong way
    expect(isWrongWay(0.0041, -0.0041, F)).toBe(true);
  });

  it("clamps guesses to the range before scoring", () => {
    expect(clampGuess(7, F)).toBe(3);
    expect(clampGuess(-9, F)).toBe(-3);
    expect(scoreRound(10, 2.5, F)).toEqual(scoreRound(3, 2.5, F));
    expect(scoreRound(-10, -2.5, F).points).toBe(scoreRound(-3, -2.5, F).points);
    expect(() => clampGuess(Number.NaN, F)).toThrow(RangeError);
    expect(() => clampGuess(Infinity, F)).toThrow(RangeError);
  });

  it("rejects non-positive values for the actual change", () => {
    expect(() => actualLog(0, 5)).toThrow(RangeError);
    expect(() => actualLog(5, -1)).toThrow(RangeError);
  });
});

describe("tiers", () => {
  it.each([
    [100, "nailed"], [90, "nailed"], [89, "close"], [65, "close"], [64, "meh"],
    [30, "meh"], [29, "off"], [0, "off"],
  ] as const)("%i points → %s", (pts, tier) => {
    expect(tierFor(pts, false)).toBe(tier);
  });

  it("wrong way overrides points", () => expect(tierFor(95, true)).toBe("wrong"));

  it("has the spec's emoji and labels", () => {
    expect(TIERS.nailed).toMatchObject({ emoji: "🟩", label: "Nailed it" });
    expect(TIERS.close).toMatchObject({ emoji: "🟨", label: "Close" });
    expect(TIERS.meh).toMatchObject({ emoji: "🟧", label: "Meh" });
    expect(TIERS.off).toMatchObject({ emoji: "🟥", label: "Way off" });
    expect(TIERS.wrong).toMatchObject({ emoji: "🟥", label: "Wrong way!" });
  });
});

describe("final titles", () => {
  it.each([
    [500, "Time traveller 🔮"], [420, "Time traveller 🔮"], [419, "History buff"],
    [320, "History buff"], [319, "Not bad, not great"], [200, "Not bad, not great"],
    [199, "Living in the past"], [100, "Living in the past"],
    [99, "Have you been asleep since 1970?"], [0, "Have you been asleep since 1970?"],
  ] as const)("%i → %s", (total, title) => {
    expect(finalTitle(total)).toBe(title);
  });

  it("totals points", () => expect(totalOf([100, 60, 0, 45, 90])).toBe(295));
});

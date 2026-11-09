import { describe, expect, it } from "vitest";
import { RANGE } from "@/lib/config";
import {
  epsilon,
  FULL_RANGE,
  multiplierLabel,
  rangeFromBounds,
  rangeProblems,
  sliderSteps,
  ticks,
  tolerance,
  width,
  type GuessRange,
} from "@/lib/range";
import { scoreRound } from "@/lib/scoring";
import { keyboardMove } from "@/lib/slider";
import { seedRows } from "../helpers/seed";

/** Deterministic PRNG so the property tests are reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

/** A random VALID question: width in [MIN, MAX], 0 inside, answer ≥ 10% in from both ends. */
function randomQuestion(rand: () => number): { r: GuessRange; a: number } {
  const w = RANGE.MIN_WIDTH + rand() * (RANGE.MAX_WIDTH - RANGE.MIN_WIDTH);
  const zeroAt = 0.01 + rand() * 0.98; // where "no change" sits
  const r = { lo: -zeroAt * w, hi: (1 - zeroAt) * w };
  const a = r.lo + (RANGE.EDGE_MARGIN + rand() * (1 - 2 * RANGE.EDGE_MARGIN)) * w;
  return { r, a };
}

const N = 3000;

describe("range basics", () => {
  it("builds a range from real-unit bounds", () => {
    const r = rangeFromBounds(51, 40, 300);
    expect(r.lo).toBeCloseTo(Math.log10(40 / 51), 12);
    expect(r.hi).toBeCloseTo(Math.log10(300 / 51), 12);
  });

  it("the full range is the prototype: tolerance 0.75, ε 0.004, steps 0.005 / 0.05 / 0.1 / 0.01", () => {
    expect(width(FULL_RANGE)).toBe(6);
    expect(tolerance(FULL_RANGE)).toBeCloseTo(0.75, 12);
    expect(epsilon(FULL_RANGE)).toBeCloseTo(0.004, 12);
    const s = sliderSteps(FULL_RANGE);
    expect([s.step, s.nudge, s.page, s.snap].map((v) => Number(v.toFixed(9)))).toEqual([0.005, 0.05, 0.1, 0.01]);
  });

  it("tolerance grows with width, but slower than the slider (never over a third of it)", () => {
    let prev = 0;
    let prevFrac = Infinity;
    for (let w = RANGE.MIN_WIDTH; w <= RANGE.MAX_WIDTH; w += 0.01) {
      const t = tolerance({ lo: -w / 2, hi: w / 2 });
      expect(t).toBeGreaterThan(prev);
      expect(t / w).toBeLessThanOrEqual(1 / 3 + 1e-12);
      expect(t / w).toBeLessThanOrEqual(prevFrac + 1e-12);
      prev = t;
      prevFrac = t / w;
    }
  });
});

describe("scoring holds for any valid question (property tests)", () => {
  it("exact answer scores 100; the far end of the slider always scores 0; an end never scores over 70", () => {
    const rand = rng(1);
    for (let i = 0; i < N; i++) {
      const { r, a } = randomQuestion(rand);
      expect(scoreRound(a, a, r).points).toBe(100);
      const far = a - r.lo > r.hi - a ? r.lo : r.hi;
      expect(scoreRound(far, a, r).points, JSON.stringify({ r, a })).toBe(0);
      expect(scoreRound(r.lo, a, r).points).toBeLessThanOrEqual(70);
      expect(scoreRound(r.hi, a, r).points).toBeLessThanOrEqual(70);
    }
  });

  it("points never increase as the guess moves away from the answer, and stay whole numbers in 0–100", () => {
    const rand = rng(2);
    for (let i = 0; i < 300; i++) {
      const { r, a } = randomQuestion(rand);
      const w = width(r);
      for (const dir of [1, -1]) {
        let prev = 101;
        for (let k = 0; k <= 200; k++) {
          const g = a + dir * (k / 200) * w;
          if (g < r.lo || g > r.hi) break;
          const p = scoreRound(g, a, r).points;
          expect(Number.isInteger(p) && p >= 0 && p <= 100).toBe(true);
          expect(p).toBeLessThanOrEqual(prev);
          prev = p;
        }
      }
    }
  });

  it("guessing the wrong direction is 0 on every range", () => {
    const rand = rng(3);
    for (let i = 0; i < N; i++) {
      const { r, a } = randomQuestion(rand);
      if (Math.abs(a) <= epsilon(r) * 1.01) continue;
      const wrong = a > 0 ? r.lo : r.hi;
      if (Math.abs(wrong) <= epsilon(r)) continue;
      expect(scoreRound(wrong, a, r)).toEqual({ points: 0, wrongWay: true, tier: "wrong" });
    }
  });

  it("guesses outside the range score as the nearest end (the server clamps)", () => {
    const rand = rng(4);
    for (let i = 0; i < 200; i++) {
      const { r, a } = randomQuestion(rand);
      expect(scoreRound(r.hi + 5, a, r)).toEqual(scoreRound(r.hi, a, r));
      expect(scoreRound(r.lo - 5, a, r)).toEqual(scoreRound(r.lo, a, r));
    }
  });

  it("the slider can reach exactly 0 and both ends on every range", () => {
    const rand = rng(5);
    for (let i = 0; i < 200; i++) {
      const { r } = randomQuestion(rand);
      expect(keyboardMove(r, keyboardMove(r, 0, "ArrowRight")!, "ArrowLeft")).toBe(0);
      expect(keyboardMove(r, 0, "Home")).toBe(r.lo);
      expect(keyboardMove(r, 0, "End")).toBe(r.hi);
    }
  });
});

describe("the UN example (51 members in 1945 → 193 in 2011, bounds 40…300)", () => {
  const r = rangeFromBounds(51, 40, 300);
  const a = Math.log10(193 / 51);
  it("×10 isn't on the slider; the top (×5.9) only scores Meh", () => {
    expect(r.hi).toBeLessThan(1);
    expect(scoreRound(1, a, r)).toEqual(scoreRound(r.hi, a, r));
    expect(scoreRound(r.hi, a, r).points).toBeLessThan(40);
  });
  it("is stricter than the old full range for a sensible miss (×3 instead of ×3.8)", () => {
    const g = Math.log10(3);
    expect(scoreRound(g, a, r).points).toBeLessThan(scoreRound(g, a, FULL_RANGE).points);
    expect(scoreRound(g, a, r).points).toBeGreaterThan(60);
  });
});

describe("rangeProblems (importer + DB rules)", () => {
  it("accepts every seed question", () => {
    for (const q of seedRows) expect(rangeProblems(q.start_value, q.end_value, q.min_end_value, q.max_end_value), q.slug).toEqual([]);
  });
  it.each([
    ["missing bounds", 100, 250, null, 1000, /needs/],
    ["no change outside the range", 100, 250, 120, 1000, /no change/],
    ["max below min", 100, 250, 1000, 50, /above/],
    ["non-positive bound", 100, 250, 0, 1000, /> 0/],
    ["answer hard against the top", 100, 250, 50, 260, /10% in/],
    ["answer hard against the bottom", 100, 52, 50, 1000, /10% in/],
    ["answer outside the range", 100, 2000, 50, 1000, /10% in/],
    ["narrower than ×1.0965", 100, 100.5, 99, 101, /too narrow/],
    ["wider than ÷1000…×1000", 100, 250, 0.01, 1e6, /too wide/],
  ] as const)("rejects %s", (_label, start, end, min, max, msg) => {
    const p = rangeProblems(start, end, min, max);
    expect(p.length).toBeGreaterThan(0);
    expect(p.join(" ")).toMatch(msg);
  });
});

describe("tick marks", () => {
  it("the full range shows the classic five", () => {
    expect(ticks(FULL_RANGE).map((t) => t.label)).toEqual(["÷1,000", "÷10", "same", "×10", "×1,000"]);
  });
  it("always has both ends, in order, inside the range, and never overlapping on a small phone", () => {
    const rand = rng(6);
    for (let i = 0; i < N; i++) {
      const { r } = randomQuestion(rand);
      const t = ticks(r);
      expect(t[0]!.at).toBe(0);
      expect(t.at(-1)!.at).toBe(100);
      for (let k = 1; k < t.length; k++) {
        expect(t[k]!.at).toBeGreaterThan(t[k - 1]!.at);
        // Same layout model as ticks(): 250 px row, 6.6 px glyphs; ends are edge-aligned.
        const px = (pct: number) => (pct / 100) * 250;
        const right = (x: (typeof t)[number], j: number) => (j === 0 ? x.label.length * 6.6 : j === t.length - 1 ? 250 : px(x.at) + (x.label.length * 6.6) / 2);
        const left = (x: (typeof t)[number], j: number) => (j === 0 ? 0 : j === t.length - 1 ? 250 - x.label.length * 6.6 : px(x.at) - (x.label.length * 6.6) / 2);
        expect(left(t[k]!, k), JSON.stringify(r)).toBeGreaterThanOrEqual(right(t[k - 1]!, k - 1));
      }
      for (const m of t) expect(m.l >= r.lo - 1e-12 && m.l <= r.hi + 1e-12).toBe(true);
    }
  });
  it("labels ends at 2 significant figures", () => {
    expect(multiplierLabel(Math.log10(5.88))).toBe("×5.9");
    expect(multiplierLabel(Math.log10(955))).toBe("×960");
    expect(multiplierLabel(-Math.log10(1.275))).toBe("÷1.3");
    expect(multiplierLabel(Math.log10(1.056))).toBe("×1.06");
    expect(multiplierLabel(3)).toBe("×1,000");
  });
});

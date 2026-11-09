import { describe, expect, it } from "vitest";
import { RANGE } from "@/lib/config";
import {
  epsilon,
  FULL_RANGE,
  multiplierLabel,
  rangeFromFactor,
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

/** A random VALID question: max_change in [1.05, 1000], answer at most 85% of the way out, either direction. */
function randomQuestion(rand: () => number): { r: GuessRange; a: number } {
  const K = Math.log10(RANGE.MIN_FACTOR) + rand() * (Math.log10(RANGE.MAX_FACTOR) - Math.log10(RANGE.MIN_FACTOR));
  const r = rangeFromFactor(10 ** K);
  const a = (rand() * 2 - 1) * RANGE.MAX_ANSWER_FRACTION * r.hi;
  return { r, a };
}

const N = 3000;

describe("range basics", () => {
  it("max_change k gives ÷k … ×k, always centred on no change", () => {
    const r = rangeFromFactor(8);
    expect(r.hi).toBeCloseTo(Math.log10(8), 12);
    expect(r.lo).toBe(-r.hi);
    expect(rangeFromFactor(1000)).toEqual(FULL_RANGE);
  });

  it("the full range keeps the prototype's ε 0.004 and steps 0.005 / 0.05 / 0.1 / 0.01", () => {
    expect(width(FULL_RANGE)).toBe(6);
    expect(tolerance(FULL_RANGE)).toBeCloseTo(2, 12); // a third of the slider
    expect(epsilon(FULL_RANGE)).toBeCloseTo(0.004, 12);
    const s = sliderSteps(FULL_RANGE);
    expect([s.step, s.nudge, s.page, s.snap].map((v) => Number(v.toFixed(9)))).toEqual([0.005, 0.05, 0.1, 0.01]);
  });

  it("tolerance is always a third of the slider", () => {
    for (const k of [1.05, 1.1, 2, 8, 30, 1000]) {
      const r = rangeFromFactor(k);
      expect(tolerance(r) / width(r)).toBeCloseTo(1 / 3, 12);
    }
  });
});

describe("scoring holds for any valid question (property tests)", () => {
  it("exact answer scores 100; the far end of the slider always scores 0; an end never scores over 78", () => {
    const rand = rng(1);
    for (let i = 0; i < N; i++) {
      const { r, a } = randomQuestion(rand);
      expect(scoreRound(a, a, r).points).toBe(100);
      const far = a - r.lo > r.hi - a ? r.lo : r.hi;
      expect(scoreRound(far, a, r).points, JSON.stringify({ r, a })).toBe(0);
      expect(scoreRound(r.lo, a, r).points).toBeLessThanOrEqual(78);
      expect(scoreRound(r.hi, a, r).points).toBeLessThanOrEqual(78);
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

  it("the slider can reach exactly 0 and both ends on every range, and 'same' is always the middle", () => {
    const rand = rng(5);
    for (let i = 0; i < 200; i++) {
      const { r } = randomQuestion(rand);
      expect(keyboardMove(r, keyboardMove(r, 0, "ArrowRight")!, "ArrowLeft")).toBe(0);
      expect(keyboardMove(r, 0, "Home")).toBe(r.lo);
      expect(keyboardMove(r, 0, "End")).toBe(r.hi);
      expect(ticks(r).find((t) => t.label === "same")?.at).toBe(50);
    }
  });
});

describe("the UN example (51 members in 1945 → 193 in 2011, max_change 8)", () => {
  const r = rangeFromFactor(8);
  const a = Math.log10(193 / 51);
  it("×10 isn't on the slider; the top (×8) scores under half", () => {
    expect(r.hi).toBeLessThan(1);
    expect(scoreRound(1, a, r)).toEqual(scoreRound(r.hi, a, r));
    expect(scoreRound(r.hi, a, r).points).toBeLessThan(50);
  });
  it("a sensible miss (×3 instead of ×3.8) still scores well; ×2 about half", () => {
    expect(scoreRound(Math.log10(3), a, r).points).toBe(83);
    expect(scoreRound(Math.log10(2), a, r).points).toBe(54);
  });
});

describe("rangeProblems (importer + DB rules)", () => {
  it("accepts every seed question", () => {
    for (const q of seedRows) expect(rangeProblems(q.start_value, q.end_value, q.max_change), q.slug).toEqual([]);
  });
  it("accepts the limits exactly", () => {
    expect(rangeProblems(100, 100, 1.05)).toEqual([]);
    expect(rangeProblems(100, 100 * 1000 ** 0.85, 1000)).toEqual([]);
  });
  it.each([
    ["missing max_change", 100, 250, null, /needs/],
    ["max_change below 1.05", 100, 100.5, 1.01, /too small/],
    ["max_change above 1000", 100, 250, 5000, /too big/],
    ["answer too close to the top", 100, 250, 2.6, /85% of the way.*at least 2.94/],
    ["answer too close to the bottom", 100, 40, 2.6, /85% of the way/],
    ["answer off the slider", 100, 2000, 10, /85% of the way/],
  ] as const)("rejects %s", (_label, start, end, k, msg) => {
    const p = rangeProblems(start, end, k);
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

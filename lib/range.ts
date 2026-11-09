/**
 * Per-question guess ranges and relative scoring (DECISIONS 2026-11-09).
 *
 * Every question has a `max_change` k (e.g. UN members: 8). The slider runs
 * ÷k … ×k, i.e. log10 −K … +K with K = log10 k: always symmetric around
 * "no change", so the slider's shape never reveals the direction.
 *
 * Scoring depends only on how far the guess is from the answer AS A SHARE OF
 * THE SLIDER (width W = 2K):
 *
 *   points = 100 × (1 − distance / (W / 3))
 *
 * so a guess a third of the slider away scores 0, on every question alike.
 *  - The far end is always ≥ ½W from the answer, so it ALWAYS scores 0.
 *  - The answer is at most 85% of the way out, so slamming the slider to an
 *    end never scores more than 78.
 */
import { RANGE, SCORING } from "./config";

export interface GuessRange {
  /** log10 multiplier at the slider's left end (= −hi). */
  lo: number;
  /** log10 multiplier at the slider's right end. */
  hi: number;
}

export const FULL_RANGE: GuessRange = RANGE.FULL;

export const width = (r: GuessRange) => r.hi - r.lo;

/** A question's guess range (÷max_change … ×max_change). Questions without one get the full ÷1000…×1000. */
export function questionRange(q: { max_change?: number | null }): GuessRange {
  return q.max_change != null ? rangeFromFactor(q.max_change) : FULL_RANGE;
}

/** Range for a question's max_change k: ÷k … ×k. */
export function rangeFromFactor(k: number): GuessRange {
  const K = Math.log10(k);
  return { lo: -K, hi: K };
}

/**
 * "No change" threshold for the wrong-way rule and the ×1 readout. Scales with
 * the width so a narrow range (a sprint record) isn't mostly dead zone;
 * 0.004 at full width, as the prototype.
 */
export function epsilon(r: GuessRange): number {
  return SCORING.EPSILON * (width(r) / (RANGE.FULL.hi - RANGE.FULL.lo));
}

/** Scoring tolerance: the log error at which a round scores 0 (a fixed share of the slider). */
export function tolerance(r: GuessRange): number {
  return width(r) * RANGE.TOLERANCE_FRACTION;
}

/**
 * Problems with a question's max_change (empty = valid). Shared by the importer,
 * the M5 pipeline's checks and the tests, so every question obeys the same rules.
 * The DB constraint questions_max_change_sane mirrors this.
 */
export function rangeProblems(start: number, end: number, maxChange: number | null | undefined): string[] {
  if (maxChange == null || !Number.isFinite(maxChange)) return ["needs max_change (the slider runs ÷max_change … ×max_change)"];
  const out: string[] = [];
  if (maxChange < RANGE.MIN_FACTOR - 1e-12) out.push(`max_change too small (minimum ${RANGE.MIN_FACTOR})`);
  if (maxChange > RANGE.MAX_FACTOR + 1e-9) out.push(`max_change too big (maximum ${RANGE.MAX_FACTOR})`);
  if (out.length) return out;
  const a = Math.abs(Math.log10(end / start));
  const K = Math.log10(maxChange);
  if (a > RANGE.MAX_ANSWER_FRACTION * K + 1e-12) {
    const need = 10 ** (a / RANGE.MAX_ANSWER_FRACTION);
    out.push(`the real answer must be at most ${RANGE.MAX_ANSWER_FRACTION * 100}% of the way from "same" to the end (max_change at least ${Number(need.toPrecision(3))})`);
  }
  return out;
}

export interface SliderSteps {
  step: number;
  nudge: number;
  page: number;
  snap: number;
}

export function sliderSteps(r: GuessRange): SliderSteps {
  const w = width(r);
  return { step: w * RANGE.STEP_FRACTION, nudge: w * RANGE.NUDGE_FRACTION, page: w * RANGE.PAGE_FRACTION, snap: w * RANGE.SNAP_FRACTION };
}

export const clampTo = (r: GuessRange, v: number) => Math.min(r.hi, Math.max(r.lo, v));

/** Position of log value `l` along the slider, 0–100 %. */
export function toPercent(r: GuessRange, l: number): number {
  return ((clampTo(r, l) - r.lo) / width(r)) * 100;
}

/** Short multiplier label for ticks, 2 significant figures: "×8", "÷1.5", "×960", "×1.04", "×1,000". */
export function multiplierLabel(l: number): string {
  const x = 10 ** Math.abs(l);
  const n = x >= 1.1 ? Number(x.toPrecision(2)).toLocaleString("en-US") : x.toFixed(2);
  return (l >= 0 ? "×" : "÷") + n;
}

export interface Tick {
  /** log10 multiplier. */
  l: number;
  /** 0–100 % along the slider. */
  at: number;
  label: string;
}

const NICE = [1000, 100, 10, 5, 2];
/** Layout assumptions for spacing labels: the narrowest tick row (small phone) and 11px mono glyphs. */
const TRACK_PX = 250;
const CHAR_PX = 6.6;
const PAD_PX = 8;
const px = (pct: number) => (pct / 100) * TRACK_PX;

/**
 * Ends (always), "same" (unless it's crowded against an end; the track's colour
 * split still marks it), and up to two round multipliers per side that fit.
 */
export function ticks(r: GuessRange): Tick[] {
  const ends: Tick[] = [
    { l: r.lo, at: 0, label: multiplierLabel(r.lo) },
    { l: r.hi, at: 100, label: multiplierLabel(r.hi) },
  ];
  const inner: Tick[] = [];
  // End labels are edge-aligned (they grow inwards); inner labels are centred on their mark.
  const fits = (at: number, label: string) => {
    const half = (label.length * CHAR_PX) / 2;
    return (
      px(at) - half >= ends[0]!.label.length * CHAR_PX + PAD_PX &&
      px(100 - at) - half >= ends[1]!.label.length * CHAR_PX + PAD_PX &&
      inner.every((t) => Math.abs(px(t.at - at)) >= half + (t.label.length * CHAR_PX) / 2 + PAD_PX)
    );
  };
  const zeroAt = toPercent(r, 0);
  if (fits(zeroAt, "same")) inner.push({ l: 0, at: zeroAt, label: "same" });
  for (const side of [1, -1] as const) {
    let added = 0;
    for (const n of NICE) {
      const l = side * Math.log10(n);
      if (l <= r.lo || l >= r.hi || added >= 2) continue;
      const at = toPercent(r, l);
      const label = (side > 0 ? "×" : "÷") + n.toLocaleString("en-US");
      if (fits(at, label)) {
        inner.push({ l, at, label });
        added++;
      }
    }
  }
  return [ends[0]!, ...inner.sort((a, b) => a.at - b.at), ends[1]!];
}

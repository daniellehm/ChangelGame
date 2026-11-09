/**
 * Per-question guess ranges (DECISIONS 2026-11-09).
 *
 * Every question carries plausible bounds for its END value (real units, e.g.
 * UN members: 34 … 408). The slider spans log10(min/start) … log10(max/start),
 * and scoring tolerance scales with that width:
 *
 *   tolerance = min( SPAN · √(W / 6),  W / 3 )
 *
 *  - W = 6 (÷1000 … ×1000) gives SPAN = 0.75: identical to the prototype.
 *  - Wider plausible ranges forgive more, but less than proportionally.
 *  - Never more than a third of the slider, and the answer is always ≥ 10% in
 *    from both ends, so the far end of the slider from the answer is ≥ ½W away
 *    and ALWAYS scores 0 — on any valid question.
 */
import { RANGE, SCORING } from "./config";

export interface GuessRange {
  /** log10 multiplier at the slider's left end (≤ 0). */
  lo: number;
  /** log10 multiplier at the slider's right end (≥ 0). */
  hi: number;
}

export const FULL_RANGE: GuessRange = RANGE.FULL;

export const width = (r: GuessRange) => r.hi - r.lo;

/** Range from a question's start value and plausible end-value bounds. */
export function rangeFromBounds(start: number, minEnd: number, maxEnd: number): GuessRange {
  return { lo: Math.log10(minEnd / start), hi: Math.log10(maxEnd / start) };
}

/**
 * "No change" threshold for the wrong-way rule and the ×1 readout. Scales with
 * the width so a narrow range (a sprint record) isn't mostly dead zone;
 * 0.004 at full width, as the prototype.
 */
export function epsilon(r: GuessRange): number {
  return SCORING.EPSILON * (width(r) / (RANGE.FULL.hi - RANGE.FULL.lo));
}

/** Scoring tolerance: the log error at which a round scores 0. */
export function tolerance(r: GuessRange): number {
  const w = width(r);
  return Math.min(SCORING.SPAN * Math.sqrt(w / (RANGE.FULL.hi - RANGE.FULL.lo)), w * RANGE.MAX_TOLERANCE_FRACTION);
}

/**
 * Problems with a question's bounds (empty = valid). Shared by the importer,
 * the M5 pipeline's checks and the tests, so every question obeys the same rules.
 */
export function rangeProblems(start: number, end: number, minEnd: number | null | undefined, maxEnd: number | null | undefined): string[] {
  if (minEnd == null || maxEnd == null) return ["needs min_end_value and max_end_value"];
  if (!(minEnd > 0) || !(maxEnd > 0)) return ["bounds must be > 0"];
  if (!(maxEnd > minEnd)) return ["max_end_value must be above min_end_value"];
  const r = rangeFromBounds(start, minEnd, maxEnd);
  const w = width(r);
  const a = Math.log10(end / start);
  const out: string[] = [];
  if (!(r.lo < 0 && r.hi > 0)) out.push("range must include 'no change' (min below the start value, max above it)");
  if (w < RANGE.MIN_WIDTH - 1e-9) out.push(`range too narrow (×${(10 ** w).toFixed(3)} end to end; minimum ×${(10 ** RANGE.MIN_WIDTH).toFixed(2)})`);
  if (w > RANGE.MAX_WIDTH + 1e-9) out.push("range too wide (more than ×1,000,000 end to end, the width of ÷1000 … ×1000)");
  const m = RANGE.EDGE_MARGIN * w;
  if (a < r.lo + m || a > r.hi - m) out.push(`the real answer must be at least ${RANGE.EDGE_MARGIN * 100}% in from both ends of the range`);
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

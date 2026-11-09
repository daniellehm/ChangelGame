/**
 * Tunable game constants (SPEC §2). Logic modules read from here so values can
 * be tuned after launch without touching code paths. Points are stored at submit
 * time, so changing these never rescores past games.
 */

export const ROUNDS = 5;
export const MAX_POINTS_PER_ROUND = 100;
export const MAX_TOTAL = ROUNDS * MAX_POINTS_PER_ROUND;

export const SCORING = {
  /** |log10 change| below this counts as "no change" for the wrong-way rule (at full width; scales with the range). */
  EPSILON: 0.004,
} as const;

/** Minimum points for each tier (anything below MEH is "Way off"). */
export const TIER_CUTOFFS = {
  NAILED: 90,
  CLOSE: 65,
  MEH: 30,
} as const;

/**
 * Per-question guess ranges (DECISIONS 2026-11-09). Each question has a
 * `max_change` k: the slider runs ÷k … ×k, always centred on "no change" so its
 * shape never hints at the direction. Scoring tolerance scales with the width.
 * Positions and widths below are in log10-multiplier units.
 */
export const RANGE = {
  /** The prototype's range (÷1000 … ×1000). A question with this range scores exactly like the prototype. */
  FULL: { lo: -3, hi: 3 },
  /** Smallest allowed max_change (÷1.05 … ×1.05, e.g. a sprint record). */
  MIN_FACTOR: 1.05,
  /** Largest allowed max_change (÷1000 … ×1000). */
  MAX_FACTOR: 1000,
  /** The real answer may be at most this fraction of the way from "same" to an end. */
  MAX_ANSWER_FRACTION: 0.85,
  /**
   * Scoring is relative to the slider: a guess this fraction of the slider's
   * length away from the answer scores 0 (DECISIONS 2026-11-09, relative scoring).
   * Must stay ≤ ½ so the far end always scores 0.
   */
  TOLERANCE_FRACTION: 1 / 3,
  /** Slider resolution, as fractions of the width (full range: 0.005 / 0.05 / 0.1 / 0.01, as the prototype). */
  STEP_FRACTION: 1 / 1200,
  NUDGE_FRACTION: 1 / 120,
  PAGE_FRACTION: 1 / 60,
  SNAP_FRACTION: 1 / 600,
} as const;

/** Full-range slider constants (the prototype). Per-question values come from lib/range.ts. */
export const SLIDER = {
  /** Slider value is g = log10(multiplier). */
  MIN: -3,
  MAX: 3,
  STEP: 0.005,
  /** "− a bit" / "+ a bit" buttons. */
  NUDGE: 0.05,
  /** Page Up / Page Down. */
  PAGE: 0.1,
  /** Values within ±SNAP of 0 snap to exactly 0 so "no change" is easy to hit. */
  SNAP: 0.01,
} as const;

/** Final-screen titles, checked top to bottom (SPEC §2). */
export const FINAL_TITLES: ReadonlyArray<{ min: number; title: string }> = [
  { min: 420, title: "Time traveller 🔮" },
  { min: 320, title: "History buff" },
  { min: 200, title: "Not bad, not great" },
  { min: 100, title: "Living in the past" },
  { min: -Infinity, title: "Have you been asleep since 1970?" },
];

/**
 * Date of puzzle #1 (YYYY-MM-DD). Server-only env var; server components pass it
 * to the client as a prop. Default matches the prototype's epoch (DECISIONS.md).
 */
export const DEFAULT_LAUNCH_DATE = "2026-11-09";
export function launchDate(): string {
  const v = process.env.LAUNCH_DATE;
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : DEFAULT_LAUNCH_DATE;
}

/** Versioned localStorage keys (SPEC §5). */
export const STORAGE_KEYS = {
  play: (puzzleDate: string) => `changel:v1:play:${puzzleDate}`,
  stats: "changel:v1:stats",
} as const;

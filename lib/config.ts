/**
 * Tunable game constants (SPEC §2). Logic modules read from here so values can
 * be tuned after launch without touching code paths. Points are stored at submit
 * time, so changing these never rescores past games.
 */

export const ROUNDS = 5;
export const MAX_POINTS_PER_ROUND = 100;
export const MAX_TOTAL = ROUNDS * MAX_POINTS_PER_ROUND;

export const SCORING = {
  /** log10 error at which a round scores 0 (≈ 5.6× off). */
  SPAN: 0.75,
  /** |log10 change| below this counts as "no change" for the wrong-way rule. */
  EPSILON: 0.004,
} as const;

/** Minimum points for each tier (anything below MEH is "Way off"). */
export const TIER_CUTOFFS = {
  NAILED: 90,
  CLOSE: 65,
  MEH: 30,
} as const;

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

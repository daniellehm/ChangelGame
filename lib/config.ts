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

type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

/**
 * Content pipeline (SPEC §8; DECISIONS 2026-11-09 "M5 pipeline: models, spend cap, global mix").
 * Prices are Anthropic list prices in USD per million tokens; web search is per search.
 */
export const CONTENT = {
  /** Hard monthly cap on Claude spend (Dani). No new call starts once the month reaches it. */
  MONTHLY_CAP_USD: 50,
  MODELS: { strong: "claude-opus-5-5", fast: "claude-sonnet-5-5" },
  /** Effort per tier: the Opus steps think a bit; the checks stay quick. */
  EFFORT: { strong: "medium", fast: "low" },
  /** Includes the server-side fallback targets so their spend is priced too. */
  PRICES: {
    "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
    "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
    "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
    "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  } as Readonly<Record<string, Price>>,
  WEB_SEARCH_USD: 0.01,
  /** Server-tool loops that hit their iteration limit pause; resume at most this many times. */
  MAX_CONTINUATIONS: 3,
} as const;

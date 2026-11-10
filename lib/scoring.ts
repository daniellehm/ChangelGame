/**
 * Pure scoring module (SPEC §2). Shared by the server (authoritative) and the
 * client (previews + local-only fallback). Each question has its own guess range,
 * and points depend on the distance as a share of that range (lib/range.ts,
 * DECISIONS 2026-11-09). Tiers and the wrong-way rule are the prototype's.
 */
import { FINAL_TITLES, MAX_POINTS_PER_ROUND, TIER_CUTOFFS } from "./config";
import { clampTo, epsilon, tolerance, type GuessRange } from "./range";

export type TierId = "nailed" | "close" | "meh" | "off" | "wrong";

export interface TierInfo {
  id: TierId;
  emoji: string;
  label: string;
  /** CSS colour (token reference) for the verdict bar. */
  color: string;
  /** Text on that bar: ink on the light bars, white on red (AA large text; DECISIONS item 12). */
  text: string;
}

export const TIERS: Record<TierId, TierInfo> = {
  nailed: { id: "nailed", emoji: "🟩", label: "Nailed it", color: "var(--g)", text: "var(--ink)" },
  close: { id: "close", emoji: "🟨", label: "Close", color: "var(--y-strong)", text: "var(--ink)" },
  meh: { id: "meh", emoji: "🟧", label: "Meh", color: "var(--o)", text: "var(--ink)" },
  off: { id: "off", emoji: "🟥", label: "Way off", color: "var(--r)", text: "var(--on-accent)" },
  wrong: { id: "wrong", emoji: "🟥", label: "Wrong way!", color: "var(--r)", text: "var(--on-accent)" },
};

export interface RoundScore {
  points: number;
  wrongWay: boolean;
  tier: TierId;
}

/** Clamp a guess to the question's range. Non-finite input is rejected. */
export function clampGuess(guessLog: number, range: GuessRange): number {
  if (!Number.isFinite(guessLog)) throw new RangeError("guess_log must be a finite number");
  return clampTo(range, guessLog);
}

/** a = log10(end / start). Both values must be > 0. */
export function actualLog(startValue: number, endValue: number): number {
  if (!(startValue > 0) || !(endValue > 0)) throw new RangeError("values must be > 0");
  return Math.log10(endValue / startValue);
}

/** True when both moves are beyond ε and point in opposite directions. */
export function isWrongWay(guessLog: number, actual: number, range: GuessRange): boolean {
  const e = epsilon(range);
  return Math.abs(actual) > e && Math.abs(guessLog) > e && Math.sign(guessLog) !== Math.sign(actual);
}

export function tierFor(points: number, wrongWay: boolean): TierId {
  if (wrongWay) return "wrong";
  if (points >= TIER_CUTOFFS.NAILED) return "nailed";
  if (points >= TIER_CUTOFFS.CLOSE) return "close";
  if (points >= TIER_CUTOFFS.MEH) return "meh";
  return "off";
}

/** Score one round. guessLog is clamped to the question's range first. */
export function scoreRound(guessLog: number, actual: number, range: GuessRange): RoundScore {
  const g = clampGuess(guessLog, range);
  if (isWrongWay(g, actual, range)) return { points: 0, wrongWay: true, tier: "wrong" };
  const points = Math.max(0, Math.round(MAX_POINTS_PER_ROUND * (1 - Math.abs(g - actual) / tolerance(range))));
  return { points, wrongWay: false, tier: tierFor(points, false) };
}

export function totalOf(points: readonly number[]): number {
  return points.reduce((a, p) => a + p, 0);
}

export function finalTitle(total: number): string {
  // The last entry has min -Infinity, so find() always succeeds.
  return FINAL_TITLES.find((t) => total >= t.min)!.title;
}

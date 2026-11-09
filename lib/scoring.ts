/**
 * Pure scoring module (SPEC §2). Shared by the server (authoritative) and the
 * client (previews + local-only fallback). Must stay identical to the prototype's
 * score()/tier() in reference/prototype.html.
 */
import { FINAL_TITLES, MAX_POINTS_PER_ROUND, SCORING, SLIDER, TIER_CUTOFFS } from "./config";

export type TierId = "nailed" | "close" | "meh" | "off" | "wrong";

export interface TierInfo {
  id: TierId;
  emoji: string;
  label: string;
  /** CSS colour (token reference) for the verdict bar. */
  color: string;
}

export const TIERS: Record<TierId, TierInfo> = {
  nailed: { id: "nailed", emoji: "🟩", label: "Nailed it", color: "var(--g)" },
  close: { id: "close", emoji: "🟨", label: "Close", color: "var(--y-strong)" },
  meh: { id: "meh", emoji: "🟧", label: "Meh", color: "var(--o)" },
  off: { id: "off", emoji: "🟥", label: "Way off", color: "var(--r)" },
  wrong: { id: "wrong", emoji: "🟥", label: "Wrong way!", color: "var(--r)" },
};

export interface RoundScore {
  points: number;
  wrongWay: boolean;
  tier: TierId;
}

/** Clamp a guess to the slider range. Non-finite input is rejected. */
export function clampGuess(guessLog: number): number {
  if (!Number.isFinite(guessLog)) throw new RangeError("guess_log must be a finite number");
  return Math.min(SLIDER.MAX, Math.max(SLIDER.MIN, guessLog));
}

/** a = log10(end / start). Both values must be > 0. */
export function actualLog(startValue: number, endValue: number): number {
  if (!(startValue > 0) || !(endValue > 0)) throw new RangeError("values must be > 0");
  return Math.log10(endValue / startValue);
}

/** True when both moves are beyond ε and point in opposite directions. */
export function isWrongWay(guessLog: number, actual: number): boolean {
  const e = SCORING.EPSILON;
  return Math.abs(actual) > e && Math.abs(guessLog) > e && Math.sign(guessLog) !== Math.sign(actual);
}

export function tierFor(points: number, wrongWay: boolean): TierId {
  if (wrongWay) return "wrong";
  if (points >= TIER_CUTOFFS.NAILED) return "nailed";
  if (points >= TIER_CUTOFFS.CLOSE) return "close";
  if (points >= TIER_CUTOFFS.MEH) return "meh";
  return "off";
}

/** Score one round. guessLog is clamped to the slider range first. */
export function scoreRound(guessLog: number, actual: number): RoundScore {
  const g = clampGuess(guessLog);
  if (isWrongWay(g, actual)) return { points: 0, wrongWay: true, tier: "wrong" };
  const points = Math.max(0, Math.round(MAX_POINTS_PER_ROUND * (1 - Math.abs(g - actual) / SCORING.SPAN)));
  return { points, wrongWay: false, tier: tierFor(points, false) };
}

export function totalOf(points: readonly number[]): number {
  return points.reduce((a, p) => a + p, 0);
}

export function finalTitle(total: number): string {
  // The last entry has min -Infinity, so find() always succeeds.
  return FINAL_TITLES.find((t) => total >= t.min)!.title;
}

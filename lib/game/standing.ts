/**
 * Where your total sits among today's finished games (Dani 2026-11-10): "Top 15% today",
 * plus bars for the score graph on the final screen. Pure; data from GET /api/crowd.
 */
import { MAX_TOTAL } from "../config";

export const STANDING = {
  /** Below this many finished games, the comparison isn't shown yet. */
  MIN_PLAYERS: 20,
  /** Bar width in points (0–24, 25–49, … 475–500). */
  BUCKET: 25,
} as const;

export interface ScoreDistribution {
  /** Finished games today. */
  n: number;
  /** Games per total (only totals someone got). */
  counts: Record<string, number>;
}

export type Standing = { kind: "early"; n: number } | { kind: "top"; pct: number; n: number } | { kind: "better"; pct: number; n: number };

/** Top X% when you're in the top half; "better than Y%" below it, so it never reads as a put-down. */
export function standing(total: number, d: ScoreDistribution | null | undefined): Standing {
  const n = d?.n ?? 0;
  if (!d || n < STANDING.MIN_PLAYERS) return { kind: "early", n };
  let above = 0;
  let below = 0;
  for (const [t, c] of Object.entries(d.counts)) {
    const v = Number(t);
    if (v > total) above += c;
    else if (v < total) below += c;
  }
  const top = Math.max(1, Math.ceil(((above + 1) / n) * 100));
  return top <= 50 ? { kind: "top", pct: top, n } : { kind: "better", pct: Math.floor((below / n) * 100), n };
}

export function standingText(s: Standing): string {
  if (s.kind === "early") return `Too early to compare: ${s.n} ${s.n === 1 ? "player" : "players"} so far today.`;
  if (s.kind === "top") return `Top ${s.pct}% today`;
  return `Better than ${s.pct}% of players today`;
}

/** Bars for the graph: games per 25-point bucket, and which bar is yours. */
export function scoreBars(total: number, d: ScoreDistribution): { counts: number[]; mine: number } {
  const size = STANDING.BUCKET;
  const buckets = Math.ceil(MAX_TOTAL / size); // 20
  const counts = Array.from({ length: buckets }, () => 0);
  const at = (t: number) => Math.min(buckets - 1, Math.floor(t / size));
  for (const [t, c] of Object.entries(d.counts)) counts[at(Number(t))]! += c;
  return { counts, mine: at(total) };
}

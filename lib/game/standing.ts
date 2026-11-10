/**
 * Where your total sits among today's finished games (Dani 2026-11-10): "Top 15% today",
 * shown as a sticker on the final screen. Never reveals how many people played. Pure;
 * data from GET /api/crowd.
 */

export interface ScoreDistribution {
  /** Finished games today. */
  n: number;
  /** Games per total (only totals someone got). */
  counts: Record<string, number>;
}

/**
 * The day's totals with yours in them. The crowd data is cached for a minute, so a game
 * that just finished may not be counted yet: if your total isn't there, add it.
 */
export function withYou(total: number, d: ScoreDistribution | null | undefined): ScoreDistribution {
  const counts = { ...(d?.counts ?? {}) };
  const n = d?.n ?? 0;
  if (counts[String(total)]) return { n, counts };
  counts[String(total)] = 1;
  return { n: n + 1, counts };
}

export type Band = "crown" | "rocket" | "star" | "thumbs" | "flex";
export type Standing = { kind: "top"; pct: number; band: Band } | { kind: "better"; pct: number; band: Band };

/**
 * Top half: "Top X%", X = the share who scored higher, rounded up, at least 1 (so the day's
 * best, or the only player so far, is "Top 1%"). Bottom half: "Beat Y% of players", so it
 * never reads as a put-down.
 */
export function standing(total: number, d: ScoreDistribution): Standing {
  const { n, counts } = withYou(total, d);
  let above = 0;
  let below = 0;
  for (const [t, c] of Object.entries(counts)) {
    const v = Number(t);
    if (v > total) above += c;
    else if (v < total) below += c;
  }
  const top = Math.max(1, Math.ceil((above * 100) / n)); // multiply first: no float drift
  if (top > 50) return { kind: "better", pct: Math.floor((below * 100) / n), band: "flex" };
  return { kind: "top", pct: top, band: top <= 5 ? "crown" : top <= 10 ? "rocket" : top <= 25 ? "star" : "thumbs" };
}

export const BAND_EMOJI: Record<Band, string> = { crown: "👑", rocket: "🚀", star: "⭐", thumbs: "👍", flex: "💪" };

export function standingText(s: Standing): string {
  return s.kind === "top" ? `Top ${s.pct}% today` : `Beat ${s.pct}% of players today`;
}

import { BAND_EMOJI, standing, standingText, type Band, type ScoreDistribution } from "@/lib/game/standing";

/** Sticker colours by how well you did (game tokens; ink text passes AA on all of them). */
const BAND_BG: Record<Band, string> = { crown: "var(--g)", rocket: "var(--g)", star: "var(--y)", thumbs: "var(--o)", flex: "var(--card)" };

/**
 * "🚀 Top 10% today" as a tilted sticker next to your title (Dani 2026-11-10: a fun graphic,
 * no graph, never a player count). Hidden until the day's scores have loaded (or offline).
 */
export function StandingSticker({ total, scores }: { total: number; scores: ScoreDistribution | null }) {
  if (!scores) return null;
  const s = standing(total, scores);
  if (s.kind === "better" && s.pct === 0) return null; // last place: no sticker rather than "Beat 0%"
  return (
    <span className={`standing-sticker band-${s.band}`} id="standing" style={{ background: BAND_BG[s.band] }}>
      <span aria-hidden="true">{BAND_EMOJI[s.band]}</span> {standingText(s)}
    </span>
  );
}

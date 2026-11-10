import { MAX_TOTAL } from "@/lib/config";
import { scoreBars, standing, standingText, type ScoreDistribution } from "@/lib/game/standing";

/**
 * Today's scores as a small bar graph with your bar marked, and where you stand
 * ("Top 15% today"). Plain HTML/CSS, no chart library (game-page JS budget).
 */
export function ScoreGraph({ total, scores }: { total: number; scores: ScoreDistribution | null }) {
  const s = standing(total, scores);
  if (s.kind === "early" || !scores) {
    return <p className="standing early" id="standing">{standingText(s)}</p>;
  }
  const { counts, mine } = scoreBars(total, scores);
  const max = Math.max(1, ...counts);
  return (
    <div className="standing-box">
      <p className="standing" id="standing">{standingText(s)}</p>
      <div className="score-graph" role="img" aria-label={`Today's scores from ${s.n} players. ${standingText(s)}.`}>
        {counts.map((c, i) => (
          <i key={i} className={i === mine ? "mine" : ""} style={{ height: `${Math.max(c ? 6 : 2, (c / max) * 100)}%` }}>
            {i === mine && <span className="you">YOU</span>}
          </i>
        ))}
      </div>
      <div className="score-axis" aria-hidden="true">
        <span>0</span>
        <span>{`${s.n} players today`}</span>
        <span>{MAX_TOTAL}</span>
      </div>
    </div>
  );
}


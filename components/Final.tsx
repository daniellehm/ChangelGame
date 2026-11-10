"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { MAX_TOTAL } from "@/lib/config";
import { formatCountdown, nextLocalMidnight } from "@/lib/dates";
import { multLabel } from "@/lib/format";
import { epsilon } from "@/lib/range";
import { shareTeaser, shareText, shareUrl } from "@/lib/game/share";
import { track, trackOnce } from "@/lib/analytics/client";
import type { StatsSummary } from "@/lib/game/storage";
import type { Puzzle, RoundResult } from "@/lib/game/types";
import { finalTitle, TIERS, totalOf } from "@/lib/scoring";
import { useCountUp } from "./motion";
import { SaveStreak } from "./SaveStreak";
import { ShareButton } from "./ShareButton";

interface Props {
  puzzle: Puzzle;
  results: RoundResult[];
  stats: StatsSummary;
  /** Count up the score and flip in the grid (only when arriving from the last reveal). */
  animate: boolean;
  /** Player has no account: show a "Save your streak" button. */
  offerSave: boolean;
  /** Open the save form straight away (from the 2nd completed game, SPEC §5). */
  saveOpen: boolean;
  onSaved: (note: string) => void;
  /** Shown after signing in from this screen (what happened to this device's games). */
  note: string | null;
  onToast: (message: string) => void;
  /** The round the crowd did worst on today (SPEC §10), once there are enough plays. */
  trap?: string | null;
}

function useCountdown(): string {
  const [text, setText] = useState("");
  useEffect(() => {
    let target = nextLocalMidnight(new Date());
    const tick = () => {
      const now = Date.now();
      if (now >= target) target = nextLocalMidnight(new Date(now));
      setText(`Next in ${formatCountdown(target - now)}`);
    };
    const first = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(id);
    };
  }, []);
  return text;
}

export function Final({ puzzle, results, stats, animate, offerSave, saveOpen, onSaved, note, onToast, trap = null }: Props) {
  const [saveExpanded, setSaveExpanded] = useState(saveOpen);
  const total = totalOf(results.map((r) => r.points));
  const shown = useCountUp(total, animate, 900);
  const countdown = useCountdown();
  const tiers = results.map((r) => r.tier);

  // Analytics (SPEC §11): the "Save your streak" pitch was shown (once per day per device).
  useEffect(() => {
    if (offerSave) trackOnce(`signup_prompt:${puzzle.date}`, puzzle.date, { name: "signup_prompt_shown" });
  }, [offerSave, puzzle.date]);

  return (
    <section id="final" className="card final">
      {note && <p className="banner" id="savedNote" role="status">{note}</p>}
      <div className="cat" id="finalCat">{`Changel #${puzzle.number}`}</div>
      <div className="gap" />
      <div>
        <span className="score" id="finalScore">{shown}</span>{" "}
        <span className="of">{`/ ${MAX_TOTAL}`}</span>
      </div>
      <div className={animate ? "grid animate" : "grid"} id="finalGrid" role="img" aria-label={tiers.map((t) => TIERS[t].label).join(", ")}>
        {tiers.map((t, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties}>{TIERS[t].emoji}</span>
        ))}
      </div>
      <div className="title" id="finalTitle">{finalTitle(total)}</div>
      <div className="rows" id="finalRows">
        {results.map((r) => {
          const round = puzzle.rounds[r.position - 1];
          return (
            <div className="row" key={r.position}>
              <span>{`${TIERS[r.tier].emoji} ${round?.prompt ?? ""}`}</span>
              <span className="r">{`${multLabel(r.actual_log, round ? epsilon(round.range) : undefined).big} · ${r.points}`}</span>
            </div>
          );
        })}
      </div>
      {trap && (
        <p className="trap" id="trapLine">
          <span>Today&apos;s trap:</span> {trap}
        </p>
      )}
      <div className="stats">
        <div><b id="stPlayed">{stats.played}</b><small>played</small></div>
        <div><b id="stStreak">{stats.streak}</b><small>streak</small></div>
        <div><b id="stBest">{stats.best}</b><small>best</small></div>
      </div>
      <ShareButton text={shareText(puzzle.number, total, tiers)} teaser={shareTeaser(puzzle.number, total, tiers)} url={shareUrl({ number: puzzle.number, total, tiers })} onToast={onToast} onShared={(method) => track(puzzle.date, { name: "share_clicked", props: { method } })} />
      {offerSave && (
        <div className="final-save">
          {saveExpanded ? (
            <SaveStreak
              mode="save"
              title={stats.streak > 1 ? `Save your ${stats.streak}-day streak` : "Save your streak"}
              onDone={(_email, n) => onSaved(n)}
            />
          ) : (
            <button className="btn ghost" id="saveBtn" type="button" onClick={() => setSaveExpanded(true)}>
              Save your streak
            </button>
          )}
        </div>
      )}
      <div className="next" id="countdown">{countdown}</div>
    </section>
  );
}

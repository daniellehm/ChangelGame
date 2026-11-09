"use client";

import { useEffect, useState } from "react";
import { MAX_TOTAL } from "@/lib/config";
import { formatCountdown, nextLocalMidnight } from "@/lib/dates";
import { multLabel } from "@/lib/format";
import { shareText } from "@/lib/game/share";
import type { StatsSummary } from "@/lib/game/storage";
import type { Puzzle, RoundResult } from "@/lib/game/types";
import { finalTitle, TIERS, totalOf } from "@/lib/scoring";
import { ShareButton } from "./ShareButton";

interface Props {
  puzzle: Puzzle;
  results: RoundResult[];
  stats: StatsSummary;
  onToast: (message: string) => void;
}

function useCountdown(): string {
  const [text, setText] = useState("");
  useEffect(() => {
    let target = nextLocalMidnight(new Date());
    const tick = () => {
      const now = Date.now();
      if (now >= target) target = nextLocalMidnight(new Date(now));
      setText(`Next Changel in ${formatCountdown(target - now)}`);
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

export function Final({ puzzle, results, stats, onToast }: Props) {
  const total = totalOf(results.map((r) => r.points));
  const countdown = useCountdown();
  const tiers = results.map((r) => r.tier);

  return (
    <section id="final" className="card final">
      <div className="cat" id="finalCat">{`Changel #${puzzle.number}`}</div>
      <div className="gap" />
      <div>
        <span className="score" id="finalScore">{total}</span>{" "}
        <span className="of">{`/ ${MAX_TOTAL}`}</span>
      </div>
      <div className="grid" id="finalGrid" role="img" aria-label={tiers.map((t) => TIERS[t].label).join(", ")}>
        {tiers.map((t) => TIERS[t].emoji).join("")}
      </div>
      <div className="title" id="finalTitle">{finalTitle(total)}</div>
      <div className="rows" id="finalRows">
        {results.map((r) => {
          const round = puzzle.rounds[r.position - 1];
          return (
            <div className="row" key={r.position}>
              <span>{`${TIERS[r.tier].emoji} ${round?.prompt ?? ""}`}</span>
              <span className="r">{`${multLabel(r.actual_log).big} · ${r.points}`}</span>
            </div>
          );
        })}
      </div>
      <div className="stats">
        <div><b id="stPlayed">{stats.played}</b><small>played</small></div>
        <div><b id="stStreak">{stats.streak}</b><small>streak</small></div>
        <div><b id="stBest">{stats.best}</b><small>best</small></div>
      </div>
      <ShareButton text={shareText(puzzle.number, total, tiers)} onToast={onToast} />
      <div className="next" id="countdown">{countdown}</div>
    </section>
  );
}

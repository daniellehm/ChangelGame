"use client";

import { useEffect, useRef } from "react";
import { loadPlay, type StatsEntry } from "@/lib/game/storage";
import { TIERS } from "@/lib/scoring";

/**
 * Pop-up for one day on the stats strip: the score and how each round went. Round
 * questions come from the full play record when this device still has it; otherwise
 * just the round results.
 */
export function DayResult({ entry, onClose }: { entry: StatsEntry; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const play = loadPlay(entry.date);
  const date = new Date(`${entry.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="day-pop-backdrop" onClick={onClose}>
      <div className="day-pop" role="dialog" aria-modal="true" aria-labelledby="dayPopTitle" onClick={(e) => e.stopPropagation()}>
        <div className="day-pop-head">
          <div>
            <small>
              Changel #{entry.number} · {date}
            </small>
            <h2 id="dayPopTitle">
              {entry.total}
              <span>/500</span>
            </h2>
          </div>
          <button ref={closeRef} type="button" className="day-pop-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <ol className="day-pop-rounds">
          {entry.tiers.map((t, i) => {
            const round = play?.puzzle.rounds[i];
            const result = play?.results[i];
            return (
              <li key={i}>
                <span className="day-pop-tier" aria-hidden="true">
                  {TIERS[t].emoji}
                </span>
                <span className="day-pop-q">
                  {round ? round.prompt : `Round ${i + 1}`}
                  <small>{TIERS[t].label}</small>
                </span>
                {result ? <b>{result.points}</b> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

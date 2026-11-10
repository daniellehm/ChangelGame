"use client";

import { useEffect, useRef } from "react";
import type { ServerPlay } from "@/lib/game/session-client";
import { loadPlay, type StatsEntry } from "@/lib/game/storage";
import { TIERS } from "@/lib/scoring";

/** A day on the stats strip: this device's entry, or the account's (with its rounds). */
export type StripDay = StatsEntry & { rounds?: ServerPlay["rounds"] };

/**
 * Pop-up for one day on the stats strip: the score and how each round went. Questions
 * and points come from this device's play record, else from the account's (server).
 */
export function DayResult({ entry, onClose }: { entry: StripDay; onClose: () => void }) {
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
            const server = entry.rounds?.[i];
            const prompt = play?.puzzle.rounds[i]?.prompt ?? server?.prompt;
            const points = play?.results[i]?.points ?? server?.points;
            return (
              <li key={i}>
                <span className="day-pop-tier" aria-hidden="true">
                  {TIERS[t].emoji}
                </span>
                <span className="day-pop-q">
                  {prompt ?? `Round ${i + 1}`}
                  <small>{TIERS[t].label}</small>
                </span>
                {points !== undefined ? <b>{points}</b> : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

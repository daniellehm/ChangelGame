"use client";

import { useEffect, useRef, useState } from "react";
import { multLabel } from "@/lib/format";
import type { RoundResult } from "@/lib/game/types";
import { epsilon, toPercent, type GuessRange } from "@/lib/range";
import { TIERS } from "@/lib/scoring";
import { confetti, useCountUp } from "./motion";
import { ReportButton } from "./ReportButton";

interface Props {
  result: RoundResult;
  /** The question's slider range: pins sit where they would on the slider. */
  range: GuessRange;
  /** Server play id: shows "Something wrong with this?" (hidden in local-only mode). */
  playId?: string | null;
  isLast: boolean;
  /** "38% of players went the wrong way" (SPEC §10); null while loading. */
  crowd?: string | null;
  /** Count-up + confetti (false under reduced motion). */
  motion: boolean;
  onNext: () => void;
}

export function Reveal({ result, range, isLast, motion, onNext, playId = null, crowd = null }: Props) {
  const zero = `${toPercent(range, 0)}%`;
  const tier = TIERS[result.tier];
  const verdictRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);
  // Captured at mount so toggling reduced motion mid-reveal doesn't restart anything.
  const [animate] = useState(motion);
  const points = useCountUp(result.points, animate, 500);

  useEffect(() => {
    // Focus the verdict (SPEC §11), then slide the pins out from the middle after two frames.
    verdictRef.current?.focus({ preventScroll: true });
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setPlaced(true));
    });
    const t = animate && result.tier === "nailed" ? setTimeout(() => confetti(verdictRef.current), 150) : undefined;
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(t);
    };
  }, [animate, result.tier]);

  return (
    <div className="reveal show" id="reveal">
      <div className="verdict" id="verdict" ref={verdictRef} tabIndex={-1} style={{ background: tier.color }} aria-describedby="revealAnnounce">
        <span id="vText">{tier.label}</span>
        <span className="pts" id="vPts">{`+${points}`}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className="track" />
        <div className="mid" style={{ left: zero }} />
        <div className="pin you" id="pinYou" style={{ left: placed ? `${toPercent(range, result.guess_log)}%` : zero }}>
          YOU<b />
        </div>
        <div className="pin real" id="pinReal" style={{ left: placed ? `${toPercent(range, result.actual_log)}%` : zero }}>
          <b />
          <span id="pinRealLbl">{`REAL ${multLabel(result.actual_log, epsilon(range)).big}`}</span>
        </div>
      </div>
      {/* Reserves its line while loading, so the fact doesn't jump. */}
      <p className="crowd" id="crowdLine">{crowd ?? "\u00a0"}</p>
      <p className="fact" id="fact">{result.fact}</p>
      <div className="src" id="src">
        <span className="sr-only">Source: </span>
        {result.source_url ? (
          <a href={result.source_url} target="_blank" rel="noopener noreferrer">{result.source_name}</a>
        ) : (
          result.source_name
        )}
      </div>
      {result.corrected ? <p className="corrected" id="corrected">Corrected since it first went live.</p> : null}
      {playId ? <ReportButton playId={playId} position={result.position} /> : null}
      <button className="btn" id="nextBtn" type="button" onClick={onNext}>
        {isLast ? "Score" : "Next"}
      </button>
    </div>
  );
}

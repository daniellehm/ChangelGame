"use client";

import { useEffect, useRef, useState } from "react";
import { SLIDER } from "@/lib/config";
import { multLabel } from "@/lib/format";
import type { RoundResult } from "@/lib/game/types";
import { TIERS } from "@/lib/scoring";

/** Pin position on the track as a percentage (prototype's pos()). */
export function pinPercent(l: number): number {
  return ((Math.min(SLIDER.MAX, Math.max(SLIDER.MIN, l)) - SLIDER.MIN) / (SLIDER.MAX - SLIDER.MIN)) * 100;
}

interface Props {
  result: RoundResult;
  isLast: boolean;
  onNext: () => void;
}

export function Reveal({ result, isLast, onNext }: Props) {
  const tier = TIERS[result.tier];
  const verdictRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    // Focus the verdict (SPEC §11), then slide pins from the middle after two frames, as in the prototype.
    verdictRef.current?.focus({ preventScroll: true });
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setPlaced(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, []);

  const real = multLabel(result.actual_log).big;

  return (
    <div className="reveal show" id="reveal">
      <div className="verdict" id="verdict" ref={verdictRef} tabIndex={-1} style={{ background: tier.color }} aria-describedby="revealAnnounce">
        <span id="vText">{tier.label}</span>
        <span className="pts" id="vPts">{`+${result.points}`}</span>
      </div>
      <div className="bar" aria-hidden="true">
        <div className="track" />
        <div className="mid" />
        <div className="pin you" id="pinYou" style={{ left: placed ? `${pinPercent(result.guess_log)}%` : "50%" }}>
          YOU<b />
        </div>
        <div className="pin real" id="pinReal" style={{ left: placed ? `${pinPercent(result.actual_log)}%` : "50%" }}>
          <b />
          <span id="pinRealLbl">{`REAL ${real}`}</span>
        </div>
      </div>
      <p className="fact" id="fact">{result.fact}</p>
      <div className="src" id="src">
        {"Source: "}
        {result.source_url ? (
          <a href={result.source_url} target="_blank" rel="noopener noreferrer">{result.source_name}</a>
        ) : (
          result.source_name
        )}
      </div>
      <button className="btn" id="nextBtn" type="button" onClick={onNext}>
        {isLast ? "See my score" : "Next"}
      </button>
    </div>
  );
}

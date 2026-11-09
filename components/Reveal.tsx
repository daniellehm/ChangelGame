"use client";

import { useEffect, useRef, useState } from "react";
import { SLIDER } from "@/lib/config";
import { multLabel } from "@/lib/format";
import type { RoundResult } from "@/lib/game/types";
import { TIERS } from "@/lib/scoring";
import { confetti, useCountUp } from "./motion";

/** Pin position on the track as a percentage (prototype's pos()). */
export function pinPercent(l: number): number {
  return ((Math.min(SLIDER.MAX, Math.max(SLIDER.MIN, l)) - SLIDER.MIN) / (SLIDER.MAX - SLIDER.MIN)) * 100;
}

interface Props {
  result: RoundResult;
  isLast: boolean;
  /** Count-up + confetti (false under reduced motion). */
  motion: boolean;
  onNext: () => void;
}

export function Reveal({ result, isLast, motion, onNext }: Props) {
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
        <div className="mid" />
        <div className="pin you" id="pinYou" style={{ left: placed ? `${pinPercent(result.guess_log)}%` : "50%" }}>
          YOU<b />
        </div>
        <div className="pin real" id="pinReal" style={{ left: placed ? `${pinPercent(result.actual_log)}%` : "50%" }}>
          <b />
          <span id="pinRealLbl">{`REAL ${multLabel(result.actual_log).big}`}</span>
        </div>
      </div>
      <p className="fact" id="fact">{result.fact}</p>
      <div className="src" id="src">
        <span className="sr-only">Source: </span>
        {result.source_url ? (
          <a href={result.source_url} target="_blank" rel="noopener noreferrer">{result.source_name}</a>
        ) : (
          result.source_name
        )}
      </div>
      <button className="btn" id="nextBtn" type="button" onClick={onNext}>
        {isLast ? "Score" : "Next"}
      </button>
    </div>
  );
}

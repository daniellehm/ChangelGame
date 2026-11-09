"use client";

import { useEffect, useRef } from "react";
import { ROUNDS, SLIDER } from "@/lib/config";
import { formatValue, multLabel, multSpoken } from "@/lib/format";
import type { PublicRound, RoundResult } from "@/lib/game/types";
import { Reveal } from "./Reveal";
import { nudge } from "@/lib/slider";
import { TIERS } from "@/lib/scoring";
import { Slider } from "./Slider";

interface Props {
  round: PublicRound;
  index: number; // 0-based
  guess: number;
  result: RoundResult | null; // set once locked
  pending: boolean;
  onGuess: (v: number) => void;
  onLock: () => void;
  onNext: () => void;
}

function announce(r: RoundResult): string {
  return `${TIERS[r.tier].label} ${r.points} points. You guessed ${multSpoken(r.guess_log)}; the real change was ${multSpoken(r.actual_log)}.`;
}

export function Round({ round, index, guess, result, pending, onGuess, onLock, onNext }: Props) {
  const qRef = useRef<HTMLDivElement>(null);
  const lab = multLabel(guess);
  const implied = formatValue(round.start_value * Math.pow(10, guess), round.format);

  // Focus moves to the question on each new round (SPEC §11).
  useEffect(() => {
    qRef.current?.focus({ preventScroll: true });
  }, [round.position]);

  return (
    <section id="round" className="card">
      <div className="progress" id="progress" aria-hidden="true">
        {Array.from({ length: ROUNDS }, (_, i) => (
          <i key={i} className={i < index ? "done" : i === index ? "now" : ""} />
        ))}
      </div>
      <div className="cat" id="cat">{`Round ${index + 1} of ${ROUNDS} · ${round.category}`}</div>
      <div className="q" id="q" ref={qRef} tabIndex={-1}>
        {round.prompt}
      </div>
      <div className="years">
        <div className="yr">
          <div className="y" id="y0">{round.start_year}</div>
          <div className="v" id="v0">{formatValue(round.start_value, round.format)}</div>
        </div>
        <div className="arrow" aria-hidden="true">→</div>
        <div className={result ? "yr" : "yr unknown"} id="yr1">
          <div className="y" id="y1">{round.end_year}</div>
          <div className="v" id="v1">{result ? formatValue(result.end_value, round.format) : "?"}</div>
        </div>
      </div>

      {!result && (
        <div id="guessArea">
          <div className="guess" aria-hidden="true">
            <div className={lab.cls ? `mult ${lab.cls}` : "mult"} id="mult">{lab.big}</div>
            <div className="mult-sub" id="multSub">{`${lab.sub} · ≈ ${implied}`}</div>
          </div>
          <Slider value={guess} onChange={onGuess} disabled={pending} />
          <div className="ticks" aria-hidden="true">
            <span>÷1000</span><span>÷10</span><span>same</span><span>×10</span><span>×1000</span>
          </div>
          <div className="nudge">
            <button type="button" data-n={-SLIDER.NUDGE} onClick={() => onGuess(nudge(guess, -1))} disabled={pending}>
              − a bit
            </button>
            <button type="button" data-n={SLIDER.NUDGE} onClick={() => onGuess(nudge(guess, 1))} disabled={pending}>
              + a bit
            </button>
          </div>
          <button className="btn" id="lockBtn" type="button" onClick={onLock} disabled={pending} aria-busy={pending}>
            Lock it in
          </button>
        </div>
      )}

      {/* Persistent live region: announcements in freshly mounted regions are often dropped. */}
      <p className="sr-only" id="revealAnnounce" role="status" aria-live="polite">
        {result ? announce(result) : ""}
      </p>

      {result && <Reveal key={round.position} result={result} isLast={index === ROUNDS - 1} onNext={onNext} />}
    </section>
  );
}

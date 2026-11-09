"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ROUNDS } from "@/lib/config";
import { formatValue, multLabel, multSpoken } from "@/lib/format";
import type { PublicRound, RoundResult } from "@/lib/game/types";
import { epsilon, ticks } from "@/lib/range";
import { TIERS } from "@/lib/scoring";
import { nudge } from "@/lib/slider";
import { stickerFor } from "@/lib/sticker";
import { buzz } from "./motion";
import { Reveal } from "./Reveal";
import { Slider } from "./Slider";

interface Props {
  round: PublicRound;
  index: number; // 0-based
  guess: number;
  /** All locked results so far (live progress colours). */
  results: RoundResult[];
  pending: boolean;
  /** Motion & juice enabled (false under reduced motion). */
  motion: boolean;
  onGuess: (v: number) => void;
  onLock: () => void;
  onNext: () => void;
  /** Server play id, for the report button (null in local-only mode). */
  playId?: string | null;
}

function announce(r: RoundResult, eps: number): string {
  return `${TIERS[r.tier].label} ${r.points} points. You guessed ${multSpoken(r.guess_log, eps)}; the real change was ${multSpoken(r.actual_log, eps)}.`;
}

/** Which gap between tick marks the guess is in (the readout pops when it changes). */
const tickBucket = (marks: readonly number[], g: number) => marks.filter((l) => g >= l).length;

export function Round({ round, index, guess, results, pending, motion, onGuess, onLock, onNext, playId = null }: Props) {
  const qRef = useRef<HTMLDivElement>(null);
  const multRef = useRef<HTMLDivElement>(null);
  const range = round.range;
  const eps = epsilon(range);
  const marks = ticks(range);
  const markLogs = marks.slice(1, -1).map((t) => t.l);
  const bucketRef = useRef(tickBucket(markLogs, guess));
  const result = results[index] ?? null;
  const lab = multLabel(guess, eps);
  const implied = formatValue(round.start_value * Math.pow(10, guess), round.format);
  const sticker = stickerFor(round.category);

  // Focus moves to the question on each new round (SPEC §11).
  useEffect(() => {
    qRef.current?.focus({ preventScroll: true });
  }, [round.position]);

  // Pop + haptic tick each time the guess crosses a tick mark (×10, "same", …).
  const bucket = tickBucket(markLogs, guess);
  useEffect(() => {
    if (bucket !== bucketRef.current && motion) {
      const el = multRef.current;
      if (el) {
        el.classList.remove("pop");
        void el.offsetWidth; // restart the animation
        el.classList.add("pop");
      }
      buzz();
    }
    bucketRef.current = bucket;
  }, [bucket, motion]);

  return (
    <section id="round" className="card">
      <div className="progress" id="progress" aria-hidden="true">
        {Array.from({ length: ROUNDS }, (_, i) => {
          const r = results[i];
          const cls = r ? "done" : i === index ? "now" : "";
          return <i key={i} className={cls} style={r ? { background: TIERS[r.tier].color } : undefined} />;
        })}
      </div>
      <div className="cat round-cat" id="cat">
        <span>{`Round ${index + 1} of ${ROUNDS}`}</span>
        <span className="sr-only">, </span>
        <span className="sticker" style={{ "--st": sticker.color, "--tilt": `${sticker.tiltDeg}deg` } as CSSProperties}>
          {round.category}
        </span>
      </div>
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
          <div className="guess">
            <button type="button" className="side" id="nudgeDown" aria-label="Nudge down" onClick={() => onGuess(nudge(range, guess, -1))} disabled={pending}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
            <div className="guess-mid" aria-hidden="true">
              <div className={lab.cls ? `mult ${lab.cls}` : "mult"} id="mult" ref={multRef}>{lab.big}</div>
              <div className="mult-sub" id="multSub">{`${lab.short} · ≈ ${implied}`}</div>
            </div>
            <button type="button" className="side" id="nudgeUp" aria-label="Nudge up" onClick={() => onGuess(nudge(range, guess, 1))} disabled={pending}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12M8 2v12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <Slider value={guess} range={range} onChange={onGuess} disabled={pending} />
          <div className="ticks" id="ticks" aria-hidden="true">
            {marks.map((t) => (
              <span key={t.label} className={t.at === 0 ? "end lo" : t.at === 100 ? "end hi" : undefined} style={{ left: `${t.at}%` }}>
                {t.label}
              </span>
            ))}
          </div>
          <button className="btn" id="lockBtn" type="button" onClick={onLock} disabled={pending} aria-busy={pending}>
            Lock in
          </button>
        </div>
      )}

      {/* Persistent live region: announcements in freshly mounted regions are often dropped. */}
      <p className="sr-only" id="revealAnnounce" role="status" aria-live="polite">
        {result ? announce(result, eps) : ""}
      </p>

      {result && <Reveal key={round.position} result={result} range={range} playId={playId} isLast={index === ROUNDS - 1} motion={motion} onNext={onNext} />}
    </section>
  );
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { TIER_CUTOFFS } from "@/lib/config";
import { formatValue, multLabel } from "@/lib/format";
import { actualLog, scoreRound, TIERS, type TierId } from "@/lib/scoring";
import { stickerFor } from "@/lib/sticker";

export const metadata: Metadata = {
  title: "How to play · Changel",
  description: "Guess how many times bigger or smaller a number from the past is now. Five rounds a day, free, no account.",
};

/* A worked example, scored with the real scoring module. */
const EXAMPLE = { cat: "People", prompt: "World population", y0: 1975, v0: 4.07e9, y1: 2025, v1: 8.2e9, guess: Math.log10(2) };
const exActual = actualLog(EXAMPLE.v0, EXAMPLE.v1);
const exScore = scoreRound(EXAMPLE.guess, exActual);
const exSticker = stickerFor(EXAMPLE.cat);

const STEPS = [
  { title: "Slide", body: "Right if it grew. Left if it shrank." },
  { title: "Lock in", body: "Closer guess, more points." },
  { title: "Wrong way?", body: "That's 0 points." },
];

const TIER_CHIPS: Array<[TierId, string, number]> = [
  ["nailed", `${TIER_CUTOFFS.NAILED}+`, -2],
  ["close", `${TIER_CUTOFFS.CLOSE}+`, 1.5],
  ["meh", `${TIER_CUTOFFS.MEH}+`, -1],
  ["off", `under ${TIER_CUTOFFS.MEH}`, 2],
  ["wrong", "0", -1.5],
];

const DEAL = [
  "Same five numbers for everyone",
  "New puzzle at midnight, your time",
  "Free, and no account needed",
  "Every number has a source",
];

export default function HowToPlay() {
  return (
    <PageShell>
      <div className="cat">How to play</div>
      <h1>Guess the change.</h1>
      <p>A number from the past. How many times bigger or smaller is it now?</p>

      <figure className="demo" aria-label="Example round">
        <div className="round-cat cat">
          <span>Example</span>
          <span className="sticker" style={{ "--st": exSticker.color, "--tilt": `${exSticker.tiltDeg}deg` } as CSSProperties}>
            {EXAMPLE.cat}
          </span>
        </div>
        <div className="demo-q">{EXAMPLE.prompt}</div>
        <div className="years">
          <div className="yr"><div className="y">{EXAMPLE.y0}</div><div className="v">{formatValue(EXAMPLE.v0, "big")}</div></div>
          <div className="arrow" aria-hidden="true">→</div>
          <div className="yr"><div className="y">{EXAMPLE.y1}</div><div className="v">{formatValue(EXAMPLE.v1, "big")}</div></div>
        </div>
        <div className="demo-result">
          <span>You: <b>{multLabel(EXAMPLE.guess).big}</b></span>
          <span>Real: <b>{multLabel(exActual).big}</b></span>
          <span className="sticker" style={{ "--st": TIERS[exScore.tier].color, "--tilt": "-2deg" } as CSSProperties}>
            {TIERS[exScore.tier].label} +{exScore.points}
          </span>
        </div>
      </figure>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="step-n">{i + 1}</span>
            <b>{s.title}</b>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>

      <h2>Points</h2>
      <p>Up to 100 a round, 500 a day. Off by 2× still gets you about 60.</p>
      <ul className="tier-chips">
        {TIER_CHIPS.map(([id, pts, tilt]) => (
          <li key={id}>
            <span className="sticker" style={{ "--st": TIERS[id].color, "--tilt": `${tilt}deg` } as CSSProperties}>
              {TIERS[id].emoji} {TIERS[id].label}
            </span>
            <span className="tier-rule">{pts}</span>
          </li>
        ))}
      </ul>

      <h2>The deal</h2>
      <ul className="deal">
        {DEAL.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </PageShell>
  );
}

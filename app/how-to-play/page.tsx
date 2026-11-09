import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { TIER_CUTOFFS } from "@/lib/config";
import { TIERS, type TierId } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "How to play · Changel",
  description: "How Changel works: guess how many times bigger or smaller a number is now.",
};

const TIER_RULES: Array<[TierId, string, number]> = [
  ["nailed", `${TIER_CUTOFFS.NAILED}+`, -2],
  ["close", `${TIER_CUTOFFS.CLOSE}–${TIER_CUTOFFS.NAILED - 1}`, 1.5],
  ["meh", `${TIER_CUTOFFS.MEH}–${TIER_CUTOFFS.CLOSE - 1}`, -1],
  ["off", `0–${TIER_CUTOFFS.MEH - 1}`, 2],
  ["wrong", "0, wrong direction", -1.5],
];

export default function HowToPlay() {
  return (
    <PageShell>
      <div className="cat">Rules</div>
      <h1>How to play</h1>
      <p>Five real numbers from the past. Guess how much each one changed.</p>
      <ul className="rules">
        <li><span>1</span>Slide right if it grew, left if it shrank. The middle means no change.</li>
        <li><span>2</span>The slider runs from ÷1000 to ×1000. Use − and + to fine-tune.</li>
        <li><span>3</span>Lock in. Closer guess, more points: 100 a round, 500 a day.</li>
        <li><span>4</span>Wrong direction scores 0. Some numbers barely moved.</li>
      </ul>

      <h2>Scoring</h2>
      <p>Off by 2× scores about 60. Off by 5.6× scores 0.</p>
      <ul className="tiers">
        {TIER_RULES.map(([id, rule, tilt]) => (
          <li key={id}>
            <span className="sticker" style={{ "--st": TIERS[id].color, "--tilt": `${tilt}deg` } as CSSProperties}>
              {TIERS[id].emoji} {TIERS[id].label}
            </span>
            <span className="tier-rule">{rule}</span>
          </li>
        ))}
      </ul>

      <h2>New puzzle daily</h2>
      <p>Everyone gets the same five. A new set lands at midnight, your time. One go each.</p>
    </PageShell>
  );
}

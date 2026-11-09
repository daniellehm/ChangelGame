import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { FINAL_TITLES, TIER_CUTOFFS } from "@/lib/config";
import { TIERS, type TierId } from "@/lib/scoring";

export const metadata: Metadata = {
  title: "How to play · Changel",
  description: "How Changel works: guess how many times bigger or smaller a number is now.",
};

const TIER_RULES: Array<[TierId, string]> = [
  ["nailed", `${TIER_CUTOFFS.NAILED}+ points`],
  ["close", `${TIER_CUTOFFS.CLOSE}–${TIER_CUTOFFS.NAILED - 1} points`],
  ["meh", `${TIER_CUTOFFS.MEH}–${TIER_CUTOFFS.CLOSE - 1} points`],
  ["off", `under ${TIER_CUTOFFS.MEH} points`],
  ["wrong", "guessed the wrong direction: 0 points"],
];

export default function HowToPlay() {
  return (
    <PageShell>
      <div className="cat">How to play</div>
      <h1>How much did it change?</h1>
      <p>Every day there are five rounds. Each one shows a real number from the past, like the world&apos;s population in 1975, and asks how big it is now.</p>
      <ul className="rules">
        <li><span>1</span>Drag the slider: right means it went up, left means it went down. The middle means no change.</li>
        <li><span>2</span>The slider works in multiples: from a thousand times smaller (÷1000) to a thousand times bigger (×1000). Use “− a bit” and “+ a bit” to fine-tune.</li>
        <li><span>3</span>Tap “Lock it in”. The closer your multiplier, the more points, up to 100 a round and 500 a day.</li>
        <li><span>4</span>Guess the wrong direction and you score nothing. Some numbers barely moved, so “same” can be the right answer.</li>
      </ul>
      <h2>Scoring</h2>
      <p>Being off by 2× scores about 60. Off by about 5.6× scores 0.</p>
      <ul className="tiers">
        {TIER_RULES.map(([id, rule]) => (
          <li key={id}>
            <span className="sw" style={{ background: TIERS[id].color }}>{TIERS[id].emoji} {TIERS[id].label}</span>
            {rule}
          </li>
        ))}
      </ul>
      <h2>Daily reset</h2>
      <p>Everyone gets the same puzzle on the same date. A new one arrives at midnight where you are. One attempt per day. If you start just before midnight, you can still finish that puzzle.</p>
      <h2>Titles</h2>
      <p>{FINAL_TITLES.map((t) => t.title).join(" · ")}</p>
    </PageShell>
  );
}

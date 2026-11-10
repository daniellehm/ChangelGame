import type { SharedResult } from "@/lib/game/share";
import { TIERS } from "@/lib/scoring";

interface Props {
  theme: string | null;
  /** Today's puzzle number, once known on the client. */
  number: number | null;
  /** A friend's shared result (?r=), shown as a challenge. */
  friend?: SharedResult | null;
  onPlay: () => void;
  disabled?: boolean;
}

export function Intro({ theme, number, friend, onPlay, disabled }: Props) {
  return (
    <section id="intro" className="card intro">
      <div className="cat">Daily · 5 rounds · 2 min</div>
      {theme && <div className="chip">{theme}</div>}
      {friend && (
        <p className="friend" id="friendLine">
          {friend.number === number ? "A friend" : `A friend playing #${friend.number}`} scored <b>{friend.total}</b>
          {" "}
          <span aria-label={friend.tiers.map((t) => TIERS[t].label).join(", ")}>{friend.tiers.map((t) => TIERS[t].emoji).join("")}</span>.{" "}
          {friend.number === number ? "Can you beat it?" : "Try today's."}
        </p>
      )}
      <h1>How much did it change?</h1>
      <p>A real number from one year. How big was it years later?</p>
      <ul className="rules">
        <li><span>1</span>Slide right if it grew, left if it shrank.</li>
        <li><span>2</span>Closer guess, more points.</li>
        <li><span>3</span>Wrong direction scores 0.</li>
      </ul>
      <button className="btn" id="startBtn" type="button" onClick={onPlay} disabled={disabled}>
        {number ? `Play #${number}` : "Play"}
      </button>
    </section>
  );
}

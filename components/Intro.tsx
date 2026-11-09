interface Props {
  theme: string | null;
  /** Today's puzzle number, once known on the client. */
  number: number | null;
  onPlay: () => void;
  disabled?: boolean;
}

export function Intro({ theme, number, onPlay, disabled }: Props) {
  return (
    <section id="intro" className="card intro">
      <div className="cat">Daily · 5 rounds · 2 min</div>
      {theme && <div className="chip">{theme}</div>}
      <h1>How much did it change?</h1>
      <p>One number from the past. How big is it now?</p>
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

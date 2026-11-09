interface Props {
  theme: string | null;
  onPlay: () => void;
  disabled?: boolean;
}

export function Intro({ theme, onPlay, disabled }: Props) {
  return (
    <section id="intro" className="card intro">
      <div className="cat">Daily · 5 rounds · ~2 min</div>
      {theme && <div className="chip">{theme}</div>}
      <h1>How much did it change?</h1>
      <p>We show you a number from the past. You guess how much it&apos;s grown or shrunk since. Sounds easy. It isn&apos;t.</p>
      <ul className="rules">
        <li><span>1</span>Drag the slider: right means it went up, left means it went down.</li>
        <li><span>2</span>The closer your multiplier, the more points (100 max per round).</li>
        <li><span>3</span>Guess the wrong direction and you score nothing. Some barely moved.</li>
      </ul>
      <button className="btn" id="startBtn" type="button" onClick={onPlay} disabled={disabled}>
        Play today&apos;s Changel
      </button>
    </section>
  );
}

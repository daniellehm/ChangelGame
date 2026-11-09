import type { LoadErrorKind } from "@/lib/game/api-source";

const COPY: Record<LoadErrorKind, { title: string; body: string }> = {
  clock: {
    title: "Check your device clock",
    body: "Your device's date looks off, so this puzzle won't load. Fix the date and time, then try again.",
  },
  missing: {
    title: "No puzzle yet",
    body: "Today's Changel isn't ready. Check back soon.",
  },
  network: {
    title: "Can't reach Changel",
    body: "Check your connection and try again.",
  },
};

export function LoadError({ kind, onRetry }: { kind: LoadErrorKind; onRetry: () => void }) {
  const c = COPY[kind];
  return (
    <section id="loadError" className="card intro" role="alert">
      <div className="cat">Hmm</div>
      <h1>{c.title}</h1>
      <p>{c.body}</p>
      <button className="btn" id="retryBtn" type="button" onClick={onRetry}>
        Try again
      </button>
    </section>
  );
}

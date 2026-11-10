/** Browser-only analytics events (SPEC §11). Fire-and-forget: never blocks or breaks the game. */
export type TrackEvent = { name: "share_clicked"; props: { method: "share_sheet" | "clipboard" | "manual" } } | { name: "signup_prompt_shown"; props?: undefined };

export function track(date: string, e: TrackEvent): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: e.name, date, ...(e.props ? { props: e.props } : {}) }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* analytics must never break the game */
  }
}

/** Track an event at most once per key on this device (e.g. a prompt shown, per day). */
export function trackOnce(key: string, date: string, e: TrackEvent): void {
  try {
    const k = `changel:v1:tracked:${key}`;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, "1");
  } catch {
    /* storage blocked: still track */
  }
  track(date, e);
}

/**
 * Get a Cloudflare Turnstile token in the browser, only when the server asks for one
 * (a brand-new player). The script loads on demand, so returning players never fetch it.
 * The widget is invisible unless Cloudflare needs an interaction, then it shows a small
 * check at the bottom of the screen.
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
};

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi | null> | null = null;

function loadScript(): Promise<TurnstileApi | null> {
  loading ??= new Promise((resolve) => {
    const w = window as unknown as { turnstile?: TurnstileApi };
    if (w.turnstile) return resolve(w.turnstile);
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve(w.turnstile ?? null);
    s.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** A token, or null (no site key, script blocked, timed out). Never throws. */
export async function getTurnstileToken(timeoutMs = 15_000): Promise<string | null> {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!sitekey || typeof window === "undefined") return null;
  const api = await loadScript();
  if (!api) return null;
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.className = "turnstile-host";
    document.body.appendChild(host);
    let id = "";
    const done = (token: string | null) => {
      clearTimeout(timer);
      try {
        if (id) api.remove(id);
      } catch {
        /* already gone */
      }
      host.remove();
      resolve(token);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    try {
      id = api.render(host, {
        sitekey,
        appearance: "interaction-only",
        execution: "execute",
        callback: (t: string) => done(t),
        "error-callback": () => done(null),
        "expired-callback": () => done(null),
      });
      api.execute(id);
    } catch {
      done(null);
    }
  });
}

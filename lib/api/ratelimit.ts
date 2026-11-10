/**
 * Rate limits (SPEC §7) via Upstash Redis. If UPSTASH_REDIS_REST_URL/TOKEN
 * aren't set (local dev, tests), every check passes, so the limiter never
 * blocks development. Anonymous sign-ups are limited by Supabase itself, per
 * player IP (DECISIONS 2026-11-09).
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { apiError } from "./http";

export const LIMITS = {
  /** 30 guesses/min per player. */
  guess: { tokens: 30, window: "1 m" },
  /** 60 puzzle reads/min per IP (most reads are CDN hits and never reach this). */
  puzzle: { tokens: 60, window: "1 m" },
  /** Analytics events from the browser (a few per game). */
  events: { tokens: 30, window: "1 m" },
  /** One reveal per round, so 30/min per IP is generous. */
  reveal: { tokens: 30, window: "1 m" },
  /** Plays, syncs and stats are rare per player. */
  play: { tokens: 30, window: "1 m" },
  sync: { tokens: 10, window: "1 m" },
  me: { tokens: 30, window: "1 m" },
  /** Sign-in emails per IP (Supabase also limits emails project-wide). */
  authEmail: { tokens: 10, window: "10 m" },
  /** Code attempts per IP: blunts guessing a 6-digit code. */
  authVerify: { tokens: 10, window: "10 m" },
  /** Reports per player: at most one per question anyway. */
  report: { tokens: 20, window: "10 m" },
  /** New anonymous players per IP (Supabase also limits per IP; carriers share IPs, so not lower). */
  session: { tokens: 30, window: "60 m" },
  /** Account export / delete / merge per player: rare. */
  account: { tokens: 10, window: "10 m" },
  /** Share images per IP. Only cache misses reach the function; each new code costs a render. */
  og: { tokens: 60, window: "1 m" },
} as const;

export type LimitName = keyof typeof LIMITS;

let redis: Redis | null | undefined;
const limiters = new Map<LimitName, Ratelimit>();

function client(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

function limiter(name: LimitName): Ratelimit | null {
  const r = client();
  if (!r) return null;
  let l = limiters.get(name);
  if (!l) {
    const { tokens, window } = LIMITS[name];
    l = new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(tokens, window), prefix: `changel:rl:${name}`, analytics: false });
    limiters.set(name, l);
  }
  return l;
}

/**
 * Returns a 429 Response if `key` is over the limit for `name`, else null.
 * Fails open: if Redis is unreachable, the request is allowed (availability over strictness).
 */
/** What players see when a limit trips; `{s}` becomes the seconds until they can retry. */
const MESSAGES: Partial<Record<LimitName, string>> = {
  authEmail: "Too many sign-in emails from your network. Try again in {s} seconds.",
  authVerify: "Too many code attempts from your network. Try again in {s} seconds.",
};

export async function rateLimit(name: LimitName, key: string): Promise<Response | null> {
  const l = limiter(name);
  if (!l) return null;
  try {
    const { success, reset } = await l.limit(key);
    if (success) return null;
    const secs = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    const msg = (MESSAGES[name] ?? "Slow down a little and try again in {s} seconds.").replace("{s}", String(secs));
    const res = apiError("rate_limited", msg, 429);
    res.headers.set("Retry-After", String(secs));
    return res;
  } catch (e) {
    console.error(`rate limit ${name} failed open`, e);
    return null;
  }
}

/** Tests only: forget the cached client so env changes take effect. */
export function resetRateLimitClientForTests(): void {
  redis = undefined;
  limiters.clear();
}

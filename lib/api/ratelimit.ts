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
  /** One reveal per round, so 30/min per IP is generous. */
  reveal: { tokens: 30, window: "1 m" },
  /** Plays, syncs and stats are rare per player. */
  play: { tokens: 30, window: "1 m" },
  sync: { tokens: 10, window: "1 m" },
  me: { tokens: 30, window: "1 m" },
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
export async function rateLimit(name: LimitName, key: string): Promise<Response | null> {
  const l = limiter(name);
  if (!l) return null;
  try {
    const { success, reset } = await l.limit(key);
    if (success) return null;
    const res = apiError("rate_limited", "Slow down a little and try again.", 429);
    res.headers.set("Retry-After", String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))));
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

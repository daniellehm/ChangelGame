/**
 * Request-scoped Supabase client for route handlers. Reads the session from the
 * request's Cookie header and collects any cookies Supabase wants to set, so the
 * route can attach them to its response. No next/headers, so handlers stay
 * testable as plain (Request) => Response functions.
 */
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PendingCookie {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

/** Session cookies: HTTP-only (SPEC §5), Lax, Secure except on plain-http localhost. */
export function sessionCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 400 * 24 * 60 * 60,
  };
}

/** Best-effort end-user IP from proxy headers (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || null;
}

export interface RequestSupabase {
  client: SupabaseClient;
  /** Copy any cookies Supabase set (sign-in, token refresh, sign-out) onto the response. */
  applyCookies: <R extends Response>(res: R) => R;
}

/**
 * @param opts.secret  use the secret key (needed for Sb-Forwarded-For on sign-in). Auth calls only.
 */
export function supabaseForRequest(req: Request, opts: { secret?: boolean } = {}): RequestSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = opts.secret ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");

  const pending: PendingCookie[] = [];
  const ip = opts.secret ? clientIp(req) : null;
  const client = createServerClient(url, key, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => parseCookieHeader(req.headers.get("cookie") ?? "").map((c) => ({ name: c.name, value: c.value ?? "" })),
      setAll: (cookies) => {
        for (const c of cookies) pending.push({ name: c.name, value: c.value, options: c.options as Record<string, unknown> });
      },
    },
    // Rate-limit anonymous sign-ups per player, not per Vercel server (DECISIONS 2026-11-09).
    global: ip ? { headers: { "sb-forwarded-for": ip } } : undefined,
    auth: { detectSessionInUrl: false },
  });

  return {
    client,
    applyCookies(res) {
      for (const c of pending) {
        res.headers.append("Set-Cookie", serializeCookieHeader(c.name, c.value, { ...c.options, ...sessionCookieOptions(), maxAge: (c.options.maxAge as number | undefined) ?? sessionCookieOptions().maxAge }));
      }
      return res;
    },
  };
}

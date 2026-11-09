/**
 * POST /api/session { tz } → ensure the browser has a session (SPEC §5).
 * Called on the first Play click, never on page load, so bounces create no users.
 * Reuses an existing valid session; otherwise signs in anonymously on the server
 * (secret key + Sb-Forwarded-For, so Supabase rate-limits per player IP).
 * Turnstile verification slots in here in M6.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { TEST_CLOCK_HEADER, testClockEnabled } from "@/lib/api/clock";
import { isValidTimeZone } from "@/lib/dates";
import { adminClient } from "@/lib/supabase/admin";
import { supabaseForRequest } from "@/lib/supabase/request";

const Body = z.object({
  tz: z.string().max(64).refine(isValidTimeZone, "unknown time zone").optional(),
});

async function touchPlayer(id: string, tz: string | undefined) {
  const patch: Record<string, unknown> = { last_seen_at: new Date().toISOString() };
  if (tz) patch.tz = tz;
  const { error } = await adminClient().from("players").update(patch).eq("id", id);
  if (error) console.error("touchPlayer failed", error);
}

export async function POST(req: Request) {
  let json: unknown = {};
  try {
    const text = await req.text();
    json = text ? JSON.parse(text) : {};
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);
  const { tz } = parsed.data;

  // Existing session?
  const existing = await sessionUser(req);
  if (existing.user) {
    await touchPlayer(existing.user.id, tz);
    return existing.sb.applyCookies(Response.json({ user_id: existing.user.id, anonymous: existing.user.isAnonymous, created: false }, { headers: { "Cache-Control": "no-store" } }));
  }

  const sb = supabaseForRequest(req, { secret: true });
  // Test runs (test clock on, never in production) tag their users so cleanup can find them.
  const isTestRun = testClockEnabled() && req.headers.has(TEST_CLOCK_HEADER);
  const { data, error } = await sb.client.auth.signInAnonymously(isTestRun ? { options: { data: { e2e: true } } } : undefined);
  if (error || !data.user) {
    if (error?.status === 429 || error?.code === "over_request_rate_limit") {
      return apiError("rate_limited", "Too many new players from your network. Try again later.", 429);
    }
    if (error?.code === "anonymous_provider_disabled") {
      return apiError("signup_unavailable", "Playing without an account isn't switched on yet.", 503);
    }
    console.error("signInAnonymously failed", error);
    return apiError("internal_error", "Couldn't start a session.", 500);
  }
  await touchPlayer(data.user.id, tz);
  return sb.applyCookies(Response.json({ user_id: data.user.id, anonymous: true, created: true }, { headers: { "Cache-Control": "no-store" } }));
}

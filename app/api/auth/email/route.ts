/**
 * POST /api/auth/email { email } → send a sign-in email with a link and a
 * 6-digit code (SPEC §5, email-only per DECISIONS). The reply is always
 * { sent: true }; which flow applies is kept in an HTTP-only cookie, so the API
 * never reveals whether an email already has an account.
 *  - Anonymous player + new email   → upgrade in place: updateUser({ email }), same user id.
 *  - Anonymous player + known email → merge token for this anonymous id, then a sign-in code.
 *  - No session (new device)        → sign-in code (creates the account if new).
 *  - Signed-in account              → change email: updateUser({ email }).
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { skipEmailForTest } from "@/lib/api/clock";
import { rateLimit } from "@/lib/api/ratelimit";
import { MERGE_COOKIE, MERGE_TTL_S, setCookie, setFlow, type AuthFlow } from "@/lib/auth/cookies";
import { createMergeToken, emailRegistered } from "@/lib/auth/merge";
import { confirmUrl } from "@/lib/auth/origin";
import { clientIp } from "@/lib/supabase/request";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function POST(req: Request) {
  const limited = await rateLimit("authEmail", clientIp(req) ?? "unknown");
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);
  const { email } = parsed.data;
  const skipSend = skipEmailForTest(req);

  try {
    const { user, sb } = await sessionUser(req);
    const redirect = confirmUrl(req);
    let flow: AuthFlow;
    let mergeToken: string | null = null;

    if (user && !(await emailRegistered(email))) {
      // Upgrade in place (anonymous) or change email (permanent): same user id, nothing moves.
      flow = { email, type: "email_change" };
      if (!skipSend) {
        const { error } = await sb.client.auth.updateUser({ email }, { emailRedirectTo: redirect });
        if (error) throw error;
      }
    } else {
      // Existing account (or no session): sign in with a code. Anonymous history merges after.
      flow = { email, type: "email" };
      if (user?.isAnonymous) mergeToken = await createMergeToken(user.id);
      if (!skipSend) {
        const { error } = await sb.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: redirect } });
        if (error) throw error;
      }
    }

    const res = sb.applyCookies(Response.json({ sent: true }, { headers: { "Cache-Control": "no-store" } }));
    setFlow(res, flow);
    if (mergeToken) setCookie(res, MERGE_COOKIE, mergeToken, MERGE_TTL_S);
    return res;
  } catch (e) {
    const err = e as { status?: number; code?: string };
    if (err.status === 429 || err.code === "over_email_send_rate_limit") {
      return apiError("rate_limited", "Too many emails. Wait a minute and try again.", 429);
    }
    console.error("POST /api/auth/email failed", e);
    return apiError("email_failed", "Couldn't send the email. Try again in a moment.", 502);
  }
}

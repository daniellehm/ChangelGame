/**
 * POST /api/auth/verify { code } → check the 6-digit code from the email.
 * Sets the session cookie (players then stay signed in on this browser) and,
 * if this browser was an anonymous player signing into an existing account,
 * merges that history in (earlier-started play wins on clashes).
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { rateLimit } from "@/lib/api/ratelimit";
import { readFlow } from "@/lib/auth/cookies";
import { clearFlowCookies, mergePending } from "@/lib/auth/complete";
import { clientIp, supabaseForRequest } from "@/lib/supabase/request";

const Body = z.object({ code: z.string().trim().regex(/^\d{6,10}$/, "enter the code from the email") });

export async function POST(req: Request) {
  const limited = await rateLimit("authVerify", clientIp(req) ?? "unknown");
  if (limited) return limited;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);

  const flow = readFlow(req);
  if (!flow) return apiError("invalid_code", "That code has expired. Ask for a new one.", 400);

  const sb = supabaseForRequest(req);
  const { data, error } = await sb.client.auth.verifyOtp({ email: flow.email, token: parsed.data.code, type: flow.type });
  if (error || !data.user) return apiError("invalid_code", "That code didn't work. Check it, or ask for a new one.", 400);

  let merged = null;
  let mergeError = false;
  try {
    merged = await mergePending(req, data.user.id);
  } catch (e) {
    console.error("POST /api/auth/verify merge failed", e);
    mergeError = true;
  }
  const res = sb.applyCookies(Response.json({ ok: true, email: data.user.email, merged, mergeError }, { headers: { "Cache-Control": "no-store" } }));
  clearFlowCookies(res);
  return res;
}

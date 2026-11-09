/**
 * GET /auth/confirm?token_hash=…&type=email|email_change → the link in the
 * sign-in email. Verifies it, merges if this browser holds a merge token, then
 * goes to the account page. Works in any browser (no PKCE verifier needed).
 */
import { clearFlowCookies, mergePending } from "@/lib/auth/complete";
import { supabaseForRequest } from "@/lib/supabase/request";

const TYPES = new Set(["email", "email_change", "magiclink", "signup"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "email";
  const to = (path: string) => new URL(path, url.origin);

  if (!tokenHash || !TYPES.has(type)) return Response.redirect(to("/account?signin=invalid"), 303);

  const sb = supabaseForRequest(req);
  const { data, error } = await sb.client.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "email_change" });
  if (error || !data.user) return Response.redirect(to("/account?signin=expired"), 303);

  const res = new Response(null, { status: 303, headers: { Location: to("/account?signin=ok").toString(), "Cache-Control": "no-store" } });
  clearFlowCookies(res);
  try {
    await mergePending(req, data.user.id);
  } catch (e) {
    console.error("GET /auth/confirm merge failed", e);
  }
  return sb.applyCookies(res);
}

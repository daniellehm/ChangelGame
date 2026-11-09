/** POST /api/auth/signout → end the session on this browser (SPEC §5). The client also clears its local cache. */
import { supabaseForRequest } from "@/lib/supabase/request";
import { AUTH_FLOW_COOKIE, clearCookie, MERGE_COOKIE } from "@/lib/auth/cookies";

export async function POST(req: Request) {
  const sb = supabaseForRequest(req);
  await sb.client.auth.signOut({ scope: "local" });
  const res = sb.applyCookies(Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }));
  clearCookie(res, AUTH_FLOW_COOKIE);
  clearCookie(res, MERGE_COOKIE);
  return res;
}

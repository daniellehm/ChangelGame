/**
 * POST /api/account/delete { confirm: "DELETE" } → hard-delete the account and
 * all of its plays (SPEC §5). Deleting the auth user cascades to players,
 * plays, guesses and reports.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { AUTH_FLOW_COOKIE, clearCookie, MERGE_COOKIE } from "@/lib/auth/cookies";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({ confirm: z.literal("DELETE") });

export async function POST(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Sign in first.", 401);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);

  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("account delete failed", error);
    return apiError("internal_error", "Couldn't delete the account. Try again.", 500);
  }
  await sb.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  const res = sb.applyCookies(Response.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } }));
  clearCookie(res, AUTH_FLOW_COOKIE);
  clearCookie(res, MERGE_COOKIE);
  return res;
}

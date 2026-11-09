/**
 * POST /api/merge → merge the anonymous history named by this browser's merge
 * token into the signed-in account (SPEC §7). Normally done automatically by
 * /api/auth/verify and /auth/confirm; this is the explicit retry.
 */
import { apiError } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { clearCookie, MERGE_COOKIE, readCookie } from "@/lib/auth/cookies";
import { consumeMergeToken, mergeInto } from "@/lib/auth/merge";

export async function POST(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user || user.isAnonymous) return apiError("unauthorized", "Sign in first.", 401);
  const token = readCookie(req, MERGE_COOKIE);
  if (!token) return apiError("invalid_request", "Nothing to merge.", 400);
  const anonId = await consumeMergeToken(token);
  if (!anonId) return apiError("invalid_request", "That merge link has expired.", 410);
  const result = await mergeInto(anonId, user.id);
  const res = sb.applyCookies(Response.json(result, { headers: { "Cache-Control": "no-store" } }));
  clearCookie(res, MERGE_COOKIE);
  return res;
}

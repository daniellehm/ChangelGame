/** Session lookup for route handlers. */
import { supabaseForRequest, type RequestSupabase } from "../supabase/request";

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
}

/**
 * The signed-in user (anonymous or permanent), verified from the session JWT,
 * or null. Returns the request client too, because a token refresh sets new
 * cookies the caller must pass on with applyCookies().
 */
export async function sessionUser(req: Request): Promise<{ user: SessionUser | null; sb: RequestSupabase }> {
  const sb = supabaseForRequest(req);
  const { data, error } = await sb.client.auth.getClaims();
  if (error || !data?.claims?.sub) return { user: null, sb };
  return { user: { id: data.claims.sub, isAnonymous: data.claims.is_anonymous === true }, sb };
}

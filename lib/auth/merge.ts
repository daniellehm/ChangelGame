/**
 * Merge tokens + anonymous → account merge (SPEC §5). The anonymous user id is
 * bound to a single-use, 15-minute token whose SHA-256 is stored server-side.
 */
import { createHash, randomBytes } from "node:crypto";
import { adminClient } from "../supabase/admin";
import { MERGE_TTL_S } from "./cookies";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createMergeToken(anonUserId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await adminClient()
    .from("merge_tokens")
    .insert({ token_hash: sha256(token), anon_user_id: anonUserId, expires_at: new Date(Date.now() + MERGE_TTL_S * 1000).toISOString() });
  if (error) throw error;
  return token;
}

/** Mark the token used and return its anonymous user id, or null if invalid/expired/used. */
export async function consumeMergeToken(token: string): Promise<string | null> {
  const { data, error } = await adminClient()
    .from("merge_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", sha256(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("anon_user_id")
    .maybeSingle();
  if (error) throw error;
  return data?.anon_user_id ?? null;
}

export interface MergeResult {
  merged: number;
  kept: number;
  replaced: number;
}

/**
 * Move `anonId`'s plays into `targetId` (earlier-started wins on clashes), then
 * delete the anonymous auth user. Refuses to delete a non-anonymous user.
 */
export async function mergeInto(anonId: string, targetId: string): Promise<MergeResult> {
  if (anonId === targetId) return { merged: 0, kept: 0, replaced: 0 };
  const db = adminClient();
  const { data: anon, error: e1 } = await db.auth.admin.getUserById(anonId);
  if (e1 || !anon.user) return { merged: 0, kept: 0, replaced: 0 }; // already gone
  if (!anon.user.is_anonymous) throw new Error("refusing to merge from a permanent account");

  const { data, error } = await db.rpc("merge_players", { p_from: anonId, p_to: targetId });
  if (error) throw error;
  const { error: e2 } = await db.auth.admin.deleteUser(anonId);
  if (e2) console.error("deleting merged anonymous user failed", e2);
  return data as MergeResult;
}

export async function emailRegistered(email: string): Promise<boolean> {
  const { data, error } = await adminClient().rpc("email_registered", { p_email: email });
  if (error) throw error;
  return data === true;
}

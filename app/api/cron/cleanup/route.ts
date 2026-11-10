/**
 * GET /api/cron/cleanup (Vercel Cron, nightly) → purge stale anonymous users
 * (SPEC §5 housekeeping): no plays after 7 days, or inactive for 400 days.
 * Deleting the auth user cascades to players/plays/guesses. Also drops expired
 * merge tokens. Permanent accounts are never touched.
 * First, it writes daily_metrics for finished days (M6 6.4), so purged players' games still count,
 * and drops raw visits/events past retention.
 */
import { apiError } from "@/lib/api/http";
import { isCronAuthorized } from "@/lib/api/cron";
import { serverNow } from "@/lib/api/clock";
import { adminClient } from "@/lib/supabase/admin";
import { pruneAnalytics, writeDailyMetrics } from "@/lib/analytics/metrics";

const BATCH = 500;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return apiError("unauthorized", "Cron secret required.", 401);
  const now = new Date(serverNow(req)).toISOString();
  const db = adminClient();

  let metrics: string[] | string = [];
  let pruned = { visits: 0, events: 0 };
  try {
    metrics = await writeDailyMetrics(new Date(now));
    pruned = await pruneAnalytics(new Date(now));
  } catch (e) {
    // Never block the cleanup on analytics; the next night fills the gap.
    console.error("daily metrics failed", e);
    metrics = `failed: ${(e as Error).message}`;
  }

  const { data, error } = await db.rpc("cleanup_candidates", { p_now: now, p_limit: BATCH });
  if (error) {
    console.error("cleanup_candidates failed", error);
    return apiError("internal_error", "Cleanup failed.", 500);
  }
  const candidates = (data ?? []) as Array<{ user_id: string; reason: string }>;
  const deleted: Record<string, number> = {};
  let failed = 0;
  for (const c of candidates) {
    const { error: e } = await db.auth.admin.deleteUser(c.user_id);
    if (e) failed++;
    else deleted[c.reason] = (deleted[c.reason] ?? 0) + 1;
  }

  const { count: tokens } = await db
    .from("merge_tokens")
    .delete({ count: "exact" })
    .lt("expires_at", new Date(Date.parse(now) - 86_400_000).toISOString());

  const summary = { at: now, deleted, failed, more: candidates.length === BATCH, merge_tokens_removed: tokens ?? 0, metrics, analytics_pruned: pruned };
  console.log("cron cleanup", JSON.stringify(summary));
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}

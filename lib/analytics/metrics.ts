/**
 * daily_metrics (SPEC §8): one row per finished puzzle day, so the Analytics page loads fast.
 * Written by the nightly cleanup cron, before old anonymous players are purged.
 */
import { addDays } from "../dates";
import { adminClient } from "../supabase/admin";

export const METRICS = {
  /** Fill in any missing day this far back. */
  BACKFILL_DAYS: 14,
  /** Raw visits and events older than this are deleted (the daily rows stay). */
  RETAIN_DAYS: 400,
} as const;

/** The latest puzzle date whose window has closed everywhere (D closes at D+1 12:00 UTC). */
export function latestClosedDate(now: Date): string {
  const utcToday = now.toISOString().slice(0, 10);
  return now.getUTCHours() >= 12 ? addDays(utcToday, -1) : addDays(utcToday, -2);
}

/** Compute and store finished days that have no row yet (plus the latest finished day). Returns the dates written. */
export async function writeDailyMetrics(now: Date): Promise<string[]> {
  const db = adminClient();
  const last = latestClosedDate(now);
  const first = addDays(last, -(METRICS.BACKFILL_DAYS - 1));
  const { data: have, error } = await db.from("daily_metrics").select("puzzle_date").gte("puzzle_date", first).lte("puzzle_date", last);
  if (error) throw error;
  const done = new Set((have ?? []).map((r) => r.puzzle_date as string));
  const dates: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) if (!done.has(d) || d === last) dates.push(d);
  for (const d of dates) {
    const { data: metrics, error: e1 } = await db.rpc("compute_daily_metrics", { p_date: d });
    if (e1) throw e1;
    const { error: e2 } = await db.from("daily_metrics").upsert({ puzzle_date: d, metrics, computed_at: now.toISOString() });
    if (e2) throw e2;
  }
  return dates;
}

/** Drop raw analytics rows past retention. Returns how many went. */
export async function pruneAnalytics(now: Date): Promise<{ visits: number; events: number }> {
  const db = adminClient();
  const cutoffDate = addDays(now.toISOString().slice(0, 10), -METRICS.RETAIN_DAYS);
  const { count: visits } = await db.from("visits").delete({ count: "exact" }).lt("puzzle_date", cutoffDate);
  const { count: events } = await db.from("events").delete({ count: "exact" }).lt("created_at", `${cutoffDate}T00:00:00Z`);
  return { visits: visits ?? 0, events: events ?? 0 };
}

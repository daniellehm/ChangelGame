/** Admin home data (M5 task 5.7): queue badges, buffer, last runs, spend, alerts. Server only. */
import { CONTENT } from "../config";
import { addDays } from "../dates";
import { monthStartUtc } from "../content/ledger";
import { schedulingToday } from "../content/run";
import { adminClient } from "../supabase/admin";
import { computeAlerts, consecutiveReadyDays, type Alert, type RunSummary } from "./alerts";

export interface Overview {
  today: string;
  queues: { reports: number; flagged: number; upcoming: number };
  readyDaysAhead: number;
  reserve: number;
  lastRun: (RunSummary & { id: number; finished_at: string | null; generated: number; scheduled: number; hops: number }) | null;
  spend: { month: number; cap: number };
  alerts: Alert[];
}

/** Questions waiting in the Reports queue. Wired up in M5 task 5.9 (report button). */
export type ReportQueueCounter = () => Promise<number>;

export async function getOverview(reportQueueCount: ReportQueueCounter = async () => 0, now = new Date()): Promise<Overview> {
  const db = adminClient();
  const today = schedulingToday(now);
  const horizon = addDays(today, 60);
  const [ready, flagged, reserve, runs, spend, reports] = await Promise.all([
    db.from("puzzles").select("puzzle_date").eq("status", "ready").gte("puzzle_date", today).lte("puzzle_date", horizon),
    db.from("questions").select("id", { count: "exact", head: true }).eq("status", "flagged"),
    db.from("questions").select("id", { count: "exact", head: true }).eq("status", "verified"),
    db.from("content_runs").select("id, status, trigger, verified, flagged, generated, scheduled, hops, started_at, finished_at, error").neq("trigger", "test").order("started_at", { ascending: false }).limit(5),
    db.rpc("llm_spend_since", { p_since: monthStartUtc(now).toISOString() }),
    reportQueueCount(),
  ]);
  for (const r of [ready, flagged, reserve, runs, spend]) if (r.error) throw r.error;

  const readySet = new Set((ready.data ?? []).map((r) => r.puzzle_date as string));
  const readyDaysAhead = consecutiveReadyDays(today, readySet, addDays);
  const upcoming = [...readySet].filter((d) => d <= addDays(today, 29)).length;
  const runRows = (runs.data ?? []) as Overview["lastRun"][];
  const nightly = runRows.filter((r) => r!.trigger === "cron") as RunSummary[];
  const month = Number(spend.data ?? 0);

  return {
    today,
    queues: { reports, flagged: flagged.count ?? 0, upcoming },
    readyDaysAhead,
    reserve: reserve.count ?? 0,
    lastRun: runRows[0] ?? null,
    spend: { month, cap: CONTENT.MONTHLY_CAP_USD },
    alerts: computeAlerts({ readyDaysAhead, nightly, capReached: month >= CONTENT.MONTHLY_CAP_USD }),
  };
}

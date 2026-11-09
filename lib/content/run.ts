/**
 * One hop of the nightly content run (M5 task 5.6), with its bookkeeping in
 * content_runs: find or start tonight's run, take the lease (so two hops never
 * overlap), run a time-boxed hop, add up the counters, release the lease, and
 * say whether another hop should follow.
 */
import { localDate } from "../dates";
import { adminClient } from "../supabase/admin";
import { dbLedger } from "./ledger";
import { ClaudeLlm, sdkParse, type Llm } from "./llm";
import { runHop, type HopResult } from "./pipeline";
import type { FetchLike } from "./sources";
import { dbStore, type Store } from "./store";
import { getOverview } from "../admin/overview";
import { sendRiskAlerts } from "../admin/notify";
import { reportQueueCount } from "./reports";

export const RUN = {
  /** Work budget per hop; the function itself may run 300 s. */
  HOP_MS: 240_000,
  /** Lease a little longer than a hop can take. */
  LEASE_S: 330,
  /** Safety stop for a night's chain of hops. */
  MAX_HOPS: 40,
  /** A run still 'running' after this long is treated as dead and a new one starts. */
  STALE_MS: 20 * 3_600_000,
} as const;

/** The puzzle date that goes live first anywhere (UTC+14): scheduling counts days from here. */
export const schedulingToday = (now = new Date()) => localDate(now, "Pacific/Kiritimati");

export type Trigger = "cron" | "manual" | "test";

export interface RunOutcome {
  status: "busy" | "done" | "capped" | "continue" | "failed";
  runId: number | null;
  hop?: Omit<HopResult, "log">;
}

export interface RunDeps {
  store?: Store;
  llm?: Llm;
  fetchFn?: FetchLike;
  now?: () => number;
  today?: string;
}

type RunRow = { id: number; status: string; hops: number; started_at: string; generated: number; verified: number; flagged: number; scheduled: number; log: unknown };

async function findOrStart(trigger: Trigger, runId: number | null, nowMs: number): Promise<RunRow> {
  const db = adminClient();
  const cols = "id, status, hops, started_at, generated, verified, flagged, scheduled, log";
  if (runId) {
    const { data, error } = await db.from("content_runs").select(cols).eq("id", runId).single();
    if (error) throw error;
    return data as RunRow;
  }
  const { data: open, error } = await db
    .from("content_runs")
    .select(cols)
    .eq("status", "running")
    .gte("started_at", new Date(nowMs - RUN.STALE_MS).toISOString())
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (open?.length) return open[0] as RunRow;
  // Older 'running' rows are dead (a crashed chain): close them.
  await db.from("content_runs").update({ status: "failed", error: "abandoned: no hop finished it", finished_at: new Date(nowMs).toISOString() }).eq("status", "running");
  const { data: created, error: e2 } = await db.from("content_runs").insert({ trigger }).select(cols).single();
  if (e2) throw e2;
  return created as RunRow;
}

/** Run one hop of tonight's content run. Never throws for pipeline errors: they're recorded on the run. */
export async function runContentHop(trigger: Trigger, runId: number | null = null, deps: RunDeps = {}): Promise<RunOutcome> {
  const db = adminClient();
  const now = deps.now ?? Date.now;
  const start = now();
  const run = await findOrStart(trigger, runId, start);
  if (run.status !== "running") return { status: run.status === "capped" ? "capped" : "done", runId: run.id };

  const { data: leased, error } = await db.rpc("lease_content_run", { p_run_id: run.id, p_seconds: RUN.LEASE_S });
  if (error) throw error;
  if (!leased) return { status: "busy", runId: run.id };

  const finish = async (patch: Record<string, unknown>) => {
    const { error: e } = await db.from("content_runs").update({ ...patch, lease_until: null }).eq("id", run.id);
    if (e) console.error("content_runs update failed", e);
  };

  if (run.hops + 1 > RUN.MAX_HOPS) {
    await finish({ status: "failed", error: `stopped after ${RUN.MAX_HOPS} hops`, finished_at: new Date(now()).toISOString() });
    return { status: "failed", runId: run.id };
  }

  try {
    const hop = await runHop({
      store: deps.store ?? dbStore(),
      llm: deps.llm ?? new ClaudeLlm(sdkParse(), dbLedger()),
      runId: run.id,
      fetchFn: deps.fetchFn,
      today: deps.today ?? schedulingToday(new Date(start)),
      now,
      deadline: start + RUN.HOP_MS,
      alreadyGenerated: run.generated,
    });
    const log = [...(Array.isArray(run.log) ? (run.log as string[]) : []), ...hop.log.map((l) => `hop ${run.hops + 1}: ${l}`)].slice(-200);
    const status = hop.capped ? "capped" : hop.done ? "done" : "running";
    await finish({
      status,
      generated: run.generated + hop.generated,
      verified: run.verified + hop.verified,
      flagged: run.flagged + hop.flagged,
      scheduled: run.scheduled + hop.scheduled,
      log,
      ...(status === "running" ? {} : { finished_at: new Date(now()).toISOString() }),
    });
    const { log: _omit, ...counts } = hop;
    void _omit;
    if (status !== "running" && trigger !== "test") await emailRiskAlerts();
    return { status: status === "running" ? "continue" : status, runId: run.id, hop: counts };
  } catch (e) {
    console.error("content hop failed", e);
    await finish({ status: "failed", error: (e as Error).message?.slice(0, 1000) ?? String(e), finished_at: new Date(now()).toISOString() });
    if (trigger !== "test") await emailRiskAlerts();
    return { status: "failed", runId: run.id };
  }
}

/** After a run ends: email the game-at-risk alerts (fewer than 7 ready days, two failed nights). */
async function emailRiskAlerts(): Promise<void> {
  try {
    await sendRiskAlerts((await getOverview(reportQueueCount)).alerts);
  } catch (e) {
    console.error("risk alert emails failed", e);
  }
}

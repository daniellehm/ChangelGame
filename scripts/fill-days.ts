/**
 * One-off: fill specific empty days (inside the nightly job's 7-day lead) with the real
 * pipeline: same generator, checks, scheduling rules and $50/month cap. Only the listed
 * days count as open; every other date looks "ready" to the scheduler.
 *   npm run content:fill-days -- 2026-11-13 2026-11-16      (inclusive range)
 * Spends real money (logged in llm_calls and as a 'manual' content run).
 */
import { addDays, daysBetween } from "../lib/dates";
import { dbLedger } from "../lib/content/ledger";
import { ClaudeLlm, sdkParse } from "../lib/content/llm";
import { runHop } from "../lib/content/pipeline";
import { SCHEDULE } from "../lib/content/schedule";
import { dbStore, type Store } from "../lib/content/store";
import { adminClient } from "../lib/supabase/admin";

async function main() {
  const [first, last = first] = process.argv.slice(2);
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first) || !/^\d{4}-\d{2}-\d{2}$/.test(last!)) throw new Error("usage: fill-days FIRST [LAST]");
  const targets = new Set(Array.from({ length: daysBetween(first, last!) + 1 }, (_, i) => addDays(first, i)));
  const base = dbStore();
  const real = await base.readyDates(first, last!);
  const open = [...targets].filter((d) => !real.has(d));
  console.log(`open target days: ${open.join(", ") || "none"}`);
  if (!open.length) return;

  // Pretend "today" is 7 days before the first target, so the targets sit at the start of the window.
  const today = addDays(first, -SCHEDULE.MIN_LEAD_DAYS);
  const store: Store = {
    ...base,
    markUsed: async () => 0,
    async readyDates(from, to) {
      const out = await base.readyDates(from, to);
      for (let d = from; d <= to; d = addDays(d, 1)) if (!open.includes(d)) out.add(d);
      return out;
    },
  };

  const db = adminClient();
  const { data: run, error } = await db.from("content_runs").insert({ trigger: "manual" }).select("id").single();
  if (error) throw error;
  const llm = new ClaudeLlm(sdkParse(), dbLedger());
  const spentBefore = await dbLedger().monthSpendUsd();
  const totals = { generated: 0, verified: 0, flagged: 0, scheduled: 0 };
  const log: string[] = [`fill-days ${open.join(", ")}`];
  let status = "running";
  for (let hop = 1; hop <= 12 && status === "running"; hop++) {
    const r = await runHop({ store, llm, runId: run.id, today, deadline: Date.now() + 240_000, log: (l) => console.log(`hop ${hop}: ${l}`), alreadyGenerated: totals.generated });
    for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += r[k];
    log.push(...r.log.map((l) => `hop ${hop}: ${l}`));
    console.log(`hop ${hop}:`, { ...totals, done: r.done, capped: r.capped }, `spent $${((await dbLedger().monthSpendUsd()) - spentBefore).toFixed(2)}`);
    if (r.capped) status = "capped";
    else if (r.done) status = "done";
  }
  if (status === "running") status = "failed";
  await db.from("content_runs").update({ status, ...totals, log: log.slice(-200), finished_at: new Date().toISOString(), ...(status === "failed" ? { error: "fill-days: stopped after 12 hops" } : {}) }).eq("id", run.id);
  const filled = await base.readyDates(first, last!);
  console.log(`status ${status}; filled ${open.filter((d) => filled.has(d)).join(", ") || "none"}; still empty ${open.filter((d) => !filled.has(d)).join(", ") || "none"}`);
  console.log(`spent this run: $${((await dbLedger().monthSpendUsd()) - spentBefore).toFixed(2)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

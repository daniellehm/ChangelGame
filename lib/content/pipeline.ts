/**
 * Nightly content pipeline (SPEC §8, M5 task 5.6). One call = one time-boxed hop.
 * All state lives in the database, so a hop can stop anywhere (deadline, crash,
 * spend cap) and the next hop or next night carries on.
 *
 * A hop:
 *  1. marks past scheduled questions 'used';
 *  2. schedules open days from the verified pool;
 *  3. checks pending drafts (batches of 5);
 *  4. generates new candidates while more are needed (data-backed + researched batches);
 *  5. repeats 3–4 while time remains, then schedules again.
 * Returns whether the night's work is finished.
 */
import { addDays } from "../dates";
import { checkBatch, flagReason } from "./checks";
import { generateDataBacked, generateResearchedBatch, proposeMaxChange, unusedEntries, type Candidate, type KindsHint } from "./generate";
import { LlmUnusable, SpendCapReached, type Llm } from "./llm";
import { candidatesNeeded, isBigMover, isTrap, planSchedule, SCHEDULE } from "./schedule";
import type { FetchLike } from "./sources";
import type { Store } from "./store";

/** Categories researched questions are spread across (global topics). */
export const RESEARCH_CATEGORIES = [
  "People", "Money", "Tech", "Internet", "Energy", "Climate", "Nature", "Health", "Space", "Sport", "Travel", "Food",
  "Culture", "Business", "Science", "Transport", "Music", "Movies", "Games", "Buildings", "Animals", "Streaming",
] as const;

const RESEARCH_BATCH = 5;
const CHECK_BATCH = 5;
/** Most candidates one night's run may generate (a cold start needs about 190). */
export const MAX_GENERATED_PER_RUN = 220;
/** Don't start a step that might not finish before the deadline. */
const NEED_MS = { check: 100_000, research: 150_000, data: 40_000 } as const;

export interface HopDeps {
  store: Store;
  llm: Llm;
  runId?: number | null;
  fetchFn?: FetchLike;
  /** Today's date (YYYY-MM-DD) for scheduling. */
  today: string;
  now?: () => number;
  deadline: number;
  rand?: () => number;
  log?: (line: string) => void;
  /** Candidates earlier hops of this run already generated (for MAX_GENERATED_PER_RUN). */
  alreadyGenerated?: number;
}

export interface HopResult {
  done: boolean;
  capped: boolean;
  generated: number;
  verified: number;
  flagged: number;
  scheduled: number;
  usedMarked: number;
  log: string[];
}

/** The least-used categories first, so new questions spread across topics. */
export function pickCategories(counts: Map<string, number>, n: number, rand: () => number): string[] {
  return [...RESEARCH_CATEGORIES]
    .map((c) => ({ c, k: (counts.get(c.toLowerCase()) ?? 0) + rand() * 0.5 }))
    .sort((a, b) => a.k - b.k)
    .slice(0, n)
    .map((x) => x.c);
}

export async function runHop(d: HopDeps): Promise<HopResult> {
  const now = d.now ?? Date.now;
  const rand = d.rand ?? Math.random;
  const out: HopResult = { done: false, capped: false, generated: 0, verified: 0, flagged: 0, scheduled: 0, usedMarked: 0, log: [] };
  const log = (s: string) => {
    out.log.push(s);
    d.log?.(s);
  };
  const left = () => d.deadline - now();

  const schedule = async () => {
    const ready = await d.store.readyDates(addDays(d.today, SCHEDULE.MIN_LEAD_DAYS), addDays(d.today, SCHEDULE.HORIZON_DAYS));
    const { plans } = planSchedule(d.today, ready, await d.store.pool());
    for (const p of plans) {
      const r = await d.store.schedule(p.date, p.questionIds);
      if (r === "ok") {
        out.scheduled++;
        if (p.relaxed) log(`${p.date}: scheduled with relaxed balance rules (no trap or big mover available)`);
      } else log(`${p.date}: schedule ${r}`);
    }
  };

  /** What the remaining open days need after scheduling what the pool can fill. */
  let kindsHint: KindsHint = { traps: 0, movers: 0 };
  /** How many more candidates tonight still needs, counting drafts already waiting. */
  const need = async () => {
    const ready = await d.store.readyDates(addDays(d.today, SCHEDULE.MIN_LEAD_DAYS), addDays(d.today, SCHEDULE.HORIZON_DAYS));
    const pool = await d.store.pool();
    // Simulate scheduling: days the pool can't fill (too few questions, or no trap / big mover) still need candidates.
    const { plans, shortDays } = planSchedule(d.today, ready, pool);
    const left = pool.length - plans.length * SCHEDULE.PER_DAY;
    const byCount = candidatesNeeded(shortDays.length, left);
    const remaining = pool.filter((q) => !plans.some((p) => p.questionIds.includes(q.id)));
    kindsHint = {
      traps: remaining.some(isTrap) ? 0 : Math.min(RESEARCH_BATCH, shortDays.length),
      movers: remaining.some(isBigMover) ? 0 : Math.min(RESEARCH_BATCH, shortDays.length),
    };
    // Enough questions but the days still can't be filled (missing a kind, or not 5 different
    // categories left): ask for a few more, of the missing kind if that's the reason.
    // MAX_GENERATED_PER_RUN stops this if a day turns out impossible to fill.
    const byShortfall = shortDays.length ? Math.max(kindsHint.traps + kindsHint.movers, Math.min(2 * RESEARCH_BATCH, 2 * shortDays.length)) : 0;
    return Math.max(0, Math.max(byCount, byShortfall) - (await d.store.countPending()));
  };

  const checkPending = async () => {
    while (left() > NEED_MS.check) {
      const batch = await d.store.pendingDrafts(CHECK_BATCH);
      if (!batch.length) return;
      const reports = await checkBatch(batch, { llm: d.llm, runId: d.runId, fetchFn: d.fetchFn, similarPrompts: d.store.similarPrompts, seriesUsed: d.store.seriesUsed });
      for (let i = 0; i < batch.length; i++) {
        const r = reports[i]!;
        await d.store.saveChecks(batch[i]!.id, r, flagReason(r));
        if (r.passed) out.verified++;
        else {
          out.flagged++;
          log(`flagged #${batch[i]!.id} "${batch[i]!.candidate.prompt}": ${flagReason(r)?.slice(0, 160)}`);
        }
      }
    }
  };

  const addCandidate = async (c: Candidate) => {
    try {
      c.max_change = await proposeMaxChange(c, { llm: d.llm, runId: d.runId });
    } catch (e) {
      if (e instanceof SpendCapReached) throw e;
      c.max_change = null; // the range check will flag it
    }
    await d.store.insertDraft(c);
    out.generated++;
  };

  const generate = async (wanted: number) => {
    // A data-backed question first while unused series remain (cheap: wording + range only).
    const unused = unusedEntries(await d.store.usedSeriesKeys());
    if (unused.length && left() > NEED_MS.data) {
      const entry = unused[Math.floor(rand() * unused.length)]!;
      try {
        const c = await generateDataBacked(entry, { llm: d.llm, runId: d.runId, fetchFn: d.fetchFn, rand });
        if (c) await addCandidate(c);
        else log(`${entry.id}: no usable years in the series`);
      } catch (e) {
        if (e instanceof SpendCapReached) throw e;
        log(`data-backed ${entry.id} failed: ${(e as Error).message}`);
      }
      wanted--;
    }
    if (wanted > 0 && left() > NEED_MS.research) {
      const count = Math.min(RESEARCH_BATCH, wanted);
      try {
        const batch = await generateResearchedBatch({
          llm: d.llm,
          runId: d.runId,
          count,
          categories: pickCategories(await d.store.categoryCounts(), count, rand),
          avoid: await d.store.recentPrompts(300),
          kinds: kindsHint,
        });
        for (const c of batch) await addCandidate(c);
      } catch (e) {
        if (e instanceof SpendCapReached) throw e;
        log(`researched batch failed: ${e instanceof LlmUnusable ? e.message : (e as Error).message}`);
      }
    }
  };

  try {
    out.usedMarked = await d.store.markUsed(d.today);
    await schedule();
    for (let guard = 0; guard < 50; guard++) {
      await checkPending(); // runs until nothing is pending or time is short
      const pending = await d.store.countPending();
      const wanted = await need();
      if (wanted === 0 && pending === 0) {
        out.done = true;
        break;
      }
      if (pending > 0 || wanted === 0 || left() < NEED_MS.data) break; // out of time for this hop
      if ((d.alreadyGenerated ?? 0) + out.generated >= MAX_GENERATED_PER_RUN) {
        log(`stopped generating: ${MAX_GENERATED_PER_RUN} candidates is tonight's limit`);
        out.done = true;
        break;
      }
      const before = out.generated;
      await generate(wanted);
      // Nothing new could be made (time, sources down, Claude unusable): the next hop or night retries.
      if (out.generated === before) break;
    }
    await schedule();
  } catch (e) {
    if (!(e instanceof SpendCapReached)) throw e;
    out.capped = true;
    log(e.message);
    await schedule().catch(() => undefined);
  }
  return out;
}

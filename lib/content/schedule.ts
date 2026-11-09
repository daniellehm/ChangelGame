/**
 * Scheduler (SPEC §8 "Schedule" + balance rules, M5 task 5.5). Pure: given the
 * calendar and the pool of verified, unscheduled questions, decide which 5
 * questions each open day gets. The cron writes the result with schedule_puzzle().
 *
 * Rules:
 *  - Only days from `today + MIN_LEAD_DAYS` to `today + HORIZON_DAYS` (the 7-day rule).
 *  - Keep at least RESERVE verified questions unscheduled, for same-day swaps.
 *  - Per day: 5 different categories; at least one trap (|log10 change| < 0.1);
 *    at least one big mover (beyond ×10 or ÷10); at most 2 data-backed questions.
 *    No regional rule (Dani: global, no country bias).
 *  - A day that can't meet the trap / big-mover rules stays empty while it's far
 *    off (more candidates come tomorrow); from RELAX_WITHIN_DAYS out it takes the
 *    best day it can (distinct categories always hold) rather than go empty.
 *  - Oldest verified questions first, so nothing sits in the pool for ever.
 */
import { addDays } from "../dates";

export const SCHEDULE = {
  MIN_LEAD_DAYS: 7,
  HORIZON_DAYS: 30,
  RESERVE: 10,
  PER_DAY: 5,
  TRAP_MAX_LOG: 0.1,
  BIG_MOVER_MIN_LOG: 1,
  MAX_DATA_PER_DAY: 2,
  /** From this many days out, relax the trap / big-mover rules rather than leave the day empty. */
  RELAX_WITHIN_DAYS: 9,
} as const;

export interface PoolQuestion {
  id: number;
  category: string;
  start_value: number;
  end_value: number;
  origin: string;
  /** When it was verified (or created): older first. */
  verified_at: string;
}

export interface DayPlan {
  date: string;
  questionIds: number[];
  /** True when the trap / big-mover rules had to be relaxed. */
  relaxed: boolean;
}

export const changeLog = (q: Pick<PoolQuestion, "start_value" | "end_value">) => Math.abs(Math.log10(q.end_value / q.start_value));
export const isTrap = (q: PoolQuestion) => changeLog(q) < SCHEDULE.TRAP_MAX_LOG;
export const isBigMover = (q: PoolQuestion) => changeLog(q) > SCHEDULE.BIG_MOVER_MIN_LOG;

/** Days in the scheduling window without a ready puzzle. */
export function openDays(today: string, readyDates: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let d = SCHEDULE.MIN_LEAD_DAYS; d <= SCHEDULE.HORIZON_DAYS; d++) {
    const date = addDays(today, d);
    if (!readyDates.has(date)) out.push(date);
  }
  return out;
}

/** Pick 5 for one day from the (oldest-first) pool, or null if the rules can't be met. */
export function pickDay(pool: readonly PoolQuestion[], strict: boolean): { ids: number[]; relaxed: boolean } | null {
  const chosen: PoolQuestion[] = [];
  const cats = new Set<string>();
  const data = () => chosen.filter((q) => q.origin === "data").length;
  const fits = (q: PoolQuestion) => !cats.has(q.category.toLowerCase()) && (q.origin !== "data" || data() < SCHEDULE.MAX_DATA_PER_DAY);
  const take = (q: PoolQuestion) => {
    chosen.push(q);
    cats.add(q.category.toLowerCase());
  };

  // Seed the day with its required kinds first, then fill oldest-first.
  const trap = pool.find(isTrap);
  if (trap) take(trap);
  const mover = pool.find((q) => isBigMover(q) && !chosen.includes(q) && fits(q));
  if (mover) take(mover);
  for (const q of pool) {
    if (chosen.length >= SCHEDULE.PER_DAY) break;
    if (!chosen.includes(q) && fits(q)) take(q);
  }
  if (chosen.length < SCHEDULE.PER_DAY) return null;
  const complete = chosen.some(isTrap) && chosen.some(isBigMover);
  if (!complete && strict) return null;
  return { ids: shuffleDay(chosen).map((q) => q.id), relaxed: !complete };
}

/** Deterministic round order (by id hash) so the trap isn't always round 1. */
function shuffleDay(qs: PoolQuestion[]): PoolQuestion[] {
  const h = (n: number) => ((n * 2654435761) >>> 0) % 1000;
  return [...qs].sort((a, b) => h(a.id) - h(b.id));
}

/**
 * Plan every open day in the window, nearest first, keeping the reserve.
 * Returns the plans and how many more candidates of each kind would help.
 */
export function planSchedule(today: string, readyDates: ReadonlySet<string>, pool: readonly PoolQuestion[]): { plans: DayPlan[]; shortDays: string[] } {
  let remaining = [...pool].sort((a, b) => a.verified_at.localeCompare(b.verified_at) || a.id - b.id);
  const plans: DayPlan[] = [];
  const shortDays: string[] = [];
  for (const date of openDays(today, readyDates)) {
    if (remaining.length - SCHEDULE.PER_DAY < SCHEDULE.RESERVE) {
      shortDays.push(date);
      continue;
    }
    const lead = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const pick = pickDay(remaining, lead > SCHEDULE.RELAX_WITHIN_DAYS);
    if (!pick) {
      shortDays.push(date);
      continue;
    }
    plans.push({ date, questionIds: pick.ids, relaxed: pick.relaxed });
    const used = new Set(pick.ids);
    remaining = remaining.filter((q) => !used.has(q.id));
  }
  return { plans, shortDays };
}

/**
 * Candidates to generate tonight (SPEC §8 "Top up"): enough verified questions to
 * fill every open day plus the reserve, minus what's already verified, plus 20%
 * because some candidates fail the checks.
 */
export function candidatesNeeded(openDayCount: number, verifiedUnscheduled: number): number {
  const need = openDayCount * SCHEDULE.PER_DAY + SCHEDULE.RESERVE - verifiedUnscheduled;
  return need <= 0 ? 0 : Math.ceil(need * 1.2);
}

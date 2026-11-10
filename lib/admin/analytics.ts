/**
 * Data for /admin/analytics (SPEC §8): finished days from daily_metrics, the open days computed
 * live (cached 5 minutes), plus live totals, retention and streaks. Aggregates only.
 */
import { launchDate } from "../config";
import { addDays, daysBetween, localDate } from "../dates";
import { latestClosedDate } from "../analytics/metrics";
import { schedulingToday } from "../content/run";
import { adminClient } from "../supabase/admin";
import { statsFor } from "./data";

export type Range = "7" | "30" | "90" | "all";

/** One day's numbers (the shape compute_daily_metrics returns). */
export interface DayMetrics {
  date: string;
  visits: number;
  visits_from_share: number;
  visits_by_device: Record<string, number>;
  visits_by_country: Record<string, number>;
  referrers: Record<string, number>;
  players: number;
  new_players: number;
  completed: number;
  rounds_locked: number[];
  avg_total: number | null;
  score_buckets: number[];
  avg_points_by_round: Array<number | null>;
  wrong_way_by_round: number[];
  shares: number;
  sharers: number;
  shares_by_method: Record<string, number>;
  signup_prompts: number;
  signups: number;
  /** True for days still open somewhere (computed live). */
  live?: boolean;
}

export interface LiveTotals {
  dau: number;
  wau: number;
  mau: number;
  dau_prev: number;
  wau_prev: number;
  mau_prev: number;
  total_players: number;
  accounts: number;
  retention: Array<{ week: string; size: number; d1: number; d7: number; d30: number }>;
  streak_buckets: Record<string, number>;
  streak_7_plus: number;
  streak_30_plus: number;
}

export interface QuestionRow {
  id: number;
  date: string;
  position: number;
  prompt: string;
  category: string;
  plays: number;
  avg_points: number | null;
  wrong_way_pct: number | null;
  /** Share of players who locked this round and went on to lock the next (or finish). */
  completion_after: number | null;
  report_rate: number | null;
}

export interface AnalyticsData {
  /** "Today" for the tiles: Australia/Sydney (AEST/AEDT). */
  today: string;
  range: Range;
  from: string;
  days: DayMetrics[];
  live: LiveTotals;
  questions: QuestionRow[];
}

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>, now: number): Promise<T> {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: now, value });
  return value;
}

export async function getAnalytics(range: Range, now = new Date()): Promise<AnalyticsData> {
  const db = adminClient();
  const today = localDate(now, "Australia/Sydney");
  const newest = schedulingToday(now); // the newest puzzle date anywhere
  const closed = latestClosedDate(now);
  const launch = launchDate();
  // Never before launch: earlier days are empty by definition.
  const start = addDays(today, -(Number(range) - 1));
  const from = range === "all" || start < launch ? launch : start;

  const { data: rows, error } = await db.from("daily_metrics").select("puzzle_date, metrics").gte("puzzle_date", from).lte("puzzle_date", closed).order("puzzle_date");
  if (error) throw error;
  const days: DayMetrics[] = (rows ?? []).map((r) => ({ date: r.puzzle_date as string, ...(r.metrics as Omit<DayMetrics, "date">) }));

  // Days not final yet (and any finished day the nightly job hasn't written): live, cached.
  const have = new Set(days.map((d) => d.date));
  for (let d = from > addDays(closed, -2) ? from : addDays(closed, -2); d <= newest; d = addDays(d, 1)) {
    if (have.has(d)) continue;
    const metrics = await cached(`day:${d}`, async () => {
      const { data, error: e } = await db.rpc("compute_daily_metrics", { p_date: d });
      if (e) throw e;
      return data as Omit<DayMetrics, "date">;
    }, now.getTime());
    days.push({ date: d, ...metrics, live: d > closed });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  const live = await cached(`live:${today}`, async () => {
    const { data, error: e } = await db.rpc("analytics_live", { p_today: today });
    if (e) throw e;
    return data as LiveTotals;
  }, now.getTime());

  // Questions played in the range (not future days).
  const { data: rounds, error: e3 } = await db
    .from("puzzle_rounds")
    .select("puzzle_date, position, question_id, questions!inner(prompt, category)")
    .gte("puzzle_date", from)
    .lte("puzzle_date", newest)
    .order("puzzle_date");
  if (e3) throw e3;
  const list = (rounds ?? []) as unknown as Array<{ puzzle_date: string; position: number; question_id: number; questions: { prompt: string; category: string } }>;
  const stats = await statsFor(list.map((r) => r.question_id));
  const byDate = new Map(days.map((d) => [d.date, d]));
  const questions: QuestionRow[] = list.map((r) => {
    const s = stats.get(r.question_id);
    const day = byDate.get(r.puzzle_date);
    const locked = day?.rounds_locked?.[r.position - 1] ?? 0;
    const after = r.position < 5 ? (day?.rounds_locked?.[r.position] ?? 0) : (day?.completed ?? 0);
    return {
      id: r.question_id,
      date: r.puzzle_date,
      position: r.position,
      prompt: r.questions.prompt,
      category: r.questions.category,
      plays: s?.plays ?? 0,
      avg_points: s?.avg_points ?? null,
      wrong_way_pct: s?.wrong_way_pct ?? null,
      completion_after: locked ? Math.round((after / locked) * 1000) / 10 : null,
      report_rate: s?.report_rate ?? null,
    };
  });

  return { today, range, from, days: days.filter((d) => daysBetween(from, d.date) >= 0), live, questions };
}

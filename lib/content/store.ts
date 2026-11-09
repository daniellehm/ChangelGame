/**
 * Database access for the content pipeline (server only, service role). The
 * pipeline talks to this interface so tests can use an in-memory version.
 */
import { addDays } from "../dates";
import { adminClient } from "../supabase/admin";
import type { CheckReport } from "./checks";
import type { Candidate } from "./generate";
import type { PoolQuestion } from "./schedule";

export interface PendingDraft {
  id: number;
  candidate: Candidate;
}

export interface Store {
  /** Scheduled questions whose date has passed become 'used'. */
  markUsed(today: string): Promise<number>;
  readyDates(from: string, to: string): Promise<Set<string>>;
  /** Verified questions not yet in any puzzle. */
  pool(): Promise<PoolQuestion[]>;
  schedule(date: string, ids: number[]): Promise<"ok" | "exists" | "unavailable">;
  /** Pipeline-made drafts still waiting for their checks. */
  pendingDrafts(limit: number): Promise<PendingDraft[]>;
  countPending(): Promise<number>;
  insertDraft(c: Candidate): Promise<number>;
  saveChecks(id: number, report: CheckReport, reason: string | null): Promise<void>;
  usedSeriesKeys(): Promise<Set<string>>;
  /** Prompts of all questions (for the generator's avoid list), newest first. */
  recentPrompts(limit: number): Promise<string[]>;
  /** Category counts across verified + pending questions (to spread new ones). */
  categoryCounts(): Promise<Map<string, number>>;
  similarPrompts(prompt: string, excludeId?: number | null): Promise<Array<{ id: number; prompt: string; similarity: number }>>;
  seriesUsed(key: string, excludeId?: number | null): Promise<boolean>;
}

const QUESTION_FIELDS = "id, origin, category, prompt, start_year, start_value, end_year, end_value, format, fact, source_name, source_url, source_url_2, source_data, max_change";

type Row = Record<string, unknown>;
const toCandidate = (r: Row): Candidate => ({
  origin: r.origin as Candidate["origin"],
  category: r.category as string,
  prompt: r.prompt as string,
  start_year: r.start_year as number,
  start_value: r.start_value as number,
  end_year: r.end_year as number,
  end_value: r.end_value as number,
  format: r.format as Candidate["format"],
  fact: (r.fact as string | null) ?? "",
  source_name: (r.source_name as string | null) ?? "",
  source_url: (r.source_url as string | null) ?? "",
  source_url_2: (r.source_url_2 as string | null) ?? null,
  source_data: (r.source_data as Record<string, unknown> | null) ?? null,
  max_change: (r.max_change as number | null) ?? null,
});

/** Stable, readable, unique slug for a pipeline question. */
export function slugFor(c: Pick<Candidate, "prompt" | "start_year" | "end_year">, salt = Math.random()): string {
  const words = c.prompt
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 8)
    .join("-");
  const tail = Math.floor(salt * 36 ** 4).toString(36).padStart(4, "0");
  return `${words || "q"}-${c.start_year}-${c.end_year}-${tail}`;
}

const PIPELINE_ORIGINS = ["data", "researched"];

export const dbStore = (): Store => {
  const db = adminClient();
  const must = <T>(r: { data: T | null; error: unknown }): T => {
    if (r.error) throw r.error;
    return r.data as T;
  };
  return {
    async markUsed(today) {
      return Number(must(await db.rpc("mark_used_questions", { p_before: addDays(today, -1) })) ?? 0);
    },
    async readyDates(from, to) {
      const rows = must(await db.from("puzzles").select("puzzle_date").eq("status", "ready").gte("puzzle_date", from).lte("puzzle_date", to)) as Row[];
      return new Set(rows.map((r) => r.puzzle_date as string));
    },
    async pool() {
      const rows = must(await db.from("questions").select("id, category, start_value, end_value, origin, verified_at, created_at").eq("status", "verified")) as Row[];
      return rows.map((r) => ({
        id: r.id as number,
        category: r.category as string,
        start_value: r.start_value as number,
        end_value: r.end_value as number,
        origin: r.origin as string,
        verified_at: ((r.verified_at ?? r.created_at) as string) ?? "",
      }));
    },
    async schedule(date, ids) {
      return must(await db.rpc("schedule_puzzle", { p_date: date, p_question_ids: ids })) as "ok" | "exists" | "unavailable";
    },
    async pendingDrafts(limit) {
      const rows = must(await db.from("questions").select(QUESTION_FIELDS).eq("status", "draft").in("origin", PIPELINE_ORIGINS).eq("checks", "{}").order("id").limit(limit)) as Row[];
      return rows.map((r) => ({ id: r.id as number, candidate: toCandidate(r) }));
    },
    async countPending() {
      const { count, error } = await db.from("questions").select("id", { count: "exact", head: true }).eq("status", "draft").in("origin", PIPELINE_ORIGINS).eq("checks", "{}");
      if (error) throw error;
      return count ?? 0;
    },
    async insertDraft(c) {
      const row = { ...c, slug: slugFor(c), status: "draft", region: "global", tags: [c.origin], checks: {} };
      const r = must(await db.from("questions").insert(row).select("id").single()) as Row;
      return r.id as number;
    },
    async saveChecks(id, report, reason) {
      const patch = report.passed
        ? { checks: report, status: "verified", verified_by: "auto", verified_at: report.ran_at, flag_reason: null }
        : { checks: report, status: "flagged", flag_reason: reason };
      must(await db.from("questions").update(patch).eq("id", id).select("id"));
    },
    async usedSeriesKeys() {
      const rows = must(await db.from("questions").select("source_data").not("source_data", "is", null)) as Row[];
      return new Set(rows.map((r) => (r.source_data as { key?: string } | null)?.key).filter((k): k is string => !!k));
    },
    async recentPrompts(limit) {
      const rows = must(await db.from("questions").select("prompt").order("id", { ascending: false }).limit(limit)) as Row[];
      return rows.map((r) => r.prompt as string);
    },
    async categoryCounts() {
      const rows = must(await db.from("questions").select("category").in("status", ["verified", "draft", "scheduled"])) as Row[];
      const m = new Map<string, number>();
      for (const r of rows) m.set(String(r.category).toLowerCase(), (m.get(String(r.category).toLowerCase()) ?? 0) + 1);
      return m;
    },
    async similarPrompts(prompt, excludeId) {
      return (must(await db.rpc("similar_questions", { p_prompt: prompt, p_min: 0.6, p_exclude: excludeId ?? null })) ?? []) as Array<{ id: number; prompt: string; similarity: number }>;
    },
    async seriesUsed(key, excludeId) {
      let q = db.from("questions").select("id").eq("source_data->>key", key).limit(1);
      if (excludeId) q = q.neq("id", excludeId);
      return ((must(await q) as Row[]) ?? []).length > 0;
    },
  };
};

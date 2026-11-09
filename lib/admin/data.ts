/**
 * Admin portal reads and actions (M5 task 5.8). Server only (service role); every
 * caller has passed requireAdmin. Edits are logged in question_edits.
 */
import { z } from "zod";
import { CONTENT } from "../config";
import { addDays } from "../dates";
import { FORMATS } from "../format";
import { checkBatch, flagReason, rangeCheck, sanityCheck, type CheckReport } from "../content/checks";
import type { Candidate } from "../content/generate";
import { dbLedger, monthStartUtc } from "../content/ledger";
import { ClaudeLlm, sdkParse, type Llm } from "../content/llm";
import { schedulingToday } from "../content/run";
import { dbStore } from "../content/store";
import { roundForStorage } from "../content/questions";
import type { FetchLike } from "../content/sources";
import { adminClient } from "../supabase/admin";

const db = () => adminClient();
/** A query's data, or throw its error. Callers cast to the shape they selected. */
const must = (r: { data: unknown; error: unknown }): unknown => {
  if (r.error) throw r.error;
  return r.data;
};

export const SUMMARY_FIELDS = "id, slug, status, origin, category, prompt, start_year, start_value, end_year, end_value, format, max_change, fact, source_name, source_url, source_url_2, checks, flag_reason, verified_by, verified_at, corrected_at, created_at";

export interface QuestionStats {
  plays: number;
  avg_points: number | null;
  wrong_way_pct: number | null;
  reports: number;
  valid_reports: number;
  report_rate: number | null;
}

export async function statsFor(ids: number[]): Promise<Map<number, QuestionStats>> {
  const out = new Map<number, QuestionStats>();
  if (!ids.length) return out;
  const rows = must(await db().rpc("question_stats", { p_ids: ids })) as Array<Omit<QuestionStats, "report_rate"> & { question_id: number }>;
  for (const r of rows) out.set(r.question_id, { ...r, report_rate: r.plays ? r.valid_reports / r.plays : null });
  return out;
}

// ---------------------------------------------------------------------------------- upcoming

export async function upcoming(now = new Date()) {
  const today = schedulingToday(now);
  const end = addDays(today, 29);
  const puzzles = must(await db().from("puzzles").select("puzzle_date, status, theme, rerun_of").gte("puzzle_date", addDays(today, -1)).lte("puzzle_date", end)) as Array<{ puzzle_date: string; status: string; theme: string | null; rerun_of: string | null }>;
  const rounds = must(await db().from("puzzle_rounds").select(`puzzle_date, position, questions!inner(${SUMMARY_FIELDS})`).gte("puzzle_date", addDays(today, -1)).lte("puzzle_date", end).order("position")) as Array<{ puzzle_date: string; position: number; questions: Record<string, unknown> }>;
  const days = [];
  for (let i = -1; i < 30; i++) {
    const date = addDays(today, i);
    const p = puzzles.find((x) => x.puzzle_date === date) ?? null;
    days.push({
      date,
      puzzle: p,
      rounds: rounds.filter((r) => r.puzzle_date === date).map((r) => ({ position: r.position, question: r.questions })),
    });
  }
  return { today, days };
}

/** A spare to swap in: verified, never scheduled, category not already used that day; oldest first. */
async function pickReserve(date: string, position: number): Promise<number | null> {
  const others = must(await db().from("puzzle_rounds").select("position, questions!inner(category)").eq("puzzle_date", date)) as Array<{ position: number; questions: { category: string } }>;
  const taken = new Set(others.filter((o) => o.position !== position).map((o) => o.questions.category.toLowerCase()));
  const pool = must(await db().from("questions").select("id, category").eq("status", "verified").order("verified_at", { ascending: true, nullsFirst: false }).limit(200)) as Array<{ id: number; category: string }>;
  return pool.find((q) => !taken.has(q.category.toLowerCase()))?.id ?? pool[0]?.id ?? null;
}

/**
 * Pull a round: swap in a reserve question (or `newId`). The pulled question goes
 * to Flagged (to fix) by default. Players who already answered keep their score.
 */
export async function pullRound(date: string, position: number, opts: { newId?: number; oldStatus?: "verified" | "flagged" | "retired"; editor: string; note?: string }) {
  const current = must(await db().from("puzzle_rounds").select("question_id").eq("puzzle_date", date).eq("position", position).maybeSingle()) as { question_id: number } | null;
  if (!current) return { status: "no_round" as const };
  const newId = opts.newId ?? (await pickReserve(date, position));
  if (!newId) return { status: "no_reserve" as const };
  const r = must(await db().rpc("swap_round", { p_date: date, p_position: position, p_new_id: newId, p_old_status: opts.oldStatus ?? "flagged" })) as string;
  if (r !== "ok") return { status: r as "unavailable" | "no_round" };
  // Same-day (or past) pull: players who already answered keep their score, and their reveal says "Corrected".
  const live = date <= schedulingToday();
  const oldPatch: Record<string, unknown> = {};
  if ((opts.oldStatus ?? "flagged") === "flagged") oldPatch.flag_reason = `pulled by ${opts.editor} from ${date}${opts.note ? `: ${opts.note}` : ""}`;
  if (live) oldPatch.corrected_at = new Date().toISOString();
  if (Object.keys(oldPatch).length) await db().from("questions").update(oldPatch).eq("id", current.question_id);
  await db().from("question_edits").insert({ question_id: current.question_id, edited_by: opts.editor, before: { puzzle_date: date, position }, after: { swapped_for: newId }, note: opts.note ?? "pulled" });
  return { status: "ok" as const, oldId: current.question_id, newId };
}

// ---------------------------------------------------------------------------------- bank + editor

export const BankFilter = z.object({
  status: z.enum(["draft", "flagged", "verified", "scheduled", "used", "retired"]).optional(),
  category: z.string().trim().max(40).optional(),
  origin: z.enum(["seed", "data", "researched", "manual"]).optional(),
  q: z.string().trim().max(100).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  page: z.coerce.number().int().min(0).max(1000).default(0),
});

const PAGE = 50;
/** A bank row: the summary fields (SUMMARY_FIELDS) plus anything else selected. */
export interface BankRow {
  id: number;
  status: string;
  origin: string;
  category: string;
  prompt: string;
  [field: string]: unknown;
}
/** Difficulty from avg points once played: easy ≥ 70, hard < 40. */
export const difficultyOf = (avg: number | null) => (avg === null ? null : avg >= 70 ? "easy" : avg < 40 ? "hard" : "medium");

export async function listQuestions(f: z.infer<typeof BankFilter>) {
  let q = db().from("questions").select(SUMMARY_FIELDS, { count: "exact" }).order("id", { ascending: false });
  if (f.status) q = q.eq("status", f.status);
  if (f.category) q = q.ilike("category", f.category);
  if (f.origin) q = q.eq("origin", f.origin);
  if (f.q) q = q.ilike("prompt", `%${f.q.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await q.range(f.page * PAGE, f.page * PAGE + PAGE - 1);
  if (error) throw error;
  const rows = (data ?? []) as unknown as BankRow[];
  const stats = await statsFor(rows.map((r) => r.id));
  let items = rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? null, difficulty: difficultyOf(stats.get(r.id)?.avg_points ?? null) }));
  if (f.difficulty) items = items.filter((i) => i.difficulty === f.difficulty);
  return { items, total: count ?? 0, page: f.page, pageSize: PAGE };
}

export async function getQuestion(id: number) {
  const q = must(await db().from("questions").select(`${SUMMARY_FIELDS}, source_data, notes, tags, region, reports_dismissed_rate`).eq("id", id).maybeSingle()) as Record<string, unknown> | null;
  if (!q) return null;
  const [edits, rounds, stats, reports] = await Promise.all([
    db().from("question_edits").select("id, edited_by, edited_at, before, after, note").eq("question_id", id).order("edited_at", { ascending: false }).limit(50),
    db().from("puzzle_rounds").select("puzzle_date, position").eq("question_id", id),
    statsFor([id]),
    db().from("reports").select("reason, note, valid, invalid_reason, created_at").eq("question_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return { question: q, edits: edits.data ?? [], rounds: rounds.data ?? [], stats: stats.get(id) ?? null, reports: reports.data ?? [] };
}

/** Fields an admin may edit. Values are rounded like the importer (3 s.f. except sec/time/yrs). */
export const QuestionEdit = z
  .object({
    category: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(3).max(200),
    start_year: z.number().int().min(-10000).max(2200),
    start_value: z.number().positive(),
    end_year: z.number().int().min(-10000).max(2200),
    end_value: z.number().positive(),
    format: z.enum(FORMATS),
    max_change: z.number().positive(),
    fact: z.string().trim().max(500),
    source_name: z.string().trim().max(200),
    source_url: z.string().trim().max(1000),
    source_url_2: z.string().trim().max(1000).nullable(),
    note: z.string().trim().max(500).optional(),
  })
  .partial();

const EDITABLE = ["category", "prompt", "start_year", "start_value", "end_year", "end_value", "format", "max_change", "fact", "source_name", "source_url", "source_url_2"] as const;

function toCandidate(q: Record<string, unknown>): Candidate {
  return {
    origin: q.origin === "data" ? "data" : "researched",
    category: q.category as string,
    prompt: q.prompt as string,
    start_year: q.start_year as number,
    start_value: q.start_value as number,
    end_year: q.end_year as number,
    end_value: q.end_value as number,
    format: q.format as Candidate["format"],
    fact: (q.fact as string) ?? "",
    source_name: (q.source_name as string) ?? "",
    source_url: (q.source_url as string) ?? "",
    source_url_2: (q.source_url_2 as string | null) ?? null,
    source_data: (q.source_data as Record<string, unknown> | null) ?? null,
    max_change: (q.max_change as number | null) ?? null,
  };
}

/** Whether a question is (or was) live: on today's or an earlier puzzle. */
async function isLiveOrPast(id: number, now: Date): Promise<boolean> {
  const today = schedulingToday(now);
  const rows = must(await db().from("puzzle_rounds").select("puzzle_date").eq("question_id", id).lte("puzzle_date", today)) as unknown[];
  return rows.length > 0;
}

/**
 * Save an edit: log before/after, add the "Corrected" note if the question is live
 * or past, then re-run the automatic checks (SPEC §8 editor). A draft or flagged
 * question that now passes becomes verified; a scheduled/used one keeps its status
 * and shows the new check results.
 */
export async function saveQuestion(id: number, patch: z.infer<typeof QuestionEdit>, editor: string, deps: { llm?: Llm; now?: Date; runChecks?: boolean; fetchFn?: FetchLike } = {}) {
  const now = deps.now ?? new Date();
  const before = must(await db().from("questions").select(`${SUMMARY_FIELDS}, source_data`).eq("id", id).maybeSingle()) as Record<string, unknown> | null;
  if (!before) return { status: "not_found" as const };
  const fmt = (patch.format ?? before.format) as Candidate["format"];
  const changes: Record<string, unknown> = {};
  for (const k of EDITABLE) {
    if (patch[k] === undefined) continue;
    let v: unknown = patch[k];
    if (k === "start_value" || k === "end_value") v = roundForStorage(v as number, fmt);
    if (k === "source_url_2" && v === "") v = null;
    if (JSON.stringify(v) !== JSON.stringify(before[k])) changes[k] = v;
  }
  const after = { ...before, ...changes };
  const cand = toCandidate(after);

  // Free checks first: never save a question the game can't play.
  const sanity = sanityCheck(cand, now);
  const range = rangeCheck(cand);
  if (!range.pass) return { status: "invalid" as const, detail: range.detail };
  if (!sanity.pass && /values must be|end year must be after|÷1000/.test(sanity.detail)) return { status: "invalid" as const, detail: sanity.detail };

  const live = Object.keys(changes).length > 0 && (await isLiveOrPast(id, now));
  if (Object.keys(changes).length) {
    must(await db().from("questions").update({ ...changes, ...(live ? { corrected_at: now.toISOString() } : {}) }).eq("id", id).select("id"));
    const beforeDiff = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k]]));
    await db().from("question_edits").insert({ question_id: id, edited_by: editor, before: beforeDiff, after: changes, note: patch.note ?? (live ? "corrected (live or past question)" : null) });
  }

  let report: CheckReport | null = null;
  if (deps.runChecks !== false) {
    const store = dbStore();
    const llm = deps.llm ?? new ClaudeLlm(sdkParse(), dbLedger());
    report = (await checkBatch([{ id, candidate: cand }], { llm, now, fetchFn: deps.fetchFn, similarPrompts: store.similarPrompts, seriesUsed: store.seriesUsed }))[0] ?? null;
    const statusNow = before.status as string;
    const patchStatus = statusNow === "draft" || statusNow === "flagged" ? (report!.passed ? { status: "verified", verified_by: editor, verified_at: now.toISOString(), flag_reason: null } : { status: "flagged", flag_reason: flagReason(report!) }) : {};
    must(await db().from("questions").update({ checks: report, ...patchStatus }).eq("id", id).select("id"));
  }
  return { status: "ok" as const, changed: Object.keys(changes), corrected: live, report };
}

/** Human approval from the Flagged queue: the playability rules must still hold. */
export async function approveQuestion(id: number, editor: string, now = new Date()) {
  const q = must(await db().from("questions").select(`${SUMMARY_FIELDS}, source_data`).eq("id", id).maybeSingle()) as Record<string, unknown> | null;
  if (!q) return { status: "not_found" as const };
  if (!["flagged", "draft"].includes(q.status as string)) return { status: "not_flagged" as const };
  const range = rangeCheck(toCandidate(q));
  if (!range.pass) return { status: "invalid" as const, detail: range.detail };
  must(await db().from("questions").update({ status: "verified", verified_by: editor, verified_at: now.toISOString(), flag_reason: null }).eq("id", id).select("id"));
  await db().from("question_edits").insert({ question_id: id, edited_by: editor, before: { status: q.status }, after: { status: "verified" }, note: "approved by a human" });
  return { status: "ok" as const };
}

/** Retire: a question on a future puzzle is swapped out first. Past plays are untouched. */
export async function retireQuestion(id: number, editor: string, now = new Date()) {
  const today = schedulingToday(now);
  const future = must(await db().from("puzzle_rounds").select("puzzle_date, position").eq("question_id", id).gt("puzzle_date", today)) as Array<{ puzzle_date: string; position: number }>;
  for (const r of future) {
    const out = await pullRound(r.puzzle_date, r.position, { editor, oldStatus: "retired", note: "retired" });
    if (out.status !== "ok") return { status: "no_reserve" as const };
  }
  must(await db().from("questions").update({ status: "retired" }).eq("id", id).select("id"));
  await db().from("question_edits").insert({ question_id: id, edited_by: editor, before: null, after: { status: "retired" }, note: "retired" });
  return { status: "ok" as const };
}

/** Delete a flagged/draft candidate that was never scheduled, played or reported. */
export async function deleteCandidate(id: number) {
  const q = must(await db().from("questions").select("status").eq("id", id).maybeSingle()) as { status: string } | null;
  if (!q) return { status: "not_found" as const };
  if (!["flagged", "draft"].includes(q.status)) return { status: "not_deletable" as const };
  const [rounds, guesses] = await Promise.all([
    db().from("puzzle_rounds").select("question_id", { count: "exact", head: true }).eq("question_id", id),
    db().from("guesses").select("play_id", { count: "exact", head: true }).eq("question_id", id),
  ]);
  if ((rounds.count ?? 0) > 0 || (guesses.count ?? 0) > 0) return { status: "not_deletable" as const };
  must(await db().from("questions").delete().eq("id", id).select("id"));
  return { status: "ok" as const };
}

// ---------------------------------------------------------------------------------- health

export async function health(now = new Date()) {
  const since = monthStartUtc(now).toISOString();
  const [runs, calls] = await Promise.all([
    db().from("content_runs").select("id, trigger, status, started_at, finished_at, hops, generated, verified, flagged, scheduled, error, log").neq("trigger", "test").order("started_at", { ascending: false }).limit(14),
    db().from("llm_calls").select("purpose, model, cost_usd, web_searches, ok").gte("created_at", since),
  ]);
  if (runs.error) throw runs.error;
  if (calls.error) throw calls.error;
  const byPurpose: Record<string, { calls: number; usd: number; searches: number; failed: number }> = {};
  let month = 0;
  for (const c of calls.data ?? []) {
    const p = (byPurpose[c.purpose] ??= { calls: 0, usd: 0, searches: 0, failed: 0 });
    p.calls++;
    p.usd += Number(c.cost_usd);
    p.searches += c.web_searches;
    if (!c.ok) p.failed++;
    month += Number(c.cost_usd);
  }
  const recent = (runs.data ?? []).slice(0, 7);
  const v = recent.reduce((a, r) => a + r.verified, 0);
  const f = recent.reduce((a, r) => a + r.flagged, 0);
  return { runs: runs.data ?? [], spend: { month, cap: CONTENT.MONTHLY_CAP_USD, byPurpose }, passRate: v + f ? v / (v + f) : null };
}

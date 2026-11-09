/** M5 task 5.8: admin actions against the real DB on throwaway questions and a 2099 puzzle. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approveQuestion, deleteCandidate, getQuestion, listQuestions, pullRound, retireQuestion, saveQuestion, statsFor } from "@/lib/admin/data";
import type { Llm, LlmRequest } from "@/lib/content/llm";
import { launchDate } from "@/lib/config";
import { puzzleNumber } from "@/lib/dates";
import { adminClient } from "@/lib/supabase/admin";

const db = adminClient();
const DATE = "2099-06-01";
const ED = "itest-admin@example.com";
let ids: number[] = []; // 0–4 on the puzzle, 5 spare (new category), 6 flagged, 7 spare (same category as 0)

async function cleanup() {
  await db.from("puzzles").delete().eq("puzzle_date", DATE);
  await db.from("questions").delete().like("slug", "itest-admin-%");
}

/** Fake Claude that passes every model check. */
const passing: Llm = {
  async json<T>(req: LlmRequest<T>) {
    const answers: Record<string, unknown> = {
      review: { like_for_like: { pass: true, reason: "ok" }, safety: { pass: true, reason: "ok" }, fact: { pass: true, reason: "ok" } },
      source_support: { start_supported: true, start_quote: "q", end_supported: true, end_quote: "q" },
      cross_check: { estimates: [{ id: 0, start_estimate: 100, end_estimate: 160, note: "" }] },
      duplicate: { duplicate_of: null, reason: "different" },
    };
    return req.schema.parse(answers[req.purpose]);
  },
};

beforeAll(async () => {
  await cleanup();
  const cats = ["CatA", "CatB", "CatC", "CatD", "CatE", "CatF", "CatG", "CatA"];
  const rows = cats.map((category, i) => ({
    slug: `itest-admin-${i}`, category, prompt: `Admin test question ${i} about widgets`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 160,
    format: "int", max_change: 3, origin: "researched", tags: ["itest"], fact: "A fact.", source_name: "Pub", source_url: `https://a.example/${i}`, source_url_2: `https://b.example/${i}`,
    status: i === 6 ? "flagged" : "verified", flag_reason: i === 6 ? "cross_check: off by 30%" : null, verified_at: i < 6 ? `2026-01-0${(i % 9) + 1}T00:00:00Z` : null,
  }));
  const { data, error } = await db.from("questions").insert(rows).select("id, slug");
  if (error) throw error;
  ids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  const s = await db.rpc("schedule_puzzle", { p_date: DATE, p_question_ids: ids.slice(0, 5) });
  if (s.data !== "ok") throw new Error(`schedule failed: ${JSON.stringify(s)}`);
});

afterAll(cleanup);

describe("pull / swap", () => {
  it("pull swaps in a spare from a category not already on that day; the old one goes to Flagged, logged", async () => {
    const out = await pullRound(DATE, 1, { editor: ED, note: "number looks off" });
    expect(out).toMatchObject({ status: "ok", oldId: ids[0] });
    expect([ids[5], ids[7]]).toContain(out.status === "ok" ? out.newId : -1);
    // ids[7] is CatA like the pulled question, but the pulled one is leaving, so CatA is allowed. Either way: no duplicate category.
    const { data: rounds } = await db.from("puzzle_rounds").select("position, questions!inner(category)").eq("puzzle_date", DATE);
    const cats = (rounds as unknown as Array<{ questions: { category: string } }>).map((r) => r.questions.category);
    expect(new Set(cats).size).toBe(5);
    const { data: old } = await db.from("questions").select("status, flag_reason").eq("id", ids[0]).single();
    expect(old).toMatchObject({ status: "flagged" });
    expect(old!.flag_reason).toContain("number looks off");
    const detail = await getQuestion(ids[0]!);
    expect(detail!.edits[0]).toMatchObject({ edited_by: ED, note: "number looks off" });
  });

  it("an explicit swap needs a verified, unscheduled question", async () => {
    expect((await pullRound(DATE, 2, { editor: ED, newId: ids[6] })).status).toBe("unavailable"); // flagged
    expect((await pullRound(DATE, 9, { editor: ED })).status).toBe("no_round");
  });
});

describe("editor", () => {
  it("saves changes rounded to 3 s.f., logs before/after, and re-runs the checks", async () => {
    const out = await saveQuestion(ids[6]!, { end_value: 161.44, start_value: 100.2, fact: "A better fact." }, ED, { llm: passing, fetchFn: async () => new Response("<p>Widgets: 100 in 2000 and 161 in 2020.</p>", { headers: { "content-type": "text/html" } }) });
    // start_value 100.2 rounds to 100 (unchanged), so only two fields change.
    expect(out).toMatchObject({ status: "ok", changed: ["end_value", "fact"], corrected: false });
    const { data } = await db.from("questions").select("end_value, status, verified_by, checks").eq("id", ids[6]).single();
    expect(data).toMatchObject({ end_value: 161, status: "verified", verified_by: ED }); // flagged → passes → verified
    expect((data!.checks as { passed: boolean }).passed).toBe(true);
    const detail = await getQuestion(ids[6]!);
    expect(detail!.edits[0]).toMatchObject({ before: { end_value: 160, fact: "A fact." }, after: { end_value: 161, fact: "A better fact." } });
  });

  it("refuses an edit the game can't play (answer outside the slider range)", async () => {
    const out = await saveQuestion(ids[6]!, { end_value: 1000 }, ED, { runChecks: false });
    expect(out).toMatchObject({ status: "invalid" });
  });
});

describe("approve / retire / delete", () => {
  it("approve moves a flagged question to verified", async () => {
    await db.from("questions").update({ status: "flagged" }).eq("id", ids[6]);
    expect((await approveQuestion(ids[6]!, ED)).status).toBe("ok");
    expect((await approveQuestion(ids[6]!, ED)).status).toBe("not_flagged");
  });

  it("retiring a question on an upcoming day swaps it out first", async () => {
    const { data: r } = await db.from("puzzle_rounds").select("question_id").eq("puzzle_date", DATE).eq("position", 3).single();
    expect((await retireQuestion(r!.question_id, ED)).status).toBe("ok");
    const { data: after } = await db.from("puzzle_rounds").select("question_id").eq("puzzle_date", DATE).eq("position", 3).single();
    expect(after!.question_id).not.toBe(r!.question_id);
    const { data: q } = await db.from("questions").select("status").eq("id", r!.question_id).single();
    expect(q!.status).toBe("retired");
  });

  it("only never-scheduled flagged/draft candidates can be deleted", async () => {
    expect((await deleteCandidate(ids[1]!)).status).toBe("not_deletable"); // scheduled
    expect((await deleteCandidate(ids[2]!)).status).toBe("not_deletable"); // verified on a puzzle
    // Pulled from a future day before anyone played it: deletable.
    expect((await deleteCandidate(ids[0]!)).status).toBe("ok");
    const { data: x } = await db.from("questions").insert({ slug: "itest-admin-del", category: "X", prompt: "Delete me please now", start_year: 2000, start_value: 1, end_year: 2001, end_value: 2, format: "int", status: "flagged", tags: ["itest"] }).select("id").single();
    expect((await deleteCandidate(x!.id)).status).toBe("ok");
  });
});

describe("bank", () => {
  it("filters by text and status and includes stats", async () => {
    const out = await listQuestions({ q: "about widgets", status: "scheduled", page: 0 });
    expect(out.items.length).toBeGreaterThanOrEqual(3);
    expect(out.items.every((i) => i.status === "scheduled" && i.prompt.includes("widgets"))).toBe(true);
    expect(out.items[0]!.stats).toMatchObject({ plays: 0, valid_reports: 0 });
    const s = await statsFor([ids[1]!]);
    expect(s.get(ids[1]!)).toMatchObject({ plays: 0, report_rate: null });
  });

  it("shows each question's puzzle day and can list one day's questions in round order", async () => {
    const day = puzzleNumber(DATE, launchDate());
    const out = await listQuestions({ day, page: 0 });
    expect(out.total).toBe(5);
    expect(out.items.map((i) => i.rounds[0]!.position)).toEqual([1, 2, 3, 4, 5]);
    expect(out.items.every((i) => i.rounds[0]!.day === day && i.rounds[0]!.date === DATE)).toBe(true);
    // Filters still apply in day view.
    expect((await listQuestions({ day, q: "question 3 about", page: 0 })).items.map((i) => i.id)).toEqual([ids[3]]);
    // The default view (newest added) carries the day too; questions not on the day have none.
    const added = await listQuestions({ q: "about widgets", page: 0 });
    expect(added.items.find((i) => i.id === ids[3])!.rounds).toEqual([{ day, date: DATE, position: 4 }]);
    const onDay = new Set(out.items.map((i) => i.id));
    const off = added.items.filter((i) => !onDay.has(i.id));
    expect(off.length).toBeGreaterThan(0);
    expect(off.every((i) => i.rounds.length === 0)).toBe(true);
    // Day 1 first vs latest first.
    const asc = await listQuestions({ sort: "day_asc", page: 0 });
    const desc = await listQuestions({ sort: "day_desc", page: 0 });
    expect(asc.items[0]!.rounds[0]!.date <= desc.items[0]!.rounds[0]!.date).toBe(true);
  });
});

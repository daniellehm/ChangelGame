/** M5 task 5.5: schedule_puzzle / mark_used_questions against the real DB, on throwaway 2099 dates. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient } from "@/lib/supabase/admin";

const db = adminClient();
const DATES = ["2099-05-01", "2099-05-02"];
let ids: number[] = [];

async function cleanup() {
  await db.from("puzzles").delete().in("puzzle_date", DATES); // cascades rounds
  await db.from("questions").delete().like("slug", "itest-sched-%");
}

beforeAll(async () => {
  await cleanup();
  const rows = Array.from({ length: 7 }, (_, i) => ({
    slug: `itest-sched-${i}`, category: `Cat${i}`, prompt: `Scheduler test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020,
    end_value: 150, format: "int", max_change: 3, status: i === 6 ? "draft" : "verified", origin: "manual", tags: ["itest"],
  }));
  const { data, error } = await db.from("questions").insert(rows).select("id, slug");
  if (error) throw error;
  ids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
});

afterAll(cleanup);

describe("schedule_puzzle", () => {
  it("creates a ready puzzle with 5 rounds and marks the questions scheduled, in one step", async () => {
    const { data, error } = await db.rpc("schedule_puzzle", { p_date: DATES[0], p_question_ids: ids.slice(0, 5) });
    expect(error).toBeNull();
    expect(data).toBe("ok");
    const { data: p } = await db.from("puzzles").select("status").eq("puzzle_date", DATES[0]).single();
    expect(p!.status).toBe("ready");
    const { data: rounds } = await db.from("puzzle_rounds").select("position, question_id").eq("puzzle_date", DATES[0]).order("position");
    expect(rounds!.map((r) => r.question_id)).toEqual(ids.slice(0, 5));
    const { data: qs } = await db.from("questions").select("status").in("id", ids.slice(0, 5));
    expect(new Set(qs!.map((q) => q.status))).toEqual(new Set(["scheduled"]));
  });

  it("won't overwrite a day, reuse a question, or use an unverified one", async () => {
    expect((await db.rpc("schedule_puzzle", { p_date: DATES[0], p_question_ids: ids.slice(0, 5) })).data).toBe("exists");
    expect((await db.rpc("schedule_puzzle", { p_date: DATES[1], p_question_ids: [ids[0], ...ids.slice(2, 6)] })).data).toBe("unavailable"); // ids[0] taken
    expect((await db.rpc("schedule_puzzle", { p_date: DATES[1], p_question_ids: [ids[5], ids[6], ids[1], ids[2], ids[3]] })).data).toBe("unavailable"); // ids[6] is a draft
    const { data } = await db.from("puzzles").select("puzzle_date").eq("puzzle_date", DATES[1]);
    expect(data).toEqual([]); // nothing half-written
  });

  it("rejects anything but 5 distinct questions", async () => {
    const { error } = await db.rpc("schedule_puzzle", { p_date: DATES[1], p_question_ids: [ids[5], ids[5], ids[1], ids[2], ids[3]] });
    expect(error?.code).toBe("22023");
  });
});

describe("mark_used_questions", () => {
  it("marks scheduled questions used once their date has passed, and only those", async () => {
    expect((await db.rpc("mark_used_questions", { p_before: DATES[0] })).data).toBe(0); // not passed yet
    expect((await db.rpc("mark_used_questions", { p_before: "2099-05-02" })).data).toBe(5);
    const { data } = await db.from("questions").select("id, status").in("id", ids);
    expect(data!.filter((q) => q.status === "used").map((q) => q.id).sort()).toEqual(ids.slice(0, 5).sort());
  });
});

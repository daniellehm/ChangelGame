/**
 * M6 task 6.3: crowd stats per round (round_crowd + GET /api/crowd). A throwaway 2099 day with
 * two players; the 50-play threshold and wording are unit-tested (tests/unit/crowd.test.ts).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/crowd/route";
import { adminClient } from "@/lib/supabase/admin";
import { get } from "./helpers";

const db = adminClient();
const DATE = "2099-07-01";
const MORNING = `${DATE}T09:00:00+11:00`;
let ids: number[] = [];
const users: string[] = [];

async function cleanup() {
  for (const u of users) await db.auth.admin.deleteUser(u);
  await db.from("plays").delete().eq("puzzle_date", DATE);
  await db.from("puzzles").delete().eq("puzzle_date", DATE);
  await db.from("questions").delete().like("slug", "itest-crowd-%");
}

beforeAll(async () => {
  await cleanup();
  const rows = Array.from({ length: 6 }, (_, i) => ({
    slug: `itest-crowd-${i}`, category: `Cr${i}`, prompt: `Crowd test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 150,
    format: "int", max_change: 3, origin: "researched", status: "verified", tags: ["itest"],
  }));
  const { data } = await db.from("questions").insert(rows).select("id, slug");
  ids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  expect((await db.rpc("schedule_puzzle", { p_date: DATE, p_question_ids: ids.slice(0, 5) })).data).toBe("ok");

  // Two players. Round 1: one nailed it, one went the wrong way. Round 2: both close.
  const plan = [
    [{ tier: "nailed", points: 95, wrong_way: false }, { tier: "close", points: 70, wrong_way: false }],
    [{ tier: "wrong", points: 0, wrong_way: true }, { tier: "close", points: 80, wrong_way: false }],
  ];
  for (const rounds of plan) {
    const u = await db.auth.admin.createUser({ email: `itest-crowd-${randomUUID()}@example.com`, email_confirm: true });
    users.push(u.data.user!.id);
    const { data: play } = await db.from("plays").insert({ player_id: u.data.user!.id, puzzle_date: DATE }).select("id").single();
    await db.from("guesses").insert(rounds.map((r, i) => ({ play_id: play!.id, position: i + 1, question_id: ids[i], guess_log: 0.1, ...r })));
  }
  // A guess on a question that was later swapped out of round 3 doesn't count toward round 3.
  const u = await db.auth.admin.createUser({ email: `itest-crowd-${randomUUID()}@example.com`, email_confirm: true });
  users.push(u.data.user!.id);
  const { data: play } = await db.from("plays").insert({ player_id: u.data.user!.id, puzzle_date: DATE }).select("id").single();
  await db.from("guesses").insert({ play_id: play!.id, position: 3, question_id: ids[5], guess_log: 0.1, tier: "off", points: 10, wrong_way: false });
});

afterAll(cleanup);

describe("crowd stats", () => {
  it("counts plays, wrong-way and nailed per round, only for the question currently in the round", async () => {
    const res = await GET(get(`/api/crowd?date=${DATE}`, MORNING));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = await res.json();
    expect(body.rounds).toEqual([
      { position: 1, plays: 2, wrong_way: 1, nailed: 1, avg_points: 47.5 },
      { position: 2, plays: 2, wrong_way: 0, nailed: 0, avg_points: 75 },
    ]);
    // No finished games in this fixture yet, so no score spread.
    expect(body.scores).toEqual({ n: 0, counts: {} });
    await db.from("plays").update({ completed_at: new Date().toISOString(), total: 300 }).eq("puzzle_date", DATE);
    const after = await (await GET(get(`/api/crowd?date=${DATE}`, MORNING))).json();
    expect(after.scores).toEqual({ n: 3, counts: { "300": 3 } });
  });

  it("refuses days whose window hasn't opened, and bad dates", async () => {
    expect((await GET(get(`/api/crowd?date=${DATE}`, "2099-06-25T09:00:00+11:00"))).status).toBe(403);
    expect((await GET(get("/api/crowd?date=nope", MORNING))).status).toBe(400);
  });
});

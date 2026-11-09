/**
 * M5 task 5.10: same-day pull. Players who already answered keep their score and
 * see "Corrected"; the round now serves the swapped-in question. A past test date
 * stands in for "today" (pullRound treats any date ≤ today as live).
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pullRound } from "@/lib/admin/data";
import { answersByQuestionId, publicRounds } from "@/lib/puzzles/repo";
import { adminClient } from "@/lib/supabase/admin";

const db = adminClient();
const DATE = "2026-10-01";
let ids: number[] = [];
let userId = "";
let playId = "";

async function cleanup() {
  if (userId) await db.auth.admin.deleteUser(userId);
  await db.from("plays").delete().eq("puzzle_date", DATE);
  await db.from("puzzles").delete().eq("puzzle_date", DATE);
  await db.from("questions").delete().like("slug", "itest-pull-%");
}

beforeAll(async () => {
  await cleanup();
  const rows = Array.from({ length: 6 }, (_, i) => ({
    slug: `itest-pull-${i}`, category: `Pl${i}`, prompt: `Pull test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 150,
    format: "int", max_change: 3, origin: "researched", status: "verified", tags: ["itest"], verified_at: "2026-01-01T00:00:00Z",
  }));
  const { data } = await db.from("questions").insert(rows).select("id, slug");
  ids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  expect((await db.rpc("schedule_puzzle", { p_date: DATE, p_question_ids: ids.slice(0, 5) })).data).toBe("ok");
  const u = await db.auth.admin.createUser({ email: `itest-pull-${randomUUID()}@example.com`, email_confirm: true });
  userId = u.data.user!.id;
  const { data: play } = await db.from("plays").insert({ player_id: userId, puzzle_date: DATE }).select("id").single();
  playId = play!.id;
  await db.from("guesses").insert({ play_id: playId, position: 1, question_id: ids[0], guess_log: 0.17, points: 97, tier: "nailed", wrong_way: false });
});

afterAll(cleanup);

describe("same-day pull", () => {
  it("swaps the round for everyone who hasn't reached it; those who answered keep their score and see Corrected", async () => {
    const out = await pullRound(DATE, 1, { editor: "itest@example.com", newId: ids[5], note: "wrong figure" });
    expect(out).toMatchObject({ status: "ok", oldId: ids[0], newId: ids[5] });
    // New players get the replacement in round 1.
    expect((await publicRounds(DATE))[0]!.question_id).toBe(ids[5]);
    // The player who answered keeps their guess and points.
    const { data: g } = await db.from("guesses").select("question_id, points").eq("play_id", playId).single();
    expect(g).toEqual({ question_id: ids[0], points: 97 });
    // …and their reveal of the old question says Corrected.
    expect((await answersByQuestionId([ids[0]!])).get(ids[0]!)!.corrected).toBe(true);
    const { data: old } = await db.from("questions").select("status, flag_reason").eq("id", ids[0]).single();
    expect(old!.status).toBe("flagged");
    expect(old!.flag_reason).toContain("wrong figure");
  });
});

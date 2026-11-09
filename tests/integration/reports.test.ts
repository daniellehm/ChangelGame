/**
 * M5 task 5.9 acceptance: simulated reports from 11% of players add the question once
 * to the Reports queue, send no email and leave it live, while 3 reports do nothing.
 * Real DB: 100 throwaway players, a 2099 puzzle, guesses and reports inserted directly.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as reportPOST } from "@/app/api/report/route";
import { dismissReports, reportQueue, submitReport } from "@/lib/content/reports";
import { adminClient } from "@/lib/supabase/admin";
import { cleanup as fixturesCleanup, newPlayer, req } from "./fixtures";

const db = adminClient();
const DATE = "2099-07-01";
const HABIT_DATES = Array.from({ length: 10 }, (_, i) => `2099-08-${String(i + 1).padStart(2, "0")}`);
const users: string[] = [];
let qids: number[] = []; // 0 = reported a lot, 1 = reported by 3, 2 = exactly 10%, 3 + 4 filler
const plays = new Map<string, string>(); // user → play id

async function makeUsers(n: number): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < n; i += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, n - i) }, () => db.auth.admin.createUser({ email: `itest-rep-${randomUUID()}@example.com`, email_confirm: true })),
    );
    for (const r of batch) {
      if (r.error) throw r.error;
      out.push(r.data.user.id);
    }
  }
  users.push(...out);
  return out;
}

async function cleanup() {
  for (const id of users.splice(0)) await db.auth.admin.deleteUser(id); // cascades players, plays, guesses, reports
  await db.from("plays").delete().in("puzzle_date", [DATE, ...HABIT_DATES]);
  await db.from("puzzles").delete().in("puzzle_date", [DATE, ...HABIT_DATES]);
  await db.from("questions").delete().like("slug", "itest-rep-%");
}

const alertsBefore = { n: 0 };

beforeAll(async () => {
  await cleanup();
  const { count } = await db.from("alerts_sent").select("id", { count: "exact", head: true });
  alertsBefore.n = count ?? 0;
  const rows = Array.from({ length: 5 }, (_, i) => ({
    slug: `itest-rep-${i}`, category: `Rep${i}`, prompt: `Report test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 150,
    format: "int", max_change: 3, origin: "researched", status: "verified", tags: ["itest"],
  }));
  const { data, error } = await db.from("questions").insert(rows).select("id, slug");
  if (error) throw error;
  qids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  const s = await db.rpc("schedule_puzzle", { p_date: DATE, p_question_ids: qids });
  if (s.data !== "ok") throw new Error(JSON.stringify(s));

  // 100 players each played the day and locked in rounds 1–3.
  const ps = await makeUsers(100);
  const { data: playRows, error: pe } = await db.from("plays").insert(ps.map((player_id) => ({ player_id, puzzle_date: DATE }))).select("id, player_id");
  if (pe) throw pe;
  for (const p of playRows!) plays.set(p.player_id, p.id);
  const guesses = playRows!.flatMap((p) => [0, 1, 2].map((k) => ({ play_id: p.id, position: k + 1, question_id: qids[k], guess_log: 0.1, points: 80, tier: "close", wrong_way: false })));
  const { error: ge } = await db.from("guesses").insert(guesses);
  if (ge) throw ge;
}, 180_000);

afterAll(async () => {
  await cleanup();
  await fixturesCleanup();
}, 180_000);

const report = (player: string, qIndex: number) => submitReport(player, plays.get(player)!, qIndex + 1, "number", "looks off");

describe("report validity", () => {
  it("one report per player per question; a round must be locked in to be reported", async () => {
    const p = users[0]!;
    expect((await report(p, 0)).status).toBe("ok");
    expect((await report(p, 0)).status).toBe("already");
    expect((await submitReport(p, plays.get(p)!, 5, "fact", null)).status).toBe("not_locked"); // round 5 not played
    expect((await submitReport(users[1]!, plays.get(p)!, 1, "fact", null)).status).toBe("not_found"); // someone else's play
  });

  it("POST /api/report needs a session and a valid body", async () => {
    expect((await reportPOST(req("/api/report", { method: "POST", body: { play_id: randomUUID(), position: 1, reason: "number" } }))).status).toBe(401);
    const anon = await newPlayer();
    expect((await reportPOST(req("/api/report", { method: "POST", cookie: anon.cookie, body: { play_id: "nope", position: 1, reason: "number" } }))).status).toBe(400);
    expect((await reportPOST(req("/api/report", { method: "POST", cookie: anon.cookie, body: { play_id: randomUUID(), position: 1, reason: "number" } }))).status).toBe(404);
  });
});

describe("Reports queue (acceptance)", () => {
  it("11% of players reporting adds the question to the queue once, sends no email, and leaves it live", async () => {
    for (const p of users.slice(1, 11)) await report(p, 0); // users[0] already reported → 11 of 100
    const queue = await reportQueue();
    const mine = queue.filter((e) => e.question_id === qids[0]);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ seen: 100, valid_reports: 11 });
    expect(mine[0]!.rate).toBeCloseTo(0.11, 5);
    const { data: q } = await db.from("questions").select("status").eq("id", qids[0]).single();
    expect(q!.status).toBe("scheduled"); // still live: never pulled automatically
    const { data: r } = await db.from("puzzle_rounds").select("question_id").eq("puzzle_date", DATE).eq("position", 1).single();
    expect(r!.question_id).toBe(qids[0]);
    const { count } = await db.from("alerts_sent").select("id", { count: "exact", head: true });
    expect(count ?? 0).toBe(alertsBefore.n); // no email
  });

  it("3 reports do nothing (under the 10-report minimum), and exactly 10% isn't over the threshold", async () => {
    for (const p of users.slice(20, 23)) await report(p, 1);
    for (const p of users.slice(30, 40)) await report(p, 2); // 10 of 100 = 10%, not > 10%
    const ids = (await reportQueue()).map((e) => e.question_id);
    expect(ids).not.toContain(qids[1]);
    expect(ids).not.toContain(qids[2]);
  });

  it("a habitual reporter (more than 30% of 10+ rounds reported) is ignored", async () => {
    // One more report on question 2 would make it 11/100, unless the reporter is habitual.
    const [habit] = await makeUsers(1);
    await db.from("puzzles").insert(HABIT_DATES.map((puzzle_date) => ({ puzzle_date, status: "draft" })));
    const { data: hp } = await db.from("plays").insert([...HABIT_DATES, DATE].map((puzzle_date) => ({ player_id: habit, puzzle_date }))).select("id, puzzle_date");
    const dayPlay = hp!.find((p) => p.puzzle_date === DATE)!.id;
    plays.set(habit!, dayPlay);
    await db.from("guesses").insert(hp!.map((p) => ({ play_id: p.id, position: 3, question_id: p.puzzle_date === DATE ? qids[2] : qids[4], guess_log: 0, points: 50, tier: "meh", wrong_way: false })));
    // 11 rounds played; reports on 4 distinct questions = 36% > 30%.
    await report(habit!, 2);
    await db.from("reports").insert([qids[3], qids[4]].map((question_id) => ({ question_id, puzzle_date: DATE, position: 4, player_id: habit, reason: "other", valid: true })));
    await db.from("reports").insert({ question_id: qids[1], puzzle_date: DATE, position: 2, player_id: habit, reason: "other", valid: true });
    const q2 = (await reportQueue()).find((e) => e.question_id === qids[2]);
    expect(q2).toBeUndefined(); // still 10 valid of 101 seen
  });

  it("dismiss removes it until the rate rises 10 more points", async () => {
    expect(await dismissReports(qids[0]!, "itest@example.com")).toBe("ok");
    expect((await reportQueue()).some((e) => e.question_id === qids[0])).toBe(false);
    for (const p of users.slice(50, 61)) await report(p, 0); // 22 of 100 = 22% ≥ 11% + 10 points
    expect((await reportQueue()).some((e) => e.question_id === qids[0])).toBe(true);
  });
});

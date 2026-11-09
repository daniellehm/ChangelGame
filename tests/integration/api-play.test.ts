import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as guessPOST } from "@/app/api/guess/route";
import { GET as meGET } from "@/app/api/me/route";
import { POST as playPOST } from "@/app/api/play/route";
import { actualLog, scoreRound } from "@/lib/scoring";
import { adminClient } from "@/lib/supabase/admin";
import { cleanup, newPlayer, req, setupTestPuzzle, TEST_DATE, TEST_QUESTIONS } from "./fixtures";

let qids: number[] = [];
let A: Awaited<ReturnType<typeof newPlayer>>;
let B: Awaited<ReturnType<typeof newPlayer>>;
let playId = "";

const expectedScore = (i: number, g: number) => scoreRound(g, actualLog(TEST_QUESTIONS[i]!.start_value, TEST_QUESTIONS[i]!.end_value));
const guess = (cookie: string, body: Record<string, unknown>, now?: string) => guessPOST(req("/api/guess", { method: "POST", cookie, body, now }));

beforeAll(async () => {
  qids = await setupTestPuzzle();
  A = await newPlayer();
  B = await newPlayer();
  console.info(`[itest] players via ${A.anonymous ? "anonymous sign-in (POST /api/session)" : "email+password fallback (anonymous sign-ins are off)"}`);
}, 60_000);

afterAll(async () => {
  await cleanup();
}, 60_000);

describe("players", () => {
  it("a players row is created by the auth trigger (deferred check from 2.2)", async () => {
    const { data } = await adminClient().from("players").select("id").eq("id", A.id).maybeSingle();
    expect(data?.id).toBe(A.id);
  });
});

describe("POST /api/play", () => {
  it("401s without a session", async () => {
    const res = await playPOST(req("/api/play", { method: "POST", body: { date: TEST_DATE } }));
    expect(res.status).toBe(401);
  });

  it("starts a play, and starting again returns the same play (one per puzzle)", async () => {
    const r1 = await playPOST(req("/api/play", { method: "POST", cookie: A.cookie, body: { date: TEST_DATE, tz: "Australia/Sydney" } }));
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    expect(b1).toMatchObject({ date: TEST_DATE, completed_at: null, answered: [] });
    playId = b1.play_id;
    const b2 = await (await playPOST(req("/api/play", { method: "POST", cookie: A.cookie, body: { date: TEST_DATE } }))).json();
    expect(b2.play_id).toBe(playId);
  });

  it("403s when the window is closed", async () => {
    const res = await playPOST(req("/api/play", { method: "POST", cookie: B.cookie, body: { date: TEST_DATE }, now: "2099-03-05T00:00:00Z" }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/guess", () => {
  it("rejects an out-of-order guess", async () => {
    const res = await guess(A.cookie, { play_id: playId, position: 2, guess_log: 0 });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("out_of_order");
  });

  it("rejects a guess on someone else's play as not found", async () => {
    const res = await guess(B.cookie, { play_id: playId, position: 1, guess_log: 0.4 });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("play_not_found");
  });

  it("rejects a guess outside the window + grace", async () => {
    const res = await guess(A.cookie, { play_id: playId, position: 1, guess_log: 0.4 }, "2099-03-03T00:00:00Z");
    expect(res.status).toBe(403);
  });

  it("returns 409 question_changed if the client saw a different question", async () => {
    const res = await guess(A.cookie, { play_id: playId, position: 1, guess_log: 0.4, question_id: qids[1] });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("question_changed");
  });

  it("scores round 1 with lib/scoring, returns the answer and crowd stats", async () => {
    const res = await guess(A.cookie, { play_id: playId, position: 1, guess_log: 0.4, question_id: qids[0] });
    expect(res.status).toBe(200);
    const body = await res.json();
    const s = expectedScore(0, 0.4);
    expect(body).toMatchObject({ position: 1, question_id: qids[0], points: s.points, tier: s.tier, wrong_way: s.wrongWay, end_value: 250, fact: TEST_QUESTIONS[0]!.fact });
    expect(body.stats).toMatchObject({ n: 1, avg_points: s.points });
  });

  it("a duplicate returns 409 already_answered with the STORED result (double taps are harmless)", async () => {
    const res = await guess(A.cookie, { play_id: playId, position: 1, guess_log: -2 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("already_answered");
    expect(body.result).toMatchObject({ position: 1, guess_log: 0.4, points: expectedScore(0, 0.4).points });
  });

  it("guesses are insert-only (deferred check from 2.2)", async () => {
    const { error } = await adminClient().from("guesses").update({ points: 100 }).eq("play_id", playId);
    expect(error?.message).toMatch(/insert-only/);
  });

  it("resuming returns the answered rounds with answers", async () => {
    const body = await (await playPOST(req("/api/play", { method: "POST", cookie: A.cookie, body: { date: TEST_DATE } }))).json();
    expect(body.answered).toHaveLength(1);
    expect(body.answered[0]).toMatchObject({ position: 1, end_value: 250, guess_log: 0.4 });
  });

  it("finishing round 5 completes the play with the right total", async () => {
    const guesses = [0.4, -0.3, 0.002, 1.5, -0.2];
    for (let p = 2; p <= 5; p++) {
      const res = await guess(A.cookie, { play_id: playId, position: p, guess_log: guesses[p - 1] });
      expect(res.status, `round ${p}`).toBe(200);
    }
    const total = guesses.reduce((a, g, i) => a + expectedScore(i, g).points, 0);
    const { data } = await adminClient().from("plays").select("completed_at, total").eq("id", playId).single();
    expect(data!.completed_at).not.toBeNull();
    expect(data!.total).toBe(total);

    const me = await (await meGET(req(`/api/me?date=${TEST_DATE}&tz=Australia/Sydney`, { cookie: A.cookie }))).json();
    expect(me).toMatchObject({ games_played: 1, best_total: total, avg_total: total, current_streak: 1, max_streak: 1 });
    expect(Object.values(me.tiers as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(5);
    expect(me.recent[0]).toMatchObject({ date: TEST_DATE, total, completed: true });
  });

  it("concurrent double-tap on the same round stores exactly one guess", async () => {
    const play = await (await playPOST(req("/api/play", { method: "POST", cookie: B.cookie, body: { date: TEST_DATE } }))).json();
    const [r1, r2] = await Promise.all([
      guess(B.cookie, { play_id: play.play_id, position: 1, guess_log: 0.1 }),
      guess(B.cookie, { play_id: play.play_id, position: 1, guess_log: 0.9 }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const { count } = await adminClient().from("guesses").select("*", { count: "exact", head: true }).eq("play_id", play.play_id);
    expect(count).toBe(1);
  });

  it("round_stats counted both players' round 1", async () => {
    const { data } = await adminClient().from("round_stats").select("n").eq("puzzle_date", TEST_DATE).eq("position", 1).single();
    expect(data!.n).toBe(2);
  });

  it("400s on bad input", async () => {
    expect((await guess(A.cookie, { play_id: "nope", position: 1, guess_log: 0 })).status).toBe(400);
    expect((await guess(A.cookie, { play_id: playId, position: 6, guess_log: 0 })).status).toBe(400);
  });
});

describe("account deletion", () => {
  it("deleting the auth user cascades to player, plays and guesses (deferred check from 2.2)", async () => {
    const C = await newPlayer();
    const play = await (await playPOST(req("/api/play", { method: "POST", cookie: C.cookie, body: { date: TEST_DATE } }))).json();
    await guess(C.cookie, { play_id: play.play_id, position: 1, guess_log: 0 });
    await adminClient().auth.admin.deleteUser(C.id);
    const { data: p } = await adminClient().from("plays").select("id").eq("id", play.play_id);
    const { data: pl } = await adminClient().from("players").select("id").eq("id", C.id);
    expect(p).toEqual([]);
    expect(pl).toEqual([]);
  });
});

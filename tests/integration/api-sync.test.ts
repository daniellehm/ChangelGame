import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as playPOST } from "@/app/api/play/route";
import { POST as syncPOST } from "@/app/api/sync/route";
import { adminClient } from "@/lib/supabase/admin";
import { cleanup, expectedScore, newPlayer, req, setupTestPuzzle, TEST_DATE } from "./fixtures";

let A: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  await setupTestPuzzle();
  A = await newPlayer();
}, 60_000);
afterAll(async () => {
  await cleanup();
}, 60_000);

const sync = (cookie: string | undefined, body: unknown, now?: string) => syncPOST(req("/api/sync", { method: "POST", cookie, body, now }));
const guesses = [0.4, -0.3, 0, 1.5, -0.2].map((g, i) => ({ position: i + 1, guess_log: g }));

describe("POST /api/sync", () => {
  it("401s without a session", async () => {
    expect((await sync(undefined, { date: TEST_DATE, started_at: "2099-03-01T08:00:00+11:00", guesses })).status).toBe(401);
  });

  it("rejects gaps in positions", async () => {
    const res = await sync(A.cookie, { date: TEST_DATE, started_at: "2099-03-01T08:00:00+11:00", guesses: [guesses[0], guesses[2]] });
    expect(res.status).toBe(400);
  });

  it("stores a local play, re-scored on the server, excluded from crowd stats", async () => {
    // Client claims 100 points everywhere; the server ignores that and re-scores from guess_log.
    const res = await sync(A.cookie, { date: TEST_DATE, tz: "Australia/Sydney", started_at: "2099-03-01T08:00:00+11:00", guesses: guesses.map((g) => ({ ...g, points: 100 })) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("synced");
    const total = guesses.reduce((a, g, i) => a + expectedScore(i, g.guess_log).points, 0);
    const { data: play } = await adminClient().from("plays").select("source, total, completed_at").eq("id", body.play_id).single();
    expect(play).toMatchObject({ source: "local", total });
    expect(play!.completed_at).not.toBeNull();
    const { data: rs } = await adminClient().from("round_stats").select("n").eq("puzzle_date", TEST_DATE);
    expect(rs ?? []).toEqual([]); // local plays never count toward crowd stats
  });

  it("a second sync for the same date returns the existing play (server wins)", async () => {
    const res = await sync(A.cookie, { date: TEST_DATE, started_at: "2099-03-01T08:00:00+11:00", guesses: [{ position: 1, guess_log: -3 }] });
    const body = await res.json();
    expect(body.status).toBe("exists");
    expect(body.answered).toHaveLength(5);
    expect(body.answered[0].guess_log).toBe(0.4);
    const play = await (await playPOST(req("/api/play", { method: "POST", cookie: A.cookie, body: { date: TEST_DATE } }))).json();
    expect(play.play_id).toBe(body.play_id);
  });

  it("refuses puzzles more than 7 days old or not yet open", async () => {
    const B = await newPlayer();
    expect((await sync(B.cookie, { date: TEST_DATE, started_at: "2099-03-01T08:00:00+11:00", guesses }, "2099-03-12T00:00:00Z")).status).toBe(403);
    expect((await sync(B.cookie, { date: TEST_DATE, started_at: "2099-03-01T08:00:00+11:00", guesses }, "2099-02-27T00:00:00Z")).status).toBe(403);
  });
});

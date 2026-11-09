import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/reveal/route";
import { questionRange } from "@/lib/puzzles/repo";
import { actualLog, scoreRound } from "@/lib/scoring";
import { post, seededRounds } from "./helpers";

const NOW = "2026-11-10T09:00:00+11:00";
/** A date that never gets a puzzle (real days fill up as the game runs). */
const EMPTY_DAY = "2097-03-03";

describe("POST /api/reveal", () => {
  it("returns that round's answer and the same score as lib/scoring", async () => {
    const q = seededRounds("2026-11-10")[2]!;
    const g = -0.01; // inside this question's range
    const res = await POST(post("/api/reveal", { date: "2026-11-10", position: 3, guess_log: g }, NOW));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    const a = actualLog(q.start_value, q.end_value);
    const s = scoreRound(g, a, questionRange(q));
    expect(s.points).toBeGreaterThan(0);
    expect(body).toMatchObject({
      position: 3, guess_log: g, points: s.points, tier: s.tier, wrong_way: s.wrongWay,
      end_value: q.end_value, fact: q.fact, source_name: q.source_name, source_url: q.source_url,
    });
    expect(body.actual_log).toBeCloseTo(a, 10);
    expect(typeof body.question_id).toBe("number");
  });

  it("clamps the guess to the question's range", async () => {
    const r = questionRange(seededRounds("2026-11-10")[0]!);
    expect((await (await POST(post("/api/reveal", { date: "2026-11-10", position: 1, guess_log: 42 }, NOW))).json()).guess_log).toBeCloseTo(r.hi, 12);
    expect((await (await POST(post("/api/reveal", { date: "2026-11-10", position: 1, guess_log: -42 }, NOW))).json()).guess_log).toBeCloseTo(r.lo, 12);
  });

  it("accepts during the grace period after the window closes, and refuses after", async () => {
    // 2026-11-10 closes 2026-11-11T12:00Z; grace runs to 18:00Z.
    expect((await POST(post("/api/reveal", { date: "2026-11-10", position: 1, guess_log: 0 }, "2026-11-11T17:59:00Z"))).status).toBe(200);
    expect((await POST(post("/api/reveal", { date: "2026-11-10", position: 1, guess_log: 0 }, "2026-11-11T18:00:00Z"))).status).toBe(403);
    expect((await POST(post("/api/reveal", { date: "2026-11-10", position: 1, guess_log: 0 }, "2026-11-09T09:00:00Z"))).status).toBe(403);
  });

  it.each([
    [{ date: "2026-11-10", position: 6, guess_log: 0 }],
    [{ date: "2026-11-10", position: 0, guess_log: 0 }],
    [{ date: "2026-11-10", position: 1.5, guess_log: 0 }],
    [{ date: "2026-11-10", position: 1, guess_log: "0.2" }],
    [{ date: "2026-11-10", position: 1 }],
    [{ date: "nope", position: 1, guess_log: 0 }],
    ["not json"],
  ])("400s on bad input %#", async (body) => {
    const res = await POST(post("/api/reveal", body, NOW));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("404s for an open date with no puzzle", async () => {
    const res = await POST(post("/api/reveal", { date: EMPTY_DAY, position: 1, guess_log: 0 }, `${EMPTY_DAY}T09:00:00+11:00`));
    expect(res.status).toBe(404);
  });
});

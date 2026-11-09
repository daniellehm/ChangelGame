import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/puzzle/route";
import { get, seededRounds } from "./helpers";

const SYD_MORNING = "2026-11-10T09:00:00+11:00";
const ANSWER_KEYS = ["end_value", "fact", "source_name", "source_url", "source_url_2", "actual_log", "notes", "checks"];

describe("GET /api/puzzle", () => {
  afterEach(() => {
    process.env.ALLOW_TEST_CLOCK = "1";
  });

  it("returns the puzzle for an open date, with number, theme and 5 public rounds", async () => {
    const res = await GET(get("/api/puzzle?date=2026-11-10", SYD_MORNING));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ date: "2026-11-10", number: 2, theme: null, rerun: false });
    const expected = seededRounds("2026-11-10");
    expect(body.rounds.map((r: { prompt: string }) => r.prompt)).toEqual(expected.map((q) => q.prompt));
    expect(body.rounds[0]).toEqual({
      position: 1,
      question_id: expect.any(Number),
      category: expected[0]!.category,
      prompt: expected[0]!.prompt,
      start_year: expected[0]!.start_year,
      start_value: expected[0]!.start_value,
      end_year: expected[0]!.end_year,
      format: expected[0]!.format,
    });
  });

  it("contains no answers anywhere in the response", async () => {
    for (const date of ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]) {
      const res = await GET(get(`/api/puzzle?date=${date}`, `${date}T09:00:00+11:00`));
      const text = await res.text();
      for (const k of ANSWER_KEYS) expect(text, `${date} leaks ${k}`).not.toContain(`"${k}"`);
      for (const q of seededRounds(date)) {
        expect(text, `${date} leaks end value of ${q.slug}`).not.toMatch(new RegExp(`[:,\\[]${q.end_value}[,}\\]]`));
        if (q.fact) expect(text).not.toContain(q.fact.slice(0, 30));
      }
    }
  });

  it("is CDN-cacheable for 5 minutes when it succeeds", async () => {
    const res = await GET(get("/api/puzzle?date=2026-11-10", SYD_MORNING));
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("403s outside the date window (device clock ahead / behind)", async () => {
    const ahead = await GET(get("/api/puzzle?date=2026-11-13", SYD_MORNING));
    expect(ahead.status).toBe(403);
    expect((await ahead.json()).error.code).toBe("puzzle_not_available");
    expect(ahead.headers.get("cache-control")).toBe("no-store");
    const behind = await GET(get("/api/puzzle?date=2026-11-08", SYD_MORNING));
    expect(behind.status).toBe(403);
  });

  it("serves exactly at the window edges", async () => {
    expect((await GET(get("/api/puzzle?date=2026-11-10", "2026-11-09T10:00:00Z"))).status).toBe(200);
    expect((await GET(get("/api/puzzle?date=2026-11-10", "2026-11-09T09:59:59Z"))).status).toBe(403);
    expect((await GET(get("/api/puzzle?date=2026-11-10", "2026-11-11T11:59:59Z"))).status).toBe(200);
    expect((await GET(get("/api/puzzle?date=2026-11-10", "2026-11-11T12:00:00Z"))).status).toBe(403);
  });

  it("404s when the window is open but no puzzle is scheduled", async () => {
    const res = await GET(get("/api/puzzle?date=2026-11-13", "2026-11-13T09:00:00+11:00"));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("puzzle_not_found");
  });

  it.each(["", "date=", "date=2026-13-01", "date=2026-02-30", "date=tomorrow", "date=2026-11-10T00:00"])("400s on bad input: ?%s", async (q) => {
    const res = await GET(get(`/api/puzzle?${q}`, SYD_MORNING));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });

  it("ignores the test clock header unless ALLOW_TEST_CLOCK=1 (real clock → 2026-11-10 is long closed or not yet open)", async () => {
    process.env.ALLOW_TEST_CLOCK = "";
    const res = await GET(get("/api/puzzle?date=2026-11-12", "2026-11-12T09:00:00+11:00"));
    // With the real clock, the answer depends on today's date; it must match the window for the REAL now.
    const { isWindowOpen } = await import("@/lib/dates");
    expect(res.status === 403).toBe(!isWindowOpen("2026-11-12", Date.now()));
  });
});

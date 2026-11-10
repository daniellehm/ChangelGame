/** M6 task 6.4: visits, events and daily_metrics against the real DB, on throwaway 2099 dates. */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as eventsPOST } from "@/app/api/events/route";
import { recordVisit } from "@/lib/analytics/server";
import { writeDailyMetrics } from "@/lib/analytics/metrics";
import { getAnalytics } from "@/lib/admin/analytics";
import { adminClient } from "@/lib/supabase/admin";

const db = adminClient();
const DAY = "2099-08-01";
const NOW = new Date(`${DAY}T03:00:00Z`); // 13:00 in Sydney, same date
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const users: string[] = [];
let qIds: number[] = [];

const hdrs = (over: Record<string, string> = {}) =>
  new Headers({ "user-agent": IPHONE, "x-forwarded-for": "203.0.113.9", "x-vercel-ip-country": "AU", "x-vercel-ip-timezone": "Australia/Sydney", host: "changel.app", ...over });

async function cleanup() {
  for (const u of users) await db.auth.admin.deleteUser(u);
  await db.from("visits").delete().gte("puzzle_date", "2099-07-01").lte("puzzle_date", "2099-08-31");
  await db.from("events").delete().gte("puzzle_date", "2099-07-01").lte("puzzle_date", "2099-08-31");
  await db.from("daily_metrics").delete().gte("puzzle_date", "2099-07-01").lte("puzzle_date", "2099-08-31");
  await db.from("plays").delete().in("puzzle_date", ["2099-07-31", DAY]);
  await db.from("puzzles").delete().in("puzzle_date", ["2099-07-31", DAY]);
  await db.from("questions").delete().like("slug", "itest-analytics-%");
}

beforeAll(async () => {
  await cleanup();
  const rows = Array.from({ length: 10 }, (_, i) => ({
    slug: `itest-analytics-${i}`, category: `An${i}`, prompt: `Analytics test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 150,
    format: "int", max_change: 3, origin: "researched", status: "verified", tags: ["itest"],
  }));
  const { data } = await db.from("questions").insert(rows).select("id, slug");
  qIds = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  expect((await db.rpc("schedule_puzzle", { p_date: "2099-07-31", p_question_ids: qIds.slice(5) })).data).toBe("ok");
  expect((await db.rpc("schedule_puzzle", { p_date: DAY, p_question_ids: qIds.slice(0, 5) })).data).toBe("ok");
});

afterAll(cleanup);

describe("visits", () => {
  it("one row per visitor per day, with country, device and share flag; bots skipped; no referrer under DNT", async () => {
    await recordVisit(hdrs({ referer: "https://www.reddit.com/r/x" }), true, NOW);
    await recordVisit(hdrs({ referer: "https://www.reddit.com/r/x" }), false, NOW); // same visitor, same day: ignored
    await recordVisit(hdrs({ "x-forwarded-for": "203.0.113.10", dnt: "1", referer: "https://t.co/x" }), false, NOW);
    await recordVisit(hdrs({ "user-agent": "WhatsApp/2.24", "x-forwarded-for": "203.0.113.11" }), false, NOW);
    const { data } = await db.from("visits").select("country, device, referrer, from_share").eq("puzzle_date", DAY).order("id");
    expect(data).toEqual([
      { country: "AU", device: "mobile", referrer: "reddit.com", from_share: true },
      { country: "AU", device: "mobile", referrer: null, from_share: false },
    ]);
  });
});

describe("events", () => {
  it("records share_clicked with its method (no session: the visitor hash), and rejects unknown events", async () => {
    const ok = await eventsPOST(new Request("http://localhost/api/events", { method: "POST", headers: hdrs({ "content-type": "application/json" }), body: JSON.stringify({ name: "share_clicked", date: DAY, props: { method: "share_sheet" } }) }));
    expect(ok.status).toBe(204);
    const { data } = await db.from("events").select("name, props, user_id, visitor_hash").eq("puzzle_date", DAY);
    expect(data).toEqual([{ name: "share_clicked", props: { method: "share_sheet" }, user_id: null, visitor_hash: expect.stringMatching(/^[0-9a-f]{32}$/) }]);
    for (const body of [{ name: "play_started", date: DAY }, { name: "share_clicked", date: DAY, props: { method: "pigeon" } }, { name: "share_clicked", date: "nope", props: { method: "clipboard" } }]) {
      const bad = await eventsPOST(new Request("http://localhost/api/events", { method: "POST", headers: hdrs({ "content-type": "application/json" }), body: JSON.stringify(body) }));
      expect(bad.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("daily metrics", () => {
  it("computes a finished day's numbers and stores them (new vs returning, funnel, scores, shares)", async () => {
    // Player A also played the day before (returning); player B is new and stops after round 2.
    for (const [i, days] of [[0, ["2099-07-31", DAY]], [1, [DAY]]] as const) {
      const u = await db.auth.admin.createUser({ email: `itest-analytics-${i}-${randomUUID()}@example.com`, email_confirm: true });
      users.push(u.data.user!.id);
      for (const d of days) {
        const { data: play } = await db.from("plays").insert({ player_id: u.data.user!.id, puzzle_date: d }).select("id").single();
        if (d !== DAY) continue;
        const n = i === 0 ? 5 : 2;
        const ids = qIds.slice(0, 5);
        await db.from("guesses").insert(Array.from({ length: n }, (_, k) => ({ play_id: play!.id, position: k + 1, question_id: ids[k], guess_log: 0.1, points: 80, tier: "close", wrong_way: false })));
        if (n === 5) await db.from("plays").update({ completed_at: NOW.toISOString(), total: 400 }).eq("id", play!.id);
      }
    }
    const written = await writeDailyMetrics(new Date("2099-08-02T17:30:00Z"));
    expect(written).toContain(DAY);
    const { data } = await db.from("daily_metrics").select("metrics").eq("puzzle_date", DAY).single();
    expect(data!.metrics).toMatchObject({
      visits: 2,
      visits_from_share: 1,
      visits_by_device: { mobile: 2 },
      visits_by_country: { AU: 2 },
      referrers: { "reddit.com": 1 },
      players: 2,
      new_players: 1,
      completed: 1,
      rounds_locked: [2, 2, 1, 1, 1],
      avg_total: 400,
      score_buckets: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      shares: 1,
      sharers: 1,
      shares_by_method: { share_sheet: 1 },
    });
    // Already written days aren't recomputed (except the latest finished one).
    expect(await writeDailyMetrics(new Date("2099-08-03T17:30:00Z"))).toEqual(["2099-08-02"]);
  });
});

describe("admin analytics ranges", () => {
  // Production 2026-11-10: picking "All" threw "Invalid time value" (Number("all") is NaN).
  it("every range loads, and All starts at launch", async () => {
    for (const range of ["7", "30", "90", "all"] as const) {
      const data = await getAnalytics(range, new Date("2026-11-10T03:00:00Z"));
      expect(data.range).toBe(range);
      expect(data.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const all = await getAnalytics("all", new Date("2026-11-10T03:00:00Z"));
    const week = await getAnalytics("7", new Date("2026-11-10T03:00:00Z"));
    expect(all.from <= week.from).toBe(true);
  }, 60_000);
});

/**
 * M5 task 5.10 acceptance: deleting a day triggers the rerun plus an alert.
 * Throwaway 2098/2099 dates. Alert emails are recorded, never sent (CHANGEL_NO_ALERT_EMAIL=1).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as puzzleGET } from "@/app/api/puzzle/route";
import { ensureRerun } from "@/lib/puzzles/rerun";
import { findReadyPuzzle } from "@/lib/puzzles/repo";
import { adminClient } from "@/lib/supabase/admin";
import { get } from "./helpers";

const db = adminClient();
const ORIGINAL = "2098-01-01";
const DAY = "2099-01-05";

async function cleanup() {
  await db.from("puzzles").delete().eq("puzzle_date", DAY); // the rerun points at ORIGINAL, so it goes first
  await db.from("puzzles").delete().eq("puzzle_date", ORIGINAL);
  await db.from("questions").delete().like("slug", "itest-rerun-%");
  await db.from("alerts_sent").delete().like("kind", `rerun:${DAY}`);
}

beforeAll(async () => {
  await cleanup();
  const rows = Array.from({ length: 10 }, (_, i) => ({
    slug: `itest-rerun-${i}`, category: `Rr${i}`, prompt: `Rerun test question ${i}`, start_year: 2000, start_value: 100, end_year: 2020, end_value: 150,
    format: "int", max_change: 3, origin: "researched", status: "verified", tags: ["itest"],
  }));
  const { data, error } = await db.from("questions").insert(rows).select("id, slug");
  if (error) throw error;
  const ids = rows.map((r) => data!.find((d) => d.slug === r.slug)!.id as number);
  expect((await db.rpc("schedule_puzzle", { p_date: ORIGINAL, p_question_ids: ids.slice(0, 5) })).data).toBe("ok");
  expect((await db.rpc("schedule_puzzle", { p_date: DAY, p_question_ids: ids.slice(5) })).data).toBe("ok");
});

afterAll(cleanup);

describe("rerun fallback (acceptance)", () => {
  it("deleting a day → a rerun of an earlier puzzle is served, labelled, with an alert", async () => {
    await db.from("puzzles").delete().eq("puzzle_date", DAY); // "deleting a day"
    // The window for 2099 isn't open by the real clock, so lookups don't create it by themselves:
    expect(await findReadyPuzzle(DAY)).toBeNull();
    // When the window opens (simulated here), the fallback runs:
    expect(await ensureRerun(DAY)).toBe(ORIGINAL); // the most recent original ≥ 365 days earlier
    const res = await puzzleGET(get(`/api/puzzle?date=${DAY}`, `${DAY}T09:00:00+11:00`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rerun).toBe(true);
    expect(body.rounds.map((r: { prompt: string }) => r.prompt)).toEqual(Array.from({ length: 5 }, (_, i) => `Rerun test question ${i}`));
    const { data: alerts } = await db.from("alerts_sent").select("kind, details").eq("kind", `rerun:${DAY}`);
    expect(alerts).toHaveLength(1);
    expect(alerts![0]!.details).toMatchObject({ suppressed: true });
  });

  it("is idempotent: a second request reuses the rerun and doesn't alert again", async () => {
    expect(await ensureRerun(DAY)).toBe(ORIGINAL);
    const { data: p } = await db.from("puzzles").select("rerun_of, status").eq("puzzle_date", DAY);
    expect(p).toEqual([{ rerun_of: ORIGINAL, status: "ready" }]);
    const { count } = await db.from("alerts_sent").select("id", { count: "exact", head: true }).eq("kind", `rerun:${DAY}`);
    expect(count).toBe(1);
  });

  it("the fresh=… reload after a same-day swap is never cached", async () => {
    const res = await puzzleGET(get(`/api/puzzle?date=${DAY}&fresh=123`, `${DAY}T09:00:00+11:00`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

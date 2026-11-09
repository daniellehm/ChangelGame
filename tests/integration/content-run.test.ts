/**
 * M5 task 5.6: run bookkeeping against the real content_runs table. Questions live in
 * the in-memory store and Claude is fake, so nothing real is generated or spent.
 */
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/content/route";
import { runContentHop, schedulingToday } from "@/lib/content/run";
import { adminClient } from "@/lib/supabase/admin";
import { fakeClaude, fetchFn, memoryStore } from "../helpers/content-fakes";

const db = adminClient();
const runIds = new Set<number>();
const track = (id: number | null) => id && runIds.add(id);

async function closeOpenRuns() {
  // Tests must never leave a 'running' row: the real cron would adopt it.
  await db.from("content_runs").update({ status: "done", lease_until: null }).eq("status", "running").eq("trigger", "test");
}

afterEach(closeOpenRuns);
afterAll(async () => {
  if (runIds.size) await db.from("content_runs").delete().in("id", [...runIds]);
});

describe("runContentHop", () => {
  it("starts a run, does the work, adds up counters and finishes it", async () => {
    const mem = memoryStore();
    const claude = fakeClaude(mem);
    let out = await runContentHop("test", null, { store: mem.store, llm: claude.llm, fetchFn, today: "2026-11-09" });
    track(out.runId);
    for (let i = 0; i < 20 && out.status === "continue"; i++) out = await runContentHop("test", out.runId, { store: mem.store, llm: claude.llm, fetchFn, today: "2026-11-09" });
    expect(out.status).toBe("done");
    const { data } = await db.from("content_runs").select("status, hops, generated, verified, flagged, scheduled, finished_at, lease_until").eq("id", out.runId!).single();
    expect(data).toMatchObject({ status: "done", lease_until: null });
    expect(data!.finished_at).not.toBeNull();
    expect(data!.scheduled).toBe(24); // days 7–30
    expect(data!.generated).toBe(data!.verified + data!.flagged);
    expect(data!.hops).toBeGreaterThanOrEqual(1);
  });

  it("a second hop while one holds the lease gets 'busy'", async () => {
    const { data: run } = await db.from("content_runs").insert({ trigger: "test" }).select("id").single();
    track(run!.id);
    await db.rpc("lease_content_run", { p_run_id: run!.id, p_seconds: 60 });
    const mem = memoryStore();
    const out = await runContentHop("test", run!.id, { store: mem.store, llm: fakeClaude(mem).llm, fetchFn });
    expect(out.status).toBe("busy");
  });

  it("records a failure on the run instead of throwing", async () => {
    const mem = memoryStore();
    mem.store.pool = async () => {
      throw new Error("database exploded");
    };
    const out = await runContentHop("test", null, { store: mem.store, llm: fakeClaude(mem).llm, fetchFn });
    track(out.runId);
    expect(out.status).toBe("failed");
    const { data } = await db.from("content_runs").select("status, error").eq("id", out.runId!).single();
    expect(data).toMatchObject({ status: "failed", error: "database exploded" });
  });
});

describe("GET /api/cron/content", () => {
  it("refuses without the cron secret", async () => {
    const res = await GET(new Request("http://localhost/api/cron/content"));
    expect(res.status).toBe(401);
  });
});

describe("schedulingToday", () => {
  it("is the date in the earliest time zone (UTC+14)", () => {
    expect(schedulingToday(new Date("2026-11-09T10:30:00Z"))).toBe("2026-11-10");
    expect(schedulingToday(new Date("2026-11-09T09:30:00Z"))).toBe("2026-11-09");
  });
});

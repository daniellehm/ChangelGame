import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as cleanupGET } from "@/app/api/cron/cleanup/route";
import { adminClient } from "@/lib/supabase/admin";
import { cleanup, newPlayer, req, setupTestPuzzle, TEST_DATE } from "./fixtures";

let idle: Awaited<ReturnType<typeof newPlayer>>;
let active: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  await setupTestPuzzle();
  idle = await newPlayer(); // never plays
  active = await newPlayer();
  const { error } = await adminClient().from("plays").insert({ player_id: active.id, puzzle_date: TEST_DATE });
  if (error) throw error;
}, 60_000);
afterAll(async () => {
  await cleanup();
}, 60_000);

const cron = (auth?: string) => {
  const r = req("/api/cron/cleanup");
  if (auth) r.headers.set("authorization", auth);
  return r;
};

describe("cron cleanup", () => {
  it("401s without the cron secret, or with a wrong one", async () => {
    expect((await cleanupGET(cron())).status).toBe(401);
    expect((await cleanupGET(cron("Bearer nope"))).status).toBe(401);
  });

  it("8 days on, an anonymous user with no plays is a candidate; one with plays is not", async () => {
    // Read-only: lists candidates as of a future "now" without deleting anything.
    const future = new Date(Date.now() + 8 * 86_400_000).toISOString();
    const { data, error } = await adminClient().rpc("cleanup_candidates", { p_now: future, p_limit: 10_000 });
    expect(error).toBeNull();
    const ids = (data as Array<{ user_id: string; reason: string }>).map((c) => c.user_id);
    expect(ids).toContain(idle.id);
    expect(ids).not.toContain(active.id);
  });

  it("today, a fresh anonymous user is NOT purged", async () => {
    const res = await cleanupGET(cron(`Bearer ${process.env.CRON_SECRET}`));
    expect(res.status).toBe(200);
    const { data } = await adminClient().auth.admin.getUserById(idle.id);
    expect(data.user?.id).toBe(idle.id);
  });
});

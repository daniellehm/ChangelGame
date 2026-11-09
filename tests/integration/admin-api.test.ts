/** M5 task 5.7: admin endpoints are server-checked against ADMIN_EMAILS. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as overviewGET } from "@/app/api/admin/overview/route";
import { POST as runPOST } from "@/app/api/admin/run/route";
import { cleanup, newAccount, newPlayer, req } from "./fixtures";

let admin: Awaited<ReturnType<typeof newAccount>>;
let other: Awaited<ReturnType<typeof newAccount>>;
let anon: Awaited<ReturnType<typeof newPlayer>>;
const saved = process.env.ADMIN_EMAILS;

beforeAll(async () => {
  [admin, other, anon] = await Promise.all([newAccount(), newAccount(), newPlayer()]);
  process.env.ADMIN_EMAILS = `someone-else@example.com, ${admin.email.toUpperCase()}`;
}, 60_000);

afterAll(async () => {
  process.env.ADMIN_EMAILS = saved;
  await cleanup();
}, 60_000);

describe("admin access", () => {
  it("401 without a session, 401 for an anonymous player, 403 for an account not on the list", async () => {
    expect((await overviewGET(req("/api/admin/overview"))).status).toBe(401);
    expect((await overviewGET(req("/api/admin/overview", { cookie: anon.cookie }))).status).toBe(401);
    const res = await overviewGET(req("/api/admin/overview", { cookie: other.cookie }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden");
  });

  it("an admin gets the overview: queues, buffer, spend, alerts, and no caching", async () => {
    const res = await overviewGET(req("/api/admin/overview", { cookie: admin.cookie }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const o = await res.json();
    expect(o).toMatchObject({ queues: { reports: expect.any(Number), flagged: expect.any(Number), upcoming: expect.any(Number) }, spend: { cap: 50 } });
    expect(typeof o.readyDaysAhead).toBe("number");
    expect(Array.isArray(o.alerts)).toBe(true);
  });

  it("'Run now' is admin-only", async () => {
    expect((await runPOST(req("/api/admin/run", { method: "POST", cookie: other.cookie }))).status).toBe(403);
    expect((await runPOST(req("/api/admin/run", { method: "POST" }))).status).toBe(401);
  });
});

/**
 * M6 task 6.7: Turnstile on new anonymous players, against Cloudflare's real endpoint with its
 * documented test secrets (always-pass / always-fail). Existing sessions never need a token.
 */
import { afterAll, describe, expect, it } from "vitest";
import { POST as sessionPOST } from "@/app/api/session/route";
import { adminClient } from "@/lib/supabase/admin";

const ALWAYS_PASS = "1x0000000000000000000000000000000AA";
const ALWAYS_FAIL = "2x0000000000000000000000000000000AA";
const saved = process.env.TURNSTILE_SECRET;
const created: string[] = [];

const post = (body: unknown, cookie?: string) =>
  sessionPOST(new Request("http://localhost/api/session", { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }));

afterAll(async () => {
  process.env.TURNSTILE_SECRET = saved;
  for (const id of created) await adminClient().auth.admin.deleteUser(id);
});

describe("POST /api/session with Turnstile on", () => {
  it("asks for a token, rejects a failing one, accepts a passing one; an existing session needs none", async () => {
    process.env.TURNSTILE_SECRET = ALWAYS_PASS;
    const missing = await post({ tz: "Australia/Sydney" });
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe("turnstile_required");

    process.env.TURNSTILE_SECRET = ALWAYS_FAIL;
    const failed = await post({ tz: "Australia/Sydney", turnstile: "XXXX.DUMMY.TOKEN.XXXX" });
    expect((await failed.json()).error.code).toBe("turnstile_failed");

    process.env.TURNSTILE_SECRET = ALWAYS_PASS;
    const ok = await post({ tz: "Australia/Sydney", turnstile: "XXXX.DUMMY.TOKEN.XXXX" });
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ anonymous: true, created: true });
    created.push(body.user_id);

    // The same browser again: its session is reused, no token needed.
    const cookie = ok.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const again = await post({ tz: "Australia/Sydney" }, cookie);
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ user_id: body.user_id, created: false });
  });
});

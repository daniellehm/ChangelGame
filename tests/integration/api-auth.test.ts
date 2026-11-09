/**
 * M4 acceptance (SPEC §12): an anonymous player with 3 plays logs in on a
 * second device holding 2 other plays and ends with all 5 (earlier-started
 * kept on clashes). Plus code checks, export, sign-out and account deletion.
 * Emails are never sent here: the test-only header skips sending, and codes
 * come from the Supabase admin API.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as exportGET } from "@/app/api/account/export/route";
import { POST as deletePOST } from "@/app/api/account/delete/route";
import { POST as emailPOST } from "@/app/api/auth/email/route";
import { POST as signoutPOST } from "@/app/api/auth/signout/route";
import { POST as verifyPOST } from "@/app/api/auth/verify/route";
import { GET as meGET } from "@/app/api/me/route";
import { TEST_NO_EMAIL_HEADER } from "@/lib/api/clock";
import { AUTH_FLOW_COOKIE, MERGE_COOKIE } from "@/lib/auth/cookies";
import { adminClient } from "@/lib/supabase/admin";
import { Jar } from "./cookie-jar";
import { cleanup, newAccount, newPlayer, req } from "./fixtures";

const DATES = ["2099-04-01", "2099-04-02", "2099-04-03", "2099-04-04", "2099-04-05"];
const email = `itest-${randomUUID()}@example.com`;
const extraUsers: string[] = [];
const db = () => adminClient();

async function clearDates() {
  await db().from("plays").delete().in("puzzle_date", DATES);
  await db().from("puzzles").delete().in("puzzle_date", DATES);
}

async function addPlay(playerId: string, date: string, startedAt: string, total: number) {
  const { error } = await db().from("plays").insert({ player_id: playerId, puzzle_date: date, started_at: startedAt, completed_at: startedAt, total, tz_at_play: "Australia/Sydney" });
  if (error) throw error;
}

const post = (path: string, jar: Jar, body: unknown, extra: Record<string, string> = {}) => {
  const r = req(path, { method: "POST", cookie: jar.header(), body });
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
};

async function codeFor(addr: string): Promise<string> {
  const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email: addr });
  if (error) throw error;
  return data.properties.email_otp;
}

let A: Awaited<ReturnType<typeof newPlayer>>;
let B: Awaited<ReturnType<typeof newPlayer>>;

beforeAll(async () => {
  await clearDates();
  const { error } = await db().from("puzzles").insert(DATES.map((d) => ({ puzzle_date: d, status: "ready" })));
  if (error) throw error;

  // Device A: anonymous with 3 plays, then saves its streak with an email (upgrade in place: same id).
  A = await newPlayer();
  await addPlay(A.id, DATES[0]!, "2099-04-01T09:00:00Z", 300);
  await addPlay(A.id, DATES[1]!, "2099-04-02T09:00:00Z", 310);
  await addPlay(A.id, DATES[2]!, "2099-04-03T09:00:00Z", 320); // clash: B started this date EARLIER
  const { error: e2 } = await db().auth.admin.updateUserById(A.id, { email, email_confirm: true });
  if (e2) throw e2;

  // Device B: a different anonymous player with 2 other plays + the earlier clash.
  B = await newPlayer();
  await addPlay(B.id, DATES[2]!, "2099-04-03T08:00:00Z", 111); // earlier → kept
  await addPlay(B.id, DATES[3]!, "2099-04-04T09:00:00Z", 330);
  await addPlay(B.id, DATES[4]!, "2099-04-05T09:00:00Z", 340);
}, 60_000);

afterAll(async () => {
  for (const id of extraUsers) await db().auth.admin.deleteUser(id);
  await db().auth.admin.deleteUser(A.id).catch(() => undefined);
  await cleanup();
  await clearDates();
}, 60_000);

describe("sign-in emails", () => {
  it("always answer { sent: true } and remember the flow in an HTTP-only cookie", async () => {
    const jar = new Jar(B.cookie);
    const res = await emailPOST(post("/api/auth/email", jar, { email }, { [TEST_NO_EMAIL_HEADER]: "1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    const set = res.headers.getSetCookie().join("\n");
    expect(set).toMatch(new RegExp(`${AUTH_FLOW_COOKIE}=.*HttpOnly`, "i"));
    expect(set).toMatch(new RegExp(`${MERGE_COOKIE}=.*HttpOnly`, "i")); // anonymous + existing account → merge token
  });

  it("an anonymous player with a NEW email upgrades in place (no merge token)", async () => {
    const C = await newPlayer();
    extraUsers.push(C.id);
    const res = await emailPOST(post("/api/auth/email", new Jar(C.cookie), { email: `itest-${randomUUID()}@example.com` }, { [TEST_NO_EMAIL_HEADER]: "1" }));
    expect(res.status).toBe(200);
    const set = res.headers.getSetCookie().join("\n");
    expect(set).toContain(AUTH_FLOW_COOKIE);
    expect(decodeURIComponent(set)).toContain('"type":"email_change"');
    expect(set).not.toContain(MERGE_COOKIE);
  });

  it("a signed-in account can't change to an email another account already uses", async () => {
    const other = await newAccount();
    const me = await newAccount();
    const res = await emailPOST(post("/api/auth/email", new Jar(me.cookie), { email: other.email }, { [TEST_NO_EMAIL_HEADER]: "1" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("email_taken");
  });

  it("rejects a bad email", async () => {
    const res = await emailPOST(post("/api/auth/email", new Jar(), { email: "not-an-email" }, { [TEST_NO_EMAIL_HEADER]: "1" }));
    expect(res.status).toBe(400);
  });
});

describe("M4 acceptance: second device signs in and merges", () => {
  it("a wrong code is refused and nothing merges", async () => {
    const jar = new Jar(B.cookie);
    jar.update(await emailPOST(post("/api/auth/email", jar, { email }, { [TEST_NO_EMAIL_HEADER]: "1" })));
    const res = await verifyPOST(post("/api/auth/verify", jar, { code: "000000" }));
    expect(res.status).toBe(400);
    const { count } = await db().from("plays").select("*", { count: "exact", head: true }).eq("player_id", B.id);
    expect(count).toBe(3);
  });

  it("ends with all 5 plays on the account, earlier-started kept on the clash", async () => {
    const jar = new Jar(B.cookie);
    jar.update(await emailPOST(post("/api/auth/email", jar, { email }, { [TEST_NO_EMAIL_HEADER]: "1" })));
    const res = await verifyPOST(post("/api/auth/verify", jar, { code: await codeFor(email) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, email, merged: { merged: 3, kept: 0, replaced: 1 } });
    jar.update(res);
    expect(jar.has(MERGE_COOKIE)).toBe(false);

    const { data: plays } = await db().from("plays").select("puzzle_date, total").eq("player_id", A.id).order("puzzle_date");
    expect(plays!.map((p) => p.puzzle_date)).toEqual(DATES);
    expect(plays!.find((p) => p.puzzle_date === DATES[2])!.total).toBe(111); // B's earlier attempt won

    // The anonymous user is gone, and this browser is now the account.
    const { data: gone } = await db().auth.admin.getUserById(B.id);
    expect(gone.user).toBeNull();
    const me = await (await meGET(req("/api/me", { cookie: jar.header() }))).json();
    expect(me).toMatchObject({ player_id: A.id, anonymous: false, email, games_played: 5 });

    // Export has everything; sign-out ends the session.
    const exp = await exportGET(req("/api/account/export", { cookie: jar.header() }));
    expect(exp.headers.get("content-disposition")).toMatch(/attachment; filename="changel-data-/);
    expect((await exp.json()).plays).toHaveLength(5);

    const out = await signoutPOST(post("/api/auth/signout", jar, {}));
    jar.update(out);
    expect((await meGET(req("/api/me", { cookie: jar.header() }))).status).toBe(401);
  });

  it("a merge token can't be reused", async () => {
    const { count } = await db().from("merge_tokens").select("*", { count: "exact", head: true }).eq("anon_user_id", B.id).is("used_at", null);
    expect(count ?? 0).toBe(0);
  });
});

describe("account deletion", () => {
  it("needs confirm: DELETE, then hard-deletes the user and their plays", async () => {
    const D = await newPlayer();
    await addPlay(D.id, DATES[0]!, "2099-04-01T10:00:00Z", 200);
    const jar = new Jar(D.cookie);
    expect((await deletePOST(post("/api/account/delete", jar, { confirm: "yes" }))).status).toBe(400);
    const res = await deletePOST(post("/api/account/delete", jar, { confirm: "DELETE" }));
    expect(res.status).toBe(200);
    const { data: u } = await db().auth.admin.getUserById(D.id);
    expect(u.user).toBeNull();
    const { count } = await db().from("plays").select("*", { count: "exact", head: true }).eq("player_id", D.id);
    expect(count).toBe(0);
  });
});

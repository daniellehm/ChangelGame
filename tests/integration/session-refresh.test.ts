/**
 * The proxy refreshes an expired session once and hands the new tokens to the browser
 * (Dani 2026-11-10: signed-in players were silently signed out because some code swapped
 * the refresh token without sending the new one back). Against the real Supabase auth server.
 */
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { GET as meGET } from "@/app/api/me/route";
import { cleanup, newAccount, req } from "./fixtures";

let account: Awaited<ReturnType<typeof newAccount>>;

beforeAll(async () => {
  account = await newAccount();
}, 60_000);
afterAll(cleanup, 60_000);

type Jar = Map<string, string>;
const parse = (header: string): Jar => new Map(header.split("; ").filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]));
const header = (jar: Jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

/** The session JSON inside Supabase's (possibly chunked, base64url) auth cookie. */
function readSession(jar: Jar): { name: string; session: Record<string, unknown> } {
  const name = [...jar.keys()].find((k) => /^sb-.*-auth-token(\.0)?$/.test(k))!.replace(/\.0$/, "");
  const raw = jar.has(name) ? jar.get(name)! : [0, 1, 2, 3, 4].map((i) => jar.get(`${name}.${i}`) ?? "").join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : decodeURIComponent(raw);
  return { name, session: JSON.parse(json) };
}

/** Same cookie, but the session says its access token expired a minute ago. */
function expire(jar: Jar): Jar {
  const { name, session } = readSession(jar);
  const out = new Map([...jar].filter(([k]) => !k.startsWith(name)));
  out.set(name, `base64-${Buffer.from(JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) - 60 }), "utf8").toString("base64url")}`);
  return out;
}

describe("session refresh in the proxy", () => {
  it("an expired session is refreshed once and the browser gets the new tokens (on the response and the request)", async () => {
    const jar = expire(parse(account.cookie));
    const before = readSession(jar).session;
    const res = await proxy(new NextRequest("https://changel.app/api/me", { headers: { cookie: header(jar) } }));
    const set = res.cookies.getAll().filter((c) => c.name.startsWith("sb-"));
    expect(set.length).toBeGreaterThan(0);
    const after = readSession(new Map(set.map((c) => [c.name, c.value]))).session;
    expect(after.refresh_token).not.toBe(before.refresh_token);
    expect(after.access_token).not.toBe(before.access_token);
    expect(Number(after.expires_at)).toBeGreaterThan(Date.now() / 1000);
    // The cookies are HTTP-only and long-lived (SPEC §5).
    expect(set.every((c) => c.httpOnly === true)).toBe(true);
    // And the route after the proxy sees the refreshed session (override headers on the request).
    expect(res.headers.get("x-middleware-override-headers") ?? "").toContain("cookie");

    // With the refreshed cookies, the account is still signed in.
    const refreshed = new Map([...jar].filter(([k]) => !k.startsWith(readSession(jar).name)));
    for (const c of set) refreshed.set(c.name, c.value);
    const me = await meGET(req("/api/me", { cookie: header(refreshed) }));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ anonymous: false, email: account.email });
  });

  it("a valid session passes through untouched, and visitors without a session cost nothing", async () => {
    const res = await proxy(new NextRequest("https://changel.app/api/me", { headers: { cookie: account.cookie } }));
    expect(res.cookies.getAll().filter((c) => c.name.startsWith("sb-"))).toHaveLength(0);
    const none = await proxy(new NextRequest("https://changel.app/api/play"));
    expect(none.cookies.getAll()).toHaveLength(0);
    const pub = await proxy(new NextRequest("https://changel.app/api/puzzle?date=2026-11-10", { headers: { cookie: header(expire(parse(account.cookie))) } }));
    expect(pub.cookies.getAll()).toHaveLength(0); // public routes are skipped
  });
});

/**
 * Throwaway test data for play/guess integration tests: 5 questions and a ready
 * puzzle on a far-future date, plus real Supabase users with session cookies.
 * Everything is removed in cleanup(); dev seed puzzles are never touched.
 */
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { POST as sessionPOST } from "@/app/api/session/route";
import { questionRange } from "@/lib/puzzles/repo";
import { actualLog, scoreRound } from "@/lib/scoring";
import { adminClient } from "@/lib/supabase/admin";
import { sessionCookieOptions } from "@/lib/supabase/request";

export const TEST_DATE = "2099-03-01";
/** Inside TEST_DATE's window (Sydney morning). */
export const TEST_NOW = "2099-03-01T09:00:00+11:00";

/** q4 has no max_change on purpose: it exercises the full-range fallback for legacy questions. */
export const TEST_QUESTIONS = [
  { slug: "itest-q1", category: "Test", prompt: "Integration test question one", start_year: 2000, start_value: 100, end_year: 2020, end_value: 250, format: "int", max_change: 10 },
  { slug: "itest-q2", category: "Test", prompt: "Integration test question two", start_year: 2000, start_value: 50, end_year: 2020, end_value: 20, format: "int", max_change: 5 },
  { slug: "itest-q3", category: "Test", prompt: "Integration test question three", start_year: 1990, start_value: 3, end_year: 2020, end_value: 3, format: "usd", max_change: 3 },
  { slug: "itest-q4", category: "Test", prompt: "Integration test question four", start_year: 1980, start_value: 1000, end_year: 2020, end_value: 90000, format: "big", max_change: null },
  { slug: "itest-q5", category: "Test", prompt: "Integration test question five", start_year: 2010, start_value: 8, end_year: 2020, end_value: 6, format: "int", max_change: 2 },
].map((q) => ({ ...q, fact: `${q.prompt} fact.`, source_name: "Test source", status: "draft", tags: ["itest"] }));

/** Question i's guess range, as the server computes it. */
export const testRange = (i: number) => questionRange(TEST_QUESTIONS[i]!);

/** The server's score for guess g on question i. */
export const expectedScore = (i: number, g: number) => {
  const q = TEST_QUESTIONS[i]!;
  return scoreRound(g, actualLog(q.start_value, q.end_value), testRange(i));
};

const createdUsers: string[] = [];

export async function setupTestPuzzle(): Promise<number[]> {
  const db = adminClient();
  await cleanupData();
  const { data, error } = await db.from("questions").insert(TEST_QUESTIONS).select("id, slug");
  if (error) throw error;
  const ids = TEST_QUESTIONS.map((q) => data!.find((d) => d.slug === q.slug)!.id as number);
  const { error: e2 } = await db.from("puzzles").insert({ puzzle_date: TEST_DATE, status: "ready" });
  if (e2) throw e2;
  const { error: e3 } = await db.from("puzzle_rounds").insert(ids.map((question_id, i) => ({ puzzle_date: TEST_DATE, position: i + 1, question_id })));
  if (e3) throw e3;
  return ids;
}

async function cleanupData() {
  const db = adminClient();
  // Plays for the test date (from crashed earlier runs) block deleting the puzzle.
  await db.from("plays").delete().eq("puzzle_date", TEST_DATE);
  await db.from("puzzles").delete().eq("puzzle_date", TEST_DATE); // cascades rounds + round_stats
  await db.from("questions").delete().like("slug", "itest-%");
}

export async function cleanup() {
  const db = adminClient();
  for (const id of createdUsers.splice(0)) await db.auth.admin.deleteUser(id);
  await cleanupData();
}

function cookieHeaderFrom(setCookies: string[]): string {
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

/**
 * A new player with a session cookie. Uses the real POST /api/session
 * (anonymous sign-in) when it's enabled; otherwise a confirmed email+password
 * test user, signed in through @supabase/ssr so the cookie format is identical.
 */
export async function newPlayer(): Promise<{ id: string; cookie: string; anonymous: boolean }> {
  const res = await sessionPOST(new Request("http://localhost/api/session", { method: "POST", body: JSON.stringify({ tz: "Australia/Sydney" }), headers: { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 200) + 1}` } }));
  if (res.status === 200) {
    const body = await res.json();
    createdUsers.push(body.user_id);
    return { id: body.user_id, cookie: cookieHeaderFrom(res.headers.getSetCookie()), anonymous: true };
  }
  const err = await res.json();
  if (err.error?.code !== "signup_unavailable") throw new Error(`session failed: ${JSON.stringify(err)}`);

  const email = `itest-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUsers.push(data.user.id);
  const jar: string[] = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: sessionCookieOptions(),
    cookies: { getAll: () => parseCookieHeader(jar.join("; ")).map((c) => ({ name: c.name, value: c.value ?? "" })), setAll: (cs) => cs.forEach((c) => jar.push(`${c.name}=${c.value}`)) },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, cookie: jar.join("; "), anonymous: false };
}

export function req(path: string, opts: { method?: string; body?: unknown; cookie?: string; now?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!path.startsWith("/api/cron/")) headers["x-changel-test-now"] = opts.now ?? TEST_NOW; // cron tests use the real clock
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(`http://localhost${path}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
}

/** A signed-in PERMANENT account (email + password test user), with its session cookie. */
export async function newAccount(): Promise<{ id: string; email: string; cookie: string }> {
  const email = `itest-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  createdUsers.push(data.user.id);
  const jar: string[] = [];
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: sessionCookieOptions(),
    cookies: { getAll: () => parseCookieHeader(jar.join("; ")).map((c) => ({ name: c.name, value: c.value ?? "" })), setAll: (cs) => cs.forEach((c) => jar.push(`${c.name}=${c.value}`)) },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, email, cookie: jar.join("; ") };
}

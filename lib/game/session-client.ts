/**
 * Browser-side calls to the session-backed routes. Every function returns a
 * result object instead of throwing, so the game can fall back to local-only
 * mode (SPEC §5) whenever the server path isn't available.
 */
import type { RoundResult } from "./types";

type Json = Record<string, unknown>;

async function call(path: string, init: RequestInit): Promise<{ status: number; body: Json | null }> {
  try {
    const res = await fetch(path, { credentials: "same-origin", ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
    let body: Json | null = null;
    try {
      body = (await res.json()) as Json;
    } catch {
      /* empty */
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null }; // network error
  }
}

const errCode = (b: Json | null) => ((b?.error as Json | undefined)?.code as string | undefined) ?? "unknown";

/** Ensure a session cookie exists (creates an anonymous user if needed). */
export async function ensureSession(tz: string): Promise<boolean> {
  const r = await call("/api/session", { method: "POST", body: JSON.stringify({ tz }) });
  return r.status === 200;
}

export type BeginResult =
  | { ok: true; playId: string; startedAt: string; answered: RoundResult[] }
  | { ok: false; reason: "unauthorized" | "closed" | "unavailable" };

/** Start or resume the server play for `date`. */
export async function beginPlay(date: string, tz: string): Promise<BeginResult> {
  const r = await call("/api/play", { method: "POST", body: JSON.stringify({ date, tz }) });
  if (r.status === 200 && r.body) {
    return { ok: true, playId: r.body.play_id as string, startedAt: r.body.started_at as string, answered: r.body.answered as RoundResult[] };
  }
  if (r.status === 401) return { ok: false, reason: "unauthorized" };
  if (r.status === 403) return { ok: false, reason: "closed" };
  return { ok: false, reason: "unavailable" };
}

export type GuessResult =
  | { kind: "ok"; result: RoundResult }
  | { kind: "already"; result: RoundResult }
  | { kind: "out_of_order" | "question_changed" | "unauthorized" | "closed" | "failed" };

export async function submitGuess(playId: string, position: number, guessLog: number, questionId?: number): Promise<GuessResult> {
  const r = await call("/api/guess", { method: "POST", body: JSON.stringify({ play_id: playId, position, guess_log: guessLog, question_id: questionId }) });
  if (r.status === 200 && r.body) return { kind: "ok", result: r.body as unknown as RoundResult };
  const code = errCode(r.body);
  if (r.status === 409 && code === "already_answered" && r.body?.result) return { kind: "already", result: r.body.result as RoundResult };
  if (r.status === 409 && code === "out_of_order") return { kind: "out_of_order" };
  if (r.status === 409 && code === "question_changed") return { kind: "question_changed" };
  if (r.status === 401) return { kind: "unauthorized" };
  if (r.status === 403) return { kind: "closed" };
  return { kind: "failed" };
}

export type SyncResult = { ok: true; playId: string; answered: RoundResult[] } | { ok: false; permanent: boolean };

/** Upload a local-only play. `permanent` failures (too old, no puzzle, bad data) shouldn't be retried. */
export async function syncLocalPlay(date: string, tz: string, startedAt: string, results: RoundResult[]): Promise<SyncResult> {
  const r = await call("/api/sync", {
    method: "POST",
    body: JSON.stringify({ date, tz, started_at: startedAt, guesses: results.map((x) => ({ position: x.position, guess_log: x.guess_log })) }),
  });
  if (r.status === 200 && r.body) return { ok: true, playId: r.body.play_id as string, answered: r.body.answered as RoundResult[] };
  return { ok: false, permanent: [400, 403, 404, 409].includes(r.status) };
}

export interface ServerStats {
  games_played: number;
  current_streak: number;
  max_streak: number;
  best_total: number | null;
  avg_total: number | null;
}

/** Server stats (SPEC §4: the client never trusts its own streak when online). */
export async function fetchMe(date: string, tz: string): Promise<ServerStats | null> {
  const r = await call(`/api/me?date=${encodeURIComponent(date)}&tz=${encodeURIComponent(tz)}`, { method: "GET", headers: {} });
  return r.status === 200 && r.body ? (r.body as unknown as ServerStats) : null;
}

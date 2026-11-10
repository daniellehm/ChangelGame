/**
 * Keeping this device's local mirror in line with the server (SPEC §5).
 * The server is the record: after signing in, this device shows the
 * ACCOUNT's games, never a replay that was discarded in the merge.
 */
import { ROUNDS } from "../config";
import { addDays, daysBetween, localDate } from "../dates";
import { beginPlay, ensureSession, syncLocalPlay, type ServerStats } from "./session-client";
import { getActiveDate, isComplete, loadPlay, replaceCompleted, savePlay, storedPlayDates, unsyncedLocalPlays, type StoredPlay } from "./storage";
import type { Puzzle } from "./types";

/** Upload finished local-only plays once a session exists. Quiet on failure. */
export async function syncPending(tz: string): Promise<void> {
  const pending = unsyncedLocalPlays().filter(isComplete);
  if (!pending.length || !(await ensureSession(tz))) return;
  for (const p of pending) {
    const r = await syncLocalPlay(p.puzzle.date, p.tz || tz, p.started_at, p.results);
    if (r.ok) savePlay({ ...p, synced: true, play_id: r.playId, results: r.answered.length === ROUNDS ? r.answered : p.results });
    else if (r.permanent) savePlay({ ...p, synced: true });
  }
}

/**
 * After signing in: upload any offline games, then replace this device's
 * recent plays with the account's. If the account had already played a day,
 * its first attempt is what the server kept, so that's what we show.
 */
export async function refreshFromAccount(tz: string): Promise<void> {
  await syncPending(tz);
  const today = localDate(new Date(), tz);
  const recent = new Set<string>([today, addDays(today, -1)]);
  const active = getActiveDate();
  if (active) recent.add(active);
  const dates = storedPlayDates().filter((d) => {
    try {
      return recent.has(d) || Math.abs(daysBetween(d, today)) <= 1;
    } catch {
      return false;
    }
  });
  for (const date of dates) {
    const local = loadPlay(date);
    if (!local) continue;
    const r = await beginPlay(date, tz); // the account's play for that day (existing or just merged in)
    if (!r.ok) continue;
    const play = {
      ...local,
      mode: "server" as const,
      play_id: r.playId,
      synced: true,
      started_at: r.startedAt,
      results: r.answered,
      completed_at: r.answered.length >= ROUNDS ? local.completed_at ?? new Date().toISOString() : null,
    };
    savePlay(play);
    replaceCompleted(play);
  }
}

/**
 * This device has no game for the puzzle's date, but the signed-in account may have played it
 * on another device (Dani 2026-11-10: "I did today's Changel, logged in on another device and
 * it says I haven't"). If `me` (GET /api/me) lists a play for that date, load it from the server,
 * finished or half-done, and store it here. Never creates a play or a session. Null if there's
 * nothing to pull.
 */
export async function pullAccountPlay(puzzle: Puzzle, tz: string, me: ServerStats | null | undefined): Promise<StoredPlay | null> {
  if (!me?.recent?.some((p) => p.date === puzzle.date)) return null;
  const r = await beginPlay(puzzle.date, tz); // resumes the account's existing play
  if (!r.ok || r.answered.length === 0) return null; // started but nothing answered: play normally
  const play: StoredPlay = {
    v: 1,
    puzzle,
    tz,
    started_at: r.startedAt,
    completed_at: r.answered.length >= ROUNDS ? new Date().toISOString() : null,
    results: r.answered,
    mode: "server",
    play_id: r.playId,
    synced: true,
  };
  savePlay(play);
  replaceCompleted(play);
  return play;
}

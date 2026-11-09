/**
 * Keeping this device's local mirror in line with the server (SPEC §5).
 * The server is the record: after signing in, this device shows the
 * ACCOUNT's games, never a replay that was discarded in the merge.
 */
import { ROUNDS } from "../config";
import { addDays, daysBetween, localDate } from "../dates";
import { beginPlay, ensureSession, syncLocalPlay } from "./session-client";
import { getActiveDate, isComplete, loadPlay, replaceCompleted, savePlay, storedPlayDates, unsyncedLocalPlays } from "./storage";

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

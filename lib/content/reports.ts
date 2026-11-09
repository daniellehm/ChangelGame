/**
 * Player reports (SPEC §8 "Safety nets", M5 task 5.9). Server only.
 * A report is about the question the player actually answered in that round
 * (guesses.question_id), so a same-day swap can't misdirect it.
 * Queueing never pulls a question, never emails: the admin decides.
 */
import { REPORTS } from "../config";
import { adminClient } from "../supabase/admin";

export type ReportReason = (typeof REPORTS.REASONS)[number];

export type SubmitOutcome = { status: "ok" | "already" } | { status: "not_found" | "not_locked" };

/** Record a report from `playerId` on round `position` of their play `playId`. */
export async function submitReport(playerId: string, playId: string, position: number, reason: ReportReason, note: string | null): Promise<SubmitOutcome> {
  const db = adminClient();
  const { data: play, error } = await db.from("plays").select("id, player_id, puzzle_date").eq("id", playId).maybeSingle();
  if (error) throw error;
  if (!play || play.player_id !== playerId) return { status: "not_found" };
  const { data: guess, error: e2 } = await db.from("guesses").select("question_id").eq("play_id", playId).eq("position", position).maybeSingle();
  if (e2) throw e2;
  // Only a round the player locked in can be reported (its reveal is where the button lives).
  if (!guess) return { status: "not_locked" };
  const { error: e3 } = await db.from("reports").insert({
    question_id: guess.question_id,
    puzzle_date: play.puzzle_date,
    position,
    player_id: playerId,
    reason,
    note: note?.trim() ? note.trim().slice(0, 500) : null,
    valid: true,
  });
  if (e3) {
    if (e3.code === "23505") return { status: "already" }; // one per player per question
    throw e3;
  }
  return { status: "ok" };
}

export interface QueueEntry {
  question_id: number;
  seen: number;
  valid_reports: number;
  rate: number;
  dismissed_rate: number | null;
}

export async function reportQueue(): Promise<QueueEntry[]> {
  const { data, error } = await adminClient().rpc("report_queue", {
    p_min_rate: REPORTS.RATE,
    p_min_reports: REPORTS.MIN_VALID,
    p_habitual: REPORTS.HABITUAL_SHARE,
    p_habitual_min_rounds: REPORTS.HABITUAL_MIN_ROUNDS,
    p_requeue_points: REPORTS.REQUEUE_POINTS,
  });
  if (error) throw error;
  return (data ?? []) as QueueEntry[];
}

export const reportQueueCount = async () => (await reportQueue()).length;

/** Dismiss: the question leaves the queue until its rate rises REQUEUE_POINTS above today's. */
export async function dismissReports(questionId: number, editor: string): Promise<"ok" | "not_queued"> {
  const entry = (await reportQueue()).find((e) => e.question_id === questionId);
  if (!entry) return "not_queued";
  const db = adminClient();
  const { error } = await db.from("questions").update({ reports_dismissed_rate: entry.rate }).eq("id", questionId);
  if (error) throw error;
  await db.from("question_edits").insert({ question_id: questionId, edited_by: editor, before: { reports_dismissed_rate: entry.dismissed_rate }, after: { reports_dismissed_rate: entry.rate }, note: `reports dismissed at ${Math.round(entry.rate * 100)}%` });
  return "ok";
}

/**
 * Puzzle data access (server only, service role). Public rounds and answers are
 * fetched by separate functions so a route can't leak answers by accident.
 */
import { isFormat, type Format } from "../format";
import type { PublicRound } from "../game/types";
import { questionRange, type GuessRange } from "../range";
import { isWindowOpen } from "../dates";
import { adminClient } from "../supabase/admin";
import { ensureRerun } from "./rerun";
import type { RoundCrowd } from "../game/crowd";

export interface StoredPuzzle {
  date: string;
  theme: string | null;
  /** Date whose rounds are served (differs for a rerun). */
  roundsDate: string;
  rerunOf: string | null;
}

/** A ready puzzle for `date`, or null. */
async function readyPuzzle(date: string): Promise<StoredPuzzle | null> {
  const { data, error } = await adminClient()
    .from("puzzles")
    .select("puzzle_date, theme, status, rerun_of")
    .eq("puzzle_date", date)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { date: data.puzzle_date, theme: data.theme, roundsDate: data.rerun_of ?? data.puzzle_date, rerunOf: data.rerun_of };
}

/**
 * The ready puzzle for `date`. If there is none and the date's window is open by the
 * REAL clock, a rerun is created (SPEC §8 rerun fallback, with an alert email).
 * The real clock (not the test clock) so tests can't create reruns on real dates.
 */
export async function findReadyPuzzle(date: string): Promise<StoredPuzzle | null> {
  const found = await readyPuzzle(date);
  if (found || !isWindowOpen(date, Date.now())) return found;
  return (await ensureRerun(date)) ? readyPuzzle(date) : null;
}

/** A question's guess range: lives in lib/range.ts (pure, so tests and the client can import it). */
export { questionRange } from "../range";

/** The 5 rounds WITHOUT answers: only these columns are ever selected. */
export async function publicRounds(roundsDate: string): Promise<PublicRound[]> {
  const { data, error } = await adminClient()
    .from("puzzle_rounds")
    .select("position, question_id, questions!inner(category, prompt, start_year, start_value, end_year, format, max_change)")
    .eq("puzzle_date", roundsDate)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => {
    const q = r.questions as unknown as { category: string; prompt: string; start_year: number; start_value: number; end_year: number; format: string; max_change: number | null };
    if (!isFormat(q.format)) throw new Error(`Unknown format ${q.format}`);
    return {
      position: r.position,
      question_id: r.question_id,
      category: q.category,
      prompt: q.prompt,
      start_year: q.start_year,
      start_value: q.start_value,
      end_year: q.end_year,
      format: q.format as Format,
      range: questionRange(q),
    };
  });
}

export interface RoundAnswer {
  question_id: number;
  start_value: number;
  end_value: number;
  /** Scoring range (bounds are public; served with the round too). */
  range: GuessRange;
  fact: string;
  source_name: string;
  source_url: string | null;
  /** Edited after it went live: the reveal says "Corrected" (SPEC §8). */
  corrected: boolean;
}

/** One round's answer. Only call AFTER that round is locked. */
export async function roundAnswer(roundsDate: string, position: number): Promise<RoundAnswer | null> {
  const { data, error } = await adminClient()
    .from("puzzle_rounds")
    .select("question_id, questions!inner(start_value, end_value, max_change, fact, source_name, source_url, corrected_at)")
    .eq("puzzle_date", roundsDate)
    .eq("position", position)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const q = data.questions as unknown as { start_value: number; end_value: number; max_change: number | null; fact: string | null; source_name: string | null; source_url: string | null; corrected_at: string | null };
  return {
    question_id: data.question_id,
    start_value: q.start_value,
    end_value: q.end_value,
    range: questionRange(q),
    fact: q.fact ?? "",
    source_name: q.source_name ?? "",
    source_url: q.source_url,
    corrected: !!q.corrected_at,
  };
}

/** Answer fields for specific questions (resume / already-answered paths). */
export async function answersByQuestionId(ids: number[]): Promise<Map<number, RoundAnswer>> {
  const out = new Map<number, RoundAnswer>();
  if (!ids.length) return out;
  const { data, error } = await adminClient()
    .from("questions")
    .select("id, start_value, end_value, max_change, fact, source_name, source_url, corrected_at")
    .in("id", ids);
  if (error) throw error;
  for (const q of data ?? []) {
    out.set(q.id, {
      question_id: q.id,
      start_value: q.start_value,
      end_value: q.end_value,
      range: questionRange(q),
      fact: q.fact ?? "",
      source_name: q.source_name ?? "",
      source_url: q.source_url,
      corrected: !!q.corrected_at,
    });
  }
  return out;
}

/** Crowd stats per round for a puzzle day (SPEC §10), from the `round_crowd` function. */
export async function roundCrowd(date: string): Promise<RoundCrowd[]> {
  const { data, error } = await adminClient().rpc("round_crowd", { p_date: date });
  if (error) throw error;
  return ((data ?? []) as Array<{ pos: number; plays: number; wrong_way: number; nailed: number; avg_points: number | string }>).map((r) => ({
    position: r.pos,
    plays: r.plays,
    wrong_way: r.wrong_way,
    nailed: r.nailed,
    avg_points: Number(r.avg_points),
  }));
}

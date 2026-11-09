/**
 * Puzzle data access (server only, service role). Public rounds and answers are
 * fetched by separate functions so a route can't leak answers by accident.
 */
import { isFormat, type Format } from "../format";
import type { PublicRound } from "../game/types";
import { FULL_RANGE, rangeFromFactor, type GuessRange } from "../range";
import { adminClient } from "../supabase/admin";

export interface StoredPuzzle {
  date: string;
  theme: string | null;
  /** Date whose rounds are served (differs for a rerun). */
  roundsDate: string;
  rerunOf: string | null;
}

/** A ready puzzle for `date`, or null. */
export async function findReadyPuzzle(date: string): Promise<StoredPuzzle | null> {
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

/** A question's guess range (÷max_change … ×max_change). Questions without one get the full ÷1000…×1000. */
export function questionRange(q: { max_change?: number | null }): GuessRange {
  return q.max_change != null ? rangeFromFactor(q.max_change) : FULL_RANGE;
}

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
}

/** One round's answer. Only call AFTER that round is locked. */
export async function roundAnswer(roundsDate: string, position: number): Promise<RoundAnswer | null> {
  const { data, error } = await adminClient()
    .from("puzzle_rounds")
    .select("question_id, questions!inner(start_value, end_value, max_change, fact, source_name, source_url)")
    .eq("puzzle_date", roundsDate)
    .eq("position", position)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const q = data.questions as unknown as { start_value: number; end_value: number; max_change: number | null; fact: string | null; source_name: string | null; source_url: string | null };
  return {
    question_id: data.question_id,
    start_value: q.start_value,
    end_value: q.end_value,
    range: questionRange(q),
    fact: q.fact ?? "",
    source_name: q.source_name ?? "",
    source_url: q.source_url,
  };
}

/** Answer fields for specific questions (resume / already-answered paths). */
export async function answersByQuestionId(ids: number[]): Promise<Map<number, RoundAnswer>> {
  const out = new Map<number, RoundAnswer>();
  if (!ids.length) return out;
  const { data, error } = await adminClient()
    .from("questions")
    .select("id, start_value, end_value, max_change, fact, source_name, source_url")
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
    });
  }
  return out;
}

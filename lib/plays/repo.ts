/** Plays and guesses (server only, service role). */
import type { RoundResult } from "../game/types";
import { actualLog, type TierId } from "../scoring";
import { adminClient } from "../supabase/admin";
import { answersByQuestionId, type RoundAnswer } from "../puzzles/repo";

export interface PlayRow {
  id: string;
  player_id: string;
  puzzle_date: string;
  started_at: string;
  completed_at: string | null;
  total: number | null;
  tz_at_play: string | null;
  source: "server" | "local";
}

export interface GuessRow {
  play_id: string;
  position: number;
  question_id: number;
  guess_log: number;
  points: number;
  tier: TierId;
  wrong_way: boolean;
  created_at: string;
}

const PLAY_COLS = "id, player_id, puzzle_date, started_at, completed_at, total, tz_at_play, source";

export async function findPlayById(id: string): Promise<PlayRow | null> {
  const { data, error } = await adminClient().from("plays").select(PLAY_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as PlayRow | null;
}

export async function findPlay(playerId: string, date: string): Promise<PlayRow | null> {
  const { data, error } = await adminClient().from("plays").select(PLAY_COLS).eq("player_id", playerId).eq("puzzle_date", date).maybeSingle();
  if (error) throw error;
  return data as PlayRow | null;
}

/** Create the play if it doesn't exist yet (race-safe), then return it. */
/** `startedAt` comes from the same clock the window checks use (serverNow). */
export async function getOrCreatePlay(playerId: string, date: string, tz: string | null, startedAt: number): Promise<PlayRow> {
  const { error } = await adminClient()
    .from("plays")
    .upsert(
      { player_id: playerId, puzzle_date: date, tz_at_play: tz, started_at: new Date(startedAt).toISOString() },
      { onConflict: "player_id,puzzle_date", ignoreDuplicates: true },
    );
  if (error) throw error;
  const play = await findPlay(playerId, date);
  if (!play) throw new Error("play vanished after upsert");
  return play;
}

export async function guessesFor(playId: string): Promise<GuessRow[]> {
  const { data, error } = await adminClient().from("guesses").select("*").eq("play_id", playId).order("position");
  if (error) throw error;
  return (data ?? []) as GuessRow[];
}

/** Stored guess + its question's answer → the RoundResult the client renders. */
export function toRoundResult(g: Pick<GuessRow, "position" | "question_id" | "guess_log" | "points" | "tier" | "wrong_way">, a: RoundAnswer): RoundResult {
  return {
    position: g.position,
    question_id: g.question_id,
    guess_log: g.guess_log,
    points: g.points,
    tier: g.tier,
    wrong_way: g.wrong_way,
    end_value: a.end_value,
    actual_log: actualLog(a.start_value, a.end_value),
    fact: a.fact,
    source_name: a.source_name,
    source_url: a.source_url,
  };
}

export async function answeredResults(playId: string): Promise<RoundResult[]> {
  const guesses = await guessesFor(playId);
  const answers = await answersByQuestionId(guesses.map((g) => g.question_id));
  return guesses.map((g) => toRoundResult(g, answers.get(g.question_id)!));
}

export interface CrowdStats {
  n: number;
  avg_points: number | null;
  pct_wrong_way: number | null;
  pct_nailed: number | null;
}

export async function roundStats(date: string, position: number): Promise<CrowdStats> {
  const { data, error } = await adminClient()
    .from("round_stats")
    .select("n, avg_points, pct_wrong_way, pct_nailed")
    .eq("puzzle_date", date)
    .eq("position", position)
    .maybeSingle();
  if (error) throw error;
  return data ?? { n: 0, avg_points: null, pct_wrong_way: null, pct_nailed: null };
}

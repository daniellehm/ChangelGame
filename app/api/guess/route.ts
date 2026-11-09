/**
 * POST /api/guess { play_id, position, guess_log, question_id? } → lock in one
 * round (SPEC §7). Scored with lib/scoring, stored atomically by
 * public.submit_guess. Duplicates return 409 already_answered with the stored
 * result, so double taps are harmless.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { serverNow } from "@/lib/api/clock";
import { isGuessAcceptable } from "@/lib/dates";
import { findPlayById, roundStats, toRoundResult } from "@/lib/plays/repo";
import { answersByQuestionId, findReadyPuzzle, roundAnswer } from "@/lib/puzzles/repo";
import { actualLog, clampGuess, scoreRound, type TierId } from "@/lib/scoring";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  play_id: z.string().uuid(),
  position: z.number().int().min(1).max(5),
  guess_log: z.number().finite(),
  question_id: z.number().int().positive().optional(),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Start a session first.", 401);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);
  const { play_id, position, question_id } = parsed.data;
  const guess = clampGuess(parsed.data.guess_log);

  try {
    const play = await findPlayById(play_id);
    // Someone else's play looks the same as a missing one.
    if (!play || play.player_id !== user.id) return apiError("play_not_found", "That game doesn't exist.", 404);
    if (!isGuessAcceptable(play.puzzle_date, serverNow(req), Date.parse(play.started_at))) {
      return apiError("puzzle_not_available", "That puzzle has closed.", 403);
    }

    const puzzle = await findReadyPuzzle(play.puzzle_date);
    if (!puzzle) return apiError("puzzle_not_found", "There's no puzzle for this date.", 404);
    const answer = await roundAnswer(puzzle.roundsDate, position);
    if (!answer) return apiError("puzzle_not_found", "That round doesn't exist.", 404);
    if (question_id !== undefined && question_id !== answer.question_id) {
      return apiError("question_changed", "This round was just updated. Reload to see it.", 409);
    }

    const s = scoreRound(guess, actualLog(answer.start_value, answer.end_value));
    const { data, error } = await adminClient().rpc("submit_guess", {
      p_play_id: play.id,
      p_player_id: user.id,
      p_position: position,
      p_question_id: answer.question_id,
      p_guess_log: guess,
      p_points: s.points,
      p_tier: s.tier,
      p_wrong_way: s.wrongWay,
    });
    if (error) throw error;
    const out = data as { status: string; expected?: number; guess?: { position: number; question_id: number; guess_log: number; points: number; tier: TierId; wrong_way: boolean } };

    if (out.status === "not_found") return apiError("play_not_found", "That game doesn't exist.", 404);
    if (out.status === "out_of_order") {
      return apiError("out_of_order", `Answer round ${out.expected} first.`, 409);
    }
    if (out.status === "already_answered" && out.guess) {
      const stored = (await answersByQuestionId([out.guess.question_id])).get(out.guess.question_id)!;
      return sb.applyCookies(
        Response.json(
          { error: { code: "already_answered", message: "You already locked in this round." }, result: toRoundResult(out.guess, stored) },
          { status: 409, headers: NO_STORE },
        ),
      );
    }

    const result = toRoundResult({ position, question_id: answer.question_id, guess_log: guess, points: s.points, tier: s.tier, wrong_way: s.wrongWay }, answer);
    const stats = await roundStats(play.puzzle_date, position);
    return sb.applyCookies(Response.json({ ...result, stats }, { headers: NO_STORE }));
  } catch (e) {
    console.error("POST /api/guess failed", e);
    return apiError("internal_error", "Something went wrong locking that in.", 500);
  }
}

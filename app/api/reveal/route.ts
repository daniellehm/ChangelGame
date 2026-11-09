/**
 * POST /api/reveal { date, position, guess_log } → that ONE round's answer and
 * score. Stateless: stores nothing. Used by the M2 client and the M3 offline
 * fallback (DECISIONS 2026-11-09). M3's /api/guess is the scored, stored path.
 */
import { z } from "zod";
import { apiError, invalid, ok } from "@/lib/api/http";
import { serverNow } from "@/lib/api/clock";
import { GUESS_GRACE_MS, isDateString, puzzleWindow } from "@/lib/dates";
import { findReadyPuzzle, roundAnswer } from "@/lib/puzzles/repo";
import { actualLog, clampGuess, scoreRound } from "@/lib/scoring";

const Body = z.object({
  date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date"),
  position: z.number().int().min(1).max(5),
  guess_log: z.number().finite(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);
  const { date, position } = parsed.data;
  const guess = clampGuess(parsed.data.guess_log);

  // Same window as serving, plus the grace period to finish a started game.
  const now = serverNow(req);
  const w = puzzleWindow(date);
  if (now < w.opensAt || now >= w.closesAt + GUESS_GRACE_MS) {
    return apiError("puzzle_not_available", "That puzzle isn't available right now. Check your device clock.", 403);
  }

  try {
    const puzzle = await findReadyPuzzle(date);
    if (!puzzle) return apiError("puzzle_not_found", "There's no puzzle for this date.", 404);
    const ans = await roundAnswer(puzzle.roundsDate, position);
    if (!ans) return apiError("puzzle_not_found", "That round doesn't exist.", 404);

    const a = actualLog(ans.start_value, ans.end_value);
    const s = scoreRound(guess, a);
    return ok({
      position,
      question_id: ans.question_id,
      guess_log: guess,
      points: s.points,
      tier: s.tier,
      wrong_way: s.wrongWay,
      end_value: ans.end_value,
      actual_log: a,
      fact: ans.fact,
      source_name: ans.source_name,
      source_url: ans.source_url,
    });
  } catch (e) {
    console.error("POST /api/reveal failed", e);
    return apiError("internal_error", "Something went wrong revealing that round.", 500);
  }
}

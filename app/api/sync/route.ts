/**
 * POST /api/sync { date, tz, started_at, guesses: [{ position, guess_log }] }
 * Uploads a play finished in local-only mode (SPEC §5) once a session exists.
 * The server re-scores every guess from guess_log (client points are never
 * trusted), stores the play with source='local' (excluded from crowd stats),
 * and ignores the upload if the player already has a play for that date.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/ratelimit";
import { serverNow } from "@/lib/api/clock";
import { isDateString, isValidTimeZone, puzzleWindow } from "@/lib/dates";
import { answeredResults, findPlay } from "@/lib/plays/repo";
import { findReadyPuzzle, roundAnswer } from "@/lib/puzzles/repo";
import { actualLog, clampGuess, scoreRound } from "@/lib/scoring";
import { adminClient } from "@/lib/supabase/admin";

const Body = z.object({
  date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date"),
  tz: z.string().max(64).refine(isValidTimeZone, "unknown time zone").optional(),
  started_at: z.string().datetime({ offset: true }),
  guesses: z
    .array(z.object({ position: z.number().int().min(1).max(5), guess_log: z.number().finite() }))
    .min(1)
    .max(5),
});

/** Local plays older than this are not accepted. */
const MAX_AGE_DAYS = 7;

export async function POST(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Start a session first.", 401);
  const limited = await rateLimit("sync", user.id);
  if (limited) return limited;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("invalid_request", "Body must be JSON.", 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return invalid(parsed.error);
  const { date, tz, guesses } = parsed.data;

  // Positions must be 1..n with no gaps or repeats.
  const positions = guesses.map((g) => g.position);
  if (positions.some((p, i) => p !== i + 1)) return apiError("invalid_request", "guesses must be positions 1..n in order", 400);

  const now = serverNow(req);
  const w = puzzleWindow(date);
  if (now < w.opensAt || now > w.closesAt + MAX_AGE_DAYS * 86_400_000) {
    return apiError("puzzle_not_available", "That puzzle can't be synced.", 403);
  }

  try {
    const existing = await findPlay(user.id, date);
    if (existing) {
      // The server's play wins; tell the client what it has.
      return sb.applyCookies(Response.json({ status: "exists", play_id: existing.id, answered: await answeredResults(existing.id) }, { headers: { "Cache-Control": "no-store" } }));
    }
    const puzzle = await findReadyPuzzle(date);
    if (!puzzle) return apiError("puzzle_not_found", "There's no puzzle for this date.", 404);

    // Clamp started_at into the window so it can't be used to dodge window checks.
    const startedAt = Math.min(Math.max(Date.parse(parsed.data.started_at), w.opensAt), now);
    const db = adminClient();
    const { data: play, error } = await db
      .from("plays")
      .insert({ player_id: user.id, puzzle_date: date, tz_at_play: tz ?? null, started_at: new Date(startedAt).toISOString(), source: "local" })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return apiError("already_answered", "That puzzle is already synced.", 409); // race with another tab
      throw error;
    }

    for (const g of guesses) {
      const answer = await roundAnswer(puzzle.roundsDate, g.position);
      if (!answer) throw new Error(`round ${g.position} missing`);
      const guess = clampGuess(g.guess_log, answer.range);
      const s = scoreRound(guess, actualLog(answer.start_value, answer.end_value), answer.range);
      const { data, error: e } = await db.rpc("submit_guess", {
        p_play_id: play.id, p_player_id: user.id, p_position: g.position, p_question_id: answer.question_id,
        p_guess_log: guess, p_points: s.points, p_tier: s.tier, p_wrong_way: s.wrongWay,
      });
      if (e) throw e;
      if ((data as { status: string }).status !== "ok") throw new Error(`sync guess ${g.position}: ${JSON.stringify(data)}`);
    }

    return sb.applyCookies(Response.json({ status: "synced", play_id: play.id, answered: await answeredResults(play.id) }, { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("POST /api/sync failed", e);
    return apiError("internal_error", "Something went wrong syncing that game.", 500);
  }
}

/**
 * POST /api/play { date, tz } → start or resume this player's play for `date`
 * (SPEC §7). Returns the answered rounds (with answers) so a refresh resumes
 * at the next unplayed round. Starting needs the date window open; resuming an
 * existing play is allowed through the grace period.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { serverNow } from "@/lib/api/clock";
import { isDateString, isGuessAcceptable, isValidTimeZone, isWindowOpen } from "@/lib/dates";
import { answeredResults, findPlay, getOrCreatePlay } from "@/lib/plays/repo";
import { findReadyPuzzle } from "@/lib/puzzles/repo";

const Body = z.object({
  date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date"),
  tz: z.string().max(64).refine(isValidTimeZone, "unknown time zone").optional(),
});

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
  const { date, tz } = parsed.data;
  const now = serverNow(req);

  try {
    let play = await findPlay(user.id, date);
    if (play) {
      const resumable = play.completed_at !== null || isGuessAcceptable(date, now, Date.parse(play.started_at));
      if (!resumable) return apiError("puzzle_not_available", "That puzzle has closed.", 403);
    } else {
      if (!isWindowOpen(date, now)) {
        return apiError("puzzle_not_available", "That puzzle isn't available right now. Check your device clock.", 403);
      }
      if (!(await findReadyPuzzle(date))) return apiError("puzzle_not_found", "There's no puzzle for this date.", 404);
      play = await getOrCreatePlay(user.id, date, tz ?? null, now);
    }
    const answered = await answeredResults(play.id);
    return sb.applyCookies(
      Response.json(
        { play_id: play.id, date, started_at: play.started_at, completed_at: play.completed_at, total: play.total, answered },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  } catch (e) {
    console.error("POST /api/play failed", e);
    return apiError("internal_error", "Something went wrong starting your game.", 500);
  }
}

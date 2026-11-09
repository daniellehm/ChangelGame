/**
 * GET /api/puzzle?date=YYYY-MM-DD → today's puzzle WITHOUT answers (SPEC §7).
 * 403 puzzle_not_available outside the date window (SPEC §4), 404 if no ready
 * puzzle exists for the date. 200s are CDN-cacheable for 5 minutes.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { serverNow } from "@/lib/api/clock";
import { launchDate } from "@/lib/config";
import { isDateString, isWindowOpen, puzzleNumber } from "@/lib/dates";
import { findReadyPuzzle, publicRounds } from "@/lib/puzzles/repo";

const Query = z.object({
  date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date"),
});

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return invalid(parsed.error);
  const { date } = parsed.data;

  if (!isWindowOpen(date, serverNow(req))) {
    return apiError("puzzle_not_available", "That puzzle isn't available right now. Check your device clock.", 403);
  }

  try {
    const puzzle = await findReadyPuzzle(date);
    if (!puzzle) return apiError("puzzle_not_found", "There's no puzzle for this date yet.", 404);
    const rounds = await publicRounds(puzzle.roundsDate);
    if (rounds.length !== 5) return apiError("puzzle_not_found", "This puzzle isn't complete yet.", 404);

    const body = { date, number: puzzleNumber(date, launchDate()), theme: puzzle.theme, rerun: puzzle.rerunOf !== null, rounds };
    return Response.json(body, {
      headers: {
        // No answers or user data in here, so the edge may cache it (SPEC §4 "Caching").
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (e) {
    console.error("GET /api/puzzle failed", e);
    return apiError("internal_error", "Something went wrong loading the puzzle.", 500);
  }
}

/**
 * GET /api/crowd?date=YYYY-MM-DD → per-round crowd stats for a puzzle day (SPEC §10):
 * plays, wrong-way and nailed counts, average points; plus `scores`, the day's finished
 * totals (for "Top 15% today"). No answers or user data, so the
 * edge caches it for a minute. Only for dates whose window has opened (no probing ahead).
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { serverNow } from "@/lib/api/clock";
import { rateLimit } from "@/lib/api/ratelimit";
import { clientIp } from "@/lib/supabase/request";
import { isDateString, isWindowOpen, servableDates } from "@/lib/dates";
import { roundCrowd, scoreDistribution } from "@/lib/puzzles/repo";

const Query = z.object({ date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date") });

export async function GET(req: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return invalid(parsed.error);
  const { date } = parsed.data;
  const limited = await rateLimit("puzzle", clientIp(req) ?? "unknown");
  if (limited) return limited;
  const now = serverNow(req);
  // Today's window, or any earlier day.
  if (!isWindowOpen(date, now) && date > servableDates(now)[0]!) {
    return apiError("puzzle_not_available", "That puzzle isn't available yet.", 403);
  }
  try {
    const [rounds, scores] = await Promise.all([roundCrowd(date), scoreDistribution(date)]);
    return Response.json({ date, rounds, scores }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" } });
  } catch (e) {
    console.error("GET /api/crowd failed", e);
    return apiError("internal_error", "Couldn't load crowd stats.", 500);
  }
}

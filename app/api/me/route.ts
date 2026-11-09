/**
 * GET /api/me?date=YYYY-MM-DD&tz=Area/City → player stats + last 30 plays
 * (SPEC §7). Streaks are computed here from plays with lib/streaks (date-line
 * rule). `date`/`tz` (the player's today) decide whether the current streak is
 * still alive.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/ratelimit";
import { launchDate } from "@/lib/config";
import { isDateString, isValidTimeZone, puzzleNumber } from "@/lib/dates";
import { currentStreak, maxStreak } from "@/lib/streaks";
import { adminClient } from "@/lib/supabase/admin";

const Query = z.object({
  date: z.string().refine(isDateString, "must be a valid YYYY-MM-DD date").optional(),
  tz: z.string().max(64).refine(isValidTimeZone, "unknown time zone").optional(),
});

export async function GET(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Start a session first.", 401);
  const limited = await rateLimit("me", user.id);
  if (limited) return limited;
  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return invalid(parsed.error);
  const { date, tz } = parsed.data;
  const launch = launchDate();

  try {
    const db = adminClient();
    const [{ data: stats, error: e1 }, { data: plays, error: e2 }] = await Promise.all([
      db.from("player_stats").select("*").eq("player_id", user.id).maybeSingle(),
      db.from("plays").select("puzzle_date, started_at, completed_at, total, tz_at_play").eq("player_id", user.id).order("puzzle_date", { ascending: false }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const completed = (plays ?? []).filter((p) => p.completed_at);
    const refs = completed.map((p) => ({ number: puzzleNumber(p.puzzle_date, launch), tz: p.tz_at_play ?? "" }));
    const today = date ? { number: puzzleNumber(date, launch), tz: tz ?? "" } : undefined;

    return sb.applyCookies(
      Response.json(
        {
          player_id: user.id,
          anonymous: user.isAnonymous,
          games_played: stats?.games_played ?? 0,
          best_total: stats?.best_total ?? null,
          avg_total: stats?.avg_total ?? null,
          current_streak: currentStreak(refs, today),
          max_streak: maxStreak(refs),
          tiers: {
            nailed: stats?.tier_nailed ?? 0,
            close: stats?.tier_close ?? 0,
            meh: stats?.tier_meh ?? 0,
            off: stats?.tier_off ?? 0,
            wrong: stats?.tier_wrong ?? 0,
          },
          recent: (plays ?? []).slice(0, 30).map((p) => ({
            date: p.puzzle_date,
            number: puzzleNumber(p.puzzle_date, launch),
            total: p.total,
            completed: p.completed_at !== null,
          })),
        },
        { headers: { "Cache-Control": "no-store" } },
      ),
    );
  } catch (e) {
    console.error("GET /api/me failed", e);
    return apiError("internal_error", "Something went wrong loading your stats.", 500);
  }
}

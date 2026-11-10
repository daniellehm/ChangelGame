/** GET /api/account/export → all of this player's data as a JSON download (SPEC §5). */
import { apiError } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/ratelimit";

export async function GET(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Sign in first.", 401);
  const limited = await rateLimit("account", user.id);
  if (limited) return limited;
  const db = adminClient();
  const [{ data: auth }, { data: player }, { data: plays }, { data: reports }] = await Promise.all([
    db.auth.admin.getUserById(user.id),
    db.from("players").select("id, tz, created_at, last_seen_at").eq("id", user.id).maybeSingle(),
    db.from("plays").select("puzzle_date, started_at, completed_at, total, tz_at_play, source, guesses(position, guess_log, points, tier, wrong_way, created_at)").eq("player_id", user.id).order("puzzle_date"),
    db.from("reports").select("puzzle_date, position, reason, note, created_at").eq("player_id", user.id),
  ]);
  const body = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: auth?.user?.email ?? null, anonymous: user.isAnonymous, created_at: auth?.user?.created_at ?? null },
    player,
    plays: plays ?? [],
    reports: reports ?? [],
  };
  return sb.applyCookies(
    new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="changel-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    }),
  );
}

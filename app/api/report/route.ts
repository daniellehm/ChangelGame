/**
 * POST /api/report { play_id, position, reason, note? } → "Something wrong with this?"
 * on a reveal (SPEC §8). One report per player per question; repeat reports are
 * accepted quietly. Reports never change the game by themselves.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { sessionUser } from "@/lib/api/auth";
import { rateLimit } from "@/lib/api/ratelimit";
import { REPORTS } from "@/lib/config";
import { submitReport } from "@/lib/content/reports";

const Body = z.object({
  play_id: z.string().uuid(),
  position: z.number().int().min(1).max(5),
  reason: z.enum(REPORTS.REASONS),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const { user, sb } = await sessionUser(req);
  if (!user) return apiError("unauthorized", "Start a session first.", 401);
  const limited = await rateLimit("report", user.id);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const out = await submitReport(user.id, parsed.data.play_id, parsed.data.position, parsed.data.reason, parsed.data.note ?? null);
    if (out.status === "not_found") return apiError("play_not_found", "That game doesn't exist.", 404);
    if (out.status === "not_locked") return apiError("out_of_order", "Lock in that round before reporting it.", 409);
    return sb.applyCookies(Response.json({ received: true }, { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("POST /api/report failed", e);
    return apiError("internal_error", "Couldn't send that report.", 500);
  }
}

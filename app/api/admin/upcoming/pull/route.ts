/**
 * POST /api/admin/upcoming/pull { date, position, new_id?, note? } → Pull or Swap one round.
 * Without new_id a reserve question is picked (different category from the rest of the day).
 * The pulled question goes to Flagged. Players who already answered keep their score.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { pullRound } from "@/lib/admin/data";
import { isDateString } from "@/lib/dates";

const Body = z.object({
  date: z.string().refine(isDateString, "must be YYYY-MM-DD"),
  position: z.number().int().min(1).max(5),
  new_id: z.number().int().positive().optional(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const out = await pullRound(parsed.data.date, parsed.data.position, { newId: parsed.data.new_id, note: parsed.data.note, editor: a.user.email! });
    if (out.status === "no_reserve") return apiError("not_found", "No spare verified question to swap in. Run the nightly job or approve one from Flagged.", 409);
    if (out.status !== "ok") return apiError("not_found", out.status === "no_round" ? "That round doesn't exist." : "That question can't be swapped in (it must be verified and unscheduled).", 409);
    return a.sb.applyCookies(Response.json(out, { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("POST /api/admin/upcoming/pull failed", e);
    return apiError("internal_error", "Couldn't pull that round.", 500);
  }
}

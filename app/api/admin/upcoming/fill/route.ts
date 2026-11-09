/**
 * POST /api/admin/upcoming/fill { date, ids? } → put 5 questions on an empty day.
 * With ids: exactly those 5 (verified and not on another day), in that order.
 * Without: auto-picked from the ready pool with the usual balance rules.
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { fillDay } from "@/lib/admin/data";
import { isDateString } from "@/lib/dates";

const Body = z.object({
  date: z.string().refine(isDateString, "must be YYYY-MM-DD"),
  ids: z
    .array(z.number().int().positive())
    .length(5, "pick exactly 5 questions")
    .refine((a) => new Set(a).size === 5, "pick 5 different questions")
    .optional(),
});

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const out = await fillDay(parsed.data.date, a.user.email!, parsed.data.ids);
    switch (out.status) {
      case "ok":
        return a.sb.applyCookies(Response.json(out, { headers: { "Cache-Control": "no-store" } }));
      case "exists":
        return apiError("invalid_request", "That day already has a puzzle. Use Swap on its rounds instead.", 409);
      case "unavailable":
        return apiError("invalid_request", "One of those questions isn't ready (it must be verified and not on another day).", 409);
      case "not_enough":
        return apiError("invalid_request", `Not enough ready questions to auto-fill (${out.available} available, 5 different categories needed). Run the job or approve some in Flagged.`, 409);
    }
  } catch (e) {
    console.error("POST /api/admin/upcoming/fill failed", e);
    return apiError("internal_error", "Couldn't fill that day.", 500);
  }
}

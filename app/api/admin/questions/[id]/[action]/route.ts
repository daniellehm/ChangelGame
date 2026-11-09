/** POST /api/admin/questions/:id/approve | /retire | /check → human approval, retirement, or a second-opinion run of the checks (status unchanged). */
import { apiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { approveQuestion, recheckQuestion, retireQuestion } from "@/lib/admin/data";

export const maxDuration = 300; // "check" runs the web cross-check

type Ctx = { params: Promise<{ id: string; action: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const { id: raw, action } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return apiError("invalid_request", "Bad id.", 400);
  const editor = a.user.email!;
  if (action === "check") {
    const r = await recheckQuestion(id);
    return r.status === "ok" ? a.sb.applyCookies(Response.json(r, { headers: { "Cache-Control": "no-store" } })) : apiError("not_found", "No such question.", 404);
  }
  const out = action === "approve" ? await approveQuestion(id, editor) : action === "retire" ? await retireQuestion(id, editor) : null;
  if (!out) return apiError("not_found", "Unknown action.", 404);
  switch (out.status) {
    case "ok":
      return a.sb.applyCookies(Response.json(out, { headers: { "Cache-Control": "no-store" } }));
    case "not_found":
      return apiError("not_found", "No such question.", 404);
    case "not_flagged":
      return apiError("invalid_request", "Only flagged or draft questions can be approved.", 409);
    case "invalid":
      return apiError("invalid_request", `Can't approve: ${out.detail}. Fix it in the editor first.`, 409);
    case "no_reserve":
      return apiError("invalid_request", "It's on an upcoming day and there's no spare question to swap in.", 409);
  }
}

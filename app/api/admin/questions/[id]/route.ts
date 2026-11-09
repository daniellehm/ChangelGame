/**
 * GET    /api/admin/questions/:id → every field, edit history, stats, reports.
 * PATCH  /api/admin/questions/:id → save (logs the edit, adds "Corrected" if live/past, re-runs the checks).
 * DELETE /api/admin/questions/:id → delete a flagged/draft candidate that was never scheduled or played.
 */
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteCandidate, getQuestion, QuestionEdit, saveQuestion } from "@/lib/admin/data";

export const maxDuration = 300; // saving re-runs the checks, including the web cross-check

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const json = (body: unknown) => Response.json(body, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: Ctx) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const id = await idOf(ctx);
  if (!id) return apiError("invalid_request", "Bad id.", 400);
  const q = await getQuestion(id);
  return q ? a.sb.applyCookies(json(q)) : apiError("not_found", "No such question.", 404);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const id = await idOf(ctx);
  if (!id) return apiError("invalid_request", "Bad id.", 400);
  const parsed = QuestionEdit.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const out = await saveQuestion(id, parsed.data, a.user.email!);
    if (out.status === "not_found") return apiError("not_found", "No such question.", 404);
    if (out.status === "invalid") return apiError("invalid_request", out.detail, 400);
    return a.sb.applyCookies(json(out));
  } catch (e) {
    console.error("PATCH /api/admin/questions failed", e);
    return apiError("internal_error", (e as Error).message ?? "Couldn't save.", 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const id = await idOf(ctx);
  if (!id) return apiError("invalid_request", "Bad id.", 400);
  const out = await deleteCandidate(id);
  if (out.status === "not_found") return apiError("not_found", "No such question.", 404);
  if (out.status === "not_deletable") return apiError("invalid_request", "Only flagged or draft candidates that were never scheduled or played can be deleted. Retire it instead.", 409);
  return a.sb.applyCookies(json(out));
}

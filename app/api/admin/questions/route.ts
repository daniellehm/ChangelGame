/** GET /api/admin/questions?status=&category=&origin=&q=&difficulty=&page= → the question bank, with stats. */
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { BankFilter, listQuestions } from "@/lib/admin/data";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const f = BankFilter.safeParse(params);
  if (!f.success) return invalid(f.error);
  try {
    return a.sb.applyCookies(Response.json(await listQuestions(f.data), { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/questions failed", e);
    return apiError("internal_error", "Couldn't load questions.", 500);
  }
}

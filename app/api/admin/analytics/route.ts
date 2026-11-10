/** GET /api/admin/analytics?range=7|30|90|all → everything /admin/analytics shows (aggregates only). */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { getAnalytics } from "@/lib/admin/analytics";

const Query = z.object({ range: z.enum(["7", "30", "90", "all"]).default("30") });

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return invalid(q.error);
  try {
    return a.sb.applyCookies(Response.json(await getAnalytics(q.data.range), { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/analytics failed", e);
    return apiError("internal_error", "Couldn't load analytics.", 500);
  }
}

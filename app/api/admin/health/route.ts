/** GET /api/admin/health → recent runs, pass rate, this month's Claude spend by step. */
import { apiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { health } from "@/lib/admin/data";
import { getOverview } from "@/lib/admin/overview";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  try {
    const [h, o] = await Promise.all([health(), getOverview()]);
    return a.sb.applyCookies(Response.json({ ...h, readyDaysAhead: o.readyDaysAhead, reserve: o.reserve, alerts: o.alerts }, { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/health failed", e);
    return apiError("internal_error", "Couldn't load health.", 500);
  }
}

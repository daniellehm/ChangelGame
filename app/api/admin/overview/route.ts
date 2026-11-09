/** GET /api/admin/overview → admin home: queue badges, buffer, last run, spend, alerts. */
import { apiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { getOverview } from "@/lib/admin/overview";
import { reportQueueCount } from "@/lib/content/reports";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  try {
    return a.sb.applyCookies(Response.json(await getOverview(reportQueueCount), { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/overview failed", e);
    return apiError("internal_error", "Couldn't load the overview.", 500);
  }
}

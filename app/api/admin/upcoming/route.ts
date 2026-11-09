/** GET /api/admin/upcoming → yesterday + the next 30 days, 5 questions each with sources and checks. */
import { apiError } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { upcoming } from "@/lib/admin/data";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  try {
    return a.sb.applyCookies(Response.json(await upcoming(), { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/upcoming failed", e);
    return apiError("internal_error", "Couldn't load upcoming days.", 500);
  }
}

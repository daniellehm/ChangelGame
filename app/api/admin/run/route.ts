/** POST /api/admin/run → "Run the nightly job now" (Health page). Same pipeline and lease as the cron. */
import { requireAdmin } from "@/lib/admin/auth";
import { startContentHop } from "@/lib/content/trigger";

export const maxDuration = 300;

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  startContentHop(new URL(req.url).origin, "manual", null);
  return a.sb.applyCookies(Response.json({ started: true }, { status: 202, headers: { "Cache-Control": "no-store" } }));
}

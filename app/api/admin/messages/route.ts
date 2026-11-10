/**
 * GET  /api/admin/messages?status=new|done|all → contact form messages (newest first).
 * POST /api/admin/messages { id, status } → mark one done (or new again).
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { listContact, setContactStatus } from "@/lib/contact";

const Query = z.object({ status: z.enum(["new", "done", "all"]).default("new") });
const Body = z.object({ id: z.number().int().positive(), status: z.enum(["new", "done"]) });
const json = (b: unknown) => Response.json(b, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return invalid(q.error);
  return a.sb.applyCookies(json({ items: await listContact(q.data.status) }));
}

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return invalid(b.error);
  if (!(await setContactStatus(b.data.id, b.data.status))) return apiError("not_found", "No such message.", 404);
  return a.sb.applyCookies(json({ ok: true }));
}

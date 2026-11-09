/**
 * GET  /api/admin/reports → questions over the report threshold, with rate, count, reasons, notes, sources.
 * POST /api/admin/reports { question_id } → Dismiss (re-queues only if the rate rises 10 more points).
 */
import { z } from "zod";
import { apiError, invalid } from "@/lib/api/http";
import { requireAdmin } from "@/lib/admin/auth";
import { SUMMARY_FIELDS } from "@/lib/admin/data";
import { dismissReports, reportQueue } from "@/lib/content/reports";
import { adminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  try {
    const queue = await reportQueue();
    const ids = queue.map((q) => q.question_id);
    const db = adminClient();
    const [qs, reports, rounds] = ids.length
      ? await Promise.all([
          db.from("questions").select(SUMMARY_FIELDS).in("id", ids),
          db.from("reports").select("question_id, reason, note, valid, created_at").in("question_id", ids).order("created_at", { ascending: false }),
          db.from("puzzle_rounds").select("question_id, puzzle_date, position").in("question_id", ids),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const items = queue.map((e) => {
      const rs = (reports.data ?? []).filter((r) => r.question_id === e.question_id);
      const reasons = Object.fromEntries(["number", "year", "fact", "other"].map((k) => [k, rs.filter((r) => r.reason === k).length]));
      return {
        ...e,
        question: (qs.data ?? []).find((q) => (q as { id: number }).id === e.question_id) ?? null,
        reasons,
        notes: rs.filter((r) => r.note).slice(0, 20).map((r) => ({ note: r.note, reason: r.reason, at: r.created_at })),
        rounds: (rounds.data ?? []).filter((r) => r.question_id === e.question_id),
      };
    });
    return a.sb.applyCookies(Response.json({ items }, { headers: { "Cache-Control": "no-store" } }));
  } catch (e) {
    console.error("GET /api/admin/reports failed", e);
    return apiError("internal_error", "Couldn't load reports.", 500);
  }
}

const Dismiss = z.object({ question_id: z.number().int().positive() });

export async function POST(req: Request) {
  const a = await requireAdmin(req);
  if (!a.ok) return a.res;
  const parsed = Dismiss.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error);
  const out = await dismissReports(parsed.data.question_id, a.user.email!);
  if (out === "not_queued") return apiError("not_found", "That question isn't in the Reports queue.", 404);
  return a.sb.applyCookies(Response.json({ dismissed: true }, { headers: { "Cache-Control": "no-store" } }));
}

/**
 * GET /api/cron/content (Vercel Cron, 02:00 UTC) → one hop of the nightly content
 * pipeline (SPEC §8, DECISIONS 2026-11-09 "M5 pipeline: how the nightly job runs").
 *
 * Replies 202 at once and does the hop after the response (next/server `after`),
 * so a chained call never waits minutes. When the hop ends with work left, it
 * calls this route again (?run=<id>) to start the next hop. A lease on the run
 * stops two hops overlapping, so duplicate calls are harmless.
 */
import { after } from "next/server";
import { apiError } from "@/lib/api/http";
import { isCronAuthorized } from "@/lib/api/cron";
import { runContentHop } from "@/lib/content/run";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return apiError("unauthorized", "Cron secret required.", 401);
  const url = new URL(req.url);
  const runId = Number(url.searchParams.get("run")) || null;
  const trigger = url.searchParams.get("trigger") === "manual" ? "manual" : "cron";

  after(async () => {
    const outcome = await runContentHop(trigger, runId);
    console.log("content hop", JSON.stringify(outcome));
    if (outcome.status === "continue" && outcome.runId) {
      // Start the next hop. It replies at once, so this returns quickly.
      await fetch(`${url.origin}/api/cron/content?run=${outcome.runId}`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(15_000),
      }).catch((e) => console.error("content hop chain failed", e));
    }
  });

  return Response.json({ accepted: true, run: runId }, { status: 202, headers: { "Cache-Control": "no-store" } });
}

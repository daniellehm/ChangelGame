/**
 * Start a content hop after the response is sent, and chain the next hop when
 * work remains (shared by Vercel Cron and the admin "Run now" button).
 */
import { after } from "next/server";
import { runContentHop, type Trigger } from "./run";

export function startContentHop(origin: string, trigger: Trigger, runId: number | null): void {
  after(async () => {
    const outcome = await runContentHop(trigger, runId);
    console.log("content hop", JSON.stringify(outcome));
    if (outcome.status === "continue" && outcome.runId) {
      // The next hop replies at once (202), so this returns quickly.
      await fetch(`${origin}/api/cron/content?run=${outcome.runId}`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        signal: AbortSignal.timeout(15_000),
      }).catch((e) => console.error("content hop chain failed", e));
    }
  });
}

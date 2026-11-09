/**
 * Alerts (SPEC §8): a banner on the admin home for anything that needs a look,
 * and email only when the game itself is at risk.
 *   Banner: fewer than 14 ready days; more than 40% of a night's candidates failing
 *           the checks; a failed nightly run; the spend cap reached.
 *   Email:  fewer than 7 ready days; the nightly job failing two nights in a row.
 */
export interface RunSummary {
  status: string;
  trigger: string;
  verified: number;
  flagged: number;
  started_at: string;
  error?: string | null;
}

export interface Alert {
  kind: "low_buffer" | "very_low_buffer" | "high_fail_rate" | "run_failed" | "runs_failed_twice" | "spend_cap";
  level: "warn" | "danger";
  text: string;
  /** Game at risk: also emailed (once a day per kind). */
  email: boolean;
}

export const ALERTS = { LOW_DAYS: 14, AT_RISK_DAYS: 7, FAIL_RATE: 0.4, MIN_FOR_RATE: 5 } as const;

/** `nightly` is the latest cron runs, newest first. */
export function computeAlerts(input: { readyDaysAhead: number; nightly: RunSummary[]; capReached: boolean }): Alert[] {
  const out: Alert[] = [];
  const d = input.readyDaysAhead;
  if (d < ALERTS.AT_RISK_DAYS) {
    out.push({ kind: "very_low_buffer", level: "danger", text: `Only ${d} ready day${d === 1 ? "" : "s"} ahead. Players will get reruns soon.`, email: true });
  } else if (d < ALERTS.LOW_DAYS) {
    out.push({ kind: "low_buffer", level: "warn", text: `${d} ready days ahead (fewer than ${ALERTS.LOW_DAYS}).`, email: false });
  }
  const [last, prev] = input.nightly;
  if (last && last.status === "failed") {
    const twice = prev?.status === "failed";
    out.push({
      kind: twice ? "runs_failed_twice" : "run_failed",
      level: twice ? "danger" : "warn",
      text: twice ? "The nightly content run failed two nights in a row." : `Last night's content run failed${last.error ? `: ${last.error.slice(0, 120)}` : "."}`,
      email: twice,
    });
  }
  if (last) {
    const n = last.verified + last.flagged;
    if (n >= ALERTS.MIN_FOR_RATE && last.flagged / n > ALERTS.FAIL_RATE) {
      out.push({ kind: "high_fail_rate", level: "warn", text: `${Math.round((100 * last.flagged) / n)}% of last night's candidates failed the checks (${last.flagged} of ${n}).`, email: false });
    }
  }
  if (input.capReached) out.push({ kind: "spend_cap", level: "warn", text: "This month's Claude spend cap is reached: no new questions until next month or a higher cap.", email: false });
  return out;
}

/** Consecutive ready days starting at `today` (today counts). */
export function consecutiveReadyDays(today: string, ready: ReadonlySet<string>, addDays: (d: string, n: number) => string, max = 60): number {
  let n = 0;
  while (n < max && ready.has(addDays(today, n))) n++;
  return n;
}

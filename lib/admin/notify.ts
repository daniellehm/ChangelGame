/**
 * Alert emails (SPEC §8): sent only when the game itself is at risk, to ADMIN_EMAILS,
 * from hello@changel.app via Resend. Each kind is sent at most once per DEDUPE_HOURS;
 * every attempt is recorded in alerts_sent (which also dedupes).
 * CHANGEL_NO_ALERT_EMAIL=1 (tests) records the alert without sending.
 */
import { adminClient } from "../supabase/admin";
import { adminEmails } from "./auth";
import type { Alert } from "./alerts";

const DEDUPE_HOURS = 20;
const FROM = "Changel <hello@changel.app>";

export interface Sent {
  kind: string;
  sent: boolean;
  reason?: string;
}

export async function sendAlertEmail(kind: string, subject: string, text: string, now = new Date()): Promise<Sent> {
  const db = adminClient();
  const since = new Date(now.getTime() - DEDUPE_HOURS * 3_600_000).toISOString();
  const { data: recent, error } = await db.from("alerts_sent").select("id").eq("kind", kind).gte("sent_at", since).limit(1);
  if (error) throw error;
  if (recent?.length) return { kind, sent: false, reason: "already sent recently" };

  const to = [...adminEmails()];
  const key = process.env.RESEND_API_KEY;
  let outcome: Record<string, unknown>;
  if (process.env.CHANGEL_NO_ALERT_EMAIL === "1" || !key || !to.length) {
    outcome = { suppressed: true, why: !to.length ? "no ADMIN_EMAILS" : !key ? "no RESEND_API_KEY" : "test" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject: `Changel: ${subject}`, text: `${text}\n\nAdmin: https://changel.app/admin` }),
        signal: AbortSignal.timeout(10_000),
      });
      outcome = res.ok ? { id: ((await res.json()) as { id?: string }).id ?? null } : { error: `HTTP ${res.status}` };
    } catch (e) {
      outcome = { error: (e as Error).message };
    }
  }
  await db.from("alerts_sent").insert({ kind, sent_at: now.toISOString(), details: { subject, recipients: to.length, ...outcome } });
  return { kind, sent: !("suppressed" in outcome) && !("error" in outcome), reason: (outcome.why ?? outcome.error) as string | undefined };
}

/** Email the at-risk alerts (alert.email), once per kind per day. */
export async function sendRiskAlerts(alerts: Alert[]): Promise<Sent[]> {
  const out: Sent[] = [];
  for (const a of alerts.filter((x) => x.email)) out.push(await sendAlertEmail(a.kind, a.text, a.text));
  return out;
}

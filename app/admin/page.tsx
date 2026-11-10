"use client";

import Link from "next/link";
import { AdminShell, Gate, useAdmin } from "@/components/admin/AdminShell";
import type { Overview } from "@/lib/admin/overview";

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function AdminHome() {
  const [load] = useAdmin<Overview>("/api/admin/overview");
  return (
    <AdminShell title="Admin">
      <Gate load={load}>
        {(o) => (
          <>
            {o.alerts.length > 0 && (
              <ul className="alerts" aria-label="Alerts">
                {o.alerts.map((a) => (
                  <li key={a.kind} className={`alert ${a.level}`} role={a.level === "danger" ? "alert" : undefined}>
                    {a.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="muted">Reviewing is optional: if you never open this, the game keeps running.</p>
            <ul className="tiles">
              <li>
                <Link href="/admin/reports">
                  <span className="tile-n">{o.queues.reports}</span>
                  <span>Reports</span>
                  {o.queues.reports > 0 && <span className="badge">needs a look</span>}
                </Link>
              </li>
              <li>
                <Link href="/admin/messages">
                  <span className="tile-n">{o.queues.messages}</span>
                  <span>Messages</span>
                  {o.queues.messages > 0 && <span className="badge">new</span>}
                </Link>
              </li>
              <li>
                <Link href="/admin/flagged">
                  <span className="tile-n">{o.queues.flagged}</span>
                  <span>Flagged</span>
                  {o.queues.flagged > 0 && <span className="badge">held back</span>}
                </Link>
              </li>
              <li>
                <Link href="/admin/upcoming">
                  <span className="tile-n">{o.readyDaysAhead}</span>
                  <span>Ready days ahead</span>
                </Link>
              </li>
              <li>
                <Link href="/admin/bank">
                  <span className="tile-n">{o.reserve}</span>
                  <span>Spare verified questions</span>
                </Link>
              </li>
            </ul>
            <h2>Last content run</h2>
            {o.lastRun ? (
              <p>
                <b>{o.lastRun.status}</b> · {o.lastRun.trigger} · started {when(o.lastRun.started_at)}
                {o.lastRun.finished_at ? `, finished ${when(o.lastRun.finished_at)}` : ""}
                <br />
                {o.lastRun.generated} generated · {o.lastRun.verified} verified · {o.lastRun.flagged} flagged · {o.lastRun.scheduled} days scheduled
              </p>
            ) : (
              <p>No runs yet.</p>
            )}
            <p>
              Claude spend this month: <b>${o.spend.month.toFixed(2)}</b> of ${o.spend.cap} · <Link href="/admin/health">Health</Link>
            </p>
          </>
        )}
      </Gate>
    </AdminShell>
  );
}

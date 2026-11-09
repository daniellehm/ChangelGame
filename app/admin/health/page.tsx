"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";
import type { Alert } from "@/lib/admin/alerts";

interface Health {
  readyDaysAhead: number;
  reserve: number;
  passRate: number | null;
  alerts: Alert[];
  spend: { month: number; cap: number; byPurpose: Record<string, { calls: number; usd: number; searches: number; failed: number }> };
  runs: Array<{ id: number; trigger: string; status: string; started_at: string; finished_at: string | null; hops: number; generated: number; verified: number; flagged: number; scheduled: number; error: string | null; log: string[] }>;
}

export default function HealthPage() {
  const [load, reload] = useAdmin<Health>("/api/admin/health");
  const [msg, setMsg] = useState<string | null>(null);
  const runNow = async () => {
    setMsg(null);
    try {
      await adminSend("/api/admin/run", "POST");
      setMsg("Started. It works in slices of a few minutes; refresh to follow progress.");
      setTimeout(reload, 4000);
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <AdminShell title="Health">
      {msg && <p role="status" className="alert warn">{msg}</p>}
      <Gate load={load}>
        {(h) => (
          <>
            {h.alerts.map((a) => <p key={a.kind} className={`alert ${a.level}`}>{a.text}</p>)}
            <ul className="tiles">
              <li><div><span className="tile-n">{h.readyDaysAhead}</span><span>Ready days ahead</span></div></li>
              <li><div><span className="tile-n">{h.reserve}</span><span>Spare verified</span></div></li>
              <li><div><span className="tile-n">{h.passRate === null ? "—" : `${Math.round(h.passRate * 100)}%`}</span><span>Check pass rate (7 runs)</span></div></li>
              <li><div><span className="tile-n">${h.spend.month.toFixed(2)}</span><span>Claude spend this month (cap ${h.spend.cap})</span></div></li>
            </ul>
            <button type="button" className="btn" onClick={runNow}>Run the nightly job now</button>
            <h2>Spend by step this month</h2>
            <div className="table-wrap">
              <table className="bank">
                <thead><tr><th>Step</th><th>Calls</th><th>Web searches</th><th>Failed</th><th>USD</th></tr></thead>
                <tbody>
                  {Object.entries(h.spend.byPurpose).map(([p, s]) => (
                    <tr key={p}><td>{p}</td><td>{s.calls}</td><td>{s.searches}</td><td>{s.failed}</td><td>${s.usd.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Recent runs</h2>
            {h.runs.length === 0 ? <p>No runs yet.</p> : (
              <ul className="history">
                {h.runs.map((r) => (
                  <li key={r.id}>
                    <b>{r.status}</b> · {r.trigger} · {new Date(r.started_at).toLocaleString()} · {r.hops} hop{r.hops === 1 ? "" : "s"} · {r.generated} generated, {r.verified} verified, {r.flagged} flagged, {r.scheduled} days scheduled
                    {r.error ? <><br /><span className="qcard-flag">{r.error}</span></> : null}
                    {r.log?.length ? (
                      <details><summary>Log ({r.log.length})</summary><pre className="log">{r.log.join("\n")}</pre></details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Gate>
    </AdminShell>
  );
}

"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";
import { QuestionCard, type QuestionSummary } from "@/components/admin/QuestionCard";

export default function Flagged() {
  const [load, reload] = useAdmin<{ items: QuestionSummary[]; total: number }>("/api/admin/questions?status=flagged");
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <AdminShell title="Flagged">
      <p className="muted">Candidates that failed an automatic check. They never go live unless you approve them here (or fix them in the editor so they pass).</p>
      {msg && <p role="status" className="alert warn">{msg}</p>}
      <Gate load={load}>
        {(d) =>
          d.items.length === 0 ? (
            <p>Nothing flagged.</p>
          ) : (
            d.items.map((q) => (
              <QuestionCard
                key={q.id}
                q={q}
                actions={
                  <>
                    <button type="button" className="btn ghost small" onClick={() => act(() => adminSend(`/api/admin/questions/${q.id}/approve`, "POST"), `Approved #${q.id}. It can now be scheduled.`)}>
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => window.confirm(`Delete #${q.id} "${q.prompt}"? This can't be undone.`) && act(() => adminSend(`/api/admin/questions/${q.id}`, "DELETE"), `Deleted #${q.id}.`)}
                    >
                      Delete
                    </button>
                  </>
                }
              />
            ))
          )
        }
      </Gate>
    </AdminShell>
  );
}

"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";
import { QuestionCard, type QuestionSummary } from "@/components/admin/QuestionCard";

interface Item {
  question_id: number;
  seen: number;
  valid_reports: number;
  rate: number;
  dismissed_rate: number | null;
  question: QuestionSummary | null;
  reasons: Record<string, number>;
  notes: Array<{ note: string; reason: string; at: string }>;
  rounds: Array<{ puzzle_date: string; position: number }>;
}

const REASON_LABEL: Record<string, string> = { number: "number looks wrong", year: "wrong year", fact: "fact is wrong", other: "other" };

export default function Reports() {
  const [load, reload] = useAdmin<{ items: Item[] }>("/api/admin/reports");
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
    <AdminShell title="Reports">
      <p className="muted">Questions more than 10% of players reported (with at least 10 valid reports). They stay live until you act. No email is sent.</p>
      {msg && <p role="status" className="alert warn">{msg}</p>}
      <Gate load={load}>
        {(d) =>
          d.items.length === 0 ? (
            <p>No questions over the report threshold.</p>
          ) : (
            d.items.map((it) => {
              const live = [...it.rounds].sort((a, b) => b.puzzle_date.localeCompare(a.puzzle_date))[0];
              return (
                <div key={it.question_id}>
                  <p>
                    <b>{Math.round(it.rate * 100)}% reported</b> · {it.valid_reports} valid reports from {it.seen} players
                    {it.dismissed_rate !== null ? ` · dismissed before at ${Math.round(it.dismissed_rate * 100)}%` : ""}
                    <br />
                    {Object.entries(it.reasons).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${REASON_LABEL[k] ?? k}`).join(" · ")}
                  </p>
                  {it.notes.length > 0 && (
                    <ul className="history">
                      {it.notes.map((n, i) => <li key={i}>“{n.note}” ({REASON_LABEL[n.reason] ?? n.reason})</li>)}
                    </ul>
                  )}
                  {it.question && (
                    <QuestionCard
                      q={it.question}
                      actions={
                        <>
                          {live && (
                            <button type="button" className="btn ghost small" onClick={() => window.confirm("Pull it from its day and swap in a spare? Players who already answered keep their score.") && act(() => adminSend("/api/admin/upcoming/pull", "POST", { date: live.puzzle_date, position: live.position, note: "pulled from Reports" }), "Pulled. A spare question took its place.")}>
                              Pull
                            </button>
                          )}
                          <button type="button" className="btn ghost small" onClick={() => act(() => adminSend("/api/admin/reports", "POST", { question_id: it.question_id }), "Dismissed. It comes back only if reports rise 10 more points.")}>
                            Dismiss
                          </button>
                        </>
                      }
                    />
                  )}
                </div>
              );
            })
          )
        }
      </Gate>
    </AdminShell>
  );
}

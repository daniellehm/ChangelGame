"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";
import { QuestionCard, type QuestionSummary } from "@/components/admin/QuestionCard";

interface Day {
  date: string;
  puzzle: { status: string; theme: string | null; rerun_of: string | null } | null;
  rounds: Array<{ position: number; question: QuestionSummary }>;
}

export default function Upcoming() {
  const [load, reload] = useAdmin<{ today: string; days: Day[] }>("/api/admin/upcoming");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const pull = async (date: string, position: number) => {
    const note = window.prompt("Why pull this question? (optional)") ?? undefined;
    if (note === undefined) return;
    setBusy(`${date}-${position}`);
    setMsg(null);
    try {
      const r = await adminSend<{ newId: number }>("/api/admin/upcoming/pull", "POST", { date, position, note: note || undefined });
      setMsg(`Swapped in question #${r.newId}. The pulled one is in Flagged.`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const swap = async (date: string, position: number) => {
    const raw = window.prompt("Swap in which question id? (it must be verified and unscheduled)");
    const id = Number(raw);
    if (!raw || !Number.isInteger(id)) return;
    setBusy(`${date}-${position}`);
    setMsg(null);
    try {
      await adminSend("/api/admin/upcoming/pull", "POST", { date, position, new_id: id, note: "swapped" });
      setMsg(`Swapped in question #${id}.`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell title="Upcoming">
      {msg && <p role="status" className="alert warn">{msg}</p>}
      <Gate load={load}>
        {(d) => (
          <ol className="days">
            {d.days.map((day) => (
              <li key={day.date} className="day">
                <h2>
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
                  {day.date === d.today ? " · today" : ""}
                  {day.puzzle?.rerun_of ? ` · rerun of ${day.puzzle.rerun_of}` : ""}
                  {!day.puzzle ? <span className="badge">empty</span> : null}
                </h2>
                {day.rounds.map((r) => (
                  <QuestionCard
                    key={r.position}
                    q={r.question}
                    actions={
                      day.date >= d.today ? (
                        <>
                          <button type="button" className="btn ghost small" disabled={!!busy} onClick={() => pull(day.date, r.position)}>
                            Pull
                          </button>
                          <button type="button" className="btn ghost small" disabled={!!busy} onClick={() => swap(day.date, r.position)}>
                            Swap…
                          </button>
                        </>
                      ) : null
                    }
                  />
                ))}
              </li>
            ))}
          </ol>
        )}
      </Gate>
    </AdminShell>
  );
}

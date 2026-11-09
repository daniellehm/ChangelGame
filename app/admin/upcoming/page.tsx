"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";
import { QuestionCard, type QuestionSummary } from "@/components/admin/QuestionCard";
import { QuestionPicker } from "@/components/admin/QuestionPicker";

interface Day {
  date: string;
  puzzle: { status: string; theme: string | null; rerun_of: string | null } | null;
  rounds: Array<{ position: number; question: QuestionSummary }>;
}

/** What the picker is open for: a round to swap, or an empty day to fill. */
type Picking = { kind: "swap"; date: string; position: number; taken: string[] } | { kind: "fill"; date: string } | null;

export default function Upcoming() {
  const [load, reload] = useAdmin<{ today: string; days: Day[] }>("/api/admin/upcoming");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking>(null);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
      setPicking(null);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pull = (date: string, position: number) => {
    const note = window.prompt("Why pull this question? (optional)") ?? undefined;
    if (note === undefined) return;
    void act(async () => {
      const r = await adminSend<{ newId: number }>("/api/admin/upcoming/pull", "POST", { date, position, note: note || undefined });
      return `Swapped in question #${r.newId}. The pulled one is in Flagged.`;
    });
  };

  const swapIn = (date: string, position: number, id: number) =>
    act(async () => {
      await adminSend("/api/admin/upcoming/pull", "POST", { date, position, new_id: id, note: "swapped" });
      return `Swapped in question #${id}. The one it replaced is in Flagged.`;
    });

  const fill = (date: string, ids?: number[]) =>
    act(async () => {
      const r = await adminSend<{ relaxed: boolean }>("/api/admin/upcoming/fill", "POST", { date, ids });
      return ids ? `${date} now has your 5 questions.` : `${date} auto-filled${r.relaxed ? " (no near-unchanged or big-mover question was available, so the day is less balanced)" : ""}.`;
    });

  const fmt = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <AdminShell title="Upcoming">
      <p className="muted">
        Every night the job fills empty days 7–30 days ahead from the ready questions. You can fill any empty day yourself, and swap any round.
      </p>
      {msg && <p role="status" className="alert warn">{msg}</p>}
      <Gate load={load}>
        {(d) => (
          <ol className="days">
            {d.days.map((day) => (
              <li key={day.date} className="day">
                <h2>
                  {fmt(day.date)}
                  {day.date === d.today ? " · today" : ""}
                  {day.puzzle?.rerun_of ? ` · rerun of ${day.puzzle.rerun_of}` : ""}
                  {!day.puzzle ? <span className="badge">empty</span> : null}
                </h2>
                {!day.puzzle && day.date >= d.today ? (
                  picking?.kind === "fill" && picking.date === day.date ? (
                    <QuestionPicker count={5} busy={busy} onPick={(ids) => void fill(day.date, ids)} onCancel={() => setPicking(null)} />
                  ) : (
                    <div className="qcard-actions">
                      <button type="button" className="btn small" disabled={busy} onClick={() => setPicking({ kind: "fill", date: day.date })}>
                        Choose questions…
                      </button>
                      <button type="button" className="btn ghost small" disabled={busy} onClick={() => void fill(day.date)}>
                        Auto-fill
                      </button>
                    </div>
                  )
                ) : null}
                {day.rounds.map((r) => (
                  <div key={r.position}>
                    <QuestionCard
                      q={r.question}
                      actions={
                        day.date >= d.today ? (
                          <>
                            <button type="button" className="btn ghost small" disabled={busy} onClick={() => pull(day.date, r.position)}>
                              Pull
                            </button>
                            <button
                              type="button"
                              className="btn ghost small"
                              disabled={busy}
                              onClick={() => setPicking({ kind: "swap", date: day.date, position: r.position, taken: day.rounds.filter((o) => o.position !== r.position).map((o) => o.question.category) })}
                            >
                              Swap…
                            </button>
                          </>
                        ) : null
                      }
                    />
                    {picking?.kind === "swap" && picking.date === day.date && picking.position === r.position ? (
                      <QuestionPicker count={1} takenCategories={picking.taken} busy={busy} onPick={([id]) => void swapIn(day.date, r.position, id!)} onCancel={() => setPicking(null)} />
                    ) : null}
                  </div>
                ))}
              </li>
            ))}
          </ol>
        )}
      </Gate>
    </AdminShell>
  );
}

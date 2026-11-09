"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminShell, Gate, useAdmin } from "@/components/admin/AdminShell";
import type { QuestionSummary } from "@/components/admin/QuestionCard";
import { formatValue } from "@/lib/format";

type Row = QuestionSummary & { rounds: Array<{ day: number; date: string; position: number }>; stats: { plays: number; avg_points: number | null; wrong_way_pct: number | null; report_rate: number | null } | null; difficulty: string | null };

const STATUSES = ["", "verified", "scheduled", "used", "flagged", "draft", "retired"];
const SORTS = [
  ["added", "Newest added"],
  ["day_asc", "Puzzle day: Day 1 first"],
  ["day_desc", "Puzzle day: latest first"],
] as const;
const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x)}%`);
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function Bank() {
  const [f, setF] = useState({ sort: "added", day: "", status: "", category: "", origin: "", difficulty: "", q: "", page: 0 });
  const qs = new URLSearchParams(Object.entries(f).map(([k, v]) => [k, String(v)])).toString();
  const [load] = useAdmin<{ items: Row[]; total: number; page: number; pageSize: number }>(`/api/admin/questions?${qs}`);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value, page: 0 });

  return (
    <AdminShell title="Question bank">
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <label>Sort <select value={f.sort} onChange={set("sort")}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Day # <input type="number" min={1} inputMode="numeric" value={f.day} onChange={set("day")} placeholder="any" style={{ width: 80 }} /></label>
        <label>Status <select value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s} value={s}>{s || "any"}</option>)}</select></label>
        <label>Origin <select value={f.origin} onChange={set("origin")}>{["", "researched", "data", "seed", "manual"].map((s) => <option key={s} value={s}>{s || "any"}</option>)}</select></label>
        <label>Difficulty <select value={f.difficulty} onChange={set("difficulty")}>{["", "easy", "medium", "hard"].map((s) => <option key={s} value={s}>{s || "any"}</option>)}</select></label>
        <label>Category <input value={f.category} onChange={set("category")} placeholder="any" /></label>
        <label>Search <input value={f.q} onChange={set("q")} placeholder="prompt contains…" /></label>
      </form>
      <Gate load={load}>
        {(d) => (
          <>
            <p className="muted">
              {d.total} questions{f.sort !== "added" || f.day ? " on a puzzle day (unscheduled ones are hidden in this view)" : ""}
            </p>
            <div className="table-wrap">
              <table className="bank">
                <thead>
                  <tr><th>Question</th><th>Day</th><th>Status</th><th>Values</th><th>Plays</th><th>Avg pts</th><th>Wrong way</th><th>Reports</th></tr>
                </thead>
                <tbody>
                  {d.items.map((q) => (
                    <tr key={q.id}>
                      <td><Link href={`/admin/questions/${q.id}`}>#{q.id} {q.prompt}</Link><br /><span className="muted">{q.category} · {q.origin}</span></td>
                      <td>
                        {q.rounds.length
                          ? q.rounds.map((r) => (
                              <span key={r.date} style={{ display: "block", whiteSpace: "nowrap" }}>
                                Day {r.day} · R{r.position}<br /><span className="muted">{shortDate(r.date)}</span>
                              </span>
                            ))
                          : <span className="muted">—</span>}
                      </td>
                      <td>{q.status}</td>
                      <td>{q.start_year} {formatValue(q.start_value, q.format)} → {q.end_year} {formatValue(q.end_value, q.format)}</td>
                      <td>{q.stats?.plays ?? 0}</td>
                      <td>{q.stats?.avg_points === null || q.stats?.avg_points === undefined ? "—" : Math.round(q.stats.avg_points)}</td>
                      <td>{pct(q.stats?.wrong_way_pct)}</td>
                      <td>{pct(q.stats?.report_rate === null || q.stats?.report_rate === undefined ? null : q.stats.report_rate * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <button type="button" className="btn ghost small" disabled={f.page === 0} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</button>
              <button type="button" className="btn ghost small" disabled={(d.page + 1) * d.pageSize >= d.total} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button>
            </div>
          </>
        )}
      </Gate>
    </AdminShell>
  );
}

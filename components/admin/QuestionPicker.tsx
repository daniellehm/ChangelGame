"use client";

import { useState } from "react";
import { Gate, useAdmin } from "./AdminShell";
import type { QuestionSummary } from "./QuestionCard";
import { formatValue, multLabel } from "@/lib/format";

/**
 * Pick ready questions (verified, not on any day) for a day: one for a Swap, or five for
 * an empty day. Searchable; shows each question's category and change so a day can be balanced.
 */
export function QuestionPicker({
  count,
  takenCategories = [],
  busy,
  onPick,
  onCancel,
}: {
  count: 1 | 5;
  /** Categories already on the day (a Swap), shown as a warning, not blocked. */
  takenCategories?: string[];
  busy: boolean;
  onPick: (ids: number[]) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [load] = useAdmin<{ items: QuestionSummary[]; total: number }>(`/api/admin/questions?status=verified&q=${encodeURIComponent(q)}`);
  const taken = new Set(takenCategories.map((c) => c.toLowerCase()));

  const toggle = (id: number) => {
    if (count === 1) return onPick([id]);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 5 ? [...p, id] : p));
  };

  return (
    <div className="picker" role="dialog" aria-label={count === 1 ? "Choose a question" : "Choose 5 questions"}>
      <div className="picker-head">
        <b>{count === 1 ? "Choose a question to swap in" : `Choose 5 questions (${picked.length}/5)`}</b>
        <label>
          Search <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="prompt contains…" />
        </label>
      </div>
      <Gate load={load}>
        {(d) =>
          d.items.length ? (
            <ul className="picker-list">
              {d.items.map((it) => {
                const on = picked.includes(it.id);
                const clash = taken.has(it.category.toLowerCase()) || (count === 5 && picked.some((p) => p !== it.id && d.items.find((x) => x.id === p)?.category.toLowerCase() === it.category.toLowerCase()));
                return (
                  <li key={it.id}>
                    <button type="button" className={`picker-item${on ? " on" : ""}`} aria-pressed={count === 5 ? on : undefined} disabled={busy} onClick={() => toggle(it.id)}>
                      <span className="muted">
                        #{it.id} · {it.category}
                        {clash ? " · same category as another round" : ""}
                      </span>
                      <span className="picker-q">{it.prompt}</span>
                      <span className="muted">
                        {it.start_year} {formatValue(it.start_value, it.format)} → {it.end_year} {formatValue(it.end_value, it.format)} ({multLabel(Math.log10(it.end_value / it.start_value)).big})
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No ready questions{q ? " match" : ""}. Approve some in Flagged, or run the job.</p>
          )
        }
      </Gate>
      <div className="picker-actions">
        {count === 5 && (
          <button type="button" className="btn small" disabled={busy || picked.length !== 5} onClick={() => onPick(picked)}>
            Put these 5 on the day
          </button>
        )}
        <button type="button" className="btn ghost small" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

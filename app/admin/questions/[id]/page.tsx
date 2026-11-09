"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AdminShell,
  adminSend,
  Gate,
  useAdmin,
} from "@/components/admin/AdminShell";
import {
  QuestionCard,
  type QuestionSummary,
} from "@/components/admin/QuestionCard";
import { FORMATS } from "@/lib/format";

interface Detail {
  question: QuestionSummary & Record<string, unknown>;
  edits: Array<{
    id: number;
    edited_by: string;
    edited_at: string;
    before: unknown;
    after: unknown;
    note: string | null;
  }>;
  rounds: Array<{ puzzle_date: string; position: number }>;
  stats: {
    plays: number;
    avg_points: number | null;
    wrong_way_pct: number | null;
    valid_reports: number;
    report_rate: number | null;
  } | null;
  reports: Array<{
    reason: string;
    note: string | null;
    valid: boolean;
    created_at: string;
  }>;
}

const FIELDS = [
  ["prompt", "Question", "text"],
  ["category", "Category", "text"],
  ["start_year", "Start year", "number"],
  ["start_value", "Start value", "number"],
  ["end_year", "End year", "number"],
  ["end_value", "End value", "number"],
  ["max_change", "Slider range (÷k … ×k)", "number"],
  ["fact", "Fact (max 140 characters)", "textarea"],
  ["source_name", "Source name", "text"],
  ["source_url", "Source URL", "text"],
  ["source_url_2", "Second source URL", "text"],
] as const;

const formOf = (q: Detail["question"]): Record<string, string> =>
  Object.fromEntries([
    ...FIELDS.map(([k]) => [
      k,
      q[k] === null || q[k] === undefined ? "" : String(q[k]),
    ]),
    ["format", String(q.format)],
  ]);

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [load, reload] = useAdmin<Detail>(`/api/admin/questions/${id}`);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <AdminShell title={`Question #${id}`}>
      {msg && (
        <p role="status" className="alert warn">
          {msg}
        </p>
      )}
      <Gate load={load}>
        {(d) => (
          <EditorBody
            key={JSON.stringify(formOf(d.question))}
            id={id}
            d={d}
            reload={reload}
            setMsg={setMsg}
          />
        )}
      </Gate>
    </AdminShell>
  );
}

/** Keyed on the loaded values, so a reload after saving starts the form from the saved question. */
function EditorBody({
  id,
  d,
  reload,
  setMsg,
}: {
  id: string;
  d: Detail;
  reload: () => void;
  setMsg: (m: string | null) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    formOf(d.question),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setMsg(
      "Saving and re-running the automatic checks (this can take a minute)…",
    );
    const patch: Record<string, unknown> = { format: form.format };
    for (const [k, , type] of FIELDS)
      patch[k] =
        type === "number"
          ? Number(form[k])
          : k === "source_url_2" && !form[k]
            ? null
            : form[k];
    try {
      const r = await adminSend<{
        changed: string[];
        corrected: boolean;
        report: { passed: boolean } | null;
      }>(`/api/admin/questions/${id}`, "PATCH", patch);
      setMsg(
        `${r.changed.length ? `Saved ${r.changed.join(", ")}.` : "No changes."}${r.corrected ? ' Players will see a "Corrected" note.' : ""} Checks ${r.report?.passed ? "passed" : "failed (see below)"}.`,
      );
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const retire = async () => {
    if (
      !window.confirm(
        "Retire this question? It's swapped out of any upcoming day. Past games keep their scores.",
      )
    )
      return;
    try {
      await adminSend(`/api/admin/questions/${id}/retire`, "POST");
      setMsg("Retired.");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <>
      <h2>Preview</h2>
      <QuestionCard q={d.question} />
      <p className="muted">
        {d.rounds.length
          ? `On: ${d.rounds.map((r) => `${r.puzzle_date} (round ${r.position})`).join(", ")}`
          : "Not on any puzzle."}
        {d.stats
          ? ` · ${d.stats.plays} plays · avg ${d.stats.avg_points === null ? "—" : Math.round(d.stats.avg_points)} pts · wrong way ${d.stats.wrong_way_pct === null ? "—" : `${Math.round(d.stats.wrong_way_pct)}%`} · ${d.stats.valid_reports} valid reports`
          : ""}
      </p>
      <h2>Edit</h2>
      <form
        className="editor"
        onSubmit={(e) => (e.preventDefault(), void save())}
      >
        {FIELDS.map(([k, label, type]) => (
          <label key={k}>
            {label}
            {type === "textarea" ? (
              <textarea
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                rows={3}
              />
            ) : (
              <input
                type={type}
                step="any"
                value={form[k] ?? ""}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            )}
          </label>
        ))}
        <label>
          Format
          <select
            value={form.format ?? ""}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn" disabled={busy}>
          Save and re-check
        </button>
      </form>
      <button
        type="button"
        className="btn ghost"
        onClick={retire}
        disabled={busy || d.question.status === "retired"}
      >
        Retire
      </button>
      <h2>Edit history</h2>
      {d.edits.length ? (
        <ul className="history">
          {d.edits.map((e) => (
            <li key={e.id}>
              <b>{new Date(e.edited_at).toLocaleString()}</b> · {e.edited_by}
              {e.note ? ` · ${e.note}` : ""}
              <br />
              <code>
                {JSON.stringify(e.before)} → {JSON.stringify(e.after)}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No edits yet.</p>
      )}
      {d.reports.length > 0 && (
        <>
          <h2>Reports</h2>
          <ul className="history">
            {d.reports.map((r, i) => (
              <li key={i}>
                {r.reason}
                {r.valid ? "" : " (not counted)"}
                {r.note ? `: ${r.note}` : ""} ·{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

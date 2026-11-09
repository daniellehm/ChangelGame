"use client";

/**
 * "Something wrong with this?" on a reveal (SPEC §8 safety nets, M5 task 5.9).
 * Only for server plays (a report needs the play id). Reports never change the
 * game on their own; the admin reviews questions that pass the report threshold.
 */
import { useId, useState } from "react";

const REASONS = [
  ["number", "The number looks wrong"],
  ["year", "Wrong year"],
  ["fact", "The fact is wrong"],
  ["other", "Something else"],
] as const;

type State = "closed" | "open" | "sending" | "sent" | "error";

export function ReportButton({ playId, position }: { playId: string; position: number }) {
  const [state, setState] = useState<State>("closed");
  const [reason, setReason] = useState<string>("number");
  const [note, setNote] = useState("");
  const id = useId();

  const send = async () => {
    setState("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ play_id: playId, position, reason, note: note.trim() || undefined }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") return <p className="report-done" role="status">Thanks. We&apos;ll take a look.</p>;
  if (state === "closed") {
    return (
      <button type="button" className="report-link" onClick={() => setState("open")}>
        Something wrong with this?
      </button>
    );
  }
  return (
    <form className="report-form" onSubmit={(e) => (e.preventDefault(), void send())}>
      <fieldset>
        <legend>What&apos;s wrong?</legend>
        {REASONS.map(([value, label]) => (
          <label key={value}>
            <input type="radio" name={`${id}-reason`} value={value} checked={reason === value} onChange={() => setReason(value)} /> {label}
          </label>
        ))}
      </fieldset>
      <label className="report-note">
        Anything to add? (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} />
      </label>
      <div className="report-actions">
        <button type="submit" className="btn small" disabled={state === "sending"}>Send</button>
        <button type="button" className="btn ghost small" onClick={() => setState("closed")}>Cancel</button>
      </div>
      {state === "error" && <p role="alert">Couldn&apos;t send that. Try again?</p>}
    </form>
  );
}

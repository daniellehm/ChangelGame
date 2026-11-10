"use client";

import { useState } from "react";
import { AdminShell, adminSend, Gate, useAdmin } from "@/components/admin/AdminShell";

type Status = "new" | "done" | "all";
interface Message {
  id: number;
  topic: string;
  message: string;
  reply_email: string | null;
  player_id: string | null;
  status: "new" | "done";
  created_at: string;
}

const TOPIC: Record<string, string> = {
  question: "Question or idea",
  data: "Copy or correction of data",
  delete: "Delete my data",
  bug: "Something's broken",
  other: "Something else",
};

export default function Messages() {
  const [status, setStatus] = useState<Status>("new");
  const [load, reload] = useAdmin<{ items: Message[] }>(`/api/admin/messages?status=${status}`);
  const [busy, setBusy] = useState(false);

  const mark = async (id: number, to: "new" | "done") => {
    setBusy(true);
    try {
      await adminSend("/api/admin/messages", "POST", { id, status: to });
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Messages">
      <p className="muted">From the contact form. Senders only give an email if they want a reply. A player ID means they were playing on that browser, so you can find their games (and delete them from the Bank or Supabase if they ask).</p>
      <div className="an-ranges" role="group" aria-label="Show">
        {(["new", "done", "all"] as const).map((s) => (
          <button key={s} type="button" className={`btn small${s === status ? "" : " ghost"}`} aria-pressed={s === status} onClick={() => setStatus(s)}>
            {s === "new" ? "New" : s === "done" ? "Done" : "All"}
          </button>
        ))}
      </div>
      <Gate load={load}>
        {(d) =>
          d.items.length ? (
            <ul className="msgs">
              {d.items.map((m) => (
                <li key={m.id} className="qcard">
                  <div className="qcard-top">
                    <span className="cat">
                      {TOPIC[m.topic] ?? m.topic} · {new Date(m.created_at).toLocaleString()}
                    </span>
                    {m.status === "done" && <span className="badge">done</span>}
                  </div>
                  <p className="msg-body">{m.message}</p>
                  <p className="muted">
                    {m.reply_email ? (
                      <>
                        Reply to: <a href={`mailto:${m.reply_email}`}>{m.reply_email}</a>
                      </>
                    ) : (
                      "No reply wanted (no email given)."
                    )}
                    {m.player_id ? ` · Player ${m.player_id}` : ""}
                  </p>
                  <div className="qcard-actions">
                    <button type="button" className="btn ghost small" disabled={busy} onClick={() => mark(m.id, m.status === "new" ? "done" : "new")}>
                      {m.status === "new" ? "Mark done" : "Mark as new"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>{status === "new" ? "No new messages." : "Nothing here."}</p>
          )
        }
      </Gate>
    </AdminShell>
  );
}

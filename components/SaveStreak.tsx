"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { sendSignInEmail, verifyCode } from "@/lib/game/session-client";

interface Props {
  /** "save": anonymous player saving their streak. "signin": signing into an account. "change": new email for an account. */
  mode: "save" | "signin" | "change";
  title?: string;
  blurb?: string;
  onDone: (email: string) => void;
}

const COPY = {
  save: { title: "Save your streak", blurb: "Add your email to keep your streak and play on any device. No password." },
  signin: { title: "Sign in", blurb: "We'll email you a 6-digit code. No password." },
  change: { title: "Change email", blurb: "We'll send a code to the new address." },
};

/** Email → 6-digit code. Once verified, the player stays signed in on this browser. */
export function SaveStreak({ mode, title, blurb, onDone }: Props) {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await sendSignInEmail(email.trim());
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setStep("code");
    setNote(null);
    requestAnimationFrame(() => codeRef.current?.focus());
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await verifyCode(code.trim());
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setStep("done");
    const n = r.merged?.merged ?? 0;
    setNote(n > 0 ? `Done. ${n} game${n === 1 ? "" : "s"} from this device ${n === 1 ? "was" : "were"} added to your account.` : "Done. You're signed in on this browser.");
    onDone(r.email);
  };

  const c = COPY[mode];
  return (
    <div className="save-streak" aria-labelledby={`${id}-t`}>
      <div className="save-title" id={`${id}-t`}>{title ?? c.title}</div>
      {step === "email" && (
        <form onSubmit={send} className="save-form">
          <p className="save-blurb">{blurb ?? c.blurb}</p>
          <label className="sr-only" htmlFor={`${id}-email`}>Email</label>
          <input id={`${id}-email`} className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Sending…" : "Email me a code"}</button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="save-form">
          <p className="save-blurb">We sent a 6-digit code to <b>{email}</b>. It can take a minute.</p>
          <label className="sr-only" htmlFor={`${id}-code`}>6-digit code</label>
          <input ref={codeRef} id={`${id}-code`} className="field code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} placeholder="123456" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="btn" type="submit" disabled={busy || code.length < 6} aria-busy={busy}>{busy ? "Checking…" : "Confirm"}</button>
          <div className="save-links">
            <button type="button" className="linkish" onClick={() => send()} disabled={busy}>Send a new code</button>
            <button type="button" className="linkish" onClick={() => { setStep("email"); setCode(""); setError(null); }}>Use a different email</button>
          </div>
        </form>
      )}
      {error && <p className="save-error" role="alert">{error}</p>}
      {note && <p className="save-note" role="status">{note}</p>}
    </div>
  );
}

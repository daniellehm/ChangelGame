"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { sendSignInEmail, verifyCode } from "@/lib/game/session-client";

interface Props {
  /** "save": anonymous player saving their streak. "signin": signing into an account. "change": new email for an account. */
  mode: "save" | "signin" | "change";
  title?: string;
  blurb?: string;
  /** `note` explains what happened to this device's games (shown by the caller if this card goes away). */
  onDone: (email: string, note: string) => void | Promise<void>;
}

/** Tell the player what happened to this device's games (one play per day; the first attempt counts). */
export function mergeNote(m: { merged: number; kept: number; replaced: number } | null): string {
  if (!m) return "Done. You're signed in on this browser.";
  const added = m.merged - m.replaced;
  const parts: string[] = [];
  if (added > 0) parts.push(`${added} game${added === 1 ? "" : "s"} from this device ${added === 1 ? "was" : "were"} added to your account.`);
  if (m.kept > 0) {
    parts.push(
      m.kept === 1
        ? "You'd already played that day on your account, so your first score stands. This device's replay was discarded."
        : `You'd already played ${m.kept} of those days on your account, so your first scores stand. This device's replays were discarded.`,
    );
  }
  if (m.replaced > 0) parts.push(`${m.replaced === 1 ? "One game" : `${m.replaced} games`} on this device started before the account's, so ${m.replaced === 1 ? "it counts" : "they count"} as the first attempt.`);
  return parts.length ? `Signed in. ${parts.join(" ")}` : "Done. You're signed in on this browser.";
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
  // Supabase allows one email per address per 60 s; show the wait instead of failing.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);
  const wait = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(t);
    };
  }, [cooldownUntil]);
  const startCooldown = (secs: number) => {
    setNow(Date.now());
    setCooldownUntil(Date.now() + secs * 1000);
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || wait > 0) return;
    setBusy(true);
    setError(null);
    const r = await sendSignInEmail(email.trim());
    setBusy(false);
    if (!r.ok) {
      if (r.retryAfter) startCooldown(r.retryAfter);
      return setError(r.message);
    }
    startCooldown(60);
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
    const n = mergeNote(r.merged);
    setNote(n);
    await onDone(r.email, n);
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
          <button className="btn" type="submit" disabled={busy || wait > 0} aria-busy={busy}>
            {busy ? "Sending…" : wait > 0 ? `Try again in ${wait}s` : "Email me a code"}
          </button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="save-form">
          <p className="save-blurb">We sent a 6-digit code to <b>{email}</b>. It can take a minute.</p>
          <label className="sr-only" htmlFor={`${id}-code`}>6-digit code</label>
          <input ref={codeRef} id={`${id}-code`} className="field code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={10} placeholder="123456" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="btn" type="submit" disabled={busy || code.length < 6} aria-busy={busy}>{busy ? "Checking…" : "Confirm"}</button>
          <div className="save-links">
            <button type="button" className="linkish" onClick={() => send()} disabled={busy || wait > 0}>
              {wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}
            </button>
            <button type="button" className="linkish" onClick={() => { setStep("email"); setCode(""); setError(null); }}>Use a different email</button>
          </div>
        </form>
      )}
      {error && <p className="save-error" role="alert">{error}</p>}
      {note && <p className="save-note" role="status">{note}</p>}
    </div>
  );
}

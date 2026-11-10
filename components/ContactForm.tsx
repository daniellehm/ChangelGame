"use client";

import { useState } from "react";

const TOPICS = [
  ["question", "A question or idea"],
  ["data", "A copy of my data, or a correction"],
  ["delete", "Delete my data"],
  ["bug", "Something's broken"],
  ["other", "Something else"],
] as const;

/** Contact form: goes to the admin inbox. An email is optional, only for a reply. */
export function ContactForm() {
  const [topic, setTopic] = useState<string>("question");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; text: string }>({ kind: "idle" });

  const send = async () => {
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic, message, reply_email: email, website }),
      });
      if (res.ok) return setState({ kind: "sent" });
      const body = await res.json().catch(() => null);
      setState({ kind: "error", text: res.status === 429 ? "That's a lot of messages. Try again in a few minutes." : (body?.error?.message ?? "Couldn't send that. Try again.") });
    } catch {
      setState({ kind: "error", text: "You seem to be offline. Try again when you're connected." });
    }
  };

  if (state.kind === "sent") {
    return (
      <p className="banner" role="status" id="contactSent">
        Thanks, your message is in. {email ? "We'll reply to the email you gave." : "You didn't leave an email, so we won't reply, but we read everything."}
      </p>
    );
  }

  return (
    <form className="contact-form" onSubmit={(e) => (e.preventDefault(), void send())}>
      <label>
        What&apos;s it about?
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} required minLength={5} />
      </label>
      {(topic === "data" || topic === "delete") && (
        <p className="muted">
          Send this from the browser you play on, so we can find your games. To delete everything yourself straight away, use &ldquo;Delete my account&rdquo; on the account page.
        </p>
      )}
      <label>
        Your email <span className="muted">(optional, only if you want a reply)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} />
      </label>
      <label className="hp" aria-hidden="true">
        Website
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {state.kind === "error" && <p role="alert" className="alert warn">{state.text}</p>}
      <button className="btn" type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatValue, multLabel, type Format } from "@/lib/format";

export interface QuestionSummary {
  id: number;
  status: string;
  origin: string;
  category: string;
  prompt: string;
  start_year: number;
  start_value: number;
  end_year: number;
  end_value: number;
  format: Format;
  max_change: number | null;
  fact: string | null;
  source_name: string | null;
  source_url: string | null;
  source_url_2: string | null;
  flag_reason?: string | null;
  corrected_at?: string | null;
  checks?: { passed?: boolean; results?: Record<string, { pass: boolean; detail: string }> } | null;
}

const hostOf = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

/** One question as the admin sees it: the round, the answer, range, sources and check results. */
export function QuestionCard({ q, actions, showChecks = true }: { q: QuestionSummary; actions?: ReactNode; showChecks?: boolean }) {
  const change = Math.log10(q.end_value / q.start_value);
  const results = q.checks?.results ? Object.entries(q.checks.results) : [];
  return (
    <article className="qcard">
      <div className="qcard-top">
        <span className="cat">
          #{q.id} · {q.category} · {q.origin} · {q.status}
          {q.corrected_at ? " · corrected" : ""}
        </span>
        <Link href={`/admin/questions/${q.id}`} className="qlink">Edit</Link>
      </div>
      <p className="qcard-q">{q.prompt}</p>
      <p className="qcard-v">
        {q.start_year}: <b>{formatValue(q.start_value, q.format)}</b> → {q.end_year}: <b>{formatValue(q.end_value, q.format)}</b> ({multLabel(change).big})
        {q.max_change ? <span className="muted"> · slider ÷{q.max_change}…×{q.max_change}</span> : null}
      </p>
      {q.fact ? <p className="qcard-fact">{q.fact}</p> : null}
      <p className="qcard-src">
        {[q.source_url, q.source_url_2].filter(Boolean).map((u, i) => (
          <a key={u!} href={u!} target="_blank" rel="noopener noreferrer">
            {i === 0 ? q.source_name || hostOf(u) : hostOf(u)}
          </a>
        ))}
      </p>
      {q.flag_reason ? <p className="qcard-flag">Held back: {q.flag_reason}</p> : null}
      {showChecks && results.length > 0 && (
        <details className="qcard-checks">
          <summary>{q.checks?.passed ? "All checks passed" : "Check results"}</summary>
          <ul>
            {results.map(([name, r]) => (
              <li key={name}>
                {r.pass ? "✓" : "✗"} <b>{name}</b>: {r.detail}
              </li>
            ))}
          </ul>
        </details>
      )}
      {actions ? <div className="qcard-actions">{actions}</div> : null}
    </article>
  );
}

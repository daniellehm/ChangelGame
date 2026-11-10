"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminShell, Gate, useAdmin } from "@/components/admin/AdminShell";
import type { AnalyticsData, DayMetrics, QuestionRow, Range } from "@/lib/admin/analytics";

/** Validated categorical order (dataviz validator vs --card): blue, red, green. Charts with one series use blue. */
const SERIES = ["#2f7cf6", "#ff5a36", "#2bb673"] as const;
const GRID = "#e3dacb";
const AXIS = { fontSize: 12, fill: "#7a7166" };
const RANGES: Array<[Range, string]> = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All time"]];

type Row = Record<string, string | number | null>;

/** Download rows as CSV (every chart has one; SPEC §8). */
function downloadCsv(name: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `changel-${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Panel({ title, note, csv, csvName, children }: { title: string; note?: string; csv: Row[]; csvName: string; children: ReactNode }) {
  return (
    <section className="an-panel">
      <div className="an-head">
        <h2>{title}</h2>
        <button type="button" className="btn ghost small" onClick={() => downloadCsv(csvName, csv)} disabled={!csv.length}>
          Download CSV
        </button>
      </div>
      {note && <p className="muted">{note}</p>}
      {children}
    </section>
  );
}

function Tile({ label, value, prev }: { label: string; value: number | string; prev?: number }) {
  const n = typeof value === "number" ? value : null;
  const delta = n !== null && prev !== undefined ? n - prev : null;
  return (
    <div className="an-tile">
      <b>{value}</b>
      <small>{label}</small>
      {delta !== null && <span className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>{delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta} vs previous`}</span>}
    </div>
  );
}

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const merge = (objs: Array<Record<string, number>>) => objs.reduce<Record<string, number>>((acc, o) => {
  for (const [k, v] of Object.entries(o ?? {})) acc[k] = (acc[k] ?? 0) + v;
  return acc;
}, {});

function Charts({ d }: { d: AnalyticsData }) {
  const days = d.days;
  const today = days.find((x) => x.date === d.today) ?? ({ players: 0, avg_total: null, completed: 0, sharers: 0 } as Partial<DayMetrics>);
  const yesterday = days.find((x) => x.date < d.today && x.date === days.filter((y) => y.date < d.today).at(-1)?.date);

  const playersOverTime = days.map((x) => ({ date: x.date, new: x.new_players, returning: x.players - x.new_players }));
  const totals = {
    visits: sum(days.map((x) => x.visits)),
    players: sum(days.map((x) => x.players)),
    locked: [0, 1, 2, 3, 4].map((i) => sum(days.map((x) => x.rounds_locked?.[i] ?? 0))),
    completed: sum(days.map((x) => x.completed)),
    sharers: sum(days.map((x) => x.sharers)),
  };
  const funnelSteps: Array<[string, number]> = [["Visited", totals.visits], ["Pressed Play", totals.players], ...totals.locked.map((n, i) => [`Locked round ${i + 1}`, n] as [string, number]), ["Shared", totals.sharers]];
  const funnel = funnelSteps.map(([step, n], i) => ({ step, players: n, lost_pct: i === 0 ? 0 : pct(Math.max(0, funnelSteps[i - 1]![1] - n), funnelSteps[i - 1]![1]) }));
  // Bars scale to the biggest row (before launch-day visits exist, "Visited" can be 0).
  const funnelMax = Math.max(0, ...funnel.map((f) => f.players));
  const avgByDay = days.map((x) => ({ date: x.date, avg_total: x.avg_total }));
  const buckets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => ({ bucket: b === 9 ? "450–500" : `${b * 50}–${b * 50 + 49}`, players: sum(days.map((x) => x.score_buckets?.[b] ?? 0)) }));
  const byRound = [0, 1, 2, 3, 4].map((i) => {
    const locked = sum(days.map((x) => x.rounds_locked?.[i] ?? 0));
    const weighted = sum(days.map((x) => (x.avg_points_by_round?.[i] ?? 0) * (x.rounds_locked?.[i] ?? 0)));
    return { round: `Round ${i + 1}`, avg_points: locked ? Math.round((weighted / locked) * 10) / 10 : 0, wrong_way_pct: pct(sum(days.map((x) => x.wrong_way_by_round?.[i] ?? 0)), locked) };
  });
  const streaks = Object.entries(d.live.streak_buckets).map(([len, players]) => ({ streak: `${len} day${len === "1" ? "" : "s"}`, players }));
  const accounts = days.map((x) => ({ date: x.date, signups: x.signups, prompts_shown: x.signup_prompts }));
  const shareVisits = sum(days.map((x) => x.visits_from_share));
  const referrers = merge(days.map((x) => x.referrers));
  const referred = sum(Object.values(referrers));
  const sources = [{ source: "Share links (?r=)", visits: shareVisits }, { source: "Other sites", visits: referred }, { source: "Direct", visits: Math.max(0, totals.visits - shareVisits - referred) }, ...Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ source: `  ${k}`, visits: v }))];
  const sourcesMax = Math.max(0, ...sources.map((x) => x.visits));
  const shareMethods = merge(days.map((x) => x.shares_by_method));
  const devices = Object.entries(merge(days.map((x) => x.visits_by_device))).map(([device, visits]) => ({ device, visits }));
  const countries = Object.entries(merge(days.map((x) => x.visits_by_country))).sort((a, b) => b[1] - a[1]).map(([country, visits]) => ({ country, visits }));

  return (
    <>
      <div className="an-tiles">
        <Tile label={`Players today (${shortDate(d.today)}, Sydney)`} value={today.players ?? 0} prev={yesterday?.players} />
        <Tile label="Daily active" value={d.live.dau} prev={d.live.dau_prev} />
        <Tile label="Weekly active" value={d.live.wau} prev={d.live.wau_prev} />
        <Tile label="Monthly active" value={d.live.mau} prev={d.live.mau_prev} />
        <Tile label="Total players" value={d.live.total_players} />
        <Tile label="Accounts (email)" value={d.live.accounts} />
        <Tile label="Average score today" value={today.avg_total ?? "—"} />
        <Tile label="Share rate today" value={today.completed ? `${pct(today.sharers ?? 0, today.completed)}%` : "—"} />
      </div>

      <Panel title="Players over time" note="New = first game ever that day." csv={playersOverTime} csvName="players">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={playersOverTime}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} />
            <YAxis allowDecimals={false} tick={AXIS} width={36} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} />
            <Legend />
            <Area type="monotone" dataKey="returning" name="Returning" stackId="p" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.35} strokeWidth={2} />
            <Area type="monotone" dataKey="new" name="New" stackId="p" stroke={SERIES[1]} fill={SERIES[1]} fillOpacity={0.35} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Where people drop off" note="Whole range. % lost compares each step with the one before." csv={funnel} csvName="funnel">
        <table className="an-table">
          <thead><tr><th>Step</th><th>Players</th><th>Lost</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {funnel.map((f) => (
              <tr key={f.step}>
                <td>{f.step}</td><td>{f.players}</td><td>{f.step === "Visited" ? "" : `${f.lost_pct}%`}</td>
                <td className="an-barcell" aria-hidden="true"><i style={{ width: `${funnelMax ? (f.players / funnelMax) * 100 : 0}%`, background: SERIES[0] }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Scores" note="Average total per day (finished games), the spread of totals, and each round." csv={[...avgByDay.map((r) => ({ ...r })), ...buckets.map((b) => ({ date: `bucket ${b.bucket}`, avg_total: b.players }))]} csvName="scores">
        <div className="an-grid2">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={avgByDay}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} />
              <YAxis domain={[0, 500]} tick={AXIS} width={36} />
              <Tooltip labelFormatter={(l) => shortDate(String(l))} />
              <Line type="monotone" dataKey="avg_total" name="Average total" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={buckets}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bucket" tick={{ ...AXIS, fontSize: 10 }} interval={1} />
              <YAxis allowDecimals={false} tick={AXIS} width={36} />
              <Tooltip />
              <Bar dataKey="players" name="Games" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byRound}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="round" tick={AXIS} />
            <YAxis domain={[0, 100]} tick={AXIS} width={36} />
            <Tooltip />
            <Bar dataKey="avg_points" name="Average points" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <QuestionsPanel rows={d.questions} />

      <Panel title="Retention" note="Share of each week's new players who came back exactly 1, 7 and 30 days after their first game. Blank = too soon to tell." csv={d.live.retention.map((r) => ({ ...r }))} csvName="retention">
        <table className="an-table">
          <thead><tr><th>First played (week of)</th><th>Players</th><th>D1</th><th>D7</th><th>D30</th></tr></thead>
          <tbody>
            {d.live.retention.map((r) => {
              const age = (Date.parse(`${d.today}T00:00:00Z`) - Date.parse(`${r.week}T00:00:00Z`)) / 86_400_000;
              const cell = (n: number, days: number) => (age >= days + 6 ? `${pct(n, r.size)}%` : "");
              return (
                <tr key={r.week}><td>{shortDate(r.week)}</td><td>{r.size}</td><td>{cell(r.d1, 1)}</td><td>{cell(r.d7, 7)}</td><td>{cell(r.d30, 30)}</td></tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Streaks" note={`Current streaks today. ${d.live.streak_7_plus} players on 7+ days, ${d.live.streak_30_plus} on 30+.`} csv={streaks} csvName="streaks">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={streaks}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="streak" tick={AXIS} />
            <YAxis allowDecimals={false} tick={AXIS} width={36} />
            <Tooltip />
            <Bar dataKey="players" name="Players" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Accounts" note={`${d.live.accounts} of ${d.live.total_players} players have an account (${pct(d.live.accounts, d.live.total_players)}%). Sign-ups are email only.`} csv={accounts} csvName="accounts">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={accounts}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} />
            <YAxis allowDecimals={false} tick={AXIS} width={36} />
            <Tooltip labelFormatter={(l) => shortDate(String(l))} />
            <Legend />
            <Line type="monotone" dataKey="prompts_shown" name="Save-your-streak shown" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="signups" name="Sign-ups" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Growth sources" note={`Shares per finished game: ${totals.completed ? (sum(Object.values(shareMethods)) / totals.completed).toFixed(2) : "—"} (${Object.entries(shareMethods).map(([m, n]) => `${m.replace("_", " ")} ${n}`).join(", ") || "none yet"}).`} csv={sources} csvName="sources">
        <table className="an-table">
          <thead><tr><th>Source</th><th>Visits</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source}>
                <td style={{ whiteSpace: "pre" }}>{s.source}</td><td>{s.visits}</td>
                <td className="an-barcell" aria-hidden="true"><i style={{ width: `${sourcesMax ? (s.visits / sourcesMax) * 100 : 0}%`, background: SERIES[0] }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Geography and devices" note="Country from Vercel's IP lookup; ?? = unknown." csv={[...countries.map((c) => ({ dimension: c.country, visits: c.visits })), ...devices.map((x) => ({ dimension: x.device, visits: x.visits }))]} csvName="geo-devices">
        {!countries.length && <p>No visits recorded yet.</p>}
        <div className="an-grid2" hidden={!countries.length}>
          <table className="an-table">
            <thead><tr><th>Country</th><th>Visits</th></tr></thead>
            <tbody>{countries.slice(0, 15).map((c) => <tr key={c.country}><td>{c.country}</td><td>{c.visits}</td></tr>)}</tbody>
          </table>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={devices} layout="vertical">
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} />
              <YAxis type="category" dataKey="device" tick={AXIS} width={64} />
              <Tooltip />
              <Bar dataKey="visits" name="Visits" fill={SERIES[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}

type SortKey = "avg_points" | "wrong_way_pct" | "completion_after" | "report_rate" | "plays";

function QuestionsPanel({ rows }: { rows: QuestionRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "avg_points", asc: true });
  const sorted = useMemo(() => {
    const v = (r: QuestionRow) => r[sort.key] ?? (sort.asc ? Infinity : -Infinity);
    return [...rows].sort((a, b) => (sort.asc ? v(a) - v(b) : v(b) - v(a)));
  }, [rows, sort]);
  const th = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : undefined}>
      <button type="button" className="an-sort" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : true })}>
        {label}{sort.key === key ? (sort.asc ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  return (
    <Panel title="Hardest and easiest questions" note="Questions played in the range. Lowest average first; click a column to sort." csv={sorted.map((r) => ({ ...r }))} csvName="questions">
      <div className="table-wrap">
        <table className="an-table">
          <thead><tr><th>Question</th>{th("plays", "Plays")}{th("avg_points", "Avg pts")}{th("wrong_way_pct", "Wrong way")}{th("completion_after", "Carried on")}{th("report_rate", "Reports")}</tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={`${r.date}-${r.position}`}>
                <td><Link href={`/admin/questions/${r.id}`}>{r.prompt}</Link><br /><span className="muted">{shortDate(r.date)} · R{r.position} · {r.category}</span></td>
                <td>{r.plays}</td>
                <td>{r.avg_points === null ? "—" : Math.round(r.avg_points)}</td>
                <td>{r.wrong_way_pct === null ? "—" : `${Math.round(r.wrong_way_pct)}%`}</td>
                <td>{r.completion_after === null ? "—" : `${r.completion_after}%`}</td>
                <td>{r.report_rate === null ? "—" : `${Math.round(r.report_rate * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function Analytics() {
  const [range, setRange] = useState<Range>("30");
  const [load] = useAdmin<AnalyticsData>(`/api/admin/analytics?range=${range}`);
  return (
    <AdminShell title="Analytics">
      <div className="an-ranges" role="group" aria-label="Date range">
        {RANGES.map(([r, label]) => (
          <button key={r} type="button" className={`btn small${r === range ? "" : " ghost"}`} aria-pressed={r === range} onClick={() => setRange(r)}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted">Days are puzzle dates (each player&apos;s own local day). Today&apos;s numbers are live and refresh every 5 minutes; finished days are fixed each night.</p>
      <Gate load={load}>{(d) => <Charts d={d} />}</Gate>
    </AdminShell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, localDate, puzzleNumber } from "@/lib/dates";
import { fetchMe, type ServerPlay } from "@/lib/game/session-client";
import { loadStats, summarize, type StatsSummary, type StoredStats } from "@/lib/game/storage";
import { DayResult, type StripDay } from "./DayResult";
import { TIERS, tierFor, type TierId } from "@/lib/scoring";

const ORDER: TierId[] = ["nailed", "close", "meh", "off", "wrong"];
const STRIP_DAYS = 30;

interface Loaded {
  summary: StatsSummary;
  stats: StoredStats;
  today: string;
  /** The account's recent plays (signed in or anonymous session), when the server answered. */
  server?: ServerPlay[];
}

export function StatsView({ launch }: { launch: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  // Signed into a real account? (null = not known yet.)
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // The day whose pop-up is open (a played square on the strip).
  const [open, setOpen] = useState<StripDay | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const today = localDate(new Date());
      const stats = loadStats();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const summary = summarize(stats, { number: puzzleNumber(today, launch), tz });
      setData({ stats, today, summary });
      // Server stats win when there's a session (SPEC §4); local stays as the fallback.
      void fetchMe(today, tz).then((me) => {
        setSignedIn(!!me && !me.anonymous);
        if (me && me.games_played >= summary.played) {
          setData({
            stats,
            today,
            server: me.recent,
            summary: { ...summary, played: me.games_played, streak: me.current_streak, maxStreak: me.max_streak, best: me.best_total ?? 0, average: me.avg_total ?? 0, tierCounts: me.tiers ?? summary.tierCounts },
          });
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [launch]);

  if (!data) return <p className="note">Loading…</p>;
  const { summary: s, stats, today, server } = data;

  if (s.played === 0) {
    return (
      <>
        <p>No games yet. Play today&apos;s Changel and your stats will show up here.</p>
        {signedIn !== true && (
          <>
            <div className="save-or" aria-hidden="true">or</div>
            <p>
              <Link href="/account" className="text-link">Sign in to restore your stats</Link> from another device.
            </p>
          </>
        )}
      </>
    );
  }

  const totalRounds = ORDER.reduce((a, t) => a + s.tierCounts[t], 0);
  // This device's games, plus the account's (another device's games show here too).
  const byDate = new Map<string, StripDay>(stats.plays.map((p) => [p.date, p]));
  for (const p of server ?? []) {
    if (!p.completed || p.rounds.length !== 5) continue;
    const local = byDate.get(p.date);
    byDate.set(p.date, local ? { ...local, rounds: p.rounds } : { date: p.date, number: p.number, tz: "", total: p.total, tiers: p.rounds.map((r) => r.tier), rounds: p.rounds });
  }
  const days = Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i - (STRIP_DAYS - 1)));
  const playedInStrip = days.filter((d) => byDate.has(d)).length;

  return (
    <>
      <div className="stats">
        <div><b id="sPlayed">{s.played}</b><small>played</small></div>
        <div><b id="sAvg">{s.average}</b><small>average</small></div>
        <div><b id="sBest">{s.best}</b><small>best</small></div>
      </div>
      <div className="stats two">
        <div><b id="sStreak">{s.streak}</b><small>current streak</small></div>
        <div><b id="sMax">{s.maxStreak}</b><small>max streak</small></div>
      </div>

      <h2>Rounds by result</h2>
      <div className="dist" aria-hidden="true">
        {ORDER.filter((t) => s.tierCounts[t] > 0).map((t) => (
          <i key={t} style={{ width: `${(s.tierCounts[t] / totalRounds) * 100}%`, background: TIERS[t].color }} />
        ))}
      </div>
      <div className="dist-legend" id="sDist">
        {ORDER.map((t) => (
          <span key={t}>{`${TIERS[t].emoji} ${TIERS[t].label} ${s.tierCounts[t]}`}</span>
        ))}
      </div>

      <h2>Last {STRIP_DAYS} days</h2>
      <div className="strip" role="group" aria-label={`Played ${playedInStrip} of the last ${STRIP_DAYS} days`}>
        {days.map((d) => {
          const p = byDate.get(d);
          // Coloured by the day's average round (total ÷ 5), with the same cut-offs and colours as a round's result.
          const tier = p ? tierFor(Math.round(p.total / 5), false) : null;
          return p && tier ? (
            <button
              key={d}
              type="button"
              className="played"
              style={{ background: TIERS[tier].color }}
              aria-label={`${d}: ${p.total} points (${TIERS[tier].label}). Show how you did`}
              onClick={() => setOpen(p)}
            />
          ) : (
            <i key={d} title={`${d}: not played`} />
          );
        })}
      </div>
      {open && <DayResult entry={open} onClose={() => setOpen(null)} />}
      {signedIn === false && (
        <p className="note">
          Stats are kept on this device. <Link href="/account" className="text-link">Add your email</Link> to keep your streak on any device.
        </p>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addDays, localDate, puzzleNumber } from "@/lib/dates";
import { fetchMe } from "@/lib/game/session-client";
import { loadStats, summarize, type StatsSummary, type StoredStats } from "@/lib/game/storage";
import { TIERS, type TierId } from "@/lib/scoring";

const ORDER: TierId[] = ["nailed", "close", "meh", "off", "wrong"];
const STRIP_DAYS = 30;

interface Loaded {
  summary: StatsSummary;
  stats: StoredStats;
  today: string;
}

export function StatsView({ launch }: { launch: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  // Signed into a real account? (null = not known yet.)
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

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
          setData({ stats, today, summary: { ...summary, played: me.games_played, streak: me.current_streak, maxStreak: me.max_streak, best: me.best_total ?? 0, average: me.avg_total ?? 0 } });
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [launch]);

  if (!data) return <p className="note">Loading…</p>;
  const { summary: s, stats, today } = data;

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
  const byDate = new Map(stats.plays.map((p) => [p.date, p]));
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
      <div className="strip" role="img" aria-label={`Played ${playedInStrip} of the last ${STRIP_DAYS} days`}>
        {days.map((d) => {
          const p = byDate.get(d);
          return <i key={d} className={p ? "played" : ""} title={p ? `${d}: ${p.total}/500` : `${d}: not played`} />;
        })}
      </div>
      {signedIn === true && <p className="note">Your stats are saved to your account, so they follow you to any device you sign in on.</p>}
      {signedIn === false && (
        <p className="note">
          Stats are kept on this device. <Link href="/account" className="text-link">Add your email</Link> to keep your streak on any device.
        </p>
      )}
    </>
  );
}

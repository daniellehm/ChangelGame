"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ROUNDS } from "@/lib/config";
import { daysBetween, deviceTimeZone, localDate } from "@/lib/dates";
import { createFixtureSource } from "@/lib/game/fixture-source";
import {
  getActiveDate,
  isComplete,
  isReturningPlayer,
  loadPlay,
  loadStats,
  pruneOldPlays,
  recordCompleted,
  savePlay,
  setActiveDate,
  summarize,
  type StoredPlay,
} from "@/lib/game/storage";
import type { GameSource, Puzzle, RoundResult } from "@/lib/game/types";
import { Final } from "./Final";
import { Header } from "./Header";
import { Intro } from "./Intro";
import { Round } from "./Round";
import { Toast } from "./Toast";

type Phase = "boot" | "intro" | "round" | "final";

interface State {
  phase: Phase;
  puzzle: Puzzle | null;
  tz: string;
  startedAt: string | null;
  results: RoundResult[];
  /** Index of the round on screen (0-based). */
  idx: number;
  /** Guess slider value (log10 multiplier). */
  guess: number;
  pending: boolean;
}

type Action =
  | { type: "loaded"; puzzle: Puzzle; tz: string; startedAt: string | null; results: RoundResult[]; phase: Phase }
  | { type: "start"; startedAt: string }
  | { type: "guess"; value: number }
  | { type: "lockPending" }
  | { type: "locked"; result: RoundResult }
  | { type: "lockFailed" }
  | { type: "next" };

const initial: State = { phase: "boot", puzzle: null, tz: "UTC", startedAt: null, results: [], idx: 0, guess: 0, pending: false };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "loaded": {
      const idx = Math.min(a.results.length, ROUNDS - 1);
      return { ...initial, phase: a.phase, puzzle: a.puzzle, tz: a.tz, startedAt: a.startedAt, results: a.results, idx };
    }
    case "start":
      return { ...s, phase: "round", startedAt: a.startedAt, idx: 0, guess: 0 };
    case "guess":
      return s.pending ? s : { ...s, guess: a.value };
    case "lockPending":
      return { ...s, pending: true };
    case "locked":
      return { ...s, pending: false, results: [...s.results, a.result] };
    case "lockFailed":
      return { ...s, pending: false };
    case "next":
      if (s.idx + 1 < ROUNDS) return { ...s, idx: s.idx + 1, guess: 0 };
      return { ...s, phase: "final" };
  }
}

interface Booted {
  puzzle: Puzzle;
  tz: string;
  startedAt: string | null;
  results: RoundResult[];
  phase: Phase;
}

function fromPlay(p: StoredPlay): Booted {
  return {
    puzzle: p.puzzle,
    tz: p.tz,
    startedAt: p.started_at,
    results: p.results,
    // Refreshing mid-game resumes at the next unplayed round (SPEC §2).
    phase: isComplete(p) ? "final" : "round",
  };
}

async function boot(source: GameSource, opts: { preferIntro?: boolean } = {}): Promise<Booted> {
  const tz = deviceTimeZone();
  const today = localDate(new Date(), tz);
  pruneOldPlays(today);

  // A puzzle started before midnight stays the same puzzle (SPEC §2).
  const active = getActiveDate();
  if (active && active !== today) {
    const p = loadPlay(active);
    let age = Infinity;
    try {
      age = Math.abs(daysBetween(active, today));
    } catch {
      /* malformed */
    }
    if (p && !isComplete(p) && age <= 1) return fromPlay(p);
    setActiveDate(null);
  }

  // Already played (or started) today, including after flying back across the date line.
  const existing = loadPlay(today);
  if (existing) return fromPlay(existing);

  const puzzle = await source.loadPuzzle(today);
  // Returning players skip the intro and go straight to round 1 (SPEC §9).
  const phase: Phase = !opts.preferIntro && isReturningPlayer() ? "round" : "intro";
  return { puzzle, tz, startedAt: null, results: [], phase };
}

function newPlay(puzzle: Puzzle, tz: string, startedAt: string): StoredPlay {
  return { v: 1, puzzle, tz, started_at: startedAt, completed_at: null, results: [] };
}

export function Game({ launch }: { launch: string }) {
  const source = useMemo(() => createFixtureSource(launch), [launch]);
  const [s, dispatch] = useReducer(reducer, initial);
  const [toast, setToast] = useState({ message: "Copied to clipboard", show: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast({ message, show: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 1800);
  }, []);

  const load = useCallback(
    async (opts?: { preferIntro?: boolean }) => {
      const b = await boot(source, opts);
      // Returning players going straight to round 1 start their play now.
      if (b.phase === "round" && !b.startedAt) {
        const startedAt = new Date().toISOString();
        savePlay(newPlay(b.puzzle, b.tz, startedAt));
        setActiveDate(b.puzzle.date);
        b.startedAt = startedAt;
      }
      dispatch({ type: "loaded", ...b });
      // The pre-paint script (app/page.tsx) hid the intro; React owns visibility from here.
      delete document.documentElement.dataset.returning;
      window.scrollTo(0, 0);
    },
    [source],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // New local day: load the new puzzle unless mid-game (SPEC §4).
  const phase = s.phase;
  const puzzleDate = s.puzzle?.date;
  useEffect(() => {
    if (phase !== "intro" && phase !== "final") return;
    const check = () => {
      if (document.visibilityState === "hidden" || !puzzleDate) return;
      if (localDate(new Date()) !== puzzleDate) void load({ preferIntro: true });
    };
    const id = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [phase, puzzleDate, load]);

  const start = () => {
    if (!s.puzzle) return;
    const startedAt = new Date().toISOString();
    savePlay(newPlay(s.puzzle, s.tz, startedAt));
    setActiveDate(s.puzzle.date);
    dispatch({ type: "start", startedAt });
    window.scrollTo(0, 0);
  };

  const lockIn = async () => {
    if (!s.puzzle || s.pending || s.results.length > s.idx) return;
    dispatch({ type: "lockPending" });
    try {
      const result = await source.lockIn(s.puzzle, s.idx + 1, s.guess);
      const results = [...s.results, result];
      const done = results.length >= ROUNDS;
      const play: StoredPlay = {
        ...newPlay(s.puzzle, s.tz, s.startedAt ?? new Date().toISOString()),
        results,
        completed_at: done ? new Date().toISOString() : null,
      };
      savePlay(play);
      if (done) {
        recordCompleted(play);
        setActiveDate(null);
      }
      dispatch({ type: "locked", result });
    } catch {
      dispatch({ type: "lockFailed" });
      showToast("Couldn't lock that in. Try again.");
    }
  };

  const next = () => {
    dispatch({ type: "next" });
    window.scrollTo(0, 0);
  };

  const stats = useMemo(
    () => (phase === "final" && s.puzzle ? summarize(loadStats(), { number: s.puzzle.number, tz: s.tz }) : null),
    [phase, s.puzzle, s.tz],
  );

  const round = s.puzzle?.rounds[s.idx];
  const result = s.results[s.idx] ?? null;

  return (
    <>
      <div className="wrap">
        <Header launch={launch} puzzle={s.puzzle ? { number: s.puzzle.number, date: s.puzzle.date } : null} />
        {(s.phase === "boot" || s.phase === "intro") && (
          <Intro theme={s.puzzle?.theme ?? null} onPlay={start} disabled={s.phase === "boot"} />
        )}
        {s.phase === "round" && round && (
          <Round
            round={round}
            index={s.idx}
            guess={s.guess}
            result={result}
            pending={s.pending}
            onGuess={(value) => dispatch({ type: "guess", value })}
            onLock={lockIn}
            onNext={next}
          />
        )}
        {s.phase === "final" && s.puzzle && stats && (
          <Final puzzle={s.puzzle} results={s.results} stats={stats} onToast={showToast} />
        )}
      </div>
      <Toast message={toast.message} show={toast.show} />
    </>
  );
}

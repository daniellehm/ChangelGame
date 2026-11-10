"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ROUNDS } from "@/lib/config";
import { daysBetween, deviceTimeZone, localDate } from "@/lib/dates";
import { createApiSource, PuzzleLoadError, type LoadErrorKind } from "@/lib/game/api-source";
import { beginPlay, ensureSession, fetchMe, submitGuess, type ServerStats } from "@/lib/game/session-client";
import { pullAccountPlay, refreshFromAccount, syncPending } from "@/lib/game/sync";
import {
  getActiveDate,
  isComplete,
  isReturningPlayer,
  loadPlay,
  rangesWereMissing,
  loadStats,
  pruneOldPlays,
  recordCompleted,
  savePlay,
  setActiveDate,
  summarize,
  type StatsSummary,
  type StoredPlay,
} from "@/lib/game/storage";
import type { GameSource, Puzzle, RoundResult } from "@/lib/game/types";
import { Final } from "./Final";
import { Header } from "./Header";
import { Intro } from "./Intro";
import { LegalLinks } from "./LegalLinks";
import { FriendPopup } from "./FriendPopup";
import type { SharedResult } from "@/lib/game/share";
import { crowdLine, todaysTrap, type RoundCrowd } from "@/lib/game/crowd";
import type { ScoreDistribution } from "@/lib/game/standing";
import { LoadError } from "./LoadError";
import { Round } from "./Round";
import { useReducedMotion } from "./motion";
import { Toast } from "./Toast";

type Phase = "boot" | "intro" | "round" | "final" | "error";
/** "server": session-backed (/api/play, /api/guess). "local": offline fallback (/api/reveal), synced later. */
type Mode = "server" | "local";

interface State {
  phase: Phase;
  puzzle: Puzzle | null;
  tz: string;
  startedAt: string | null;
  results: RoundResult[];
  mode: Mode | null;
  playId: string | null;
  /** Index of the round on screen (0-based). */
  idx: number;
  /** Guess slider value (log10 multiplier). */
  guess: number;
  /** A lock-in or start request is in flight. */
  pending: boolean;
  /** True only when the final screen was reached by finishing round 5 just now (drives count-up/flip). */
  justFinished: boolean;
  errorKind: LoadErrorKind | null;
  /** Authoritative stats from /api/me (server mode). */
  serverStats: ServerStats | null;
  /** The server confirmed there is no session (so "Save your streak" applies). */
  noSession: boolean;
}

interface PlayInfo {
  puzzle: Puzzle;
  tz: string;
  startedAt: string | null;
  results: RoundResult[];
  mode: Mode | null;
  playId: string | null;
}

type Action =
  | ({ type: "loaded"; phase: Phase } & PlayInfo)
  | { type: "failed"; kind: LoadErrorKind }
  | { type: "retry" }
  | { type: "startPending" }
  | { type: "start"; startedAt: string; mode: Mode; playId: string | null; results: RoundResult[] }
  | { type: "guess"; value: number }
  | { type: "lockPending" }
  | { type: "locked"; result: RoundResult }
  | { type: "lockFailed" }
  | { type: "resync"; results: RoundResult[] }
  | { type: "puzzleUpdated"; puzzle: Puzzle }
  | { type: "modeLocal" }
  | { type: "serverStats"; stats: ServerStats }
  | { type: "noSession" }
  | { type: "next" };

const initial: State = {
  phase: "boot", puzzle: null, tz: "UTC", startedAt: null, results: [], mode: null, playId: null,
  idx: 0, guess: 0, pending: false, justFinished: false, errorKind: null, serverStats: null, noSession: false,
};

/** Where a play with `results` should be: the next unplayed round (or the last one when all 5 are in). */
const roundIdx = (results: RoundResult[]) => Math.min(results.length, ROUNDS - 1);

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "loaded":
      return { ...initial, phase: a.phase, puzzle: a.puzzle, tz: a.tz, startedAt: a.startedAt, results: a.results, mode: a.mode, playId: a.playId, idx: roundIdx(a.results) };
    case "failed":
      return { ...initial, phase: "error", errorKind: a.kind };
    case "retry":
      return { ...initial };
    case "startPending":
      return { ...s, pending: true };
    case "start":
      return {
        ...s, pending: false, startedAt: a.startedAt, mode: a.mode, playId: a.playId, results: a.results,
        phase: a.results.length >= ROUNDS ? "final" : "round", idx: roundIdx(a.results), guess: 0,
      };
    case "guess":
      return s.pending ? s : { ...s, guess: a.value };
    case "lockPending":
      return { ...s, pending: true };
    case "locked":
      return { ...s, pending: false, results: [...s.results, a.result] };
    case "lockFailed":
      return { ...s, pending: false };
    case "resync":
      return { ...s, pending: false, results: a.results, idx: roundIdx(a.results), guess: 0, phase: a.results.length >= ROUNDS ? "final" : s.phase };
    case "puzzleUpdated":
      return { ...s, puzzle: a.puzzle };
    case "modeLocal":
      return { ...s, mode: "local", playId: null };
    case "serverStats":
      return { ...s, serverStats: a.stats, noSession: false };
    case "noSession":
      return { ...s, noSession: true };
    case "next":
      if (s.idx + 1 < ROUNDS) return { ...s, idx: s.idx + 1, guess: 0 };
      return { ...s, phase: "final", justFinished: true };
  }
}

function fromPlay(p: StoredPlay): PlayInfo & { phase: Phase } {
  return {
    puzzle: p.puzzle,
    tz: p.tz,
    startedAt: p.started_at,
    results: p.results,
    mode: p.mode ?? "local",
    playId: p.play_id ?? null,
    // Refreshing mid-game resumes at the next unplayed round (SPEC §2).
    phase: isComplete(p) ? "final" : "round",
  };
}

/**
 * A play saved before per-question ranges gets its rounds' ranges from the
 * server (same question, same position), keeping its results. If that fails
 * (offline, puzzle closed), loadPlay's full-range fallback stays.
 */
async function refreshRanges(source: GameSource, p: StoredPlay): Promise<StoredPlay> {
  if (!rangesWereMissing(p)) return p;
  try {
    const fresh = await source.loadPuzzle(p.puzzle.date);
    const rounds = p.puzzle.rounds.map((r) => {
      const f = fresh.rounds.find((x) => x.position === r.position && (r.question_id === undefined || x.question_id === r.question_id));
      return f ? { ...r, range: f.range } : r;
    });
    const up: StoredPlay = { ...p, puzzle: { ...p.puzzle, rounds } };
    savePlay(up);
    return up;
  } catch {
    return p;
  }
}

async function boot(source: GameSource, opts: { preferIntro?: boolean } = {}): Promise<PlayInfo & { phase: Phase }> {
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
    if (p && !isComplete(p) && age <= 1) return fromPlay(await refreshRanges(source, p));
    setActiveDate(null);
  }

  // Already played (or started) today, including after flying back across the date line.
  const existing = loadPlay(today);
  if (existing) return fromPlay(await refreshRanges(source, existing));

  // In parallel: today's puzzle, and whether this account already played today on another device.
  const [puzzle, me] = await Promise.all([source.loadPuzzle(today), fetchMe(today, tz).catch(() => null)]);
  const fromAccount = await pullAccountPlay(puzzle, tz, me).catch(() => null);
  if (fromAccount) {
    if (!isComplete(fromAccount)) setActiveDate(today);
    return fromPlay(fromAccount);
  }
  // Returning players skip the intro and go straight to round 1 (SPEC §9).
  const phase: Phase = !opts.preferIntro && isReturningPlayer() ? "round" : "intro";
  return { puzzle, tz, startedAt: null, results: [], mode: null, playId: null, phase };
}

function toStored(p: { puzzle: Puzzle; tz: string; startedAt: string; results: RoundResult[]; mode: Mode; playId: string | null }): StoredPlay {
  return {
    v: 1,
    puzzle: p.puzzle,
    tz: p.tz,
    started_at: p.startedAt,
    completed_at: p.results.length >= ROUNDS ? new Date().toISOString() : null,
    results: p.results,
    mode: p.mode,
    play_id: p.playId ?? undefined,
  };
}

/** Start (or resume) the play on the server; fall back to local-only mode if no session is possible. */
async function beginOnServer(puzzle: Puzzle, tz: string): Promise<{ mode: Mode; playId: string | null; startedAt: string; results: RoundResult[] }> {
  if (await ensureSession(tz)) {
    const b = await beginPlay(puzzle.date, tz);
    if (b.ok) return { mode: "server", playId: b.playId, startedAt: b.startedAt, results: b.answered };
  }
  return { mode: "local", playId: null, startedAt: new Date().toISOString(), results: [] };
}

const toSummary = (s: ServerStats, local: StatsSummary): StatsSummary => ({
  ...local,
  played: s.games_played,
  streak: s.current_streak,
  maxStreak: s.max_streak,
  best: s.best_total ?? 0,
  average: s.avg_total ?? 0,
});

/** `friend`: a shared result from `?r=` (SPEC §10), decoded by the page on the server. */
export function Game({ launch, friend = null }: { launch: string; friend?: SharedResult | null }) {
  const source = useMemo(() => createApiSource(), []);
  const [s, dispatch] = useReducer(reducer, initial);
  const motion = !useReducedMotion();
  const [toast, setToast] = useState({ message: "Copied to clipboard", show: false });
  // Survives the reload after signing in from the final screen.
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast({ message, show: true });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 1800);
  }, []);

  const loadServerStats = useCallback(async (date: string, tz: string) => {
    const stats = await fetchMe(date, tz);
    if (stats) dispatch({ type: "serverStats", stats });
    // Definitely no session (the server said so): only then offer "Save your streak" (Dani 2026-11-10).
    else if (stats === null) dispatch({ type: "noSession" });
  }, []);

  const load = useCallback(
    async (opts?: { preferIntro?: boolean }) => {
      let b: PlayInfo & { phase: Phase };
      try {
        b = await boot(source, opts);
      } catch (e) {
        dispatch({ type: "failed", kind: e instanceof PuzzleLoadError ? e.kind : "network" });
        delete document.documentElement.dataset.returning;
        return;
      }

      if (b.phase === "round" && !b.startedAt) {
        // Returning player going straight to round 1: start the play now.
        const started = await beginOnServer(b.puzzle, b.tz);
        b = { ...b, ...started, phase: started.results.length >= ROUNDS ? "final" : "round" };
        savePlay(toStored({ ...b, startedAt: started.startedAt, mode: started.mode }));
        setActiveDate(b.puzzle.date);
      } else if (b.phase === "round" && b.mode === "server") {
        // Resuming a server play: the server is the source of truth for answered rounds.
        const r = await beginPlay(b.puzzle.date, b.tz);
        if (r.ok && r.answered.length >= b.results.length) {
          b = { ...b, results: r.answered, playId: r.playId, phase: r.answered.length >= ROUNDS ? "final" : "round" };
          savePlay(toStored({ ...b, startedAt: b.startedAt ?? r.startedAt, mode: "server" }));
        } else if (!r.ok && r.reason === "unauthorized") {
          b = { ...b, mode: "local", playId: null }; // session lost: finish locally, sync later
        }
      }

      dispatch({ type: "loaded", ...b });
      // The pre-paint script (app/page.tsx) hid the intro; React owns visibility from here.
      delete document.documentElement.dataset.returning;
      window.scrollTo(0, 0);
      // Check the account on the final screen whichever way the game was played (local plays too).
      if (b.phase === "final") void loadServerStats(b.puzzle.date, b.tz);
    },
    [source, loadServerStats],
  );

  // Crowd stats for today's rounds (SPEC §10), refreshed after each locked round. CDN-cached for a minute.
  const [crowd, setCrowd] = useState<{ date: string; rounds: RoundCrowd[]; scores: ScoreDistribution | null } | null>(null);
  const crowdKey = s.puzzle && s.results.length > 0 ? `${s.puzzle.date}|${s.results.length}` : null;
  useEffect(() => {
    if (!crowdKey) return;
    const date = crowdKey.split("|")[0]!;
    let live = true;
    fetch(`/api/crowd?date=${date}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { rounds: RoundCrowd[]; scores?: ScoreDistribution } | null) => live && b && setCrowd({ date, rounds: b.rounds, scores: b.scores ?? null }))
      .catch(() => undefined); // offline: no crowd line
    return () => {
      live = false;
    };
  }, [crowdKey]);
  const dayCrowd = crowd && crowd.date === s.puzzle?.date ? crowd.rounds : null;
  const dayScores = crowd && crowd.date === s.puzzle?.date ? crowd.scores : null;

  // The friend's shared result, as a pop-up once per visit (Dani 2026-11-10).
  const [showFriend, setShowFriend] = useState(true);

  useEffect(() => {
    // A shared link shows the intro (with the friend's pop-up) even to returning players.
    void load({ preferIntro: !!friend });
  }, [load, friend]);

  // New local day: load the new puzzle unless mid-game (SPEC §4).
  const phase = s.phase;
  const puzzleDate = s.puzzle?.date;

  // Mid-round, floating extras (the Buy Me a Coffee button) hide so they never cover game controls.
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "round") root.dataset.playing = "1";
    else delete root.dataset.playing;
    return () => {
      delete root.dataset.playing;
    };
  }, [phase]);
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

  const start = async () => {
    if (!s.puzzle || s.pending) return;
    dispatch({ type: "startPending" });
    const started = await beginOnServer(s.puzzle, s.tz);
    savePlay(toStored({ puzzle: s.puzzle, tz: s.tz, ...started }));
    setActiveDate(s.puzzle.date);
    dispatch({ type: "start", ...started });
    window.scrollTo(0, 0);
    if (started.mode === "server") void syncPending(s.tz); // upload any earlier offline games
  };

  const lockIn = async () => {
    const round = s.puzzle?.rounds[s.idx];
    if (!s.puzzle || !round || s.pending || s.results.length > s.idx) return;
    dispatch({ type: "lockPending" });
    const position = s.idx + 1;
    let mode: Mode = s.mode ?? "local";
    let result: RoundResult | null = null;

    try {
      if (mode === "server" && s.playId) {
        const g = await submitGuess(s.playId, position, s.guess, round.question_id);
        if (g.kind === "ok" || g.kind === "already") {
          result = g.result;
        } else if (g.kind === "out_of_order") {
          // Another tab moved on: take the server's answered rounds.
          const r = await beginPlay(s.puzzle.date, s.tz);
          if (r.ok) {
            savePlay(toStored({ puzzle: s.puzzle, tz: s.tz, startedAt: s.startedAt ?? r.startedAt, results: r.answered, mode: "server", playId: r.playId }));
            dispatch({ type: "resync", results: r.answered });
          } else dispatch({ type: "lockFailed" });
          return;
        } else if (g.kind === "question_changed") {
          // Same-day swap (SPEC §8): load the updated rounds (uncached), keep what's answered.
          const fresh = await source.loadPuzzle(s.puzzle.date, { fresh: true });
          dispatch({ type: "puzzleUpdated", puzzle: fresh });
          dispatch({ type: "lockFailed" });
          showToast("This round was just updated");
          return;
        } else if (g.kind === "unauthorized") {
          mode = "local"; // session lost mid-game: finish locally, sync later
          dispatch({ type: "modeLocal" });
        } else if (g.kind === "closed") {
          dispatch({ type: "lockFailed" });
          showToast("This puzzle has closed");
          return;
        } else {
          dispatch({ type: "lockFailed" });
          showToast("Couldn't lock that in. Try again.");
          return;
        }
      }
      if (!result) result = await source.lockIn(s.puzzle, position, s.guess);
    } catch (e) {
      dispatch({ type: "lockFailed" });
      showToast(e instanceof PuzzleLoadError && e.kind === "clock" ? "Check your device clock" : "Couldn't lock that in. Try again.");
      return;
    }

    const results = [...s.results, result];
    const done = results.length >= ROUNDS;
    const stored = toStored({ puzzle: s.puzzle, tz: s.tz, startedAt: s.startedAt ?? new Date().toISOString(), results, mode, playId: mode === "server" ? s.playId : null });
    savePlay(stored);
    if (done) {
      recordCompleted(stored);
      setActiveDate(null);
    }
    dispatch({ type: "locked", result });
    if (done) void loadServerStats(s.puzzle.date, s.tz);
    if (done && mode === "local") void syncPending(s.tz);
  };

  const next = () => {
    dispatch({ type: "next" });
    window.scrollTo(0, 0);
  };

  const stats = useMemo(() => {
    if (phase !== "final" || !s.puzzle) return null;
    const local = summarize(loadStats(), { number: s.puzzle.number, tz: s.tz });
    return s.serverStats ? toSummary(s.serverStats, local) : local;
  }, [phase, s.puzzle, s.tz, s.serverStats]);

  const round = s.puzzle?.rounds[s.idx];

  return (
    <>
      <div className="wrap">
        <Header launch={launch} puzzle={s.puzzle ? { number: s.puzzle.number, date: s.puzzle.date } : null} />
        {(s.phase === "boot" || s.phase === "intro") && (
          <Intro theme={s.puzzle?.theme ?? null} onPlay={start} disabled={s.phase === "boot" || s.pending} />
        )}
        {s.phase === "error" && s.errorKind && (
          <LoadError
            kind={s.errorKind}
            onRetry={() => {
              dispatch({ type: "retry" });
              void load();
            }}
          />
        )}
        {s.phase === "round" && round && (
          <Round
            round={round}
            index={s.idx}
            guess={s.guess}
            results={s.results}
            pending={s.pending}
            motion={motion}
            onGuess={(value) => dispatch({ type: "guess", value })}
            onLock={lockIn}
            onNext={next}
            playId={s.mode === "server" ? s.playId : null}
            crowd={dayCrowd ? crowdLine(dayCrowd.find((c) => c.position === s.idx + 1)) : null}
          />
        )}
        {s.phase === "final" && s.puzzle && stats && (
          <Final
            puzzle={s.puzzle}
            results={s.results}
            stats={stats}
            animate={s.justFinished && motion}
            // Button for anyone without an account; the form opens itself from the 2nd game (SPEC §5). Never blocks play.
            // Signed in: never ask to save. Unknown (check failed): don't nag either.
            offerSave={s.serverStats ? s.serverStats.anonymous : s.noSession}
            saveOpen={stats.played >= 2}
            onSaved={async (note) => {
              // The account's games are the record: reload today's result from it,
              // then explain what happened (so the old score never sits next to the note).
              await refreshFromAccount(s.tz);
              await load();
              setSavedNote(note);
            }}
            note={savedNote}
            onToast={showToast}
            scores={dayScores}
            trap={(() => {
              const t = dayCrowd ? todaysTrap(dayCrowd, ROUNDS) : null;
              return t ? (s.puzzle.rounds[t.position - 1]?.prompt ?? null) : null;
            })()}
          />
        )}
        {/* Privacy & terms and Contact live here, not in the menu (Dani 2026-11-10); hidden mid-round. */}
        {s.phase !== "round" && <LegalLinks />}
        {friend && showFriend && (s.phase === "boot" || s.phase === "intro") && (
          <FriendPopup
            friend={friend}
            today={s.puzzle?.number ?? null}
            onClose={() => setShowFriend(false)}
            onPlay={() => {
              setShowFriend(false);
              if (s.phase === "intro" && !s.pending) start();
            }}
          />
        )}
      </div>
      <Toast message={toast.message} show={toast.show} />
    </>
  );
}

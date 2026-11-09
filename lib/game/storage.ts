/**
 * Best-effort localStorage mirror (SPEC §5): every locked-in round is written
 * here so the game survives refreshes and network/cookie failures. All access
 * is wrapped: private mode or blocked storage must never break play.
 *
 * Keys: changel:v1:play:<date>, changel:v1:stats, changel:v1:active
 * (`active` = date of an in-progress play, so a game started before midnight
 * resumes after it. See DECISIONS.md.)
 */
import { ROUNDS, STORAGE_KEYS } from "../config";
import { daysBetween } from "../dates";
import { currentStreak, maxStreak, type PlayRef } from "../streaks";
import type { TierId } from "../scoring";
import type { Puzzle, RoundResult } from "./types";

export interface StoredPlay {
  v: 1;
  puzzle: Puzzle;
  tz: string;
  started_at: string;
  completed_at: string | null;
  results: RoundResult[];
  /** "server": scored + stored by /api/guess. "local": offline fallback via /api/reveal (SPEC §5). */
  mode?: "server" | "local";
  /** Server play id (mode "server", or after a local play is synced). */
  play_id?: string;
  /** Local play uploaded with /api/sync (or permanently rejected, so stop retrying). */
  synced?: boolean;
}

export interface StatsEntry {
  date: string;
  number: number;
  tz: string;
  total: number;
  tiers: TierId[];
}

export interface StoredStats {
  v: 1;
  plays: StatsEntry[];
}

export interface StatsSummary {
  played: number;
  streak: number;
  maxStreak: number;
  best: number;
  average: number;
  tierCounts: Record<TierId, number>;
}

const ACTIVE_KEY = "changel:v1:active";
const PLAY_PREFIX = "changel:v1:play:";
/** Keep full play records this long; stats keep a compact entry forever-ish. */
const PLAY_RETENTION_DAYS = 45;
const MAX_STATS_ENTRIES = 800;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: play continues in memory */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isComplete(play: StoredPlay): boolean {
  return play.results.length >= ROUNDS;
}

export function loadPlay(date: string): StoredPlay | null {
  const p = read<StoredPlay>(STORAGE_KEYS.play(date));
  return p && p.v === 1 && Array.isArray(p.results) && p.puzzle?.date === date ? p : null;
}

export function savePlay(play: StoredPlay): void {
  write(STORAGE_KEYS.play(play.puzzle.date), play);
}

export function getActiveDate(): string | null {
  const d = read<string>(ACTIVE_KEY);
  return typeof d === "string" ? d : null;
}

export function setActiveDate(date: string | null): void {
  if (date) write(ACTIVE_KEY, date);
  else remove(ACTIVE_KEY);
}

export function loadStats(): StoredStats {
  const s = read<StoredStats>(STORAGE_KEYS.stats);
  return s && s.v === 1 && Array.isArray(s.plays) ? s : { v: 1, plays: [] };
}

/** Record a completed play once (idempotent per date). */
export function recordCompleted(play: StoredPlay): StoredStats {
  const stats = loadStats();
  if (!stats.plays.some((e) => e.date === play.puzzle.date)) {
    stats.plays.push({
      date: play.puzzle.date,
      number: play.puzzle.number,
      tz: play.tz,
      total: play.results.reduce((a, r) => a + r.points, 0),
      tiers: play.results.map((r) => r.tier),
    });
    stats.plays.sort((a, b) => a.number - b.number);
    if (stats.plays.length > MAX_STATS_ENTRIES) stats.plays.splice(0, stats.plays.length - MAX_STATS_ENTRIES);
    write(STORAGE_KEYS.stats, stats);
  }
  return stats;
}

export function summarize(stats: StoredStats, today?: PlayRef): StatsSummary {
  const tierCounts: Record<TierId, number> = { nailed: 0, close: 0, meh: 0, off: 0, wrong: 0 };
  for (const e of stats.plays) for (const t of e.tiers) tierCounts[t]++;
  const totals = stats.plays.map((e) => e.total);
  return {
    played: stats.plays.length,
    streak: currentStreak(stats.plays, today),
    maxStreak: maxStreak(stats.plays),
    best: totals.length ? Math.max(...totals) : 0,
    average: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0,
    tierCounts,
  };
}

/** True if the player has finished at least one game on this device. */
export function isReturningPlayer(): boolean {
  return loadStats().plays.length > 0;
}

/** Drop full play records older than the retention window (stats entries stay). */
export function pruneOldPlays(today: string): void {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (!k?.startsWith(PLAY_PREFIX)) continue;
      const d = k.slice(PLAY_PREFIX.length);
      try {
        if (daysBetween(d, today) > PLAY_RETENTION_DAYS) ls.removeItem(k);
      } catch {
        ls.removeItem(k); // malformed key
      }
    }
  } catch {
    /* ignore */
  }
}

/** Local-only plays that still need uploading (newest last). */
export function unsyncedLocalPlays(): StoredPlay[] {
  const out: StoredPlay[] = [];
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k?.startsWith(PLAY_PREFIX)) continue;
      const p = loadPlay(k.slice(PLAY_PREFIX.length));
      if (p && p.mode === "local" && !p.synced && p.results.length > 0) out.push(p);
    }
  } catch {
    /* ignore */
  }
  return out.sort((a, b) => a.puzzle.date.localeCompare(b.puzzle.date));
}

/** Sign-out / account deletion: forget every Changel key on this device (SPEC §5). */
export function clearLocalGameData(): void {
  try {
    const ls = window.localStorage;
    for (let i = ls.length - 1; i >= 0; i--) {
      const k = ls.key(i);
      if (k?.startsWith("changel:")) ls.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** Overwrite this device's record of `play`'s date with it (e.g. the account's result after sign-in). */
export function replaceCompleted(play: StoredPlay): void {
  const stats = loadStats();
  stats.plays = stats.plays.filter((e) => e.date !== play.puzzle.date);
  write(STORAGE_KEYS.stats, stats);
  if (isComplete(play)) recordCompleted(play);
}

/** Dates this device has a stored play for. */
export function storedPlayDates(): string[] {
  const out: string[] = [];
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(PLAY_PREFIX)) out.push(k.slice(PLAY_PREFIX.length));
    }
  } catch {
    /* ignore */
  }
  return out;
}

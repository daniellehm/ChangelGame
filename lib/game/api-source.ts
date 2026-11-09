/**
 * GameSource backed by the API: GET /api/puzzle (no answers) and, on lock-in,
 * POST /api/reveal for that one round (M2). M3 swaps reveal for /api/guess.
 */
import type { GameSource, Puzzle, RoundResult } from "./types";

export type LoadErrorKind = "clock" | "missing" | "network";

export class PuzzleLoadError extends Error {
  constructor(public readonly kind: LoadErrorKind, message: string) {
    super(message);
    this.name = "PuzzleLoadError";
  }
}

async function errorKind(res: Response): Promise<LoadErrorKind> {
  if (res.status === 403) return "clock";
  if (res.status === 404) return "missing";
  return "network";
}

export function createApiSource(fetchImpl: typeof fetch = (...a) => fetch(...a)): GameSource {
  return {
    async loadPuzzle(date: string, opts?: { fresh?: boolean }): Promise<Puzzle> {
      let res: Response;
      try {
        // fresh: skip the 5-minute CDN cache (after a same-day swap the cached copy is out of date).
        res = await fetchImpl(`/api/puzzle?date=${encodeURIComponent(date)}${opts?.fresh ? `&fresh=${Date.now()}` : ""}`);
      } catch {
        throw new PuzzleLoadError("network", "Network error");
      }
      if (!res.ok) throw new PuzzleLoadError(await errorKind(res), `HTTP ${res.status}`);
      const body = (await res.json()) as Puzzle;
      return { date: body.date, number: body.number, theme: body.theme, rerun: body.rerun, rounds: body.rounds };
    },

    async lockIn(puzzle: Puzzle, position: number, guessLog: number): Promise<RoundResult> {
      const res = await fetchImpl("/api/reveal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: puzzle.date, position, guess_log: guessLog }),
      });
      if (!res.ok) throw new PuzzleLoadError(await errorKind(res), `HTTP ${res.status}`);
      return (await res.json()) as RoundResult;
    },
  };
}

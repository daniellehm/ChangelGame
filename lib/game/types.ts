/**
 * Shapes shared by the game UI and its data sources. They mirror the API
 * contracts in SPEC §7 so the M1 fixture source and the M2+ API source are
 * interchangeable.
 */
import type { Format } from "../format";
import type { TierId } from "../scoring";

/** A round as served before lock-in: no answer fields. */
export interface PublicRound {
  position: number; // 1–5
  /** Lets /api/guess detect a same-day question swap (DECISIONS item 8). Not an answer. */
  question_id?: number;
  category: string;
  prompt: string;
  start_year: number;
  start_value: number;
  end_year: number;
  format: Format;
}

export interface Puzzle {
  date: string; // YYYY-MM-DD (player's local date)
  number: number;
  theme: string | null;
  /** Served from an earlier puzzle (fallback, SPEC §8). */
  rerun?: boolean;
  rounds: PublicRound[];
}

/** What the server returns once a round is locked (SPEC §7 POST /api/guess). */
export interface RoundResult {
  position: number;
  guess_log: number;
  points: number;
  tier: TierId;
  wrong_way: boolean;
  end_value: number;
  actual_log: number;
  fact: string;
  source_name: string;
  source_url: string | null;
  /** Question actually answered (server results only). */
  question_id?: number;
}

/**
 * Where the game gets puzzles and scores from. M2: the API (`api-source.ts`).
 * M3 adds the session-backed source (/api/play, /api/guess).
 */
export interface GameSource {
  loadPuzzle(date: string): Promise<Puzzle>;
  lockIn(puzzle: Puzzle, position: number, guessLog: number): Promise<RoundResult>;
}

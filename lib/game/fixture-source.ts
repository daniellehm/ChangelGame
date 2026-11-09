/**
 * M1 GameSource backed by the prototype fixture, scored on the client with the
 * shared lib/scoring. Replaced by the API source in M2.
 */
import { ROUNDS } from "../config";
import { daysBetween, puzzleNumber } from "../dates";
import { PROTOTYPE_EPOCH, questionsForDay, type FixtureQuestion } from "../fixtures/prototype-pool";
import { actualLog, scoreRound } from "../scoring";
import type { GameSource, Puzzle, RoundResult } from "./types";

export function createFixtureSource(launch: string): GameSource {
  const answers = new Map<string, FixtureQuestion[]>();
  const pick = (date: string) => {
    let qs = answers.get(date);
    if (!qs) {
      qs = questionsForDay(daysBetween(PROTOTYPE_EPOCH, date), ROUNDS);
      answers.set(date, qs);
    }
    return qs;
  };

  return {
    async loadPuzzle(date: string): Promise<Puzzle> {
      return {
        date,
        number: puzzleNumber(date, launch),
        theme: null,
        rounds: pick(date).map((q, i) => ({
          position: i + 1,
          category: q.cat,
          prompt: q.q,
          start_year: q.y0,
          start_value: q.v0,
          end_year: q.y1,
          format: q.fmt,
        })),
      };
    },
    async lockIn(puzzle: Puzzle, position: number, guessLog: number): Promise<RoundResult> {
      const q = pick(puzzle.date)[position - 1];
      if (!q) throw new RangeError(`no round ${position}`);
      const a = actualLog(q.v0, q.v1);
      const s = scoreRound(guessLog, a);
      return {
        position,
        guess_log: guessLog,
        points: s.points,
        tier: s.tier,
        wrong_way: s.wrongWay,
        end_value: q.v1,
        actual_log: a,
        fact: q.fact,
        source_name: q.src,
        source_url: null,
      };
    },
  };
}

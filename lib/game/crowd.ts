/**
 * Crowd stats (SPEC §10): the line under each reveal, and "Today's trap" on the final screen.
 * Pure, so the wording rules are unit-tested; the numbers come from GET /api/crowd.
 */
export const CROWD = {
  /** Below this many plays of a round, show the neutral line (SPEC §10: 50). */
  MIN_PLAYS: 50,
  /** At or above this share going the wrong way, that's the line. */
  WRONG_WAY_PCT: 20,
  /** Below this share nailing it, say "Only …". */
  ONLY_NAILED_PCT: 25,
} as const;

export interface RoundCrowd {
  position: number;
  plays: number;
  wrong_way: number;
  nailed: number;
  avg_points: number;
}

export const NEUTRAL_LINE = "Too early for crowd stats on this one.";

const pct = (n: number, of: number) => Math.round((n / of) * 100);

/** The reveal's crowd line for one round. */
export function crowdLine(c: RoundCrowd | undefined): string {
  if (!c || c.plays < CROWD.MIN_PLAYS) return NEUTRAL_LINE;
  const wrong = pct(c.wrong_way, c.plays);
  if (wrong >= CROWD.WRONG_WAY_PCT) return `${wrong}% of players went the wrong way`;
  const nailed = pct(c.nailed, c.plays);
  return nailed < CROWD.ONLY_NAILED_PCT ? `Only ${nailed}% nailed this` : `${nailed}% of players nailed this`;
}

/** The round the crowd did worst on (lowest average points), once every round has enough plays. */
export function todaysTrap(crowd: readonly RoundCrowd[], rounds: number): RoundCrowd | null {
  if (crowd.length < rounds || crowd.some((c) => c.plays < CROWD.MIN_PLAYS)) return null;
  return crowd.reduce((worst, c) => (c.avg_points < worst.avg_points ? c : worst));
}

/**
 * Streaks count consecutive PUZZLE NUMBERS played, not calendar days (SPEC §4).
 * A streak continues if the previous play was n−1, or n−2 when the player's
 * time zone changed in between (crossing the date line skips a date).
 * Pure, so the server (M3, authoritative) and the local mirror share it.
 */

export interface PlayRef {
  number: number;
  tz: string;
}

function continues(prev: PlayRef, next: PlayRef): boolean {
  const gap = next.number - prev.number;
  return gap === 1 || (gap === 2 && prev.tz !== next.tz);
}

/** Sort by puzzle number and keep the first play of each number. */
function normalise(plays: readonly PlayRef[]): PlayRef[] {
  const seen = new Set<number>();
  return [...plays]
    .sort((a, b) => a.number - b.number)
    .filter((p) => (seen.has(p.number) ? false : (seen.add(p.number), true)));
}

/** Length of every run, in order. */
function runs(plays: readonly PlayRef[]): number[] {
  const ps = normalise(plays);
  const out: number[] = [];
  for (let i = 0; i < ps.length; i++) {
    if (i > 0 && continues(ps[i - 1]!, ps[i]!)) out[out.length - 1]!++;
    else out.push(1);
  }
  return out;
}

/**
 * Current streak. Without `today`, it is the run ending at the latest play.
 * With `today` (the player's current puzzle number and time zone), a run is
 * still alive if the latest play is today, or today could still continue it
 * (yesterday, or n−2 across a time zone change). Otherwise it is 0.
 */
export function currentStreak(plays: readonly PlayRef[], today?: PlayRef): number {
  const ps = normalise(plays);
  const last = ps[ps.length - 1];
  if (!last) return 0;
  const r = runs(ps);
  const len = r[r.length - 1]!;
  if (!today || last.number === today.number) return len;
  return continues(last, today) && today.number > last.number ? len : 0;
}

export function maxStreak(plays: readonly PlayRef[]): number {
  return Math.max(0, ...runs(plays));
}

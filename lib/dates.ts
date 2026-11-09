/**
 * All date logic (SPEC §4). The puzzle is identified by the player's LOCAL
 * calendar date. Never derive it from UTC.
 *
 * M1 covers local date, puzzle number and the countdown. The server date
 * window and the full edge-case table land in M2.
 */

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const formatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    // en-CA formats as YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The device's IANA time zone, e.g. "Australia/Sydney". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** True if `tz` is a time zone this runtime recognises. */
export function isValidTimeZone(tz: string): boolean {
  try {
    dateFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date (YYYY-MM-DD) of `now` in `timeZone`. */
export function localDate(now: Date, timeZone: string = deviceTimeZone()): string {
  return dateFormatter(timeZone).format(now);
}

export function isDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

function dayIndex(date: string): number {
  if (!isDateString(date)) throw new RangeError(`invalid date: ${date}`);
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

/** Whole calendar days from a to b (b − a). Pure date arithmetic: DST can't affect it. */
export function daysBetween(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a);
}

export function addDays(date: string, n: number): string {
  return new Date((dayIndex(date) + n) * DAY_MS).toISOString().slice(0, 10);
}

/** Puzzle number: days since launch + 1. The same date gives the same number everywhere. */
export function puzzleNumber(date: string, launch: string): number {
  return daysBetween(launch, date) + 1;
}

/**
 * The first instant (ms since epoch) at which the local date in `timeZone`
 * becomes later than its date at `now`. Found by binary search, so it is
 * correct on DST nights and in zones where midnight itself is skipped.
 */
export function nextLocalMidnight(now: Date, timeZone: string = deviceTimeZone()): number {
  const today = localDate(now, timeZone);
  let lo = now.getTime(); // local date is still `today`
  let hi = lo + 2 * DAY_MS; // certainly past the next midnight
  // ~38 iterations to 1 ms precision. Callers compute this once and reuse it.
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(new Date(mid), timeZone) === today) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Milliseconds until the next local midnight. */
export function msUntilNextLocalMidnight(now: Date, timeZone: string = deviceTimeZone()): number {
  return nextLocalMidnight(now, timeZone) - now.getTime();
}

/** "h:mm:ss", as on the prototype's final screen. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Short header date, e.g. "9 Nov" (prototype: toLocaleDateString(undefined, {day, month:"short"})). */
export function headerDate(date: string, locale?: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
}

/* ---------------------------------------------------------------------------
 * Server date window (SPEC §4). Date D exists somewhere on Earth from
 * D 00:00 at UTC+14 to D 24:00 at UTC−12, so puzzle D is served while
 *   (D − 1) 10:00 UTC ≤ now < (D + 1) 12:00 UTC.
 * ------------------------------------------------------------------------- */

const HOUR_MS = 3_600_000;
/** Extra time to finish a play started inside the window (DECISIONS item 6). */
export const GUESS_GRACE_MS = 6 * HOUR_MS;

export interface PuzzleWindow {
  /** First instant the puzzle may be served (ms since epoch). */
  opensAt: number;
  /** First instant it may no longer be served (exclusive). */
  closesAt: number;
}

export function puzzleWindow(date: string): PuzzleWindow {
  const midnightUtc = dayIndex(date) * DAY_MS;
  return { opensAt: midnightUtc - 14 * HOUR_MS, closesAt: midnightUtc + 36 * HOUR_MS };
}

/** May puzzle `date` be served (and a new play started) at `now`? */
export function isWindowOpen(date: string, now: Date | number): boolean {
  const t = typeof now === "number" ? now : now.getTime();
  const w = puzzleWindow(date);
  return t >= w.opensAt && t < w.closesAt;
}

/**
 * May a guess on puzzle `date` be accepted? The play must have started inside
 * the window, and the guess must arrive before the window closes plus a grace
 * period, so a game started at 23:58 in UTC−11/−12 can still be finished.
 */
export function isGuessAcceptable(date: string, now: Date | number, playStartedAt: Date | number): boolean {
  const t = typeof now === "number" ? now : now.getTime();
  const s = typeof playStartedAt === "number" ? playStartedAt : playStartedAt.getTime();
  const w = puzzleWindow(date);
  return isWindowOpen(date, s) && t >= w.opensAt && t < w.closesAt + GUESS_GRACE_MS;
}

/** Dates whose window is open at `now` (always 2 or 3 consecutive dates). */
export function servableDates(now: Date | number): string[] {
  const t = typeof now === "number" ? now : now.getTime();
  const utcToday = new Date(t).toISOString().slice(0, 10);
  return [-1, 0, 1, 2].map((d) => addDays(utcToday, d)).filter((d) => isWindowOpen(d, t));
}

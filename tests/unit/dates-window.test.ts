/**
 * SPEC §4 server date window + every row of the "Edge cases to test" table,
 * with fixed clocks and time zones.
 */
import { describe, expect, it } from "vitest";
import {
  addDays,
  GUESS_GRACE_MS,
  isGuessAcceptable,
  isWindowOpen,
  localDate,
  msUntilNextLocalMidnight,
  puzzleNumber,
  puzzleWindow,
  servableDates,
} from "@/lib/dates";
import { currentStreak } from "@/lib/streaks";

const at = (iso: string) => new Date(iso);
const H = 3_600_000;
const LAUNCH = "2026-11-09";
const D = "2026-11-20";

describe("puzzle window", () => {
  it("opens at (D−1) 10:00 UTC and closes at (D+1) 12:00 UTC", () => {
    const w = puzzleWindow(D);
    expect(new Date(w.opensAt).toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(new Date(w.closesAt).toISOString()).toBe("2026-11-21T12:00:00.000Z");
  });

  it("boundaries are inclusive at open, exclusive at close", () => {
    expect(isWindowOpen(D, at("2026-11-19T09:59:59.999Z"))).toBe(false);
    expect(isWindowOpen(D, at("2026-11-19T10:00:00.000Z"))).toBe(true);
    expect(isWindowOpen(D, at("2026-11-21T11:59:59.999Z"))).toBe(true);
    expect(isWindowOpen(D, at("2026-11-21T12:00:00.000Z"))).toBe(false);
  });

  it("is 50 hours long (14 + 24 + 12), so 2–3 dates are servable at any instant", () => {
    const w = puzzleWindow(D);
    expect((w.closesAt - w.opensAt) / H).toBe(50);
    for (let h = 0; h < 48; h++) {
      const n = servableDates(at("2026-11-20T00:00:00Z").getTime() + h * H);
      expect(n.length === 2 || n.length === 3, `hour ${h}: ${n}`).toBe(true);
    }
  });

  it("every real local date at any instant is servable (all zones UTC−12…UTC+14)", () => {
    const zones = ["Etc/GMT+12", "Pacific/Pago_Pago", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "Pacific/Auckland", "Pacific/Kiritimati"];
    for (let h = 0; h < 72; h += 0.5) {
      const now = at("2026-11-19T00:00:00Z").getTime() + h * H;
      for (const tz of zones) expect(isWindowOpen(localDate(new Date(now), tz), now), `${tz} +${h}h`).toBe(true);
    }
  });
});

describe("SPEC §4 edge cases", () => {
  it("Player in UTC+14 (Kiribati) at 00:01 gets the new puzzle and the server accepts it", () => {
    const now = at(`${D}T00:01:00+14:00`); // = (D−1) 10:01 UTC
    expect(localDate(now, "Pacific/Kiritimati")).toBe(D);
    expect(isWindowOpen(D, now)).toBe(true);
    // One minute earlier, Kiribati is still on D−1, and D isn't served yet anywhere.
    expect(localDate(at(`${addDays(D, -1)}T23:59:00+14:00`), "Pacific/Kiritimati")).toBe(addDays(D, -1));
  });

  it("Player in UTC−11 (American Samoa) at 23:59 is still on the old puzzle and guesses are accepted", () => {
    const now = at(`${D}T23:59:00-11:00`); // = (D+1) 10:59 UTC
    expect(localDate(now, "Pacific/Pago_Pago")).toBe(D);
    expect(isWindowOpen(D, now)).toBe(true);
    expect(isGuessAcceptable(D, now, at(`${D}T23:30:00-11:00`))).toBe(true);
  });

  it("Device clock set 3 days ahead: the server refuses that date", () => {
    const realNow = at(`${D}T09:00:00+11:00`);
    const deviceDate = localDate(new Date(realNow.getTime() + 3 * 24 * H), "Australia/Sydney");
    expect(deviceDate).toBe(addDays(D, 3));
    expect(isWindowOpen(deviceDate, realNow)).toBe(false);
    // Even one day ahead from the furthest-east zone is refused.
    expect(isWindowOpen(addDays(D, 2), realNow)).toBe(false);
  });

  it("Daylight-saving night (Sydney, Sun 4 Oct 2026): countdown correct, no double or skipped puzzle", () => {
    // Walk minute by minute for 48 h from Sat 3 Oct 00:00 AEST (= 2 Oct 14:00 UTC):
    // each local date appears once, in order, and puzzle numbers are consecutive.
    const seen: string[] = [];
    for (let m = 0; m < 48 * 60; m += 1) {
      const d = localDate(new Date(at("2026-10-02T14:00:00Z").getTime() + m * 60_000), "Australia/Sydney");
      if (seen[seen.length - 1] !== d) seen.push(d);
    }
    expect(seen).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    const nums = seen.map((d) => puzzleNumber(d, "2026-10-01"));
    expect(nums).toEqual([3, 4, 5]);
    expect(msUntilNextLocalMidnight(at("2026-10-03T14:00:00Z"), "Australia/Sydney")).toBe(23 * H);
  });

  it("Starts at 23:58, finishes at 00:03: the started puzzle can be finished", () => {
    // UTC−11: still inside the window at 00:03.
    expect(isGuessAcceptable(D, at(`${addDays(D, 1)}T00:03:00-11:00`), at(`${D}T23:58:00-11:00`))).toBe(true);
    // UTC−12 (worst case): window closed at 00:00 local, the grace period still accepts it.
    const start = at(`${D}T23:58:00-12:00`);
    const finish = at(`${addDays(D, 1)}T00:03:00-12:00`);
    expect(isWindowOpen(D, finish)).toBe(false);
    expect(isGuessAcceptable(D, finish, start)).toBe(true);
    // …but not forever, and not for a play started after the window closed.
    expect(isGuessAcceptable(D, puzzleWindow(D).closesAt + GUESS_GRACE_MS, start)).toBe(false);
    expect(isGuessAcceptable(D, finish, finish)).toBe(false);
  });

  it("Flies Sydney → LA (date goes backwards): already-played date maps to the same puzzle", () => {
    const playedAt = at(`${D}T09:00:00+11:00`);
    const played = localDate(playedAt, "Australia/Sydney");
    const landed = new Date(playedAt.getTime() + 14 * H); // 14 h flight
    const laDate = localDate(landed, "America/Los_Angeles");
    expect(laDate).toBe(played); // same date → the client shows the stored result, not a replay
    expect(puzzleNumber(laDate, LAUNCH)).toBe(puzzleNumber(played, LAUNCH));
  });

  it("Flies LA → Sydney (skips a date): streak is not broken", () => {
    const laDate = localDate(at(`${D}T20:00:00-08:00`), "America/Los_Angeles"); // play D in LA
    const landed = at(`${D}T20:00:00-08:00`).getTime() + 15 * H;
    const sydDate = localDate(new Date(landed), "Australia/Sydney");
    expect(sydDate).toBe(addDays(D, 2)); // D+1 never happened locally
    const plays = [
      { number: puzzleNumber(addDays(D, -1), LAUNCH), tz: "America/Los_Angeles" },
      { number: puzzleNumber(laDate, LAUNCH), tz: "America/Los_Angeles" },
      { number: puzzleNumber(sydDate, LAUNCH), tz: "Australia/Sydney" },
    ];
    expect(currentStreak(plays)).toBe(3);
  });
});

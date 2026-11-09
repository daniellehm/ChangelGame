import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatCountdown,
  headerDate,
  isDateString,
  isValidTimeZone,
  localDate,
  msUntilNextLocalMidnight,
  nextLocalMidnight,
  puzzleNumber,
} from "@/lib/dates";

const at = (iso: string) => new Date(iso);
const H = 3_600_000;

describe("localDate (never from UTC)", () => {
  // 2026-11-09 13:30 UTC
  const now = at("2026-11-09T13:30:00Z");
  it("Sydney is already on the 10th (AEDT, UTC+11)", () => expect(localDate(now, "Australia/Sydney")).toBe("2026-11-10"));
  it("London is on the 9th", () => expect(localDate(now, "Europe/London")).toBe("2026-11-09"));
  it("LA is on the 9th", () => expect(localDate(now, "America/Los_Angeles")).toBe("2026-11-09"));
  it("Kiribati (UTC+14) is on the 10th", () => expect(localDate(now, "Pacific/Kiritimati")).toBe("2026-11-10"));
  it("American Samoa (UTC−11) is on the 9th", () => expect(localDate(now, "Pacific/Pago_Pago")).toBe("2026-11-09"));
  it("differs from the UTC date when local and UTC disagree", () => {
    const late = at("2026-11-09T23:30:00Z");
    expect(late.toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(localDate(late, "Australia/Sydney")).toBe("2026-11-10");
  });
});

describe("puzzle number", () => {
  const launch = "2026-11-09";
  it("launch day is #1", () => expect(puzzleNumber("2026-11-09", launch)).toBe(1));
  it("next day is #2", () => expect(puzzleNumber("2026-11-10", launch)).toBe(2));
  it("is the same date-for-date in every time zone", () => {
    const now = at("2026-11-09T13:30:00Z");
    expect(puzzleNumber(localDate(now, "Australia/Sydney"), launch)).toBe(2);
    expect(puzzleNumber(localDate(now, "Europe/London"), launch)).toBe(1);
  });
  it("is unaffected by DST (Sydney Oct 4 2026, London Mar 28 2027)", () => {
    expect(daysBetween("2026-10-03", "2026-10-05")).toBe(2);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
    expect(puzzleNumber("2027-11-09", launch)).toBe(366);
  });
  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("validates date strings", () => {
    expect(isDateString("2026-11-09")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-1-9")).toBe(false);
    expect(() => puzzleNumber("nope", launch)).toThrow(RangeError);
  });
});

describe("countdown to next local midnight", () => {
  it("Sydney: 23:00 local → 1 hour", () => {
    // 2026-11-09 23:00 AEDT = 12:00 UTC
    expect(msUntilNextLocalMidnight(at("2026-11-09T12:00:00Z"), "Australia/Sydney")).toBe(H);
  });
  it("London: 18:30 local → 5.5 hours", () => {
    expect(msUntilNextLocalMidnight(at("2026-11-09T18:30:00Z"), "Europe/London")).toBe(5.5 * H);
  });
  it("LA: 09:15:30 local → 14:44:30", () => {
    // PST = UTC−8
    const ms = msUntilNextLocalMidnight(at("2026-11-09T17:15:30Z"), "America/Los_Angeles");
    expect(formatCountdown(ms)).toBe("14:44:30");
  });
  it("lands exactly on local midnight", () => {
    const t = nextLocalMidnight(at("2026-11-09T12:34:56.789Z"), "Australia/Sydney");
    expect(new Date(t).toISOString()).toBe("2026-11-09T13:00:00.000Z");
    expect(localDate(new Date(t - 1), "Australia/Sydney")).toBe("2026-11-09");
    expect(localDate(new Date(t), "Australia/Sydney")).toBe("2026-11-10");
  });
  it("Sydney DST start night (Sun 4 Oct 2026) is a 23-hour day: no skipped or double puzzle", () => {
    // 2026-10-04 00:00 AEST (UTC+10) = 2026-10-03T14:00Z; next midnight is AEDT (UTC+11).
    const startOfDay = at("2026-10-03T14:00:00Z");
    expect(localDate(startOfDay, "Australia/Sydney")).toBe("2026-10-04");
    expect(msUntilNextLocalMidnight(startOfDay, "Australia/Sydney")).toBe(23 * H);
    expect(new Date(nextLocalMidnight(startOfDay, "Australia/Sydney")).toISOString()).toBe("2026-10-04T13:00:00.000Z");
    // 01:30 before the jump → 21.5 h left
    expect(msUntilNextLocalMidnight(at("2026-10-03T15:30:00Z"), "Australia/Sydney")).toBe(21.5 * H);
  });
  it("Sydney DST end night (Sun 4 Apr 2027) is a 25-hour day", () => {
    // 2027-04-04 00:00 AEDT (UTC+11) = 2027-04-03T13:00Z
    expect(msUntilNextLocalMidnight(at("2027-04-03T13:00:00Z"), "Australia/Sydney")).toBe(25 * H);
  });
  it("handles zones whose DST switch skips midnight itself (Chile, Sep 6 2026)", () => {
    // America/Santiago jumps 00:00 → 01:00 on 2026-09-06. The new day starts at 01:00 local (04:00Z).
    const t = nextLocalMidnight(at("2026-09-05T20:00:00Z"), "America/Santiago");
    expect(localDate(new Date(t), "America/Santiago")).toBe("2026-09-06");
    expect(localDate(new Date(t - 1), "America/Santiago")).toBe("2026-09-05");
  });
  it("formats like the prototype", () => {
    expect(formatCountdown(0)).toBe("0:00:00");
    expect(formatCountdown(H + 61_000)).toBe("1:01:01");
    expect(formatCountdown(23 * H + 59 * 60_000 + 59_999)).toBe("23:59:59");
    expect(formatCountdown(-5)).toBe("0:00:00");
  });
});

describe("misc", () => {
  it("validates time zones", () => {
    expect(isValidTimeZone("Australia/Sydney")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
  it("header date is the puzzle date, not the device's UTC date", () => {
    expect(headerDate("2026-11-09", "en-US")).toBe("Nov 9");
    expect(headerDate("2026-11-09", "en-AU")).toBe("9 Nov");
  });
});

import { describe, expect, it } from "vitest";
import { currentStreak, maxStreak, type PlayRef } from "@/lib/streaks";

const SYD = "Australia/Sydney";
const LA = "America/Los_Angeles";
const p = (number: number, tz = SYD): PlayRef => ({ number, tz });

describe("streaks", () => {
  it("is 0 with no plays", () => {
    expect(currentStreak([])).toBe(0);
    expect(maxStreak([])).toBe(0);
  });

  it("counts consecutive puzzle numbers", () => {
    expect(currentStreak([p(1), p(2), p(3)])).toBe(3);
  });

  it("breaks on a skipped puzzle in the same time zone", () => {
    expect(currentStreak([p(1), p(2), p(4)])).toBe(1);
    expect(maxStreak([p(1), p(2), p(4)])).toBe(2);
  });

  it("date-line case: LA → Sydney skips a date without breaking the streak", () => {
    // Played #10 in LA, flew west, next local date in Sydney is #12.
    expect(currentStreak([p(9, LA), p(10, LA), p(12, SYD)])).toBe(3);
  });

  it("n−2 without a time zone change still breaks", () => {
    expect(currentStreak([p(10, LA), p(12, LA)])).toBe(1);
  });

  it("n−3 breaks even with a time zone change", () => {
    expect(currentStreak([p(10, LA), p(13, SYD)])).toBe(1);
  });

  it("is order-independent and ignores duplicate numbers (Sydney → LA replays a date)", () => {
    expect(currentStreak([p(3), p(1), p(2), p(2, LA)])).toBe(3);
  });

  it("with today: alive if played today or yesterday, otherwise 0", () => {
    const plays = [p(4), p(5), p(6)];
    expect(currentStreak(plays, p(6))).toBe(3); // played today
    expect(currentStreak(plays, p(7))).toBe(3); // today not played yet
    expect(currentStreak(plays, p(8))).toBe(0); // missed #7
    expect(currentStreak(plays, p(8, LA))).toBe(3); // tz changed: #8 can still continue
    expect(currentStreak(plays, p(9, LA))).toBe(0);
  });

  it("max streak picks the longest run", () => {
    // 6 (SYD) → 8 (LA) is n−2 with a tz change, so 5,6,8,9 is one run of 4
    expect(maxStreak([p(1), p(2), p(3), p(5), p(6), p(8, LA), p(9, LA)])).toBe(4);
    expect(maxStreak([p(1), p(3), p(4), p(5), p(6)])).toBe(4);
  });
});

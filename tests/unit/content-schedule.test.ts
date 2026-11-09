import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { candidatesNeeded, isBigMover, isTrap, openDays, pickDay, planSchedule, SCHEDULE, type PoolQuestion } from "@/lib/content/schedule";

const TODAY = "2026-11-09";
const CATS = ["People", "Money", "Tech", "Energy", "Food", "Sport", "Space", "Health", "Nature", "Travel", "Science", "Internet"];
let seq = 0;
/** kind: trap (×1.1), mover (×20), plain (×2.5) */
const q = (kind: "trap" | "mover" | "plain", category: string, over: Partial<PoolQuestion> = {}): PoolQuestion => ({
  id: ++seq,
  category,
  start_value: 100,
  end_value: kind === "trap" ? 110 : kind === "mover" ? 2000 : 250,
  origin: "researched",
  verified_at: `2026-10-01T00:00:${String(seq % 60).padStart(2, "0")}Z`,
  ...over,
});
/** A healthy pool: per 5 questions, one trap and one big mover, all categories rotating. */
const pool = (n: number) => Array.from({ length: n }, (_, i) => q(i % 5 === 0 ? "trap" : i % 5 === 1 ? "mover" : "plain", CATS[i % CATS.length]!));

describe("window", () => {
  it("only schedules from day 7 to day 30 (the 7-day rule)", () => {
    const days = openDays(TODAY, new Set());
    expect(days[0]).toBe(addDays(TODAY, 7));
    expect(days.at(-1)).toBe(addDays(TODAY, 30));
    expect(days).toHaveLength(24);
    expect(openDays(TODAY, new Set([addDays(TODAY, 7)]))[0]).toBe(addDays(TODAY, 8));
  });
});

describe("pickDay balance rules", () => {
  it("picks 5 different categories with at least one trap and one big mover", () => {
    const p = pickDay(pool(15), true)!;
    expect(p.ids).toHaveLength(5);
    expect(p.relaxed).toBe(false);
  });

  it("never repeats a category in a day (case-insensitive)", () => {
    const same = [q("trap", "Tech"), q("mover", "tech"), q("plain", "TECH"), q("plain", "Money"), q("plain", "Food"), q("plain", "Sport"), q("plain", "Space")];
    const p = pickDay(same, false)!;
    expect(p.ids).toHaveLength(5);
    expect(p.ids).not.toContain(same[1]!.id);
    expect(p.ids).not.toContain(same[2]!.id);
    expect(pickDay(same.slice(0, 6), false)).toBeNull(); // only 4 different categories
  });

  it("caps data-backed questions at 2 per day", () => {
    const data = CATS.slice(0, 6).map((c, i) => q(i === 0 ? "trap" : i === 1 ? "mover" : "plain", c, { origin: "data" }));
    const mixed = [...data, q("plain", "Space"), q("plain", "Health"), q("plain", "Nature")];
    const p = pickDay(mixed, true)!;
    expect(p.ids.filter((id) => data.some((d) => d.id === id))).toHaveLength(2);
  });

  it("strict mode refuses a day with no trap; relaxed mode takes the best day and says so", () => {
    const noTrap = CATS.slice(0, 6).map((c, i) => q(i === 0 ? "mover" : "plain", c));
    expect(pickDay(noTrap, true)).toBeNull();
    expect(pickDay(noTrap, false)).toMatchObject({ relaxed: true });
  });

  it("classifies traps and big movers", () => {
    expect(isTrap(q("trap", "x"))).toBe(true);
    expect(isBigMover(q("mover", "x"))).toBe(true);
    expect(isBigMover(q("plain", "x"))).toBe(false);
    expect(isBigMover(q("plain", "x", { start_value: 100, end_value: 5 }))).toBe(true); // ÷20
  });
});

describe("planSchedule", () => {
  it("fills every open day, nearest first, and keeps the reserve of 10", () => {
    const { plans, shortDays } = planSchedule(TODAY, new Set(), pool(24 * 5 + SCHEDULE.RESERVE));
    expect(plans).toHaveLength(24);
    expect(shortDays).toEqual([]);
    expect(plans[0]!.date).toBe(addDays(TODAY, 7));
    const used = plans.flatMap((p) => p.questionIds);
    expect(new Set(used).size).toBe(used.length); // a question appears in at most one puzzle
  });

  it("stops before dipping into the reserve", () => {
    const { plans, shortDays } = planSchedule(TODAY, new Set(), pool(3 * 5 + SCHEDULE.RESERVE + 4));
    expect(plans).toHaveLength(3);
    expect(shortDays).toHaveLength(21);
  });

  it("uses the oldest verified questions first", () => {
    const old = q("plain", "Space", { verified_at: "2020-01-01T00:00:00Z" });
    const { plans } = planSchedule(TODAY, new Set(), [...pool(40), old]);
    expect(plans[0]!.questionIds).toContain(old.id);
  });

  it("leaves a far-off day empty rather than break the rules, but relaxes close to the date", () => {
    const noTraps = Array.from({ length: 40 }, (_, i) => q(i % 4 === 0 ? "mover" : "plain", CATS[i % CATS.length]!));
    const { plans, shortDays } = planSchedule(TODAY, new Set(), noTraps);
    expect(plans.every((p) => p.relaxed)).toBe(true);
    expect(plans.every((p) => Date.parse(p.date) - Date.parse(TODAY) <= SCHEDULE.RELAX_WITHIN_DAYS * 86_400_000)).toBe(true);
    expect(shortDays.length).toBeGreaterThan(0);
  });
});

describe("top-up", () => {
  it("asks for the gap plus the reserve, plus 20%", () => {
    expect(candidatesNeeded(24, 0)).toBe(Math.ceil((24 * 5 + 10) * 1.2));
    expect(candidatesNeeded(1, 0)).toBe(18);
    expect(candidatesNeeded(2, 30)).toBe(0);
  });
});

describe("cold start (acceptance): an empty database reaches 30 ready days ahead in a week, with no human", () => {
  it("simulates 8 nightly runs where each night's verified candidates top the pool up", () => {
    const ready = new Set<string>();
    let poolNow: PoolQuestion[] = [];
    let today = TODAY;
    for (let night = 0; night < 8; night++) {
      const open = openDays(today, ready);
      // Night's generation: candidatesNeeded, of which ~80% pass the checks.
      const made = Math.floor(candidatesNeeded(open.length, poolNow.length) * 0.8);
      poolNow = [...poolNow, ...pool(made)];
      const { plans } = planSchedule(today, ready, poolNow);
      for (const p of plans) ready.add(p.date);
      const used = new Set(plans.flatMap((p) => p.questionIds));
      poolNow = poolNow.filter((x) => !used.has(x.id));
      expect(poolNow.length, `night ${night} reserve`).toBeGreaterThanOrEqual(SCHEDULE.RESERVE);
      today = addDays(today, 1);
    }
    // From "today" (8 days on), every day for the next 30 is ready.
    const ahead = Array.from({ length: 30 }, (_, d) => addDays(today, d));
    expect(ahead.filter((d) => !ready.has(d))).toEqual([]);
  });
});

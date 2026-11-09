import { describe, expect, it } from "vitest";
import { daysBetween } from "@/lib/dates";
import { ORDER, POOL, PROTOTYPE_EPOCH, questionsForDay } from "@/lib/fixtures/prototype-pool";
import { createFixtureSource } from "@/lib/game/fixture-source";
import { loadPrototype } from "../helpers/prototype";

const proto = loadPrototype();

describe("prototype fixture", () => {
  it("has the prototype's 20 questions verbatim", () => {
    expect(POOL).toEqual(proto.POOL);
  });

  it("shuffles in the prototype's order", () => {
    expect(ORDER).toEqual(proto.order);
  });

  it.each(["2026-11-09", "2026-11-10", "2026-11-13", "2026-12-25", "2027-06-01"])(
    "picks the same 5 rounds as the prototype on %s",
    (date) => {
      const dayNum = daysBetween(PROTOTYPE_EPOCH, date);
      const expected = Array.from({ length: 5 }, (_, i) => proto.POOL[proto.order[(dayNum * 5 + i) % proto.POOL.length]!]);
      expect(questionsForDay(dayNum)).toEqual(expected);
    },
  );

  it("clamps dates before the epoch to day 0, like the prototype", () => {
    expect(questionsForDay(-3)).toEqual(questionsForDay(0));
  });
});

describe("fixture GameSource", () => {
  const source = createFixtureSource("2026-11-09");

  it("serves rounds with no answer fields", async () => {
    const p = await source.loadPuzzle("2026-11-09");
    expect(p.number).toBe(1);
    expect(p.rounds).toHaveLength(5);
    for (const r of p.rounds) {
      expect(Object.keys(r).sort()).toEqual(["category", "end_year", "format", "position", "prompt", "start_value", "start_year"]);
    }
  });

  it("scores a lock-in exactly like the prototype", async () => {
    const p = await source.loadPuzzle("2026-11-10");
    const q = questionsForDay(1)[2]!;
    const res = await source.lockIn(p, 3, 0.38);
    const al = Math.log10(q.v1 / q.v0);
    const ps = proto.score(0.38, al);
    expect(res).toMatchObject({ position: 3, points: ps.pts, wrong_way: ps.wrong, end_value: q.v1, fact: q.fact, source_name: q.src });
    expect(proto.tier(res.points, res.wrong_way).t).toBe(
      { nailed: "Nailed it", close: "Close", meh: "Meh", off: "Way off", wrong: "Wrong way!" }[res.tier],
    );
  });
});

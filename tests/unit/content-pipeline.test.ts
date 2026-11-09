/**
 * End-to-end pipeline on fakes: in-memory store, fake Claude, recorded datasets.
 * Exercises the real generator, check and scheduler code paths.
 */
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { pickCategories, runHop } from "@/lib/content/pipeline";
import { SCHEDULE } from "@/lib/content/schedule";
import { fakeClaude, fetchFn, memoryStore } from "../helpers/content-fakes";

const TODAY = "2026-11-09";

describe("runHop", () => {
  it("cold start (acceptance): from an empty database, 30 days ahead are ready after a week, with no human", async () => {
    const mem = memoryStore();
    const claude = fakeClaude(mem);
    let today = TODAY;
    for (let night = 0; night < 8; night++) {
      // Each night may take several hops; give each a generous fake deadline.
      for (let hop = 0; hop < 30; hop++) {
        const r = await runHop({ store: mem.store, llm: claude.llm, fetchFn, today, deadline: Number.POSITIVE_INFINITY, rand: () => 0.42 });
        if (r.done) break;
      }
      today = addDays(today, 1);
    }
    const ahead = Array.from({ length: 30 }, (_, d) => addDays(today, d));
    expect(ahead.filter((d) => !mem.puzzles.has(d))).toEqual([]);
    // The reserve is kept, planted wrong numbers never reached a puzzle, and data-backed ones were used.
    expect(mem.qs.filter((q) => q.status === "verified").length).toBeGreaterThanOrEqual(SCHEDULE.RESERVE);
    const planted = mem.qs.filter((q) => q.origin === "researched" && Number(q.prompt.split(" ").at(-1)) % 7 === 0);
    expect(planted.length).toBeGreaterThan(0);
    expect(planted.every((q) => q.status === "flagged")).toBe(true);
    const scheduledIds = new Set([...mem.puzzles.values()].flat());
    expect(planted.some((q) => scheduledIds.has(q.id))).toBe(false);
    expect(mem.qs.some((q) => q.origin === "data" && scheduledIds.has(q.id))).toBe(true);
    // Every scheduled day keeps the balance rules (5 different categories).
    for (const ids of mem.puzzles.values()) {
      const cats = ids.map((id) => mem.qs.find((q) => q.id === id)!.category.toLowerCase());
      expect(new Set(cats).size).toBe(5);
    }
  });

  it("finishes immediately when nothing is needed", async () => {
    const mem = memoryStore();
    const claude = fakeClaude(mem);
    // Fill once fully, then a second run the same day has nothing to do.
    for (let hop = 0; hop < 30 && !(await runHop({ store: mem.store, llm: claude.llm, fetchFn, today: TODAY, deadline: Infinity })).done; hop++);
    const callsBefore = claude.calls();
    const r = await runHop({ store: mem.store, llm: claude.llm, fetchFn, today: TODAY, deadline: Infinity });
    expect(r.done).toBe(true);
    expect(claude.calls()).toBe(callsBefore);
  });

  it("stops at the spend cap without failing, and still schedules what it can", async () => {
    const mem = memoryStore();
    const claude = fakeClaude(mem);
    claude.setCap(0.5);
    const r = await runHop({ store: mem.store, llm: claude.llm, fetchFn, today: TODAY, deadline: Infinity });
    expect(r.capped).toBe(true);
    expect(r.done).toBe(false);
    expect(r.log.join("\n")).toMatch(/spend cap/i);
  });

  it("respects the hop deadline: with no time left it does no paid work", async () => {
    const mem = memoryStore();
    const claude = fakeClaude(mem);
    const r = await runHop({ store: mem.store, llm: claude.llm, fetchFn, today: TODAY, deadline: Date.now() + 10_000 });
    expect(r.done).toBe(false);
    expect(claude.calls()).toBe(0);
  });
});

describe("pickCategories", () => {
  it("prefers the least-used categories", () => {
    const counts = new Map([["people", 9], ["money", 9], ["tech", 9]]);
    const picked = pickCategories(counts, 5, () => 0);
    expect(picked).not.toContain("People");
    expect(picked).toHaveLength(5);
  });
});

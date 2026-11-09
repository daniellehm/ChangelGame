import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/lib/content/catalog";
import {
  fitMaxChange,
  generateDataBacked,
  generateResearchedBatch,
  MAX_CHANGE_MENU,
  pickYears,
  proposeMaxChange,
  seriesKey,
  snapUp,
  unusedEntries,
  type Candidate,
} from "@/lib/content/generate";
import type { Llm, LlmRequest } from "@/lib/content/llm";
import type { FetchLike, Series } from "@/lib/content/sources";
import { rangeProblems } from "@/lib/range";

/** Fake Claude: answers each purpose with a canned object and records every request. */
function fakeLlm(answers: Partial<Record<string, unknown>>) {
  const calls: LlmRequest<unknown>[] = [];
  const llm: Llm = {
    async json<T>(req: LlmRequest<T>): Promise<T> {
      calls.push(req as LlmRequest<unknown>);
      return req.schema.parse(answers[req.purpose]);
    },
  };
  return { llm, calls };
}

const NOW = new Date("2026-11-09T00:00:00Z");
const fixed = (x: number) => () => x;
const pop = CATALOG.find((e) => e.id === "SP.POP.TOTL")!;
const series = (points: Array<[number, number]>): Series => ({
  source: "worldbank", id: "X", entity: "WLD", entityName: "World", label: "X", unit: null, publisher: "World Bank", citation: "c", url: "u",
  points: points.map(([year, value]) => ({ year, value })),
});

describe("catalog", () => {
  it("has unique series keys and a valid format for each entry", () => {
    const keys = CATALOG.map(seriesKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(CATALOG.length).toBeGreaterThanOrEqual(45);
  });
  it("money series say whether they're nominal or inflation-adjusted", () => {
    for (const e of CATALOG.filter((x) => x.format === "usd")) expect(e.money, e.id).toBeDefined();
  });
  it("unusedEntries skips series already turned into questions", () => {
    expect(unusedEntries(new Set([seriesKey(pop)])).some((e) => e.id === pop.id)).toBe(false);
  });
});

describe("pickYears", () => {
  it("ends on the latest year and starts on a round year at least 10 years earlier", () => {
    const s = series([[1960, 3e9], [1990, 5.3e9], [2016, 7.4e9], [2025, 8.2e9]]);
    expect(pickYears(s, pop, NOW, fixed(0))).toEqual({ start_year: 1960, start_value: 3e9, end_year: 2025, end_value: 8.2e9 });
    expect(pickYears(s, pop, NOW, fixed(0.99))!.start_year).toBe(1990); // 2016 is too close to 2025 and not round
  });
  it("rejects stale series, missing start years and changes too big for the slider", () => {
    expect(pickYears(series([[1960, 1], [2015, 2]]), pop, NOW, fixed(0))).toBeNull(); // last point 2015 < 2021
    expect(pickYears(series([[1963, 1], [2025, 2]]), pop, NOW, fixed(0))).toBeNull(); // no round start year
    expect(pickYears(series([[1990, 1], [2025, 1e4]]), pop, NOW, fixed(0))).toBeNull(); // ×10,000
  });
  it("respects minYear", () => {
    const e = { ...pop, minYear: 1990 };
    expect(pickYears(series([[1960, 3e9], [1990, 5.3e9], [2025, 8.2e9]]), e, NOW, fixed(0))!.start_year).toBe(1990);
  });
});

describe("generateDataBacked", () => {
  const wbJson = readFileSync("tests/fixtures/content/wb-SP.POP.TOTL-WLD.json", "utf8");
  const fetchFn: FetchLike = async () => new Response(wbJson);

  it("takes both values from the dataset; Claude only writes the wording", async () => {
    const { llm, calls } = fakeLlm({ wording: { prompt: "World population", fact: "It has more than doubled." } });
    const c = (await generateDataBacked(pop, { llm, fetchFn, now: NOW, rand: fixed(0) }))!;
    expect(c).toMatchObject({
      origin: "data", category: "People", prompt: "World population", format: "big",
      start_year: 1960, start_value: 3.02e9, end_year: 2025, end_value: 8.22e9,
      source_name: "World Bank", source_url: "https://data.worldbank.org/indicator/SP.POP.TOTL", max_change: null,
    });
    expect(c.source_data).toMatchObject({ key: "worldbank:SP.POP.TOTL:WLD", values: { 1960: 3021512598, 2025: 8215424893 } });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ purpose: "wording", tier: "fast" });
    expect(calls[0]!.prompt).toContain("3.02 billion");
  });
});

describe("generateResearchedBatch", () => {
  it("uses Opus with web search and rounds values to 3 significant figures", async () => {
    const q = {
      category: "Streaming", prompt: "Spotify monthly active users", start_year: 2015, start_value: 75123456, end_year: 2025, end_value: 696000000,
      format: "big", fact: "Spotify passed 600 million users in 2024.", source_name: "Spotify", source_url: "https://investors.spotify.com/x", source_url_2: "https://example.org/y",
    };
    const { llm, calls } = fakeLlm({ draft: { questions: [q, { ...q, prompt: "Second" }] } });
    const out = await generateResearchedBatch({ llm, count: 1, categories: ["Streaming"], avoid: ["World population"], now: NOW });
    expect(out).toHaveLength(1); // never more than asked for
    expect(out[0]).toMatchObject({ origin: "researched", start_value: 75100000, end_value: 696000000, source_url_2: "https://example.org/y" });
    expect(calls[0]).toMatchObject({ purpose: "draft", tier: "strong", webSearches: 8 });
    expect(calls[0]!.prompt).toContain("World population");
  });
});

describe("max_change", () => {
  const cand: Candidate = {
    origin: "researched", category: "Politics", prompt: "Member states of the United Nations", start_year: 1945, start_value: 51, end_year: 2011, end_value: 193,
    format: "int", fact: "f", source_name: "UN", source_url: "u", source_url_2: null, source_data: null, max_change: null,
  };

  it("the proposal never sees the end value (the answer)", async () => {
    const { llm, calls } = fakeLlm({ max_change: { max_change: "8", why: "membership can't grow forever" } });
    expect(await proposeMaxChange(cand, { llm })).toBe(8);
    expect(calls[0]!.prompt).not.toContain("193");
    expect(calls[0]!.prompt).toContain("51");
  });

  it("raises k along the menu only when the answer is too close to the end; never lowers it", () => {
    expect(fitMaxChange(8, 51, 193)).toBe(8);
    expect(fitMaxChange(2, 51, 193)).toBe(5); // ×3.78 needs k ≥ 4.77
    expect(fitMaxChange(100, 51, 193)).toBe(100);
    // ×200 is the biggest kind of change the generators allow (beyond ~×355 no range can hold it).
    for (const [s, e] of [[100, 101], [100, 99], [3, 600], [9.95, 9.58]] as const) {
      expect(rangeProblems(s, e, fitMaxChange(1.05, s, e)), `${s}→${e}`).toEqual([]);
    }
  });

  it("snaps a proposal up to the menu", () => {
    expect(snapUp(6)).toBe(8);
    expect(snapUp(1.05)).toBe(1.05);
    expect(snapUp(5000)).toBe(1000);
    expect(MAX_CHANGE_MENU.at(-1)).toBe(1000);
  });
});

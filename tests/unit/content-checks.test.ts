import { describe, expect, it } from "vitest";
import { blocklistHit, checkBatch, flagReason, pageText, rangeCheck, relevantPassages, sanityCheck, type CheckDeps } from "@/lib/content/checks";
import type { Candidate } from "@/lib/content/generate";
import { SpendCapReached, type Llm, type LlmRequest } from "@/lib/content/llm";
import type { FetchLike } from "@/lib/content/sources";

const NOW = new Date("2026-11-09T00:00:00Z");

const researched = (over: Partial<Candidate> = {}): Candidate => ({
  origin: "researched",
  category: "Politics",
  prompt: "Member states of the United Nations",
  start_year: 1945,
  start_value: 51,
  end_year: 2011,
  end_value: 193,
  format: "int",
  fact: "South Sudan became the 193rd member in 2011.",
  source_name: "United Nations",
  source_url: "https://www.un.org/en/about-us/growth-in-un-membership",
  source_url_2: "https://en.wikipedia.org/wiki/Member_states_of_the_United_Nations",
  source_data: null,
  max_change: 8,
  ...over,
});

const dataBacked = (over: Partial<Candidate> = {}): Candidate => ({
  ...researched(),
  origin: "data",
  category: "People",
  prompt: "World population",
  start_year: 1960,
  start_value: 3.02e9,
  end_year: 2025,
  end_value: 8.22e9,
  format: "big",
  fact: "It has more than doubled since 1960.",
  source_name: "World Bank",
  source_url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
  source_url_2: null,
  source_data: { key: "worldbank:SP.POP.TOTL:WLD", values: { 1960: 3021512598, 2025: 8215424893 } },
  max_change: 4,
  ...over,
});

type Answers = { [purpose: string]: (req: LlmRequest<unknown>) => unknown };

/** Fake Claude keyed by purpose; records requests. */
function fake(answers: Answers) {
  const calls: LlmRequest<unknown>[] = [];
  const llm: Llm = {
    async json<T>(req: LlmRequest<T>) {
      calls.push(req as LlmRequest<unknown>);
      const f = answers[req.purpose];
      if (!f) throw new Error(`unexpected ${req.purpose} call`);
      return req.schema.parse(f(req as LlmRequest<unknown>));
    },
  };
  return { llm, calls };
}

const ok = { pass: true, reason: "fine" };
const goodReview = () => ({ like_for_like: ok, safety: ok, fact: ok });
const supported = () => ({ start_supported: true, start_quote: "51 original members", end_supported: true, end_quote: "193 Member States" });
/** Cross-check that "finds" the given values for every id in the prompt. */
const crossFinds = (values: Array<[number, number]>) => (req: LlmRequest<unknown>) => ({
  estimates: values.map(([s, e], id) => ({ id, start_estimate: s, end_estimate: e, note: "found" })).filter((_, id) => req.prompt.includes(`id ${id}:`)),
});
const page: FetchLike = async () => new Response("<html><body><p>In 1945 the UN had 51 original members.</p><p>Today there are 193 Member States (2011).</p></body></html>", { headers: { "content-type": "text/html" } });

function deps(llm: Llm, over: Partial<CheckDeps> = {}): CheckDeps {
  return { llm, now: NOW, fetchFn: page, similarPrompts: async () => [], seriesUsed: async () => false, ...over };
}

describe("code checks", () => {
  it("sanity passes a clean question", () => expect(sanityCheck(researched(), NOW)).toEqual({ pass: true, detail: "ok" }));

  it.each([
    [{ start_value: 0 }, "values must be > 0"],
    [{ end_year: 1940 }, "end year must be after"],
    [{ end_year: 2030 }, "in the future"],
    [{ start_value: 1, end_value: 5000 }, "÷1000 to ×1000"],
    [{ end_value: 193.4 }, "3 significant figures"],
    [{ prompt: "UN members in 1945" }, "mentions a year"],
    [{ source_url_2: null }, "second source"],
    [{ source_url_2: "https://news.un.org/x" }, "different publishers"],
    [{ format: "usd" as const, prompt: "Price of a stamp" }, "nominal or inflation-adjusted"],
  ])("sanity fails %o", (over, msg) => {
    const r = sanityCheck(researched(over), NOW);
    expect(r.pass).toBe(false);
    expect(r.detail).toContain(msg);
  });

  it("keeps full precision for sec/time/yrs", () => {
    expect(sanityCheck(researched({ format: "sec", start_value: 9.95, end_value: 9.58, max_change: 1.1 }), NOW).pass).toBe(true);
  });

  it("range check applies the slider rules", () => {
    expect(rangeCheck(researched()).pass).toBe(true);
    expect(rangeCheck(researched({ max_change: 4 })).detail).toMatch(/85% of the way/);
    expect(rangeCheck(researched({ max_change: null })).pass).toBe(false);
  });

  it("blocklist catches tragedy topics but not lookalikes", () => {
    expect(blocklistHit(researched({ prompt: "Road deaths worldwide" }))).toBe("deaths");
    expect(blocklistHit(researched({ fact: "Fewer people died than expected." }))).toBe("died");
    expect(blocklistHit(researched({ prompt: "Wardrobes sold by IKEA" }))).toBeNull();
  });
});

describe("page text", () => {
  it("strips scripts, styles and tags, and keeps only relevant passages", () => {
    const html = "<html><script>var x=193</script><style>p{}</style><p>Intro text</p><p>There are 193&nbsp;members.</p><p>Unrelated</p></html>";
    const t = pageText(html);
    expect(t).not.toContain("var x");
    expect(t).toContain("There are 193 members.");
    expect(relevantPassages(t, researched())).toContain("193 members");
  });

  it("finds the page's exact figure when the stored value is rounded to 3 s.f. (1,864 stored as 1,860)", () => {
    const text = "Background on the surveys.\nThe latest survey found 1,864 wild pandas.\nOther news.";
    const c = researched({ prompt: "Wild giant pandas", start_year: 1003, start_value: 1600, end_year: 1014, end_value: 1860 });
    expect(relevantPassages(text, c)).toContain("1,864 wild pandas");
  });
});

describe("source pages", () => {
  it("reads .csv data files served as application/octet-stream", async () => {
    const csv: FetchLike = async () => new Response(" year, mo, extent\n 1945,  9, 51\n 2011,  9, 193\n", { headers: { "content-type": "application/octet-stream" } });
    const seen: string[] = [];
    const { llm } = fake({
      review: goodReview,
      source_support: (req) => {
        seen.push(req.prompt);
        return supported();
      },
      cross_check: crossFinds([[51, 193]]),
    });
    await checkBatch([{ id: 5, candidate: researched({ source_url: "https://data.example.org/N_09_extent.csv" }) }], { ...deps(llm), fetchFn: csv });
    expect(seen.some((p) => p.includes("2011,  9, 193"))).toBe(true);
  });
});

describe("checkBatch", () => {
  it("passes a good researched question after every check, and records evidence", async () => {
    const { llm, calls } = fake({ review: goodReview, source_support: supported, cross_check: crossFinds([[51, 193]]) });
    const [r] = await checkBatch([{ id: 5, candidate: researched() }], deps(llm));
    expect(r!.passed).toBe(true);
    expect(Object.keys(r!.results).sort()).toEqual(["cross_check", "duplicate", "fact_quality", "like_for_like", "range", "safety", "sanity", "source_support"]);
    expect(r!.results.source_support!.evidence).toHaveLength(2);
    expect(calls.map((c) => c.purpose)).toEqual(["review", "source_support", "source_support", "cross_check"]);
    expect(flagReason(r!)).toBeNull();
  });

  describe("FLAGS A PLANTED WRONG NUMBER (UN members 2011 = 293; the real figure is 193)", () => {
    const planted = { ...researched({ end_value: 293 }), max_change: 10 };

    it("source support catches it, and the paid cross-check is skipped", async () => {
      const { llm, calls } = fake({ review: goodReview, source_support: () => ({ ...supported(), end_supported: false, end_quote: "" }) });
      const [r] = await checkBatch([{ id: 1, candidate: planted }], deps(llm));
      expect(r!.passed).toBe(false);
      expect(r!.results.source_support).toMatchObject({ pass: false, detail: "no source supports the 2011 value" });
      expect(calls.some((c) => c.purpose === "cross_check")).toBe(false);
    });

    it("if a source wrongly appears to support it, the independent cross-check still catches it", async () => {
      const { llm } = fake({ review: goodReview, source_support: supported, cross_check: crossFinds([[51, 193]]) });
      const [r] = await checkBatch([{ id: 1, candidate: planted }], deps(llm));
      expect(r!.passed).toBe(false);
      expect(r!.results.cross_check!.detail).toMatch(/2011 by 34%/);
      expect(flagReason(r!)).toMatch(/^cross_check:/);
    });
  });

  it("the cross-check never sees the values it is checking", async () => {
    const { llm, calls } = fake({ review: goodReview, source_support: supported, cross_check: crossFinds([[51, 193]]) });
    await checkBatch([{ id: 1, candidate: researched() }], deps(llm));
    const cross = calls.find((c) => c.purpose === "cross_check")!;
    expect(cross.prompt).not.toMatch(/\b51\b|\b193\b/);
    expect(cross.tier).toBe("strong");
    expect(cross.webSearches).toBeGreaterThan(0);
  });

  it("a free check failure skips every paid call", async () => {
    const { llm, calls } = fake({});
    const [r] = await checkBatch([{ id: 1, candidate: researched({ prompt: "Battle deaths worldwide" }) }], deps(llm));
    expect(r!.passed).toBe(false);
    expect(r!.results.safety!.detail).toMatch(/blocklisted/);
    expect(calls).toHaveLength(0);
  });

  it("data-backed questions skip source fetching but still get the review and the cross-check", async () => {
    let fetched = false;
    const { llm, calls } = fake({ review: goodReview, cross_check: crossFinds([[3.03e9, 8.1e9]]) });
    const [r] = await checkBatch([{ id: 1, candidate: dataBacked() }], deps(llm, { fetchFn: async () => ((fetched = true), new Response("")) }));
    expect(r!.passed).toBe(true);
    expect(fetched).toBe(false);
    expect(calls.map((c) => c.purpose)).toEqual(["review", "cross_check"]);
  });

  it("a series already used is a duplicate; similar wording goes to a quick 'same measure?' check", async () => {
    const used = fake({});
    const [r1] = await checkBatch([{ id: 1, candidate: dataBacked() }], deps(used.llm, { seriesUsed: async () => true }));
    expect(r1!.results.duplicate).toMatchObject({ pass: false });

    const same = fake({ duplicate: () => ({ duplicate_of: 9, reason: "same thing" }) });
    const [r2] = await checkBatch([{ id: 1, candidate: researched() }], deps(same.llm, { similarPrompts: async () => [{ id: 9, prompt: "Member states of the UN", similarity: 0.8 }] }));
    expect(r2!.results.duplicate).toMatchObject({ pass: false, detail: "same measure as question 9" });

    const different = fake({ duplicate: () => ({ duplicate_of: null, reason: "wind vs solar" }), review: goodReview, source_support: supported, cross_check: crossFinds([[51, 193]]) });
    const [r3] = await checkBatch([{ id: 1, candidate: researched() }], deps(different.llm, { similarPrompts: async () => [{ id: 9, prompt: "x", similarity: 0.7 }] }));
    expect(r3!.results.duplicate).toMatchObject({ pass: true });
  });

  it("an unreachable source or a missing estimate fails safe (held back for a human)", async () => {
    const { llm } = fake({ review: goodReview, cross_check: () => ({ estimates: [{ id: 0, start_estimate: 51, end_estimate: null, note: "not found" }] }) });
    const [r] = await checkBatch([{ id: 1, candidate: researched() }], deps(llm, { fetchFn: async () => new Response("nope", { status: 403 }) }));
    expect(r!.results.source_support).toMatchObject({ pass: false });
    expect(r!.passed).toBe(false);
  });

  it("cross-checks in batches of 5 and maps estimates back to the right question", async () => {
    const cands = Array.from({ length: 6 }, (_, k) => researched({ prompt: `Thing number ${k}` }));
    const { llm, calls } = fake({ review: goodReview, source_support: supported, cross_check: crossFinds(Array.from({ length: 5 }, () => [51, 193] as [number, number])) });
    const reports = await checkBatch(cands.map((c, k) => ({ id: k, candidate: c })), deps(llm));
    expect(calls.filter((c) => c.purpose === "cross_check")).toHaveLength(2);
    expect(reports.every((r) => r.results.cross_check!.pass)).toBe(true);
  });

  it("stops the whole batch when the spend cap is reached", async () => {
    const llm: Llm = { json: async () => { throw new SpendCapReached(50); } };
    await expect(checkBatch([{ id: 1, candidate: researched() }], deps(llm))).rejects.toBeInstanceOf(SpendCapReached);
  });
});

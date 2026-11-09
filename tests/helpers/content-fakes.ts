/** Shared fakes for content pipeline tests: in-memory Store, fake Claude, recorded datasets. */
import { readFileSync } from "node:fs";
import { addDays } from "@/lib/dates";
import type { CheckReport } from "@/lib/content/checks";
import type { Candidate } from "@/lib/content/generate";
import { SpendCapReached, type Llm, type LlmRequest } from "@/lib/content/llm";
import type { PoolQuestion } from "@/lib/content/schedule";
import type { FetchLike } from "@/lib/content/sources";
import type { Store } from "@/lib/content/store";

type Q = Candidate & { id: number; status: string; checks: CheckReport | null; verified_at: string | null };

export function memoryStore() {
  const qs: Q[] = [];
  const puzzles = new Map<string, number[]>();
  let next = 1;
  const store: Store = {
    async markUsed(today) {
      let n = 0;
      for (const [date, ids] of puzzles) {
        if (date >= addDays(today, -1)) continue;
        for (const q of qs) {
          if (ids.includes(q.id) && q.status === "scheduled") {
            q.status = "used";
            n++;
          }
        }
      }
      return n;
    },
    async readyDates(from, to) {
      return new Set([...puzzles.keys()].filter((d) => d >= from && d <= to));
    },
    async pool(): Promise<PoolQuestion[]> {
      return qs.filter((q) => q.status === "verified").map((q) => ({ id: q.id, category: q.category, start_value: q.start_value, end_value: q.end_value, origin: q.origin, verified_at: q.verified_at! }));
    },
    async schedule(date, ids) {
      if (puzzles.has(date)) return "exists";
      if (!ids.every((id) => qs.find((q) => q.id === id)?.status === "verified")) return "unavailable";
      puzzles.set(date, ids);
      for (const q of qs) if (ids.includes(q.id)) q.status = "scheduled";
      return "ok";
    },
    async pendingDrafts(limit) {
      return qs.filter((q) => q.status === "draft" && !q.checks).slice(0, limit).map((q) => ({ id: q.id, candidate: q }));
    },
    async countPending() {
      return qs.filter((q) => q.status === "draft" && !q.checks).length;
    },
    async insertDraft(c) {
      const q: Q = { ...c, id: next++, status: "draft", checks: null, verified_at: null };
      qs.push(q);
      return q.id;
    },
    async saveChecks(id, report) {
      const q = qs.find((x) => x.id === id)!;
      q.checks = report;
      q.status = report.passed ? "verified" : "flagged";
      q.verified_at = report.passed ? new Date(1_700_000_000_000 + id * 1000).toISOString() : null;
    },
    async usedSeriesKeys() {
      return new Set(qs.map((q) => q.source_data?.key as string).filter(Boolean));
    },
    async recentPrompts(limit) {
      return qs.map((q) => q.prompt).reverse().slice(0, limit);
    },
    async categoryCounts() {
      const m = new Map<string, number>();
      for (const q of qs) m.set(q.category.toLowerCase(), (m.get(q.category.toLowerCase()) ?? 0) + 1);
      return m;
    },
    async similarPrompts() {
      return [];
    },
    async seriesUsed(key, excludeId) {
      return qs.some((q) => q.id !== excludeId && q.source_data?.key === key);
    },
  };
  return { store, qs, puzzles };
}

/**
 * Fake Claude. Researched drafts rotate trap (×1.1) / big mover (×20) / plain (×2.5);
 * every 7th researched draft has a planted wrong end value. The cross-check answers
 * with the truth, so planted ones must end up flagged.
 */
export function fakeClaude(store: ReturnType<typeof memoryStore>) {
  const truth = new Map<string, [number, number]>();
  let n = 0;
  let calls = 0;
  let spend = 0;
  let capAt = Infinity;
  const llm: Llm = {
    async json<T>(req: LlmRequest<T>): Promise<T> {
      if (spend >= capAt) throw new SpendCapReached(spend);
      calls++;
      spend += req.tier === "strong" ? 0.1 : 0.003;
      const answer = ((): unknown => {
        switch (req.purpose) {
          case "wording":
            return { prompt: `Data series ${++n}`, fact: "It changed." };
          case "max_change":
            return { max_change: "10", why: "plausible" };
          case "draft": {
            const count = Number(/Research (\d+)/.exec(req.prompt)![1]);
            const cats = /categories: ([^\n.]+)\./.exec(req.prompt)![1]!.split(", ");
            return {
              questions: Array.from({ length: count }, (_, i) => {
                const k = ++n;
                const end = k % 3 === 0 ? 110 : k % 3 === 1 ? 2000 : 250;
                const planted = k % 7 === 0;
                truth.set(`Researched topic ${k}`, [100, end]);
                return {
                  category: cats[i % cats.length], prompt: `Researched topic ${k}`, start_year: 2005, start_value: 100, end_year: 2024,
                  end_value: planted ? end * 2 : end, format: "int", fact: "A fact.", source_name: "Pub A", source_url: `https://a.example/${k}`, source_url_2: `https://b.example/${k}`,
                };
              }),
            };
          }
          case "review":
            return { like_for_like: { pass: true, reason: "ok" }, safety: { pass: true, reason: "ok" }, fact: { pass: true, reason: "ok" } };
          case "source_support":
            return { start_supported: true, start_quote: "q", end_supported: true, end_quote: "q" };
          case "cross_check": {
            const lines = req.prompt.split("\n");
            return {
              estimates: lines.map((line, id) => {
                const prompt = /^id \d+: (.*) — value in/.exec(line)![1]!;
                const q = store.qs.find((x) => x.prompt === prompt)!;
                const t = truth.get(prompt) ?? [q.start_value, q.end_value]; // data-backed: the dataset is the truth
                return { id, start_estimate: t[0], end_estimate: t[1], note: "" };
              }),
            };
          }
          default:
            throw new Error(`unexpected ${req.purpose}`);
        }
      })();
      return req.schema.parse(answer);
    },
  };
  return { llm, calls: () => calls, setCap: (x: number) => (capAt = x), spend: () => spend };
}

const wbJson = readFileSync("tests/fixtures/content/wb-SP.POP.TOTL-WLD.json", "utf8");
const owidCsv = readFileSync("tests/fixtures/content/owid-life-expectancy-OWID_WRL.csv", "utf8");
const owidMeta = readFileSync("tests/fixtures/content/owid-life-expectancy.metadata.json", "utf8");
export const fetchFn: FetchLike = async (url) => {
  if (url.startsWith("https://api.worldbank.org")) return new Response(wbJson);
  if (url.includes(".metadata.json")) return new Response(owidMeta);
  if (url.startsWith("https://ourworldindata.org")) return new Response(owidCsv);
  // Source pages: mention the years so passages are found.
  return new Response("<p>Figures for 2005 and 2024 are given here.</p>", { headers: { "content-type": "text/html" } });
};


/**
 * Question generators (SPEC §8, M5 task 5.3).
 *
 *  - Data-backed: code picks a catalog series and two years and reads both values
 *    from the dataset. Claude (Sonnet) only writes the prompt wording and the fact.
 *  - Researched: Claude (Opus + web search) proposes a batch of questions with
 *    values, years, a fact and two sources from different publishers. Batching
 *    shares one set of searches across 5 questions to fit the spend cap.
 *  - Range: a separate Claude call proposes max_change WITHOUT seeing the end value,
 *    so where the answer sits on the slider leaks nothing. Code then raises it only
 *    if the range rules (lib/range.ts) need more room.
 *
 * Generators return Candidates; the checks (checks.ts) decide verified vs flagged.
 */
import { z } from "zod";
import { RANGE } from "../config";
import { FORMATS, formatValue, type Format } from "../format";
import { rangeProblems } from "../range";
import { CATALOG, type CatalogEntry } from "./catalog";
import type { Llm } from "./llm";
import { roundForStorage } from "./questions";
import { fetchOwid, fetchWorldBank, valueAt, type FetchLike, type Series } from "./sources";

export interface Candidate {
  origin: "data" | "researched";
  category: string;
  prompt: string;
  start_year: number;
  start_value: number;
  end_year: number;
  end_value: number;
  format: Format;
  fact: string;
  source_name: string;
  source_url: string;
  source_url_2: string | null;
  /** Data-backed provenance (dataset, series, entity, fetched values). */
  source_data: Record<string, unknown> | null;
  max_change: number | null;
}

export interface GenContext {
  llm: Llm;
  runId?: number | null;
  fetchFn?: FetchLike;
  now?: Date;
  rand?: () => number;
}

/** Menu of slider ranges: round numbers keep the end labels readable (÷8 … ×8). */
export const MAX_CHANGE_MENU = [1.05, 1.1, 1.2, 1.3, 1.5, 2, 3, 4, 5, 8, 10, 20, 30, 50, 100, 200, 500, 1000] as const;

const START_YEARS = [1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015];
const MIN_GAP_YEARS = 10;
const MAX_DATA_AGE_YEARS = 5;

// ---------------------------------------------------------------------------------- data-backed

export interface YearPick {
  start_year: number;
  start_value: number;
  end_year: number;
  end_value: number;
}

/**
 * Two years from a series: the latest year (not older than MAX_DATA_AGE_YEARS) and
 * a round start year at least MIN_GAP_YEARS earlier whose change fits the slider's
 * widest range. Null when the series can't make a fair question.
 */
export function pickYears(s: Series, entry: CatalogEntry, now: Date, rand: () => number): YearPick | null {
  const last = s.points.at(-1);
  if (!last || last.year < now.getUTCFullYear() - MAX_DATA_AGE_YEARS) return null;
  const end_value = roundForStorage(last.value, entry.format);
  const options: YearPick[] = [];
  for (const y of START_YEARS) {
    if (y < (entry.minYear ?? 0) || last.year - y < MIN_GAP_YEARS) continue;
    const v = valueAt(s, y);
    if (v === null) continue;
    const start_value = roundForStorage(v, entry.format);
    if (!(start_value > 0 && end_value > 0)) continue;
    const a = Math.abs(Math.log10(end_value / start_value));
    if (a > RANGE.MAX_ANSWER_FRACTION * Math.log10(RANGE.MAX_FACTOR)) continue;
    options.push({ start_year: y, start_value, end_year: last.year, end_value });
  }
  return options.length ? options[Math.floor(rand() * options.length)]! : null;
}

const Wording = z.object({
  prompt: z.string().describe("The question text shown to players (no years, no values)."),
  fact: z.string().describe("One fun, true sentence shown after the answer is revealed."),
});

const WORDING_SYSTEM = `You write questions for Changel, a daily game. Each round shows a real number from the past and asks players how many times bigger or smaller it is now. You get a measure and its two values from a trusted dataset. Write:
- prompt: a short noun phrase naming exactly what is measured, its units and its scope (worldwide), under 80 characters. Sentence case. No years, no numbers from the data, no question mark. Money must say "nominal" or "inflation-adjusted" as given. Examples: "World population", "Price of a solar panel, per watt (inflation-adjusted)", "Share of the world's electricity from wind".
- fact: one surprising, accurate sentence (max 140 characters) that can be checked against the two values and years given. Don't invent other numbers.
Plain, friendly English. No emoji.`;

async function fetchSeries(entry: CatalogEntry, fetchFn?: FetchLike): Promise<Series> {
  return entry.source === "worldbank" ? fetchWorldBank(entry.id, entry.entity, fetchFn) : fetchOwid(entry.id, entry.entity, fetchFn);
}

/** Catalog entries not yet used by any question (duplicate key: source + id + entity). */
export function unusedEntries(usedKeys: ReadonlySet<string>): CatalogEntry[] {
  return CATALOG.filter((e) => !usedKeys.has(seriesKey(e)));
}

export const seriesKey = (e: { source: string; id: string; entity: string }) => `${e.source}:${e.id}:${e.entity}`;

export async function generateDataBacked(entry: CatalogEntry, ctx: GenContext): Promise<Candidate | null> {
  const now = ctx.now ?? new Date();
  const series = await fetchSeries(entry, ctx.fetchFn);
  const pick = pickYears(series, entry, now, ctx.rand ?? Math.random);
  if (!pick) return null;
  const w = await ctx.llm.json({
    purpose: "wording",
    tier: "fast",
    runId: ctx.runId,
    system: WORDING_SYSTEM,
    prompt: [
      `Measure: ${entry.measure}`,
      `Dataset's own name: ${series.label}${series.unit ? ` (unit: ${series.unit})` : ""}`,
      entry.money ? `Money: ${entry.money}` : null,
      `Category: ${entry.category}`,
      `${pick.start_year}: ${formatValue(pick.start_value, entry.format)}`,
      `${pick.end_year}: ${formatValue(pick.end_value, entry.format)}`,
      `Source: ${series.publisher}`,
    ]
      .filter(Boolean)
      .join("\n"),
    schema: Wording,
  });
  return {
    origin: "data",
    category: entry.category,
    prompt: w.prompt.trim(),
    ...pick,
    format: entry.format,
    fact: w.fact.trim(),
    source_name: series.publisher,
    source_url: series.url,
    source_url_2: null,
    source_data: {
      key: seriesKey(entry),
      source: entry.source,
      id: entry.id,
      entity: entry.entity,
      label: series.label,
      unit: series.unit,
      citation: series.citation,
      money: entry.money ?? null,
      fetched_at: now.toISOString(),
      values: { [pick.start_year]: valueAt(series, pick.start_year), [pick.end_year]: valueAt(series, pick.end_year) },
    },
    max_change: null,
  };
}

// ---------------------------------------------------------------------------------- researched

const ResearchedQ = z.object({
  category: z.string(),
  prompt: z.string(),
  start_year: z.number().int(),
  start_value: z.number(),
  end_year: z.number().int(),
  end_value: z.number(),
  format: z.enum(FORMATS),
  fact: z.string(),
  source_name: z.string().describe("Publisher of source_url, e.g. 'International Energy Agency'."),
  source_url: z.string().describe("Page that states both values (or the end value)."),
  source_url_2: z.string().describe("Page from a DIFFERENT publisher that confirms at least one value."),
});
const ResearchedBatch = z.object({ questions: z.array(ResearchedQ) });

const RESEARCH_SYSTEM = `You research questions for Changel, a daily game played worldwide. Each round shows a real number from the past (e.g. Netflix subscribers in 2014) and players guess how many times bigger or smaller it is now.
Rules for every question:
- Globally interesting: a worldwide total, a famous company, product, record, place or phenomenon. No country-specific politics, no local trivia.
- Both values must be real, published figures for the SAME measure in the same units, found with web search. Use the most recent year with a reliable figure as end_year (within the last 4 years); start_year at least 10 years earlier.
- Two sources from different publishers (different websites), each stating the figure(s). Prefer primary sources (company reports, statistics offices, international agencies, record bodies).
- prompt: a short noun phrase naming exactly what is measured, units and scope, under 80 characters, no years or values. Money must say "nominal" or "inflation-adjusted".
- fact: one surprising, accurate sentence, max 140 characters, supported by your sources.
- format: big (large counts or decimals), int (whole counts), usd, sec (seconds), m (metres), yrs (years of age or life), time (durations in seconds shown h:mm:ss), pct (percentages).
- Values above zero; changes between ÷300 and ×300. Mix ups, downs and near-unchanged values.
- Never: death tolls, disasters, wars, crimes, living private individuals, active political controversies, anything that could shame a group.
- Don't repeat topics from the "Already used" list.`;

/** Kinds the schedule is short of: near-unchanged "traps" and big movers (beyond ×10 / ÷10). */
export interface KindsHint {
  traps: number;
  movers: number;
}

export async function generateResearchedBatch(ctx: GenContext & { count: number; categories: string[]; avoid: string[]; kinds?: KindsHint }): Promise<Candidate[]> {
  const kinds = [
    ctx.kinds?.traps ? `At least ${ctx.kinds.traps} must be nearly unchanged: within about ±25% between the two years.` : null,
    ctx.kinds?.movers ? `At least ${ctx.kinds.movers} must have changed a lot: more than ×10 or less than ÷10.` : null,
  ].filter(Boolean);
  const out = await ctx.llm.json({
    purpose: "draft",
    tier: "strong",
    runId: ctx.runId,
    webSearches: 8,
    system: RESEARCH_SYSTEM,
    prompt: [
      `Research ${ctx.count} new questions.`,
      `Spread them across these categories: ${ctx.categories.join(", ")}.`,
      ...kinds,
      `Today is ${(ctx.now ?? new Date()).toISOString().slice(0, 10)}.`,
      `Already used (avoid these topics):\n${ctx.avoid.slice(0, 300).map((p) => `- ${p}`).join("\n") || "- (none)"}`,
    ].join("\n\n"),
    schema: ResearchedBatch,
  });
  return out.questions.slice(0, ctx.count).map((q) => ({
    origin: "researched" as const,
    category: q.category.trim(),
    prompt: q.prompt.trim(),
    start_year: q.start_year,
    start_value: roundForStorage(q.start_value, q.format),
    end_year: q.end_year,
    end_value: roundForStorage(q.end_value, q.format),
    format: q.format,
    fact: q.fact.trim(),
    source_name: q.source_name.trim(),
    source_url: q.source_url.trim(),
    source_url_2: q.source_url_2.trim() || null,
    source_data: null,
    max_change: null,
  }));
}

// ---------------------------------------------------------------------------------- blind range

const RangeChoice = z.object({
  max_change: z.enum(MAX_CHANGE_MENU.map(String) as [string, ...string[]]),
  why: z.string(),
});

const RANGE_SYSTEM = `You set the slider range for a Changel question. Players see a number from a past year and guess how many times bigger or smaller it is in a later year, on a slider from ÷k to ×k. Pick k: the biggest change, up OR down, that a well-informed person would consider plausible for this measure over this period. Not the likely answer: the edge of plausibility. Physical limits matter (a share can't exceed 100%, a sprint record barely moves); fast-growing tech can move ×1000. Choose k from the menu.`;

/** Smallest menu value at or above `k` (or the largest menu value). */
export function snapUp(k: number): number {
  return MAX_CHANGE_MENU.find((m) => m >= k - 1e-12) ?? MAX_CHANGE_MENU.at(-1)!;
}

/**
 * Proposes max_change from the prompt, category, years and START value only.
 * If the real answer then sits too close to the end (range rules), k is raised
 * along the menu until it fits.
 */
export async function proposeMaxChange(c: Candidate, ctx: GenContext): Promise<number> {
  const r = await ctx.llm.json({
    purpose: "max_change",
    tier: "fast",
    runId: ctx.runId,
    system: RANGE_SYSTEM,
    prompt: [`Question: ${c.prompt}`, `Category: ${c.category}`, `In ${c.start_year}: ${formatValue(c.start_value, c.format)}`, `Players guess the change by ${c.end_year}.`, `Menu: ${MAX_CHANGE_MENU.join(", ")}`].join("\n"),
    schema: RangeChoice,
  });
  return fitMaxChange(Number(r.max_change), c.start_value, c.end_value);
}

/** Raise k along the menu until the range rules pass (never lowers it). */
export function fitMaxChange(k: number, start: number, end: number): number {
  let i = Math.max(0, MAX_CHANGE_MENU.indexOf(snapUp(k) as (typeof MAX_CHANGE_MENU)[number]));
  while (i < MAX_CHANGE_MENU.length - 1 && rangeProblems(start, end, MAX_CHANGE_MENU[i]).length) i++;
  return MAX_CHANGE_MENU[i]!;
}

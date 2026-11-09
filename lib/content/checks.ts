/**
 * Automatic checks (SPEC §8 table, M5 task 5.4). A candidate goes live only if
 * every check passes; any failure flags it with the reason, and a flagged
 * question is never published without a human.
 *
 * Order keeps cost down: free code checks first (a failure skips the paid ones),
 * then the duplicate check, one combined Sonnet review (like-for-like, topic
 * safety, fact quality), source support for researched questions, and finally
 * the independent cross-check: Opus with web search, batched, never shown the values.
 */
import { z } from "zod";
import { formatValue } from "../format";
import { rangeProblems } from "../range";
import type { Candidate } from "./generate";
import { LlmUnusable, SpendCapReached, type Llm } from "./llm";
import type { FetchLike } from "./sources";

export type CheckName = "sanity" | "range" | "duplicate" | "like_for_like" | "safety" | "fact_quality" | "source_support" | "cross_check";

export interface CheckResult {
  pass: boolean;
  detail: string;
  /** Quotes, estimates or matches backing the verdict (audit trail). */
  evidence?: unknown;
}

export interface CheckReport {
  version: 1;
  ran_at: string;
  passed: boolean;
  results: Partial<Record<CheckName, CheckResult>>;
}

export interface CheckDeps {
  llm: Llm;
  runId?: number | null;
  fetchFn?: FetchLike;
  now?: Date;
  /** Existing questions with a prompt similar to this one (trigram > threshold). */
  similarPrompts(prompt: string, excludeId?: number | null): Promise<Array<{ id: number; prompt: string; similarity: number }>>;
  /** Whether another question already uses this data-backed series key. */
  seriesUsed(key: string, excludeId?: number | null): Promise<boolean>;
}

export const CROSS_CHECK_TOLERANCE = 0.15;
export const DUPLICATE_SIMILARITY = 0.6;
export const FACT_MAX_CHARS = 140;
const CROSS_CHECK_BATCH = 5;

/** Topics the game avoids (SPEC §8 topic safety). Whole words, case-insensitive; the model check catches the rest. */
const BLOCKLIST = /\b(deaths?|died|dead|killed|killings?|fatalit(y|ies)|casualt(y|ies)|murders?|homicides?|suicides?|genocide|massacres?|terroris[mt]s?|war|wars|bombings?|shootings?|earthquakes?|tsunamis?|famine|epidemic deaths|overdoses?|abortions?|executions?)\b/i;

const KEEP_PRECISION = new Set(["sec", "time", "yrs"]);
const sigFigs = (v: number) => {
  const s = Math.abs(v).toExponential(12).split("e")[0]!.replace(".", "").replace(/0+$/, "");
  return Math.max(1, s.length);
};
const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};
/** Registrable-ish domain: last two labels (three for common second-level suffixes like co.uk). */
const siteOf = (url: string | null) => {
  const h = hostOf(url);
  if (!h) return null;
  const parts = h.split(".");
  const n = parts.length >= 3 && /^(co|com|org|gov|ac|net|edu)$/.test(parts.at(-2)!) ? 3 : 2;
  return parts.slice(-n).join(".");
};

// ---------------------------------------------------------------------------------- code checks

export function sanityCheck(c: Candidate, now = new Date()): CheckResult {
  const problems: string[] = [];
  if (!(c.start_value > 0) || !(c.end_value > 0)) problems.push("values must be > 0");
  if (!(c.end_year > c.start_year)) problems.push("end year must be after start year");
  if (c.end_year > now.getUTCFullYear()) problems.push("end year is in the future");
  if (c.start_value > 0 && c.end_value > 0 && Math.abs(Math.log10(c.end_value / c.start_value)) > 3) problems.push("change outside ÷1000 to ×1000");
  if (!KEEP_PRECISION.has(c.format) && (sigFigs(c.start_value) > 3 || sigFigs(c.end_value) > 3)) problems.push("more than 3 significant figures");
  if (c.prompt.length < 3 || c.prompt.length > 120) problems.push("prompt length must be 3–120 characters");
  if (/\b(19|20)\d{2}\b/.test(c.prompt)) problems.push("prompt mentions a year");
  if (!c.category || c.category.length > 40) problems.push("category missing or too long");
  if (!/^https?:\/\/\S+$/.test(c.source_url)) problems.push("source URL missing or not http(s)");
  if (c.origin === "researched") {
    if (!c.source_url_2 || !/^https?:\/\/\S+$/.test(c.source_url_2)) problems.push("researched questions need a second source URL");
    else if (siteOf(c.source_url) === siteOf(c.source_url_2)) problems.push("the two sources must be from different publishers");
  }
  if (c.format === "usd" && !/\b(nominal|inflation[- ]adjusted|constant|real terms)\b/i.test(c.prompt)) problems.push("money prompt must say nominal or inflation-adjusted");
  return problems.length ? { pass: false, detail: problems.join("; ") } : { pass: true, detail: "ok" };
}

export function rangeCheck(c: Candidate): CheckResult {
  const p = rangeProblems(c.start_value, c.end_value, c.max_change);
  return p.length ? { pass: false, detail: p.join("; ") } : { pass: true, detail: `÷${c.max_change} … ×${c.max_change}` };
}

export function blocklistHit(c: Candidate): string | null {
  const m = `${c.prompt} ${c.fact}`.match(BLOCKLIST);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------------- page text for source support

/** Readable text from an HTML page (scripts, styles and tags removed, entities decoded). */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Leading digits of a value as it might be written ("85", "38.3", "2,4"), for finding the right passages. */
function digitHints(v: number): string[] {
  const out = new Set<string>();
  for (const scale of [1, 1e3, 1e6, 1e9, 1e12]) {
    const x = v / scale;
    if (x >= 1 && x < 100000) {
      out.add(String(Number(x.toPrecision(3))));
      out.add(String(Number(x.toPrecision(2))));
      const whole = Math.round(x).toLocaleString("en-US");
      out.add(whole);
      // Stored values are rounded to 3 s.f., so 1,864 on the page is stored as 1,860: match "1,86".
      if (/^\d{1,3},\d{3}$/.test(whole) && whole.endsWith("0")) out.add(whole.replace(/0+$/, ""));
    }
  }
  return [...out].filter((h) => h.replace(/\D/g, "").length >= 2);
}

/** Passages around the years and values, capped so a source check stays cheap. */
export function relevantPassages(text: string, c: Candidate, maxChars = 12_000): string {
  const needles = [String(c.start_year), String(c.end_year), ...digitHints(c.start_value), ...digitHints(c.end_value)];
  const chunks = text.split(/\n/).flatMap((line) => (line.length > 600 ? line.match(/[\s\S]{1,600}/g)! : [line]));
  const hits: string[] = [];
  let size = 0;
  for (let i = 0; i < chunks.length && size < maxChars; i++) {
    if (needles.some((n) => chunks[i]!.includes(n))) {
      const piece = [chunks[i - 1], chunks[i], chunks[i + 1]].filter(Boolean).join("\n");
      hits.push(piece);
      size += piece.length;
    }
  }
  return hits.join("\n…\n").slice(0, maxChars);
}

async function fetchPage(url: string, fetchFn: FetchLike): Promise<string | null> {
  try {
    const res = await fetchFn(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; changel-content-checks)", accept: "text/html,text/plain,*/*" },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // PDFs etc. aren't read in v1. Data files (.csv/.txt) are often served as octet-stream.
    const dataFile = /\.(csv|txt|tsv)(\?|$)/i.test(new URL(res.url || url).pathname) && /octet-stream/.test(type);
    if (!/text|html|json|xml/.test(type) && type && !dataFile) return null;
    const body = (await res.text()).slice(0, 3_000_000);
    return type.includes("html") || /<html|<body/i.test(body) ? pageText(body) : body;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------- model checks

/** Reason first, so the model reasons before it commits to a verdict. */
const Verdict = z.object({ reason: z.string(), pass: z.boolean() });
const Review = z.object({ like_for_like: Verdict, safety: Verdict, fact: Verdict });

const REVIEW_SYSTEM = `You review a trivia question for Changel before it goes live. Players see a number from a past year and guess how many times bigger or smaller it is in a later year. The two numbers are verified separately against the sources and by an independent lookup, so don't re-judge whether they are exact. Judge three things:
1. like_for_like (strict; when unsure, fail): both values measure the same thing, in the same units and scope, so the change is meaningful. Money must state nominal or inflation-adjusted, consistently. Fail if the prompt is ambiguous about scope (e.g. which stores, which kind of count).
2. safety (strict): no death tolls, disasters, wars, crimes, tragedies, living private individuals, or anything demeaning to a group, and no question or fact that takes a side in a live political dispute (elections, parties, culture-war topics). Neutral, widely published measurements are fine even when the topic is debated: CO₂ levels, temperatures, wages, prices, populations, tax rates.
3. fact: under ${FACT_MAX_CHARS} characters, consistent with the question's values and years (it must not contradict them or swap in a different measure), not misleading (no implied cause or claim the record doesn't support), and true to the best of your knowledge. Fail it if you believe it is false or misleading, or it's an unsupported superlative ("fastest ever"). Don't fail a plausible, widely reported fact only because you can't confirm a small detail. Statements true as of today ("still the record") are fine.
   - Origin "researched": the fact may add other true, well-documented information (e.g. "Nobody has joined since").
   - Origin "data-backed": the fact may only use the two values and years given, plus simple arithmetic on them.`;

/** Quotes first, so the verdict follows from what the page actually says. */
const SourceVerdict = z.object({
  start_quote: z.string().describe("Exact sentence or table cell from the page stating the start value, or empty."),
  start_supported: z.boolean(),
  end_quote: z.string().describe("Exact sentence or table cell from the page stating the end value, or empty."),
  end_supported: z.boolean(),
});

const SOURCE_SYSTEM = `You check whether a web page supports a number. You get extracted text from the page. A value is supported only if the page itself states it (allowing rounding to 3 significant figures and different notation like "85 million" for 85,000,000) for the same measure and the same year. Quote the exact sentence or table cell. If the page doesn't state it, say false with an empty quote. Never use outside knowledge.`;

const SameMeasure = z.object({ duplicate_of: z.number().int().nullable(), reason: z.string() });

const CrossEstimate = z.object({
  estimates: z.array(
    z.object({
      id: z.number().int(),
      start_estimate: z.number().nullable(),
      end_estimate: z.number().nullable(),
      note: z.string(),
    }),
  ),
});

const CROSS_SYSTEM = `You independently estimate figures for trivia questions, using web search. For each question you get what is measured and two years. Find the best published value for each year yourself, in the units the question implies. Give plain numbers (e.g. 85000000, not "85M"). If you can't find a reliable figure, return null. Don't guess wildly.`;

const relDiff = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

// ---------------------------------------------------------------------------------- orchestration

export interface CheckTarget {
  /** Question id once inserted (for the ledger and to exclude itself from duplicates). */
  id: number | null;
  candidate: Candidate;
}

function report(results: Partial<Record<CheckName, CheckResult>>, now: Date): CheckReport {
  return { version: 1, ran_at: now.toISOString(), passed: Object.values(results).every((r) => r!.pass), results };
}

/** First failing check's summary, for questions.flag_reason. */
export function flagReason(r: CheckReport): string | null {
  const failed = Object.entries(r.results).filter(([, v]) => !v!.pass);
  return failed.length ? failed.map(([k, v]) => `${k}: ${v!.detail}`).join(" | ").slice(0, 500) : null;
}

/**
 * Runs every check on a batch. Returns one report per target, same order.
 * SpendCapReached propagates (the run stops and resumes next month or after the cap is raised);
 * an unusable model answer fails just that check.
 */
export async function checkBatch(targets: CheckTarget[], deps: CheckDeps): Promise<CheckReport[]> {
  const now = deps.now ?? new Date();
  const fetchFn = deps.fetchFn ?? fetch;
  const results = targets.map(() => ({}) as Partial<Record<CheckName, CheckResult>>);
  const alive = (i: number) => Object.values(results[i]!).every((r) => r!.pass);
  const guard = async (i: number, name: CheckName, fn: () => Promise<CheckResult>) => {
    try {
      results[i]![name] = await fn();
    } catch (e) {
      if (e instanceof SpendCapReached) throw e;
      results[i]![name] = { pass: false, detail: e instanceof LlmUnusable ? e.message : `check failed to run: ${(e as Error).message}` };
    }
  };

  // 1. Free code checks.
  targets.forEach((t, i) => {
    const c = t.candidate;
    results[i]!.sanity = sanityCheck(c, now);
    results[i]!.range = rangeCheck(c);
    const hit = blocklistHit(c);
    if (hit) results[i]!.safety = { pass: false, detail: `blocklisted topic word "${hit}"` };
    if (c.fact.length > FACT_MAX_CHARS) results[i]!.fact_quality = { pass: false, detail: `fact is ${c.fact.length} characters (max ${FACT_MAX_CHARS})` };
  });

  // 2. Duplicates, 3. combined review, 4. source support: per candidate, only while it's still passing.
  for (let i = 0; i < targets.length; i++) {
    const { id, candidate: c } = targets[i]!;
    if (!alive(i)) continue;

    await guard(i, "duplicate", async () => {
      const key = (c.source_data?.key as string | undefined) ?? null;
      if (key && (await deps.seriesUsed(key, id))) return { pass: false, detail: `dataset series ${key} is already used` };
      const similar = (await deps.similarPrompts(c.prompt, id)).filter((s) => s.similarity > DUPLICATE_SIMILARITY);
      if (!similar.length) return { pass: true, detail: "no similar prompts" };
      const v = await deps.llm.json({
        purpose: "duplicate",
        tier: "fast",
        runId: deps.runId,
        questionId: id,
        system: "You decide whether a new trivia question measures the same thing as an existing one (same quantity and scope, ignoring wording). Different quantities that sound alike (solar vs wind share, wheat vs rice yield) are NOT duplicates.",
        prompt: `New: "${c.prompt}" (${c.start_year} → ${c.end_year})\nExisting:\n${similar.map((s) => `- id ${s.id}: "${s.prompt}"`).join("\n")}\nReturn duplicate_of = the id it duplicates, or null.`,
        schema: SameMeasure,
      });
      return v.duplicate_of === null
        ? { pass: true, detail: `similar wording, different measure (${v.reason})`, evidence: similar }
        : { pass: false, detail: `same measure as question ${v.duplicate_of}`, evidence: { similar, reason: v.reason } };
    });
    if (!alive(i)) continue;

    try {
      const r = await deps.llm.json({
        purpose: "review",
        tier: "fast",
        runId: deps.runId,
        questionId: id,
        system: REVIEW_SYSTEM,
        prompt: [
          `Question: ${c.prompt}`,
          `Category: ${c.category}`,
          `${c.start_year}: ${formatValue(c.start_value, c.format)} (${c.start_value})`,
          `${c.end_year}: ${formatValue(c.end_value, c.format)} (${c.end_value})`,
          `Fact: ${c.fact}`,
          `Origin: ${c.origin === "data" ? `data-backed (${(c.source_data?.citation as string) ?? c.source_name})` : "researched"}`,
          c.source_data?.label ? `Dataset measure: ${String(c.source_data.label)}${c.source_data.unit ? ` [${String(c.source_data.unit)}]` : ""}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        schema: Review,
      });
      results[i]!.like_for_like = { pass: r.like_for_like.pass, detail: r.like_for_like.reason };
      results[i]!.safety = { pass: r.safety.pass, detail: r.safety.reason };
      results[i]!.fact_quality = { pass: r.fact.pass, detail: r.fact.reason };
    } catch (e) {
      if (e instanceof SpendCapReached) throw e;
      results[i]!.like_for_like = { pass: false, detail: (e as Error).message };
    }
    if (!alive(i)) continue;

    await guard(i, "source_support", async () => {
      if (c.origin === "data") return { pass: true, detail: `values read from ${c.source_name} (${String(c.source_data?.key)})`, evidence: c.source_data?.values };
      const pages: Array<{ url: string; verdict: z.infer<typeof SourceVerdict> | null; error?: string }> = [];
      for (const url of [c.source_url, c.source_url_2].filter((u): u is string => !!u)) {
        const text = await fetchPage(url, fetchFn);
        const passages = text ? relevantPassages(text, c) : "";
        if (!passages) {
          pages.push({ url, verdict: null, error: text ? "no passage mentions these years or values" : "page could not be fetched" });
          continue;
        }
        const verdict = await deps.llm.json({
          purpose: "source_support",
          tier: "fast",
          runId: deps.runId,
          questionId: id,
          system: SOURCE_SYSTEM,
          prompt: `Measure: ${c.prompt}\nStart: ${c.start_value} in ${c.start_year}\nEnd: ${c.end_value} in ${c.end_year}\n\nPage ${url}:\n"""\n${passages}\n"""`,
          schema: SourceVerdict,
        });
        pages.push({ url, verdict });
      }
      const startOk = pages.some((p) => p.verdict?.start_supported && p.verdict.start_quote.trim());
      const endOk = pages.some((p) => p.verdict?.end_supported && p.verdict.end_quote.trim());
      const missing = [!startOk && `${c.start_year} value`, !endOk && `${c.end_year} value`].filter(Boolean);
      return missing.length
        ? { pass: false, detail: `no source supports the ${missing.join(" or the ")}`, evidence: pages }
        : { pass: true, detail: "both values quoted from a source", evidence: pages };
    });
  }

  // 5. Independent cross-check, batched; never shown the values.
  const pending = targets.map((t, i) => ({ t, i })).filter(({ i }) => alive(i));
  for (let b = 0; b < pending.length; b += CROSS_CHECK_BATCH) {
    const batch = pending.slice(b, b + CROSS_CHECK_BATCH);
    try {
      const out = await deps.llm.json({
        purpose: "cross_check",
        tier: "strong",
        runId: deps.runId,
        webSearches: Math.min(10, batch.length * 2),
        system: CROSS_SYSTEM,
        prompt: batch.map(({ t }, k) => `id ${k}: ${t.candidate.prompt} — value in ${t.candidate.start_year} and in ${t.candidate.end_year}`).join("\n"),
        schema: CrossEstimate,
      });
      batch.forEach(({ t, i }, k) => {
        const est = out.estimates.find((e) => e.id === k);
        const c = t.candidate;
        if (!est || est.start_estimate === null || est.end_estimate === null) {
          results[i]!.cross_check = { pass: false, detail: "independent research found no figure for one of the years", evidence: est ?? null };
          return;
        }
        const ds = relDiff(est.start_estimate, c.start_value);
        const de = relDiff(est.end_estimate, c.end_value);
        const pct = (x: number) => `${Math.round(x * 100)}%`;
        results[i]!.cross_check =
          ds <= CROSS_CHECK_TOLERANCE && de <= CROSS_CHECK_TOLERANCE
            ? { pass: true, detail: `independent estimates within ${pct(Math.max(ds, de))}`, evidence: est }
            : { pass: false, detail: `independent estimate differs: ${c.start_year} by ${pct(ds)}, ${c.end_year} by ${pct(de)} (max ${pct(CROSS_CHECK_TOLERANCE)})`, evidence: est };
      });
    } catch (e) {
      if (e instanceof SpendCapReached) throw e;
      for (const { i } of batch) results[i]!.cross_check = { pass: false, detail: (e as Error).message };
    }
  }

  return results.map((r) => report(r, now));
}

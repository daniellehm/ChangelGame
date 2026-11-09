/**
 * Claude for the content pipeline (M5 task 5.2). Every call:
 *  - refuses to start once the month's spend reaches CONTENT.MONTHLY_CAP_USD,
 *  - returns schema-validated JSON (structured outputs + Zod),
 *  - is priced and written to the llm_calls ledger (tokens, web searches, USD),
 *  - uses the server-side refusal fallback (`fallbacks: "default"`).
 * The pipeline depends on the small `Llm` interface, so tests use a fake.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { CONTENT } from "../config";

export type Tier = "strong" | "fast";

export type Purpose =
  | "draft"
  | "wording"
  | "max_change"
  | "source_support"
  | "cross_check"
  | "like_for_like"
  | "safety"
  | "fact_quality";

export interface LlmRequest<T> {
  purpose: Purpose;
  tier: Tier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Let Claude search the web (server tool), at most this many searches. */
  webSearches?: number;
  runId?: number | null;
  questionId?: number | null;
}

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  web_searches: number;
  cost_usd: number;
}

export interface Llm {
  json<T>(req: LlmRequest<T>): Promise<T>;
}

export interface LedgerEntry extends Usage {
  purpose: Purpose;
  run_id: number | null;
  question_id: number | null;
  ok: boolean;
}

/** Where spend is checked and recorded (the llm_calls table in production). */
export interface Ledger {
  monthSpendUsd(): Promise<number>;
  record(entry: LedgerEntry): Promise<void>;
}

export class SpendCapReached extends Error {
  constructor(public spent: number) {
    super(`Monthly Claude spend cap reached ($${spent.toFixed(2)} of $${CONTENT.MONTHLY_CAP_USD})`);
    this.name = "SpendCapReached";
  }
}

/** Claude declined (stop_reason "refusal"), ran out of room, or the output didn't match the schema. The candidate gets flagged. */
export class LlmUnusable extends Error {
  constructor(
    public reason: "refusal" | "unparseable" | "max_tokens",
    detail?: string,
  ) {
    super(`Claude response unusable: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "LlmUnusable";
  }
}

type Counts = Omit<Usage, "cost_usd" | "model">;

export function priceOf(model: string, u: Counts): number {
  // An unknown model (e.g. a new fallback target) is priced as the dearest one we know, so spend is never under-counted.
  const p = CONTENT.PRICES[model] ?? CONTENT.PRICES["claude-opus-5"]!;
  const tokens = (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_read_tokens * p.cacheRead + u.cache_write_tokens * p.cacheWrite) / 1e6;
  return Number((tokens + u.web_searches * CONTENT.WEB_SEARCH_USD).toFixed(5));
}

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Reply = Anthropic.Beta.Messages.BetaMessage & { parsed_output?: unknown };

/** The one SDK method the wrapper needs, so tests can stand in for it. */
export type ParseFn = (params: Params) => Promise<Reply>;

export function sdkParse(client = new Anthropic()): ParseFn {
  return (params) => client.beta.messages.parse(params) as Promise<Reply>;
}

export class ClaudeLlm implements Llm {
  constructor(
    private parse: ParseFn,
    private ledger: Ledger,
  ) {}

  async json<T>(req: LlmRequest<T>): Promise<T> {
    const spent = await this.ledger.monthSpendUsd();
    if (spent >= CONTENT.MONTHLY_CAP_USD) throw new SpendCapReached(spent);

    const model = CONTENT.MODELS[req.tier];
    const tools: Anthropic.Beta.Messages.BetaToolUnion[] | undefined = req.webSearches
      ? [{ type: "web_search_20260209", name: "web_search", max_uses: req.webSearches }]
      : undefined;
    const question: Anthropic.Beta.Messages.BetaMessageParam = { role: "user", content: req.prompt };
    let messages: Anthropic.Beta.Messages.BetaMessageParam[] = [question];
    const total: Counts = { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, web_searches: 0 };
    let servedBy: string = model;
    let ok = false;

    try {
      for (let turn = 0; ; turn++) {
        const res = await this.parse({
          model,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: req.system,
          messages,
          ...(tools ? { tools } : {}),
          output_config: { effort: CONTENT.EFFORT[req.tier], format: betaZodOutputFormat(req.schema) },
        } as Params);

        servedBy = res.model ?? model;
        total.input_tokens += res.usage.input_tokens ?? 0;
        total.output_tokens += res.usage.output_tokens ?? 0;
        total.cache_read_tokens += res.usage.cache_read_input_tokens ?? 0;
        total.cache_write_tokens += res.usage.cache_creation_input_tokens ?? 0;
        total.web_searches += res.usage.server_tool_use?.web_search_requests ?? 0;

        if (res.stop_reason === "pause_turn" && turn < CONTENT.MAX_CONTINUATIONS) {
          // The server-tool loop paused: send its content back and it resumes (no extra user message).
          messages = [question, { role: "assistant", content: res.content }];
          continue;
        }
        if (res.stop_reason === "refusal") throw new LlmUnusable("refusal", res.stop_details?.category ?? undefined);
        if (res.stop_reason === "max_tokens") throw new LlmUnusable("max_tokens");
        const parsed = req.schema.safeParse(res.parsed_output);
        if (!parsed.success) throw new LlmUnusable("unparseable", parsed.error.issues[0]?.message);
        ok = true;
        return parsed.data;
      }
    } finally {
      await this.ledger.record({
        model: servedBy,
        ...total,
        cost_usd: priceOf(servedBy, total),
        purpose: req.purpose,
        run_id: req.runId ?? null,
        question_id: req.questionId ?? null,
        ok,
      });
    }
  }
}

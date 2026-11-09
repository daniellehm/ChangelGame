import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CONTENT } from "@/lib/config";
import { ClaudeLlm, LlmUnusable, priceOf, SpendCapReached, type Ledger, type LedgerEntry, type ParseFn } from "@/lib/content/llm";
import { monthStartUtc } from "@/lib/content/ledger";

const Answer = z.object({ value: z.number() });

function memoryLedger(spent = 0) {
  const rows: LedgerEntry[] = [];
  const ledger: Ledger = { monthSpendUsd: async () => spent, record: async (e) => void rows.push(e) };
  return { ledger, rows };
}

type Reply = Awaited<ReturnType<ParseFn>>;
const reply = (over: Partial<Reply> & { parsed_output?: unknown }): Reply =>
  ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [],
    stop_reason: "end_turn",
    stop_details: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 2 } },
    ...over,
  }) as unknown as Reply;

const req = { purpose: "cross_check" as const, tier: "strong" as const, system: "s", prompt: "p", schema: Answer, webSearches: 3, runId: 7 };

describe("priceOf", () => {
  it("prices Opus 5.5 and Sonnet 5.5 at list price, plus $10 per 1,000 searches", () => {
    const u = { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_tokens: 0, cache_write_tokens: 0, web_searches: 10 };
    expect(priceOf("claude-opus-5-5", u)).toBeCloseTo(4 + 2 + 0.1, 5);
    expect(priceOf("claude-sonnet-5-5", u)).toBeCloseTo(2 + 1 + 0.1, 5);
  });
  it("prices an unknown model as the dearest known one, never as free", () => {
    const u = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, web_searches: 0 };
    expect(priceOf("claude-something-new", u)).toBe(5);
  });
});

describe("ClaudeLlm", () => {
  it("returns parsed JSON and records tokens, searches and cost in the ledger", async () => {
    const { ledger, rows } = memoryLedger();
    const sent: unknown[] = [];
    const parse: ParseFn = async (p) => (sent.push(p), reply({ parsed_output: { value: 42 } }));
    const out = await new ClaudeLlm(parse, ledger).json(req);
    expect(out).toEqual({ value: 42 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ purpose: "cross_check", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 200, web_searches: 2, run_id: 7, ok: true });
    expect(rows[0]!.cost_usd).toBeCloseTo((1000 * 4 + 200 * 20) / 1e6 + 0.02, 6);
    // The request: right model, fallback on, effort for the tier, web search capped.
    expect(sent[0]).toMatchObject({
      model: CONTENT.MODELS.strong,
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
    });
  });

  it("uses Sonnet at low effort with no tools for fast checks", async () => {
    const { ledger } = memoryLedger();
    let sent: Record<string, unknown> = {};
    const parse: ParseFn = async (p) => ((sent = p as never), reply({ model: "claude-sonnet-5-5", parsed_output: { value: 1 } }));
    await new ClaudeLlm(parse, ledger).json({ ...req, tier: "fast", webSearches: undefined });
    expect(sent.model).toBe("claude-sonnet-5-5");
    expect(sent).toMatchObject({ output_config: { effort: "low" } });
    expect(sent.tools).toBeUndefined();
  });

  it("refuses to call Claude once the month's spend reaches the cap", async () => {
    const { ledger, rows } = memoryLedger(CONTENT.MONTHLY_CAP_USD);
    let called = false;
    const parse: ParseFn = async () => ((called = true), reply({ parsed_output: { value: 1 } }));
    await expect(new ClaudeLlm(parse, ledger).json(req)).rejects.toBeInstanceOf(SpendCapReached);
    expect(called).toBe(false);
    expect(rows).toHaveLength(0);
  });

  it("resumes a paused server-tool turn and adds up usage across both requests", async () => {
    const { ledger, rows } = memoryLedger();
    const calls: Array<{ messages: unknown[] }> = [];
    const parse: ParseFn = async (p) => {
      calls.push(p as never);
      return calls.length === 1
        ? reply({ stop_reason: "pause_turn", content: [{ type: "text", text: "searching", citations: null }] as never })
        : reply({ parsed_output: { value: 3 } });
    };
    expect(await new ClaudeLlm(parse, ledger).json(req)).toEqual({ value: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.messages).toHaveLength(2); // question + paused assistant content, no "continue" message
    expect(rows[0]).toMatchObject({ input_tokens: 2000, web_searches: 4 });
  });

  it("treats a refusal, a truncated answer or bad JSON as unusable, and still records the spend", async () => {
    for (const [r, reason] of [
      [reply({ stop_reason: "refusal", stop_details: { type: "refusal", category: "general_harms", explanation: null } as never }), "refusal"],
      [reply({ stop_reason: "max_tokens" }), "max_tokens"],
      [reply({ parsed_output: { value: "not a number" } }), "unparseable"],
    ] as const) {
      const { ledger, rows } = memoryLedger();
      const err = await new ClaudeLlm(async () => r, ledger).json(req).catch((e) => e);
      expect(err).toBeInstanceOf(LlmUnusable);
      expect(err.reason).toBe(reason);
      expect(rows[0]).toMatchObject({ ok: false });
      expect(rows[0]!.cost_usd).toBeGreaterThan(0);
    }
  });

  it("prices a fallback by the model that actually answered", async () => {
    const { ledger, rows } = memoryLedger();
    await new ClaudeLlm(async () => reply({ model: "claude-opus-4-8", parsed_output: { value: 1 } }), ledger).json(req);
    expect(rows[0]!.model).toBe("claude-opus-4-8");
    expect(rows[0]!.cost_usd).toBeCloseTo((1000 * 5 + 200 * 25) / 1e6 + 0.02, 6);
  });
});

describe("monthStartUtc", () => {
  it("is midnight UTC on the 1st", () => {
    expect(monthStartUtc(new Date("2026-11-30T23:59:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(monthStartUtc(new Date("2027-01-01T00:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

/** M5 task 5.1: pipeline tables and functions against the real DB. Test rows use trigger 'test' and are removed after. */
import { afterAll, describe, expect, it } from "vitest";
import { adminClient } from "@/lib/supabase/admin";

const db = adminClient();
const runIds: number[] = [];

afterAll(async () => {
  if (runIds.length) {
    await db.from("llm_calls").delete().in("run_id", runIds);
    await db.from("content_runs").delete().in("id", runIds);
  }
});

async function newRun(): Promise<number> {
  const { data, error } = await db.from("content_runs").insert({ trigger: "test" }).select("id").single();
  if (error) throw error;
  runIds.push(data.id);
  return data.id;
}

describe("lease_content_run", () => {
  it("only one of two simultaneous hops gets the lease", async () => {
    const id = await newRun();
    const [a, b] = await Promise.all([
      db.rpc("lease_content_run", { p_run_id: id, p_seconds: 60 }),
      db.rpc("lease_content_run", { p_run_id: id, p_seconds: 60 }),
    ]);
    expect([a.data, b.data].filter(Boolean)).toHaveLength(1);
    const { data } = await db.from("content_runs").select("hops").eq("id", id).single();
    expect(data!.hops).toBe(1);
  });

  it("an expired lease can be taken again; a finished run can't be leased", async () => {
    const id = await newRun();
    expect((await db.rpc("lease_content_run", { p_run_id: id, p_seconds: 0 })).data).toBe(true);
    expect((await db.rpc("lease_content_run", { p_run_id: id, p_seconds: 60 })).data).toBe(true);
    await db.from("content_runs").update({ status: "done", lease_until: null }).eq("id", id);
    expect((await db.rpc("lease_content_run", { p_run_id: id, p_seconds: 60 })).data).toBe(false);
  });
});

describe("llm_spend_since", () => {
  it("sums the ledger from a moment on", async () => {
    const id = await newRun();
    const since = new Date(Date.now() - 1000).toISOString();
    const before = Number((await db.rpc("llm_spend_since", { p_since: since })).data);
    await db.from("llm_calls").insert([
      { run_id: id, purpose: "test", model: "test", cost_usd: 0.125 },
      { run_id: id, purpose: "test", model: "test", cost_usd: 0.0005 },
    ]);
    const after = Number((await db.rpc("llm_spend_since", { p_since: since })).data);
    expect(after - before).toBeCloseTo(0.1255, 5);
  });
});

describe("similar_questions (duplicate check)", () => {
  it("finds a near-identical prompt and ignores unrelated ones", async () => {
    const { data, error } = await db.rpc("similar_questions", { p_prompt: "Number of member states of the United Nations", p_min: 0.6 });
    expect(error).toBeNull();
    expect(data!.map((r: { prompt: string }) => r.prompt)).toContain("Member states of the United Nations");
    const none = await db.rpc("similar_questions", { p_prompt: "Average height of a giraffe in metres", p_min: 0.6 });
    expect(none.data).toEqual([]);
  });
});

describe("question pipeline columns", () => {
  it("seed questions are marked origin 'seed'", async () => {
    const { data } = await db.from("questions").select("origin").contains("tags", ["prototype"]);
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((q) => q.origin))).toEqual(new Set(["seed"]));
  });
});

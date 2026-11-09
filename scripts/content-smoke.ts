/**
 * Small paid smoke test of the real Claude + dataset path (about $0.25, logged in
 * llm_calls against the monthly cap). Writes nothing else to the database.
 *   npm run content:smoke
 */
import { CATALOG } from "../lib/content/catalog";
import { generateDataBacked, generateResearchedBatch, proposeMaxChange } from "../lib/content/generate";
import { dbLedger, monthStartUtc } from "../lib/content/ledger";
import { ClaudeLlm, sdkParse } from "../lib/content/llm";
import { adminClient } from "../lib/supabase/admin";

async function main() {
  const llm = new ClaudeLlm(sdkParse(), dbLedger());
  const since = new Date().toISOString();

  const entry = CATALOG.find((e) => e.id === "installed-solar-pv-capacity")!;
  const data = await generateDataBacked(entry, { llm });
  console.log("DATA-BACKED", JSON.stringify(data, null, 2));
  if (data) console.log("max_change →", await proposeMaxChange(data, { llm }));

  const batch = await generateResearchedBatch({ llm, count: 2, categories: ["Tech", "Sport"], avoid: [] });
  for (const q of batch) {
    console.log("RESEARCHED", JSON.stringify(q, null, 2));
    console.log("max_change →", await proposeMaxChange(q, { llm }));
  }

  const { data: calls } = await adminClient().from("llm_calls").select("purpose, model, input_tokens, output_tokens, web_searches, cost_usd, ok").gte("created_at", since).order("id");
  console.table(calls);
  const total = (calls ?? []).reduce((a, c) => a + Number(c.cost_usd), 0);
  console.log(`This run: $${total.toFixed(4)} · month to date: $${(await dbLedger().monthSpendUsd()).toFixed(4)} (since ${monthStartUtc().toISOString().slice(0, 10)})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Paid smoke test of the real checks (about $0.25, logged in llm_calls).
 * Acceptance (SPEC §12 M5): a planted wrong number is flagged.
 *   npm run content:check-smoke
 * Duplicate lookups are stubbed so the seed UN question doesn't short-circuit the run.
 */
import { checkBatch, flagReason } from "../lib/content/checks";
import type { Candidate } from "../lib/content/generate";
import { dbLedger } from "../lib/content/ledger";
import { ClaudeLlm, sdkParse } from "../lib/content/llm";

const un: Candidate = {
  origin: "researched",
  category: "Politics",
  prompt: "Member states of the United Nations",
  start_year: 1945,
  start_value: 51,
  end_year: 2011,
  end_value: 193,
  format: "int",
  fact: "South Sudan became the 193rd member in 2011. Nobody has joined since.",
  source_name: "United Nations",
  source_url: "https://www.un.org/en/about-us/growth-in-un-membership",
  source_url_2: "https://en.wikipedia.org/wiki/Member_states_of_the_United_Nations",
  source_data: null,
  max_change: 8,
};

const usOpen: Candidate = {
  origin: "researched",
  category: "Sport",
  prompt: "US Open tennis total prize money, nominal US dollars",
  start_year: 2014,
  start_value: 38300000,
  end_year: 2025,
  end_value: 85000000,
  format: "usd",
  fact: "In 2025 the US Open paid a record $5 million to each singles champion, and total player compensation reached $90 million.",
  source_name: "ESPN",
  source_url: "https://www.espn.com/tennis/story/_/id/45913673/us-open-prize-money-20-singles-champions-get-record-5m",
  source_url_2: "https://www.cnn.com/2014/07/10/sport/tennis/us-open-prize-money",
  source_data: null,
  max_change: 3,
};

async function main() {
  const llm = new ClaudeLlm(sdkParse(), dbLedger());
  const before = await dbLedger().monthSpendUsd();
  const targets = [
    { label: "UN members (correct)", candidate: un },
    { label: "UN members, PLANTED 293", candidate: { ...un, end_value: 293, max_change: 10 } },
    // Planted with a fact that agrees with it, so the review can't spot the mismatch and the sources + cross-check must.
    { label: "UN members, PLANTED 293 with a matching fact", candidate: { ...un, end_value: 293, max_change: 10, fact: "Membership has grown steadily since the founding." } },
    { label: "US Open prize money", candidate: usOpen },
  ];
  const reports = await checkBatch(
    targets.map((t) => ({ id: null, candidate: t.candidate })),
    { llm, similarPrompts: async () => [], seriesUsed: async () => false },
  );
  reports.forEach((r, i) => {
    console.log(`\n=== ${targets[i]!.label}: ${r.passed ? "VERIFIED" : "FLAGGED"}`);
    for (const [name, res] of Object.entries(r.results)) console.log(`  ${res!.pass ? "✓" : "✗"} ${name}: ${res!.detail}`);
    if (!r.passed) console.log(`  flag_reason: ${flagReason(r)}`);
  });
  console.log(`\nSpend this run: $${((await dbLedger().monthSpendUsd()) - before).toFixed(4)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

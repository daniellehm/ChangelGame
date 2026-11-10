/**
 * Game-page JavaScript budget (SPEC §11: "JS for the game page under 120 KB gzipped").
 * Runs after `next build`. Measures what the home page loads up front: Next/React's shared
 * runtime (rootMainFiles) plus the layout's and page's own chunks. Lazy chunks (Sentry,
 * Turnstile, share/analytics extras) aren't counted, because they only load when needed.
 *
 * The framework alone (Next 16 + React 19) is ~120 KB gzipped, so the SPEC's 120 KB can't
 * hold for the total. The gates are: our code ≤ APP_BUDGET, and the total ≤ TOTAL_BUDGET
 * (DECISIONS 2026-11-10 "JS budget"). Lighthouse mobile ≥ 95 is the acceptance measure.
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const APP_BUDGET_KB = 45;
const TOTAL_BUDGET_KB = 170;

const gz = (f) => gzipSync(readFileSync(`.next/${f}`), { level: 9 }).length / 1024;
const build = JSON.parse(readFileSync(".next/build-manifest.json", "utf8"));
const framework = [...new Set([...build.rootMainFiles])];
const manifest = readFileSync(".next/server/app/page_client-reference-manifest.js", "utf8");
const entry = JSON.parse(manifest.match(/"entryJSFiles":(\{[^}]*\})/)[1]);
const app = [...new Set([...(entry["[project]/app/layout"] ?? []), ...(entry["[project]/app/page"] ?? [])])].filter((f) => !framework.includes(f));

const fw = framework.reduce((a, f) => a + gz(f), 0);
const ours = app.reduce((a, f) => a + gz(f), 0);
const total = fw + ours;
const line = `framework ${fw.toFixed(1)} KB + game page ${ours.toFixed(1)} KB = ${total.toFixed(1)} KB gzipped`;
if (ours > APP_BUDGET_KB || total > TOTAL_BUDGET_KB) {
  console.error(`\n✖ JS budget exceeded: ${line} (limits: page ${APP_BUDGET_KB} KB, total ${TOTAL_BUDGET_KB} KB)\n`);
  process.exit(1);
}
console.log(`✓ JS budget: ${line} (limits: page ${APP_BUDGET_KB} KB, total ${TOTAL_BUDGET_KB} KB)`);
